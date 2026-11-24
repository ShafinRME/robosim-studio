/**
 * Physical quantities used by part properties and readouts (ADR 007 §3).
 *
 * Inside the solver and in files every value is a plain number in SI base units; the quantity
 * tells the UI which unit to show and which spellings to accept when a learner types a value.
 * Display follows ISO 80000 / the SI brochure: a space between number and unit, "µ" for micro.
 */
import { formatSI, parseRKM, parseSI } from "../units";

interface QuantityInfo {
  readonly unit: string;
  readonly label: string;
  /** Accepted unit spellings when typing (longest match wins; case-sensitive unless listed). */
  readonly aliases: readonly string[];
  /** Letter used as the decimal point in RKM codes ("2R2", "1F5"). */
  readonly decimalLetter?: "R" | "F";
  /** Example shown when a value cannot be read. */
  readonly example: string;
  /** Use SI prefixes when displaying (not for °C or %). */
  readonly prefixes: boolean;
}

export const QUANTITIES = {
  resistance: {
    unit: "Ω",
    label: "Resistance",
    aliases: ["Ω", "Ω", "ohms", "ohm", "Ohms", "Ohm", "R"],
    decimalLetter: "R",
    example: "4.7k, 4k7 or 220 Ω",
    prefixes: true,
  },
  conductance: {
    unit: "S",
    label: "Conductance",
    aliases: ["S"],
    example: "1m or 2 mS",
    prefixes: true,
  },
  capacitance: {
    unit: "F",
    label: "Capacitance",
    aliases: ["F"],
    decimalLetter: "F",
    example: "100n, 4n7 or 10 µF",
    prefixes: true,
  },
  inductance: {
    unit: "H",
    label: "Inductance",
    aliases: ["H"],
    example: "10m or 100 µH",
    prefixes: true,
  },
  voltage: {
    unit: "V",
    label: "Voltage",
    aliases: ["V"],
    example: "5, 3.3 V or 500 mV",
    prefixes: true,
  },
  current: {
    unit: "A",
    label: "Current",
    aliases: ["A"],
    example: "20m, 20 mA or 1.5 A",
    prefixes: true,
  },
  power: {
    unit: "W",
    label: "Power",
    aliases: ["W"],
    example: "0.25, 250 mW or 1 W",
    prefixes: true,
  },
  frequency: {
    unit: "Hz",
    label: "Frequency",
    aliases: ["Hz", "hz", "HZ"],
    example: "50, 1k or 16 MHz",
    prefixes: true,
  },
  time: { unit: "s", label: "Time", aliases: ["s"], example: "1m, 10 ms or 2 s", prefixes: true },
  temperature: {
    unit: "°C",
    label: "Temperature",
    aliases: ["°C", "℃", "C"],
    example: "27 or 85 °C",
    prefixes: false,
  },
  /** Plain number without a unit (gain, ratio, ideality factor…). */
  ratio: { unit: "", label: "Value", aliases: [], example: "1, 0.5 or 100k", prefixes: true },
  /** Percent, stored as a fraction (5 % → 0.05). Typed as "5" or "5 %". */
  percent: { unit: "%", label: "Percent", aliases: ["%"], example: "5 or 1 %", prefixes: false },
} as const satisfies Record<string, QuantityInfo>;

export type Quantity = keyof typeof QUANTITIES;

export function unitOf(quantity: Quantity): string {
  return QUANTITIES[quantity].unit;
}

export interface QuantityRange {
  readonly min?: number;
  readonly max?: number;
  /** Value must be strictly greater than `min`. */
  readonly exclusiveMin?: boolean;
}

export type QuantityParseResult =
  | { ok: true; value: number }
  | { ok: false; reason: "not-a-number" | "too-small" | "too-large"; message: string };

const MAX_INPUT_LENGTH = 64;

/** Shows a value with its unit: "4.7 kΩ", "100 nF", "5 %", "27 °C". Never prints NaN. */
export function formatQuantity(value: number, quantity: Quantity, digits = 3): string {
  const info: QuantityInfo = QUANTITIES[quantity];
  if (!Number.isFinite(value)) return "—";
  if (quantity === "percent") return `${Number((value * 100).toPrecision(digits))} %`;
  if (!info.prefixes) return `${Number(value.toPrecision(digits))} ${info.unit}`;
  return formatSI(value, info.unit, digits);
}

/**
 * Reads what a learner typed for a quantity — "4.7k", "4k7", "4.7 kΩ", "220R", "100 nF", "5 %" —
 * and checks the range. Wrong units ("4.7 kF" for a resistance) are refused, never guessed.
 * Messages are plain words for the inspector: "Resistance must be more than 0 Ω."
 */
export function parseQuantity(
  input: string,
  quantity: Quantity,
  range: QuantityRange = {},
): QuantityParseResult {
  const info: QuantityInfo = QUANTITIES[quantity];
  const text = input.length > MAX_INPUT_LENGTH ? "" : input.trim().replace(/\s+/g, " ");
  const notANumber = {
    ok: false as const,
    reason: "not-a-number" as const,
    message: `"${input.length > 24 ? `${input.slice(0, 24)}…` : input}" is not a ${info.label.toLowerCase()}. Try ${info.example}.`,
  };
  if (text === "") return notANumber;

  // Strip one unit spelling at the end (longest first), then read the number with its prefix.
  let body = text;
  for (const alias of [...info.aliases].sort((a, b) => b.length - a.length)) {
    if (body.endsWith(alias) && body.length > alias.length) {
      body = body.slice(0, -alias.length).trimEnd();
      break;
    }
  }
  let value = parseRKM(body, info.decimalLetter) ?? parseSI(body, "");
  if (value === null) return notANumber;
  if (quantity === "percent") value = value / 100;

  const { min, max, exclusiveMin } = range;
  if (min !== undefined && (exclusiveMin ? value <= min : value < min)) {
    const limit = formatQuantity(min, quantity);
    return {
      ok: false,
      reason: "too-small",
      message: `${info.label} must be ${exclusiveMin ? "more than" : "at least"} ${limit}.`,
    };
  }
  if (max !== undefined && value > max) {
    return {
      ok: false,
      reason: "too-large",
      message: `${info.label} must be at most ${formatQuantity(max, quantity)}.`,
    };
  }
  return { ok: true, value };
}
