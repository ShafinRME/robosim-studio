import { createDemoModels } from "@robosim/core";
import type { ModelRegistry } from "./sim-host";

/**
 * Simulation models the worker can load, by id. Only ids listed here can ever be loaded: the main
 * thread asks for an id, never sends code. Labs add their models here as they are built.
 */
export const SIM_MODELS: ModelRegistry = {
  /** Spring + driver demo (Day 09) until the first lab model arrives. */
  demo: () => createDemoModels(),
};

export const DEFAULT_SIM_MODEL = "demo";
