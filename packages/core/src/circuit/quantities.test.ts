import { describe, expect, it } from "vitest";
import { parseRKM, parseSI } from "../units";
import { QUANTITIES, formatQuantity, parseQuantity, type Quantity } from "./quantities";

describe("parseRKM (IEC 60062 codes printed on parts)", () => {
  it.each([
    ["4k7", 4_700],
    ["1M5", 1.5e6],
    ["2K2", 2_200],
    ["4m7", 0.0047],
    ["4n7", 4.7e-9],
    ["2µ2", 2.2e-6],
    ["2u2", 2.2e-6],
    ["6p8", 6.8e-12],
    ["k47", 470],
  ])("reads %s", (text, expected) => {
    expect(parseRKM(text)).toBeCloseTo(expected, 15);
  });

  it("uses R only for resistance and F only for capacitance as the decimal point", () => {
    expect(parseRKM("2R2", "R")).toBe(2.2);
    expect(parseRKM("R47", "R")).toBe(0.47);
    expect(parseRKM("1F5", "F")).toBe(1.5);
    expect(parseRKM("2R2")).toBeNull();
    expect(parseRKM("2R2", "F")).toBeNull();
    expect(parseRKM("1F5", "R")).toBeNull();
  });

  it.each(["4k", "k", "4.7k", "4kk7", "4x7", "1234567k1", ""])("rejects %s", (text) => {
    expect(parseRKM(text, "R")).toBeNull();
  });
});

describe("parseSI with RKM codes", () => {
  it("accepts RKM codes, with or without the unit", () => {
    expect(parseSI("4k7")).toBe(4_700);
    expect(parseSI("4k7Ω", "Ω")).toBe(4_700);
    expect(parseSI("4k7 Ω", "Ω")).toBe(4_700);
    expect(parseSI("2R2")).toBe(2.2);
    expect(parseSI("4n7F", "F")).toBeCloseTo(4.7e-9, 20);
    expect(parseSI("1F5", "F")).toBe(1.5);
    expect(parseSI("4k7V", "Ω")).toBeNull();
  });
});

describe("parseQuantity", () => {
  it.each<[string, Quantity, number]>([
    ["4.7k", "resistance", 4_700],
    ["4k7", "resistance", 4_700],
    ["4.7 kΩ", "resistance", 4_700],
    ["4.7kΩ", "resistance", 4_700], // U+2126 OHM SIGN, as some keyboards type it
    ["220R", "resistance", 220],
    ["2R2", "resistance", 2.2],
    ["10 ohm", "resistance", 10],
    ["1meg", "resistance", 1e6],
    ["100n", "capacitance", 100e-9],
    ["4n7", "capacitance", 4.7e-9],
    ["10 µF", "capacitance", 10e-6],
    ["10uF", "capacitance", 10e-6],
    ["100 µH", "inductance", 100e-6],
    ["3.3 V", "voltage", 3.3],
    ["500 mV", "voltage", 0.5],
    ["-12", "voltage", -12],
    ["20 mA", "current", 0.02],
    ["250 mW", "power", 0.25],
    ["16 MHz", "frequency", 16e6],
    ["1khz", "frequency", 1_000],
    ["10 ms", "time", 0.01],
    ["27 °C", "temperature", 27],
    ["5 %", "percent", 0.05],
    ["1", "percent", 0.01],
    ["100k", "ratio", 100_000],
  ])("reads %s as %s", (text, quantity, expected) => {
    const result = parseQuantity(text, quantity);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeCloseTo(expected, 15);
  });

  it("refuses the wrong unit instead of guessing", () => {
    expect(parseQuantity("4.7 kF", "resistance")).toMatchObject({
      ok: false,
      reason: "not-a-number",
    });
    expect(parseQuantity("2R2", "capacitance").ok).toBe(false);
    expect(parseQuantity("5 V", "current").ok).toBe(false);
    expect(parseQuantity("10 S", "time").ok).toBe(false);
  });

  it("explains what to type when a value cannot be read", () => {
    const result = parseQuantity("abc", "resistance");
    expect(result).toEqual({
      ok: false,
      reason: "not-a-number",
      message: '"abc" is not a resistance. Try 4.7k, 4k7 or 220 Ω.',
    });
    expect(parseQuantity("", "voltage").ok).toBe(false);
    expect(parseQuantity("Ω", "resistance").ok).toBe(false);
    expect(parseQuantity("1".repeat(100), "voltage").ok).toBe(false);
  });

  it("checks the range with plain-word messages", () => {
    expect(parseQuantity("0", "resistance", { min: 0, exclusiveMin: true })).toEqual({
      ok: false,
      reason: "too-small",
      message: "Resistance must be more than 0 Ω.",
    });
    expect(parseQuantity("-1", "capacitance", { min: 0 })).toMatchObject({
      message: "Capacitance must be at least 0 F.",
    });
    expect(parseQuantity("2T", "resistance", { max: 1e12 })).toMatchObject({
      reason: "too-large",
      message: "Resistance must be at most 1 TΩ.",
    });
    expect(parseQuantity("60", "percent", { max: 0.5 })).toMatchObject({
      message: "Percent must be at most 50 %.",
    });
    expect(parseQuantity("1k", "resistance", { min: 0, exclusiveMin: true, max: 1e12 })).toEqual({
      ok: true,
      value: 1_000,
    });
  });

  it("never returns NaN or Infinity", () => {
    for (const text of ["NaN", "Infinity", "1e999", "-1e999", "1e308k"]) {
      const result = parseQuantity(text, "voltage");
      if (result.ok) expect(Number.isFinite(result.value)).toBe(true);
    }
  });
});

describe("formatQuantity", () => {
  it.each<[number, Quantity, string]>([
    [4_700, "resistance", "4.7 kΩ"],
    [100e-9, "capacitance", "100 nF"],
    [2.2e-6, "capacitance", "2.2 µF"],
    [0.02, "current", "20 mA"],
    [16e6, "frequency", "16 MHz"],
    [0.05, "percent", "5 %"],
    [27, "temperature", "27 °C"],
    [0, "voltage", "0 V"],
    [Number.NaN, "voltage", "—"],
  ])("shows %s as %s", (value, quantity, expected) => {
    expect(formatQuantity(value, quantity)).toBe(expected);
  });

  it("round-trips through parseQuantity for every quantity", () => {
    for (const quantity of Object.keys(QUANTITIES) as Quantity[]) {
      for (const value of [0.0047, 1, 220, 4.7e-9]) {
        if (quantity === "temperature" && value < 0.1) continue;
        const text = formatQuantity(value, quantity, 6);
        const result = parseQuantity(text, quantity);
        expect(result.ok, `${quantity}: ${text}`).toBe(true);
        if (result.ok) expect(result.value).toBeCloseTo(value, 12);
      }
    }
  });
});
