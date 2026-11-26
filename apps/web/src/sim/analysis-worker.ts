/// <reference lib="webworker" />
/**
 * Analysis Web Worker (ADR 011 §4): solves the DC operating point off the main thread. The input
 * comes from another thread, so it is untrusted: `solveCircuitDc` checks it with the circuit schema
 * (via `buildNetlist`) and answers bad input with an issue, never with a crash.
 */
import { componentFor, solveCircuitDc, type CircuitInput, type DcResult } from "@robosim/core";
import { expose } from "comlink";

export type AnalysisHost = {
  /** Solves one request; `seq` comes back so the caller can drop answers that are out of date. */
  solveDc(seq: number, input: CircuitInput): { seq: number; result: DcResult };
};

const host: AnalysisHost = {
  solveDc(seq, input) {
    return { seq, result: solveCircuitDc(input, componentFor) };
  },
};

expose(host);
