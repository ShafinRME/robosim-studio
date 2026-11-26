"use client";

/**
 * Main-thread side of the analysis worker (ADR 011 §4). Every request gets a sequence number and
 * only the newest answer is delivered ("latest wins"), so a slow solve can never overwrite the
 * result of a newer edit. A solve that takes longer than `timeoutMs` ends the worker (the only
 * way to stop running code in it) and the next request starts a fresh one.
 */
import { solverIssues, type CircuitInput, type DcResult } from "@robosim/core";
import { releaseProxy, wrap, type Remote } from "comlink";
import type { AnalysisHost } from "./analysis-worker";

export const ANALYSIS_TIMEOUT_MS = 2_000;

export type AnalysisClient = {
  /**
   * Solves the DC operating point. Resolves with the result, or with `null` when a newer request
   * was made in the meantime (the caller then simply waits for that one).
   */
  solveDc(input: CircuitInput): Promise<DcResult | null>;
  dispose(): void;
};

export type Running = { worker: Worker; api: Remote<AnalysisHost> };

function startWorker(): Running {
  const worker = new Worker(new URL("./analysis-worker.ts", import.meta.url), {
    type: "module",
    name: "robosim-analysis",
  });
  return { worker, api: wrap<AnalysisHost>(worker) };
}

export function createAnalysisClient(
  options: { timeoutMs?: number; start?: () => Running } = {},
): AnalysisClient {
  const timeoutMs = options.timeoutMs ?? ANALYSIS_TIMEOUT_MS;
  const start = options.start ?? startWorker;
  let running: Running | null = null;
  let latest = 0;

  const stop = () => {
    if (!running) return;
    running.api[releaseProxy]();
    running.worker.terminate();
    running = null;
  };

  return {
    async solveDc(input) {
      const seq = ++latest;
      running ??= start();
      const current = running;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), timeoutMs);
      });
      try {
        const answer = await Promise.race([current.api.solveDc(seq, input), timeout]);
        if (answer === "timeout") {
          if (running === current) stop();
          return seq === latest
            ? { ok: false, issues: [solverIssues.timedOut(timeoutMs / 1_000)] }
            : null;
        }
        return answer.seq === latest ? answer.result : null;
      } catch (error) {
        // The worker failed (or was stopped for a newer request): report only for the newest.
        if (running === current) stop();
        if (seq !== latest) return null;
        const detail = error instanceof Error ? error.message : "worker error";
        return { ok: false, issues: [solverIssues.modelError(detail)] };
      } finally {
        clearTimeout(timer);
      }
    },
    dispose() {
      latest++;
      stop();
    },
  };
}
