import { describe, expect, it } from "vitest";
import { createSimulation, type SimModel } from "./simulation";

/** Counts steps into a signal. */
const counter: SimModel = {
  id: "test.counter",
  signals: [{ name: "count", kind: "number" }],
  reset: () => {},
  step: (_t, _dt, bus) => bus.write("count", bus.readNumber("count") + 1),
};

/** Turns on when the counter reaches 3 (one step late: it reads last step's value). */
const watcher: SimModel = {
  id: "test.watcher",
  signals: [{ name: "reached", kind: "boolean" }],
  reset: () => {},
  step: (_t, _dt, bus) => bus.write("reached", bus.readNumber("count") >= 3),
};

describe("simulation", () => {
  it("steps every model and commits the bus each step", () => {
    const sim = createSimulation([counter, watcher]);
    sim.step(3);
    expect(sim.snapshot().signals).toEqual({ count: 3, reached: false });
    sim.step();
    expect(sim.snapshot().signals).toEqual({ count: 4, reached: true });
  });

  it("gives the same result with the models in any order", () => {
    const a = createSimulation([counter, watcher]);
    const b = createSimulation([watcher, counter]);
    a.step(10);
    b.step(10);
    expect(a.snapshot().signals).toEqual(b.snapshot().signals);
  });

  it("runs in real time through the scheduler", () => {
    const sim = createSimulation([counter]);
    sim.run();
    sim.advance(0.05);
    expect(sim.snapshot()).toMatchObject({ state: "running", steps: 50, signals: { count: 50 } });
  });

  it("resets models and signals", () => {
    let resets = 0;
    const model: SimModel = { ...counter, id: "x", reset: () => void resets++ };
    const sim = createSimulation([model]);
    sim.step(5);
    sim.reset();
    expect(sim.snapshot()).toMatchObject({ state: "stopped", steps: 0, signals: { count: 0 } });
    expect(resets).toBe(2); // once when created, once on reset
  });

  it("snapshots only watched signals", () => {
    const sim = createSimulation([counter, watcher], { watch: ["reached"] });
    expect(Object.keys(sim.snapshot().signals)).toEqual(["reached"]);
    sim.watch(["count", "nope"]);
    expect(Object.keys(sim.snapshot().signals)).toEqual(["count"]);
  });

  it("refuses the same model twice and clashing signal names", () => {
    expect(() => createSimulation([counter, counter])).toThrow(/twice/);
    expect(() => createSimulation([counter, { ...counter, id: "other" }])).toThrow(
      /already declared/,
    );
  });
});
