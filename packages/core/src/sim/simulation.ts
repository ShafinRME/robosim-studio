/**
 * A simulation = models + Signal Bus + fixed-step scheduler (ADR 006).
 *
 * Every model implements one small interface. Each step, every model reads the bus (values from the
 * previous step) and writes its outputs; then the bus commits. Labs plug in as models and only talk
 * to each other through signals.
 */
import { createScheduler, type SchedulerOptions, type SchedulerSnapshot } from "./scheduler";
import {
  createSignalBus,
  type SignalBus,
  type SignalDefinition,
  type SignalValue,
} from "./signal-bus";

export interface SimModel {
  /** Stable id, e.g. "demo.oscillator". */
  readonly id: string;
  /** Signals this model owns (declared once, when the simulation is created). */
  readonly signals: readonly SignalDefinition[];
  /** Back to the initial state (time 0). */
  reset(bus: SignalBus): void;
  /** Advances by `dt` seconds starting at `time`: read inputs from the bus, write outputs. */
  step(time: number, dt: number, bus: SignalBus): void;
}

export type SimulationSnapshot = SchedulerSnapshot & {
  /** Current values of the watched signals. */
  signals: Record<string, SignalValue>;
};

export type Simulation = ReturnType<typeof createSimulation>;

export function createSimulation(
  models: readonly SimModel[],
  options: SchedulerOptions & { watch?: readonly string[] } = {},
) {
  const bus = createSignalBus();
  const ids = new Set<string>();
  for (const model of models) {
    if (ids.has(model.id)) throw new Error(`model "${model.id}" added twice`);
    ids.add(model.id);
    for (const signal of model.signals) bus.declare(signal);
  }
  let watch: readonly string[] = options.watch ?? bus.names();

  const resetModels = () => {
    bus.reset();
    for (const model of models) model.reset(bus);
    bus.commit();
  };
  resetModels();

  const scheduler = createScheduler((time, dt) => {
    for (const model of models) model.step(time, dt, bus);
    bus.commit();
  }, options);

  return {
    bus,
    run: () => scheduler.run(),
    pause: () => scheduler.pause(),
    step: (count?: number) => scheduler.step(count),
    setRate: (rate: number) => scheduler.setRate(rate),
    advance: (realSeconds: number) => scheduler.advance(realSeconds),
    reset() {
      scheduler.reset();
      resetModels();
    },
    /** Chooses which signals snapshots include (unknown names are ignored). */
    watch(names: readonly string[]) {
      watch = names.filter((name) => bus.has(name));
    },
    snapshot(): SimulationSnapshot {
      return { ...scheduler.snapshot(), signals: bus.snapshot(watch) };
    },
  };
}
