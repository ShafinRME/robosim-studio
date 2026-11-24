/// <reference lib="webworker" />
/**
 * Simulation Web Worker (ADR 006): runs the simulation off the main thread, so the page stays
 * smooth. The studio talks to it through Comlink (see `sim-client.ts`).
 */
import { expose } from "comlink";
import { SIM_MODELS } from "./models";
import { createSimHost } from "./sim-host";

expose(createSimHost(SIM_MODELS));
