"use client";

import { proxy, releaseProxy, wrap, type Remote } from "comlink";
import type { HostSnapshot, SimHost } from "./sim-host";

export type SimWorker = {
  /** Typed, async calls into the worker (`await api.run()`). */
  api: Remote<SimHost>;
  /** Receives every snapshot the worker sends (~30 per second while running). */
  subscribe: (listener: (snapshot: HostSnapshot) => void) => Promise<void>;
  /** Stops the worker and everything running in it. */
  terminate: () => void;
};

/** Starts a simulation worker (same origin only; allowed by CSP `worker-src 'self'`). */
export function startSimWorker(): SimWorker {
  const worker = new Worker(new URL("./sim-worker.ts", import.meta.url), {
    type: "module",
    name: "robosim-simulation",
  });
  const api = wrap<SimHost>(worker);
  return {
    api,
    subscribe: (listener) => api.subscribe(proxy(listener)),
    terminate: () => {
      api[releaseProxy]();
      worker.terminate();
    },
  };
}
