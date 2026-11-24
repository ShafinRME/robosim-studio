/**
 * The simulation host that runs inside the Web Worker (ADR 006).
 *
 * It owns one simulation, ticks it from its own timer with real elapsed time, and sends snapshots to
 * one listener (the studio) at display rate — never once per step. Clock and timers are injected,
 * so the host is unit-tested without a real worker. Everything that arrives from the main thread is
 * checked: Comlink delivers structured clones, but their values are still untrusted input.
 */
import {
  createSimulation,
  type SignalDefinition,
  type SimModel,
  type Simulation,
  type SimulationSnapshot,
} from "@robosim/core";

/** Tick the scheduler about this often (ms). 4 ms ≈ 4 steps per tick at 1 kHz. */
export const TICK_MS = 4;
/** Send snapshots about this often (ms) by default: ~30 per second is enough for any display. */
export const SNAPSHOT_MS = 33;
const MIN_SNAPSHOT_MS = 16;
const MAX_SNAPSHOT_MS = 1000;
const MAX_WATCHED = 100;

export type ModelRegistry = Readonly<Record<string, () => readonly SimModel[]>>;

export type HostSnapshot = SimulationSnapshot & {
  model: string | null;
  /** Steps actually run during the last second of real time. */
  stepsPerSecond: number;
};

export type HostClock = {
  now: () => number;
  setTimer: (callback: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
};

const realClock: HostClock = {
  now: () => performance.now(),
  setTimer: (callback, ms) => setTimeout(callback, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export class SimHostError extends Error {
  override name = "SimHostError";
}

const EMPTY: HostSnapshot = {
  model: null,
  state: "stopped",
  steps: 0,
  time: 0,
  dt: 0.001,
  rate: 1,
  behind: false,
  droppedTime: 0,
  signals: {},
  stepsPerSecond: 0,
};

export type SimHost = ReturnType<typeof createSimHost>;

export function createSimHost(registry: ModelRegistry, clock: HostClock = realClock) {
  let sim: Simulation | null = null;
  let modelId: string | null = null;
  let listener: ((snapshot: HostSnapshot) => void) | null = null;
  let tickTimer: unknown = null;
  let lastTick = 0;
  let lastSent = -Infinity;
  let snapshotMs = SNAPSHOT_MS;
  /** Step counts per tick over the last second, for `stepsPerSecond`. */
  let recent: { at: number; steps: number }[] = [];

  const stepsPerSecond = () => {
    const since = clock.now() - 1000;
    recent = recent.filter((entry) => entry.at > since);
    return recent.reduce((sum, entry) => sum + entry.steps, 0);
  };

  const snapshot = (): HostSnapshot =>
    sim ? { ...sim.snapshot(), model: modelId, stepsPerSecond: stepsPerSecond() } : { ...EMPTY };

  const send = () => {
    lastSent = clock.now();
    listener?.(snapshot());
  };

  const stopTicking = () => {
    if (tickTimer !== null) clock.clearTimer(tickTimer);
    tickTimer = null;
  };

  const tick = () => {
    tickTimer = null;
    if (!sim || sim.snapshot().state !== "running") return;
    const now = clock.now();
    const steps = sim.advance((now - lastTick) / 1000);
    lastTick = now;
    recent.push({ at: now, steps });
    if (now - lastSent >= snapshotMs) send();
    tickTimer = clock.setTimer(tick, TICK_MS);
  };

  const requireSim = (): Simulation => {
    if (!sim) throw new SimHostError("no simulation loaded");
    return sim;
  };

  return {
    /** Loads a model set by id (replacing the current simulation). Returns its signals. */
    load(id: unknown): SignalDefinition[] {
      if (typeof id !== "string" || !Object.hasOwn(registry, id)) {
        throw new SimHostError("unknown simulation model");
      }
      stopTicking();
      sim = createSimulation(registry[id]!());
      modelId = id;
      recent = [];
      const definitions = sim.bus.names().map((name) => sim!.bus.definition(name));
      send();
      return definitions;
    },

    run() {
      const current = requireSim();
      current.run();
      if (tickTimer === null) {
        lastTick = clock.now();
        tickTimer = clock.setTimer(tick, TICK_MS);
      }
      send();
    },

    pause() {
      requireSim().pause();
      stopTicking();
      send();
    },

    step(count: unknown = 1): number {
      if (typeof count !== "number") throw new SimHostError("step count must be a number");
      const ran = requireSim().step(count);
      send();
      return ran;
    },

    reset() {
      requireSim().reset();
      stopTicking();
      recent = [];
      send();
    },

    setRate(rate: unknown) {
      if (typeof rate !== "number") throw new SimHostError("rate must be a number");
      requireSim().setRate(rate);
      send();
    },

    watch(names: unknown) {
      if (!Array.isArray(names) || names.length > MAX_WATCHED) {
        throw new SimHostError(`watch takes a list of at most ${MAX_WATCHED} names`);
      }
      requireSim().watch(names.filter((name): name is string => typeof name === "string"));
      send();
    },

    /** How often snapshots are sent while running (Low-end mode sends fewer). */
    setSnapshotInterval(ms: unknown) {
      if (
        typeof ms !== "number" ||
        !Number.isFinite(ms) ||
        ms < MIN_SNAPSHOT_MS ||
        ms > MAX_SNAPSHOT_MS
      ) {
        throw new SimHostError(
          `snapshot interval must be ${MIN_SNAPSHOT_MS}–${MAX_SNAPSHOT_MS} ms`,
        );
      }
      snapshotMs = ms;
    },

    /** One listener receives every snapshot (the studio). Sends the current state at once. */
    subscribe(callback: (snapshot: HostSnapshot) => void) {
      listener = callback;
      send();
    },

    snapshot,

    dispose() {
      stopTicking();
      listener = null;
      sim = null;
      modelId = null;
    },
  };
}
