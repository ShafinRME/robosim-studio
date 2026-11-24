import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_STEPS_PER_FRAME,
  MAX_MANUAL_STEPS,
  SchedulerError,
  createScheduler,
  type SchedulerOptions,
} from "./scheduler";

function setup(options: SchedulerOptions = {}) {
  const calls: { time: number; dt: number; step: number }[] = [];
  const scheduler = createScheduler((time, dt, step) => calls.push({ time, dt, step }), options);
  return { scheduler, calls };
}

describe("scheduler", () => {
  it("starts stopped at time 0 with 1 kHz steps and real-time rate", () => {
    const { scheduler } = setup();
    expect(scheduler.snapshot()).toEqual({
      state: "stopped",
      steps: 0,
      time: 0,
      dt: 0.001,
      rate: 1,
      behind: false,
      droppedTime: 0,
    });
  });

  it("does nothing until it runs", () => {
    const { scheduler, calls } = setup();
    expect(scheduler.advance(0.1)).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it("runs as many fixed steps as real time is worth", () => {
    const { scheduler, calls } = setup();
    scheduler.run();
    expect(scheduler.advance(0.016)).toBe(16);
    expect(calls[0]).toEqual({ time: 0, dt: 0.001, step: 0 });
    expect(calls[15]?.step).toBe(15);
    expect(scheduler.snapshot()).toMatchObject({ state: "running", steps: 16 });
    expect(scheduler.snapshot().time).toBeCloseTo(0.016, 12);
  });

  it("carries leftover time to the next frame, so 1 s of frames gives exactly 1000 steps", () => {
    const { scheduler } = setup();
    scheduler.run();
    let total = 0;
    for (let i = 0; i < 60; i++) total += scheduler.advance(1 / 60);
    expect(total).toBe(1000);
  });

  it("keeps exact time over long runs (no drift)", () => {
    const { scheduler } = setup({ maxStepsPerFrame: 1_000_000 });
    scheduler.run();
    for (let i = 0; i < 3600; i++) scheduler.advance(0.25); // 15 simulated minutes, in 0.25 s frames
    expect(scheduler.snapshot().steps).toBe(900_000);
    expect(scheduler.snapshot().time).toBe(900);
  });

  it("scales by the real-time factor", () => {
    const { scheduler } = setup();
    scheduler.setRate(0.5);
    scheduler.run();
    expect(scheduler.advance(0.02)).toBe(10);
    scheduler.setRate(2);
    expect(scheduler.advance(0.02)).toBe(40);
  });

  it.each([0, 0.05, 11, Number.NaN, Infinity])("refuses rate %d", (rate) => {
    const { scheduler } = setup();
    expect(() => scheduler.setRate(rate)).toThrow(SchedulerError);
  });

  it("drops time and reports `behind` when the step budget runs out", () => {
    const { scheduler } = setup({ maxStepsPerFrame: 50 });
    scheduler.run();
    expect(scheduler.advance(0.08)).toBe(50);
    expect(scheduler.snapshot().behind).toBe(true);
    expect(scheduler.snapshot().droppedTime).toBeCloseTo(0.03, 12);
    // Catching up afterwards is not attempted: the next normal frame is normal again.
    expect(scheduler.advance(0.016)).toBe(16);
    expect(scheduler.snapshot().behind).toBe(false);
  });

  it("uses a budget of 200 steps per frame by default", () => {
    const { scheduler } = setup();
    scheduler.run();
    expect(scheduler.advance(0.25)).toBe(DEFAULT_MAX_STEPS_PER_FRAME);
  });

  it("does not catch up after a long pause of the page", () => {
    const { scheduler } = setup({ maxStepsPerFrame: 1_000_000 });
    scheduler.run();
    expect(scheduler.advance(30)).toBe(250); // capped at 0.25 s of real time
  });

  it.each([0, -1, Number.NaN, Infinity])("ignores a bad frame time of %d", (seconds) => {
    const { scheduler } = setup();
    scheduler.run();
    expect(scheduler.advance(seconds)).toBe(0);
  });

  it("pauses, forgets leftover time, and resumes", () => {
    const { scheduler } = setup();
    scheduler.run();
    scheduler.advance(0.0015); // 1 step + 0.5 ms left over
    scheduler.pause();
    expect(scheduler.snapshot().state).toBe("paused");
    expect(scheduler.advance(1)).toBe(0);
    scheduler.run();
    expect(scheduler.advance(0.0005)).toBe(0); // the old half step is gone
    expect(scheduler.snapshot().steps).toBe(1);
  });

  it("single-steps while stopped or paused, and not while running", () => {
    const { scheduler, calls } = setup();
    expect(scheduler.step()).toBe(1);
    expect(scheduler.snapshot()).toMatchObject({ state: "paused", steps: 1 });
    expect(scheduler.step(10)).toBe(10);
    expect(calls.map((c) => c.step)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    scheduler.run();
    expect(scheduler.step()).toBe(0);
  });

  it.each([0, -5, MAX_MANUAL_STEPS + 1, Number.NaN])("refuses step(%d)", (count) => {
    const { scheduler } = setup();
    expect(() => scheduler.step(count)).toThrow(SchedulerError);
  });

  it("resets to time 0", () => {
    const { scheduler } = setup({ maxStepsPerFrame: 5 });
    scheduler.run();
    scheduler.advance(0.1);
    scheduler.reset();
    expect(scheduler.snapshot()).toMatchObject({
      state: "stopped",
      steps: 0,
      time: 0,
      behind: false,
      droppedTime: 0,
    });
  });

  it.each<[string, SchedulerOptions]>([
    ["dt of 0", { dt: 0 }],
    ["negative dt", { dt: -0.001 }],
    ["dt above 1 s", { dt: 2 }],
    ["a budget of 0", { maxStepsPerFrame: 0 }],
    ["a rate of 100", { rate: 100 }],
  ])("refuses %s", (_name, options) => {
    expect(() => setup(options)).toThrow(SchedulerError);
  });

  it("supports other step sizes", () => {
    const { scheduler } = setup({ dt: 0.01 });
    scheduler.run();
    expect(scheduler.advance(0.1)).toBe(10);
    expect(scheduler.snapshot().time).toBeCloseTo(0.1, 12);
  });
});
