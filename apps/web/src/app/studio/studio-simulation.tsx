"use client";

import type { MessageLevel, SignalDefinition } from "@robosim/core";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { DEFAULT_SIM_MODEL } from "../../sim/models";
import { startSimWorker, type SimWorker } from "../../sim/sim-client";
import type { HostSnapshot } from "../../sim/sim-host";

/**
 * The studio's simulation (ADR 006). The worker starts on first use (Run or Step), so opening the
 * studio costs nothing. Snapshots (~30/s) go into a small external store: only the parts that show
 * simulation values re-render, not the whole studio.
 */
type SimView = { snapshot: HostSnapshot | null; signals: readonly SignalDefinition[] };

function createSimStore() {
  let view: SimView = { snapshot: null, signals: [] };
  const listeners = new Set<() => void>();
  return {
    get: () => view,
    set(next: Partial<SimView>) {
      view = { ...view, ...next };
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export type SimController = {
  /** Run, or pause when running. */
  toggle: () => void;
  run: () => void;
  pause: () => void;
  /** One step (1 ms) while paused or stopped. */
  step: () => void;
  /** Back to time 0. */
  stop: () => void;
  setRate: (rate: number) => void;
};

type SimContextValue = { store: ReturnType<typeof createSimStore>; controller: SimController };

const SimContext = createContext<SimContextValue | null>(null);

export function SimulationProvider({
  post,
  children,
}: {
  post: (level: MessageLevel, text: string) => void;
  children: ReactNode;
}) {
  const [store] = useState(createSimStore);
  const worker = useRef<Promise<SimWorker> | null>(null);
  const postRef = useRef(post);
  useEffect(() => {
    postRef.current = post;
  });

  useEffect(
    () => () => {
      // The studio is closing: stop the worker and everything running in it.
      void worker.current?.then((w) => w.terminate());
      worker.current = null;
    },
    [],
  );

  const [controller] = useState<SimController>(() => {
    const ensure = (): Promise<SimWorker> => {
      worker.current ??= (async () => {
        const w = startSimWorker();
        await w.subscribe((snapshot) => store.set({ snapshot }));
        store.set({ signals: await w.api.load(DEFAULT_SIM_MODEL) });
        postRef.current("info", "Demo simulation loaded: a spring with a switching force.");
        return w;
      })();
      return worker.current;
    };
    const call = (action: (w: SimWorker) => Promise<unknown>) => {
      ensure()
        .then(action)
        .catch((error: unknown) => {
          console.error("Simulation:", error);
          postRef.current(
            "error",
            `Simulation error: ${error instanceof Error ? error.message : "unknown"}.`,
          );
        });
    };
    const running = () => store.get().snapshot?.state === "running";
    return {
      toggle: () => call((w) => (running() ? w.api.pause() : w.api.run())),
      run: () => call((w) => w.api.run()),
      pause: () => call((w) => w.api.pause()),
      step: () => call((w) => w.api.step(1)),
      stop: () => {
        // Nothing to stop before the worker exists.
        if (worker.current) call((w) => w.api.reset());
      },
      setRate: (rate) => call((w) => w.api.setRate(rate)),
    };
  });

  return <SimContext.Provider value={{ store, controller }}>{children}</SimContext.Provider>;
}

function useSimContext(): SimContextValue {
  const value = useContext(SimContext);
  if (!value) throw new Error("useSimulation needs a SimulationProvider");
  return value;
}

export function useSimController(): SimController {
  return useSimContext().controller;
}

/** Live simulation view (re-renders ~30 times per second while running). */
export function useSimView(): SimView {
  const { store } = useSimContext();
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** "Idle" before anything ran, then Running / Paused / Stopped. */
export function simStateLabel(snapshot: HostSnapshot | null): string {
  if (!snapshot || (snapshot.state === "stopped" && snapshot.steps === 0)) return "Idle";
  return { running: "Running", paused: "Paused", stopped: "Stopped" }[snapshot.state];
}

/** Simulated time, e.g. "12.345 s". */
export function formatSimTime(seconds: number): string {
  return `${seconds.toFixed(3)} s`;
}
