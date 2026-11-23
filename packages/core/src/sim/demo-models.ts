/**
 * Demo simulation (Day 09): a mass on a spring with a damper, pushed by a force that switches on and
 * off. Two models that only talk through the Signal Bus — the pattern every lab will follow:
 *
 * - `demo.driver` switches `demo.drive` on and off every half period.
 * - `demo.spring` reads `demo.drive` and integrates m·x″ = F − k·x − c·x′ (semi-implicit Euler),
 *   writing `demo.position` and `demo.velocity`.
 *
 * It exists to exercise the kernel at 1 kHz until the first real lab arrives.
 */
import type { SimModel } from "./simulation";

export type DemoOptions = {
  /** Drive on for half of this, off for the other half (seconds). */
  period?: number;
  /** Force while the drive is on (N). */
  force?: number;
  mass?: number;
  stiffness?: number;
  damping?: number;
};

export const DEMO_SIGNALS = {
  drive: "demo.drive",
  position: "demo.position",
  velocity: "demo.velocity",
} as const;

export function createDemoModels(options: DemoOptions = {}): SimModel[] {
  const { period = 2, force = 2, mass = 0.5, stiffness = 20, damping = 1 } = options;

  const driver: SimModel = {
    id: "demo.driver",
    signals: [{ name: DEMO_SIGNALS.drive, kind: "boolean", initial: true }],
    reset: () => {},
    step(time, dt, bus) {
      // On during the first half of each period. Evaluated at the end of this step.
      const t = time + dt;
      bus.write(DEMO_SIGNALS.drive, t % period < period / 2);
    },
  };

  let x = 0;
  let v = 0;
  const spring: SimModel = {
    id: "demo.spring",
    signals: [
      { name: DEMO_SIGNALS.position, kind: "number", unit: "m", min: -10, max: 10 },
      { name: DEMO_SIGNALS.velocity, kind: "number", unit: "m/s", min: -100, max: 100 },
    ],
    reset() {
      x = 0;
      v = 0;
    },
    step(_time, dt, bus) {
      const f = bus.readBoolean(DEMO_SIGNALS.drive) ? force : 0;
      const a = (f - stiffness * x - damping * v) / mass;
      v += a * dt; // semi-implicit Euler: stable for this oscillator at 1 kHz
      x += v * dt;
      bus.write(DEMO_SIGNALS.velocity, v);
      bus.write(DEMO_SIGNALS.position, x);
    },
  };

  return [driver, spring];
}
