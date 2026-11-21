import { describe, expect, it } from "vitest";
import { clampStep, formatSI, parseSI } from "./units";

describe("parseSI", () => {
  it.each([
    ["4.7k", 4700],
    ["4.7 kΩ", 4700],
    ["100n", 100e-9],
    ["100 nF", 100e-9],
    ["2.2µ", 2.2e-6],
    ["2.2u", 2.2e-6],
    ["1M", 1e6],
    ["1meg", 1e6],
    ["3m", 0.003],
    ["-3.3", -3.3],
    [".5", 0.5],
    ["2.2e-6", 2.2e-6],
    ["0", 0],
    ["10 Hz", 10],
  ])("parses %s", (text, expected) => {
    expect(parseSI(text)).toBeCloseTo(expected, 15);
  });

  it.each(["", "abc", "k", "1..2", "--1", "1 2", "Infinity", "NaN"])(
    "rejects %s without returning NaN",
    (text) => {
      expect(parseSI(text)).toBeNull();
    },
  );

  it("distinguishes milli (m) from mega (M)", () => {
    expect(parseSI("1m")).toBe(0.001);
    expect(parseSI("1M")).toBe(1e6);
  });

  it("checks the unit when one is required", () => {
    expect(parseSI("10 V", "V")).toBe(10);
    expect(parseSI("10 A", "V")).toBeNull();
  });

  it("removes floating-point noise", () => {
    expect(parseSI("0.1m")).toBe(0.0001);
  });
});

describe("formatSI", () => {
  it.each([
    [4700, "Ω", "4.7 kΩ"],
    [1e-7, "F", "100 nF"],
    [0, "V", "0 V"],
    [1.23456, "V", "1.23 V"],
    [0.0125, "A", "12.5 mA"],
    [999_950, "Hz", "1 MHz"],
    [-3.3, "V", "-3.3 V"],
    [2.5e-13, "F", "0.25 pF"],
    [42, "", "42"],
  ])("formats %d %s as %s", (value, unit, expected) => {
    expect(formatSI(value, unit)).toBe(expected);
  });

  it("never prints NaN", () => {
    expect(formatSI(Number.NaN, "V")).toBe("—");
    expect(formatSI(Number.POSITIVE_INFINITY, "V")).toBe("—");
  });

  it("round-trips through parseSI", () => {
    for (const v of [1, 4700, 2.2e-6, 1.5e9, 0.033]) {
      expect(parseSI(formatSI(v))).toBeCloseTo(v, 12);
    }
  });
});

describe("clampStep", () => {
  it("clamps to the range", () => {
    expect(clampStep(12, { min: 0, max: 10 })).toBe(10);
    expect(clampStep(-1, { min: 0, max: 10 })).toBe(0);
  });

  it("snaps to the step without floating-point noise", () => {
    expect(clampStep(0.30000000000000004, { step: 0.1 })).toBe(0.3);
    expect(clampStep(7, { min: 1, step: 2 })).toBe(7);
    expect(clampStep(6, { min: 1, step: 2 })).toBe(7);
  });
});
