import { describe, expect, it } from "vitest";
import { MAX_SIGNALS, SignalBusError, createSignalBus, type SignalDefinition } from "./signal-bus";

function busWith(...defs: SignalDefinition[]) {
  const bus = createSignalBus();
  for (const def of defs) bus.declare(def);
  return bus;
}

describe("signal bus", () => {
  it("declares signals with initial values", () => {
    const bus = busWith(
      { name: "motor.left.voltage", kind: "number", unit: "V", min: -12, max: 12 },
      { name: "led1.on", kind: "boolean" },
      { name: "sonar.distance", kind: "number", unit: "m", min: 0.02, max: 4, initial: 1 },
    );
    expect(bus.names()).toEqual(["motor.left.voltage", "led1.on", "sonar.distance"]);
    expect(bus.snapshot()).toEqual({
      "motor.left.voltage": 0,
      "led1.on": false,
      "sonar.distance": 1,
    });
    expect(bus.definition("motor.left.voltage")).toEqual({
      name: "motor.left.voltage",
      kind: "number",
      unit: "V",
      min: -12,
      max: 12,
      initial: 0,
    });
  });

  it("starts a number at the nearest value to 0 inside its range", () => {
    const bus = busWith({ name: "temp", kind: "number", min: 20, max: 30 });
    expect(bus.read("temp")).toBe(20);
  });

  it("makes writes visible only after commit (double-buffered)", () => {
    const bus = busWith({ name: "x", kind: "number" });
    bus.write("x", 5);
    expect(bus.read("x")).toBe(0);
    bus.commit();
    expect(bus.read("x")).toBe(5);
  });

  it("gives the same result whatever order models run in", () => {
    // Two models: A copies b → a, B copies a → b. With one buffer the order would matter.
    const run = (order: ("A" | "B")[]) => {
      const bus = busWith(
        { name: "a", kind: "number", initial: 1 },
        { name: "b", kind: "number", initial: 2 },
      );
      for (let step = 0; step < 3; step++) {
        for (const model of order) {
          if (model === "A") bus.write("a", bus.readNumber("b") + 10);
          else bus.write("b", bus.readNumber("a") * 2);
        }
        bus.commit();
      }
      return bus.snapshot();
    };
    expect(run(["A", "B"])).toEqual(run(["B", "A"]));
  });

  it("refuses a second write to the same signal in one step", () => {
    const bus = busWith({ name: "x", kind: "number" });
    bus.write("x", 1);
    expect(() => bus.write("x", 2)).toThrow(/twice/);
    bus.commit();
    expect(() => bus.write("x", 3)).not.toThrow();
  });

  it("clamps numbers to the declared range", () => {
    const bus = busWith({ name: "pwm", kind: "number", min: 0, max: 255 });
    bus.write("pwm", 300);
    bus.commit();
    expect(bus.read("pwm")).toBe(255);
    bus.write("pwm", -4);
    bus.commit();
    expect(bus.read("pwm")).toBe(0);
  });

  it.each([Number.NaN, Infinity, -Infinity, "5", true])("refuses %s for a number", (value) => {
    const bus = busWith({ name: "x", kind: "number" });
    expect(() => bus.write("x", value as number)).toThrow(SignalBusError);
  });

  it.each([1, 0, "true"])("refuses %s for a boolean", (value) => {
    const bus = busWith({ name: "on", kind: "boolean" });
    expect(() => bus.write("on", value as unknown as boolean)).toThrow(SignalBusError);
  });

  it("reads with type checks", () => {
    const bus = busWith({ name: "x", kind: "number" }, { name: "on", kind: "boolean" });
    expect(bus.readNumber("x")).toBe(0);
    expect(bus.readBoolean("on")).toBe(false);
    expect(() => bus.readNumber("on")).toThrow(SignalBusError);
    expect(() => bus.readBoolean("x")).toThrow(SignalBusError);
  });

  it("refuses unknown signals", () => {
    const bus = createSignalBus();
    expect(bus.has("ghost")).toBe(false);
    expect(() => bus.read("ghost")).toThrow(/unknown signal/);
    expect(() => bus.write("ghost", 1)).toThrow(/unknown signal/);
  });

  it("resets every signal and drops pending writes", () => {
    const bus = busWith({ name: "x", kind: "number", initial: 3 }, { name: "on", kind: "boolean" });
    bus.write("x", 9);
    bus.write("on", true);
    bus.commit();
    bus.write("x", 7);
    bus.reset();
    bus.commit();
    expect(bus.snapshot()).toEqual({ x: 3, on: false });
  });

  it("snapshots only the requested signals that exist", () => {
    const bus = busWith({ name: "a", kind: "number" }, { name: "b", kind: "boolean" });
    expect(bus.snapshot(["b", "missing"])).toEqual({ b: false });
  });

  it.each([
    "",
    "Motor",
    "motor..left",
    "motor.",
    ".motor",
    "motor left",
    "__proto__",
    "x".repeat(65),
  ])("refuses the name %j", (name) => {
    expect(() => createSignalBus().declare({ name, kind: "number" })).toThrow(/bad signal name/);
  });

  it.each<[string, SignalDefinition]>([
    ["min above max", { name: "x", kind: "number", min: 5, max: 1 }],
    ["a NaN range", { name: "x", kind: "number", min: Number.NaN }],
    ["an initial value out of range", { name: "x", kind: "number", max: 1, initial: 2 }],
    ["an infinite initial value", { name: "x", kind: "number", initial: Infinity }],
    ["a long unit", { name: "x", kind: "number", unit: "u".repeat(17) }],
    ["a non-boolean initial", { name: "x", kind: "boolean", initial: 1 as unknown as boolean }],
    ["an unknown kind", { name: "x", kind: "string" } as unknown as SignalDefinition],
  ])("refuses %s", (_name, def) => {
    expect(() => createSignalBus().declare(def)).toThrow(SignalBusError);
  });

  it("refuses a duplicate declaration", () => {
    const bus = busWith({ name: "x", kind: "number" });
    expect(() => bus.declare({ name: "x", kind: "boolean" })).toThrow(/already declared/);
  });

  it("caps the number of signals", () => {
    const bus = createSignalBus();
    for (let i = 0; i < MAX_SIGNALS; i++) bus.declare({ name: `s${i}`, kind: "boolean" });
    expect(() => bus.declare({ name: "one-more", kind: "boolean" })).toThrow(/at most/);
  });
});
