import { describe, expect, it } from "vitest";
import { DEMO_SIGNALS, createDemoModels } from "./demo-models";
import { createSimulation } from "./simulation";

const position = (sim: ReturnType<typeof createSimulation>) =>
  sim.bus.readNumber(DEMO_SIGNALS.position);

describe("demo models", () => {
  it("settles at F/k while the force stays on", () => {
    const sim = createSimulation(createDemoModels({ period: 1000 }));
    sim.step(10_000); // 10 s
    expect(position(sim)).toBeCloseTo(2 / 20, 3);
    expect(Math.abs(sim.bus.readNumber(DEMO_SIGNALS.velocity))).toBeLessThan(1e-3);
  });

  it("switches the drive every half period", () => {
    const sim = createSimulation(createDemoModels({ period: 2 }));
    sim.step(999);
    expect(sim.bus.readBoolean(DEMO_SIGNALS.drive)).toBe(true);
    sim.step(2);
    expect(sim.bus.readBoolean(DEMO_SIGNALS.drive)).toBe(false);
    sim.step(1000);
    expect(sim.bus.readBoolean(DEMO_SIGNALS.drive)).toBe(true);
  });

  it("stays bounded over a long run (stable integration)", () => {
    const sim = createSimulation(createDemoModels());
    let max = 0;
    for (let i = 0; i < 60_000; i++) {
      sim.step();
      max = Math.max(max, Math.abs(position(sim)));
    }
    // Overshoot of an underdamped step response stays below 2 × F/k.
    expect(max).toBeGreaterThan(0.1);
    expect(max).toBeLessThan(0.2);
  });

  it("is deterministic and resets to the same start", () => {
    const run = () => {
      const sim = createSimulation(createDemoModels());
      sim.step(3_210);
      return sim.snapshot().signals;
    };
    expect(run()).toEqual(run());

    const sim = createSimulation(createDemoModels());
    sim.step(500);
    sim.reset();
    expect(position(sim)).toBe(0);
    sim.step(3_210);
    expect(sim.snapshot().signals).toEqual(run());
  });

  it("runs 10 000 steps (10 s at 1 kHz) in well under a second", () => {
    const sim = createSimulation(createDemoModels());
    const start = Date.now();
    sim.step(10_000);
    expect(Date.now() - start).toBeLessThan(500);
  });
});
