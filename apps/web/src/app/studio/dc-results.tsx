"use client";

/**
 * Live DC results (ADR 011 §5). `DcAnalysis` watches the active project; a short moment after the
 * circuit changes it sends the drawing to the analysis worker. The answer is kept in a small store
 * that the canvas (net voltages, problems), the Inspector (V / I / P) and the Console read.
 * Renaming a part or the project does not re-solve: only parts, wires and labels count.
 */
import { connectivityOf, type CircuitIssue, type DcResult } from "@robosim/core";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { createAnalysisClient, type AnalysisClient } from "../../sim/analysis-client";
import { useActiveProject } from "./studio-project";
import { useStudioStatus } from "./studio-status";

/** Wait this long after the last change before solving (typing a value, dragging). */
export const DC_DEBOUNCE_MS = 60;
/** Problems are written to the Console only once the drawing has been still this long. */
const CONSOLE_QUIET_MS = 1_500;

export type DcState = {
  readonly projectId: string | null;
  readonly result: DcResult | null;
  /** A newer solve is on its way (the result shown may be one edit old). */
  readonly solving: boolean;
};

const EMPTY: DcState = { projectId: null, result: null, solving: false };
let current: DcState = EMPTY;
const listeners = new Set<() => void>();

function publish(next: DcState) {
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The DC results of `projectId` (empty for any other project). */
export function useDcResults(projectId: string | null): DcState {
  const state = useSyncExternalStore(
    subscribe,
    () => current,
    () => EMPTY,
  );
  return state.projectId === projectId ? state : EMPTY;
}

/** For tests and commands outside React. */
export function getDcResults(): DcState {
  return current;
}

const problemKey = (issue: CircuitIssue) => `${issue.code}:${issue.message}`;

/** Keeps the DC results of the active project up to date. Renders nothing. */
export function DcAnalysis() {
  const { state } = useActiveProject();
  const { post } = useStudioStatus();
  const project = state?.project;
  const projectId = project?.id ?? null;
  const parts = project?.parts;
  const wires = project?.wires;
  const labels = project?.labels;
  const input = useMemo(
    () => (parts && wires && labels ? connectivityOf({ parts, wires, labels }).input : null),
    [parts, wires, labels],
  );

  const client = useRef<AnalysisClient | null>(null);
  useEffect(() => {
    const created = createAnalysisClient();
    client.current = created;
    return () => {
      created.dispose();
      if (client.current === created) client.current = null;
    };
  }, []);

  // Problems already written to the Console for this project (so each is written once).
  const reported = useRef<{ projectId: string | null; keys: Set<string> }>({
    projectId: null,
    keys: new Set(),
  });

  useEffect(() => {
    if (!projectId || !input) {
      publish(EMPTY);
      return;
    }
    publish({ ...(current.projectId === projectId ? current : EMPTY), projectId, solving: true });
    let consoleTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      void client.current?.solveDc(input).then((result) => {
        if (!result || cancelled) return; // a newer request is on its way
        publish({ projectId, result, solving: false });
        consoleTimer = setTimeout(() => {
          if (reported.current.projectId !== projectId) {
            reported.current = { projectId, keys: new Set() };
          }
          const shown = result.issues.filter((i) => i.severity !== "info");
          const keys = new Set(shown.map(problemKey));
          // Problems were reported before and now all are gone: say so, so no old warning stays
          // as the latest message in the status bar.
          if (result.ok && shown.length === 0 && reported.current.keys.size > 0) {
            post("success", "Circuit solved: all problems fixed.");
          }
          // Least important first, so the most important one is the latest line (the status bar).
          for (const issue of shown.slice(0, 3).reverse()) {
            if (reported.current.keys.has(problemKey(issue))) continue;
            post(issue.severity === "error" ? "warning" : "info", issue.message);
          }
          reported.current.keys = keys;
        }, CONSOLE_QUIET_MS);
      });
    }, DC_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(consoleTimer);
    };
  }, [projectId, input, post]);

  return null;
}
