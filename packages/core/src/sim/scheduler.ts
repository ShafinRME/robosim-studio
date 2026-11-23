/**
 * Fixed-step simulation scheduler (ADR 006).
 *
 * Models advance in fixed steps of `dt` seconds. Simulated time is `steps × dt` (an integer step
 * count, so it never drifts). The scheduler has no clock of its own: its host tells it how much real
 * time passed (`advance`), and it runs as many whole steps as the real-time factor asks for, within
 * a per-frame budget. When the model cannot keep up, the extra time is dropped and the scheduler
 * reports `behind`, so the simulation slows down instead of freezing the page.
 */

/** Default step: 1 ms (1 kHz). */
export const DEFAULT_STEP_SECONDS = 0.001;
/** Default most steps per `advance` call (one display frame). */
export const DEFAULT_MAX_STEPS_PER_FRAME = 200;
export const MIN_RATE = 0.1;
export const MAX_RATE = 10;
/** Real-time factors offered in the studio. */
export const RATE_PRESETS = [0.1, 0.25, 0.5, 1, 2, 5, 10] as const;
/** At most this many steps in one `step(n)` call. */
export const MAX_MANUAL_STEPS = 100_000;
/** Real time larger than this in one `advance` (tab was hidden, debugger pause) is not caught up. */
const MAX_FRAME_SECONDS = 0.25;

export type SimState = "stopped" | "running" | "paused";

export type SchedulerSnapshot = {
  state: SimState;
  /** Completed steps since reset. */
  steps: number;
  /** Simulated time in seconds (`steps × dt`). */
  time: number;
  dt: number;
  rate: number;
  /** True when the last `advance` had to drop time because the step budget ran out. */
  behind: boolean;
  /** Simulated seconds dropped since reset because the model could not keep up. */
  droppedTime: number;
};

export type SchedulerOptions = {
  dt?: number;
  rate?: number;
  maxStepsPerFrame?: number;
};

export type StepFunction = (time: number, dt: number, step: number) => void;

export class SchedulerError extends Error {
  override name = "SchedulerError";
}

function checkRate(rate: number): number {
  if (!Number.isFinite(rate) || rate < MIN_RATE || rate > MAX_RATE) {
    throw new SchedulerError(`rate must be between ${MIN_RATE} and ${MAX_RATE}`);
  }
  return rate;
}

export type Scheduler = ReturnType<typeof createScheduler>;

/**
 * Creates a scheduler around a step function. `onStep(time, dt, step)` is called once per step with
 * the simulated time at the *start* of that step.
 */
export function createScheduler(onStep: StepFunction, options: SchedulerOptions = {}) {
  const dt = options.dt ?? DEFAULT_STEP_SECONDS;
  if (!Number.isFinite(dt) || dt <= 0 || dt > 1) {
    throw new SchedulerError("dt must be between 0 and 1 second");
  }
  const maxSteps = Math.floor(options.maxStepsPerFrame ?? DEFAULT_MAX_STEPS_PER_FRAME);
  if (!(maxSteps >= 1)) throw new SchedulerError("maxStepsPerFrame must be at least 1");

  let state: SimState = "stopped";
  let steps = 0;
  let rate = checkRate(options.rate ?? 1);
  /** Simulated time owed but not yet stepped (always < dt after an advance). */
  let accumulator = 0;
  let behind = false;
  let droppedTime = 0;

  const runSteps = (count: number) => {
    for (let i = 0; i < count; i++) {
      onStep(steps * dt, dt, steps);
      steps++;
    }
  };

  return {
    snapshot(): SchedulerSnapshot {
      return { state, steps, time: steps * dt, dt, rate, behind, droppedTime };
    },

    /** Starts or resumes real-time running. */
    run() {
      state = "running";
    },

    pause() {
      if (state === "running") state = "paused";
      accumulator = 0;
    },

    /** Back to time 0 (the host also resets its models). */
    reset() {
      state = "stopped";
      steps = 0;
      accumulator = 0;
      behind = false;
      droppedTime = 0;
    },

    setRate(next: number) {
      rate = checkRate(next);
    },

    /**
     * Runs `count` steps now (single-stepping). Allowed while stopped or paused; it leaves the
     * scheduler paused.
     */
    step(count = 1): number {
      if (state === "running") return 0;
      const n = Math.floor(count);
      if (!(n >= 1 && n <= MAX_MANUAL_STEPS)) {
        throw new SchedulerError(`step count must be 1–${MAX_MANUAL_STEPS}`);
      }
      runSteps(n);
      state = "paused";
      return n;
    },

    /**
     * Tells the scheduler that `realSeconds` of wall-clock time passed. While running, runs the
     * steps that time is worth (× rate), at most the per-frame budget. Returns the steps run.
     */
    advance(realSeconds: number): number {
      if (state !== "running") return 0;
      if (!Number.isFinite(realSeconds) || realSeconds <= 0) return 0;
      accumulator += Math.min(realSeconds, MAX_FRAME_SECONDS) * rate;
      // Tiny tolerance so 0.001 + 0.001 + … still counts as whole steps despite rounding.
      let due = Math.floor(accumulator / dt + 1e-9);
      behind = due > maxSteps;
      if (behind) {
        droppedTime += (due - maxSteps) * dt;
        due = maxSteps;
        accumulator = 0;
      } else {
        accumulator = Math.max(0, accumulator - due * dt);
      }
      runSteps(due);
      return due;
    },
  };
}
