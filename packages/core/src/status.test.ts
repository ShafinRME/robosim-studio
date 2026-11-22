import { describe, expect, it } from "vitest";
import {
  MAX_STATUS_MESSAGES,
  appendMessage,
  detectLowEnd,
  formatClock,
  resolveLowEnd,
  type StatusMessage,
} from "./status";

describe("appendMessage", () => {
  it("adds messages with increasing ids", () => {
    let log: StatusMessage[] = [];
    log = appendMessage(log, { level: "info", text: "a", time: 1 });
    log = appendMessage(log, { level: "warning", text: "b", time: 2 });
    expect(log.map((m) => [m.id, m.text, m.level])).toEqual([
      [1, "a", "info"],
      [2, "b", "warning"],
    ]);
  });

  it("does not change the original log", () => {
    const log: StatusMessage[] = [];
    appendMessage(log, { level: "info", text: "a", time: 1 });
    expect(log).toEqual([]);
  });

  it("keeps only the newest messages", () => {
    let log: StatusMessage[] = [];
    for (let i = 0; i < MAX_STATUS_MESSAGES + 5; i++) {
      log = appendMessage(log, { level: "info", text: `m${i}`, time: i });
    }
    expect(log).toHaveLength(MAX_STATUS_MESSAGES);
    expect(log[0]?.text).toBe("m5");
    expect(log.at(-1)?.id).toBe(MAX_STATUS_MESSAGES + 5);
  });

  it("trims very long text", () => {
    const log = appendMessage([], { level: "info", text: "x".repeat(2000), time: 0 });
    expect(log[0]?.text).toHaveLength(500);
    expect(log[0]?.text.endsWith("…")).toBe(true);
  });
});

describe("formatClock", () => {
  it("formats local time as HH:MM:SS", () => {
    const time = new Date(2026, 10, 22, 9, 5, 7).getTime();
    expect(formatClock(time)).toBe("09:05:07");
  });
});

describe("detectLowEnd", () => {
  it.each([
    [{ deviceMemory: 2 }, true],
    [{ deviceMemory: 4 }, true],
    [{ deviceMemory: 8 }, false],
    [{ hardwareConcurrency: 2 }, true],
    [{ hardwareConcurrency: 4 }, false],
    [{ deviceMemory: 8, hardwareConcurrency: 2 }, true],
    [{ deviceMemory: 8, hardwareConcurrency: 8 }, false],
    [{}, false],
    [{ deviceMemory: 0, hardwareConcurrency: 0 }, false],
  ])("%j → %s", (hints, expected) => {
    expect(detectLowEnd(hints)).toBe(expected);
  });
});

describe("resolveLowEnd", () => {
  it("uses the stored choice first", () => {
    expect(resolveLowEnd("on", { deviceMemory: 8 })).toBe(true);
    expect(resolveLowEnd("off", { deviceMemory: 2 })).toBe(false);
  });

  it("falls back to detection", () => {
    expect(resolveLowEnd(null, { deviceMemory: 2 })).toBe(true);
    expect(resolveLowEnd("garbage", { deviceMemory: 8 })).toBe(false);
  });
});
