import type { SimModel } from "@robosim/core";
import { describe, expect, it } from "vitest";
import {
  SNAPSHOT_MS,
  SimHostError,
  TICK_MS,
  createSimHost,
  type HostClock,
  type HostSnapshot,
} from "./sim-host";

/** A clock whose time only moves when the test says so. */
function fakeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const clock: HostClock = {
    now: () => now,
    setTimer: (callback, ms) => {
      const id = nextId++;
      timers.set(id, { at: now + ms, callback });
      return id;
    },
    clearTimer: (handle) => void timers.delete(handle as number),
  };
  /** Moves time forward, firing due timers in order. */
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      now = due[1].at;
      due[1].callback();
    }
    now = end;
  };
  return { clock, advance, pending: () => timers.size };
}

const counter = (): SimModel[] => [
  {
    id: "test.counter",
    signals: [{ name: "count", kind: "number" }],
    reset: () => {},
    step: (_t, _dt, bus) => bus.write("count", bus.readNumber("count") + 1),
  },
];

function setup() {
  const time = fakeClock();
  const host = createSimHost({ counter }, time.clock);
  const snapshots: HostSnapshot[] = [];
  host.subscribe((s) => snapshots.push(s));
  return { host, snapshots, ...time };
}

describe("simulation host", () => {
  it("reports an empty state before a model is loaded", () => {
    const { host, snapshots } = setup();
    expect(snapshots[0]).toMatchObject({ model: null, state: "stopped", steps: 0 });
    expect(() => host.run()).toThrow(SimHostError);
  });

  it("loads a model by id and returns its signals", () => {
    const { host, snapshots } = setup();
    expect(host.load("counter")).toEqual([{ name: "count", kind: "number", initial: 0 }]);
    expect(snapshots.at(-1)).toMatchObject({ model: "counter", signals: { count: 0 } });
  });

  it.each(["nope", "__proto__", "constructor", 42, null])("refuses the model id %j", (id) => {
    const { host } = setup();
    expect(() => host.load(id)).toThrow(/unknown simulation model/);
  });

  it("runs in real time from its own timer: 1 s → 1000 steps", () => {
    const { host, advance } = setup();
    host.load("counter");
    host.run();
    advance(1000);
    expect(host.snapshot()).toMatchObject({ state: "running", steps: 1000 });
    expect(host.snapshot().stepsPerSecond).toBe(1000);
  });

  it("sends snapshots at display rate, not once per step", () => {
    const { host, snapshots, advance } = setup();
    host.load("counter");
    const before = snapshots.length;
    host.run();
    advance(1000);
    const sent = snapshots.length - before;
    expect(sent).toBeGreaterThan(1000 / SNAPSHOT_MS / 2);
    expect(sent).toBeLessThan(1000 / TICK_MS / 4); // far fewer than ticks, let alone steps
  });

  it("pauses (stops its timer), steps and resets", () => {
    const { host, advance, pending } = setup();
    host.load("counter");
    host.run();
    advance(100);
    host.pause();
    expect(pending()).toBe(0);
    const steps = host.snapshot().steps;
    advance(500);
    expect(host.snapshot().steps).toBe(steps);
    expect(host.step(5)).toBe(5);
    expect(host.snapshot().steps).toBe(steps + 5);
    host.reset();
    expect(host.snapshot()).toMatchObject({ state: "stopped", steps: 0, signals: { count: 0 } });
  });

  it("changes the rate", () => {
    const { host, advance } = setup();
    host.load("counter");
    host.setRate(2);
    host.run();
    advance(100);
    expect(host.snapshot().steps).toBe(200);
  });

  it("checks every argument from the main thread", () => {
    const { host } = setup();
    host.load("counter");
    expect(() => host.step("5")).toThrow(SimHostError);
    expect(() => host.step(-1)).toThrow();
    expect(() => host.setRate("fast")).toThrow(SimHostError);
    expect(() => host.setRate(1000)).toThrow();
    expect(() => host.watch("count")).toThrow(SimHostError);
    expect(() => host.watch(Array.from({ length: 101 }, () => "count"))).toThrow(SimHostError);
    host.watch(["count", 5, "missing"]);
    expect(Object.keys(host.snapshot().signals)).toEqual(["count"]);
  });

  it("stops everything on dispose", () => {
    const { host, advance, pending } = setup();
    host.load("counter");
    host.run();
    advance(10);
    host.dispose();
    expect(pending()).toBe(0);
    expect(host.snapshot().model).toBeNull();
  });

  it("does not run two timers when run() is called twice", () => {
    const { host, advance } = setup();
    host.load("counter");
    host.run();
    host.run();
    advance(100);
    expect(host.snapshot().steps).toBe(100);
  });
});
