/**
 * Engineering notation with SI prefixes — used everywhere a learner types or reads a value
 * (resistance "4.7k", capacitance "100n", frequency "1.2M").
 */

const PREFIXES: ReadonlyArray<readonly [symbol: string, exponent: number]> = [
  ["T", 12],
  ["G", 9],
  ["M", 6],
  ["k", 3],
  ["", 0],
  ["m", -3],
  ["µ", -6],
  ["n", -9],
  ["p", -12],
];

/** Accepted spellings of each prefix when parsing ("u" for micro, "K" for kilo, "meg" as in SPICE). */
const PARSE_PREFIX: Readonly<Record<string, number>> = {
  T: 12,
  G: 9,
  M: 6,
  meg: 6,
  MEG: 6,
  k: 3,
  K: 3,
  m: -3,
  µ: -6,
  μ: -6,
  u: -6,
  n: -9,
  p: -12,
};

const NUMBER_WITH_PREFIX =
  /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(meg|MEG|[TGMkKmµμunp])?\s*(.*)$/i;

/**
 * Parses "4.7k", "4k7"-free plain notation, "100 nF", "-3.3", "2.2e-6", "1meg".
 * Returns `null` for anything that is not a finite number (never NaN), so callers can show a
 * friendly message instead of propagating bad values into a simulation.
 * A trailing unit (e.g. "F", "Ω", "Hz") is allowed and ignored; pass `unit` to restrict it.
 */
export function parseSI(input: string, unit?: string): number | null {
  const text = input.trim();
  if (text === "") return null;
  const match = NUMBER_WITH_PREFIX.exec(text);
  if (!match) return null;
  const [, numberPart = "", rawPrefix, rest = ""] = match;

  // A lone "m"/"M" etc. must be case-sensitive (milli vs mega); the regex is case-insensitive only
  // so that "e" exponents and "meg" work — re-check the prefix exactly.
  let exponent = 0;
  if (rawPrefix !== undefined) {
    const exact = PARSE_PREFIX[rawPrefix];
    if (exact === undefined) return null;
    exponent = exact;
  }

  const trailing = rest.trim();
  if (trailing !== "" && unit !== undefined && trailing !== unit) return null;
  if (trailing !== "" && unit === undefined && /[\d.]/.test(trailing)) return null;

  const value = Number(numberPart) * 10 ** exponent;
  return Number.isFinite(value) ? normalise(value) : null;
}

/**
 * Formats a value with the best SI prefix and `digits` significant digits:
 * formatSI(4700, "Ω") → "4.7 kΩ", formatSI(1e-7, "F") → "100 nF", formatSI(0, "V") → "0 V".
 */
export function formatSI(value: number, unit = "", digits = 3): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return unit ? `0 ${unit}` : "0";
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  let index = PREFIXES.findIndex(([, e]) => exponent >= e);
  if (index === -1) index = PREFIXES.length - 1;
  let scaled = round(value, index, digits);
  // Rounding can turn 999.95k into 1000k — use the next larger prefix instead.
  if (Math.abs(scaled) >= 1000 && index > 0) {
    index -= 1;
    scaled = round(value, index, digits);
  }
  const symbol = PREFIXES[index]?.[0] ?? "";
  const suffix = `${symbol}${unit}`;
  return suffix ? `${String(scaled)} ${suffix}` : String(scaled);
}

function round(value: number, index: number, digits: number): number {
  const exponent = PREFIXES[index]?.[1] ?? 0;
  return Number((value / 10 ** exponent).toPrecision(digits));
}

/** Clamps to [min, max] and snaps to `step` (relative to `min` when given). */
export function clampStep(value: number, opts: { min?: number; max?: number; step?: number } = {}) {
  const { min = -Infinity, max = Infinity, step } = opts;
  let v = value;
  if (step !== undefined && step > 0) {
    const origin = Number.isFinite(min) ? min : 0;
    v = origin + Math.round((v - origin) / step) * step;
    v = normalise(v);
  }
  return Math.min(max, Math.max(min, v));
}

/** Removes floating-point noise such as 0.30000000000000004. */
function normalise(value: number): number {
  return Number(value.toPrecision(12));
}
