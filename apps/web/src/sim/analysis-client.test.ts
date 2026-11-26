import { componentFor, solveCircuitDc, type CircuitInput } from "@robosim/core";
import { releaseProxy } from "comlink";
import { describe, expect, it, vi } from "vitest";
import { createAnalysisClient, type Running } from "./analysis-client";

const EMPTY: CircuitInput = { parts: [], connections: [], labels: [] };

/** A stand-in worker whose answers the test releases one by one. */
function fakeWorker() {
  const pending: (() => void)[] = [];
  const terminate = vi.fn();
  const solveDc = vi.fn(
    (seq: number, input: CircuitInput) =>
      new Promise<{ seq: number; result: ReturnType<typeof solveCircuitDc> }>((resolve) => {
        pending.push(() => resolve({ seq, result: solveCircuitDc(input, componentFor) }));
      }),
  );
  const running = {
    worker: { terminate } as unknown as Worker,
    api: { solveDc, [releaseProxy]: vi.fn() } as unknown as Running["api"],
  };
  return { running, pending, terminate, solveDc };
}

describe("analysis client", () => {
  it("delivers only the newest answer (latest wins)", async () => {
    const fake = fakeWorker();
    const client = createAnalysisClient({ start: () => fake.running });
    const first = client.solveDc(EMPTY);
    const second = client.solveDc(EMPTY);
    // The older answer arrives last: it must not win.
    fake.pending[1]?.();
    fake.pending[0]?.();
    expect(await second).toMatchObject({ issues: [{ code: "empty-circuit" }] });
    expect(await first).toBeNull();
    expect(fake.solveDc).toHaveBeenCalledTimes(2);
  });

  it("stops a solve that takes too long and says so; the next request starts a new worker", async () => {
    vi.useFakeTimers();
    try {
      const workers = [fakeWorker(), fakeWorker()];
      let started = 0;
      const client = createAnalysisClient({
        timeoutMs: 2_000,
        start: () => (workers[started++] as ReturnType<typeof fakeWorker>).running,
      });
      const slow = client.solveDc(EMPTY);
      await vi.advanceTimersByTimeAsync(2_001);
      expect(await slow).toMatchObject({ ok: false, issues: [{ code: "timeout" }] });
      expect(workers[0]?.terminate).toHaveBeenCalled();

      const next = client.solveDc(EMPTY);
      workers[1]?.pending[0]?.();
      expect(await next).toMatchObject({ issues: [{ code: "empty-circuit" }] });
      expect(started).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("turns a worker crash into an issue instead of an exception", async () => {
    const fake = fakeWorker();
    fake.solveDc.mockImplementationOnce(() => Promise.reject(new Error("boom")));
    const client = createAnalysisClient({ start: () => fake.running });
    expect(await client.solveDc(EMPTY)).toMatchObject({
      ok: false,
      issues: [{ code: "model-error" }],
    });
    expect(fake.terminate).toHaveBeenCalled();
  });

  it("dispose stops the worker and drops answers still on the way", async () => {
    const fake = fakeWorker();
    const client = createAnalysisClient({ start: () => fake.running });
    const pending = client.solveDc(EMPTY);
    client.dispose();
    fake.pending[0]?.();
    expect(await pending).toBeNull();
    expect(fake.terminate).toHaveBeenCalled();
  });
});
