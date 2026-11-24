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

/** Longest text we try to parse. Real values are short; this also bounds the work per keystroke. */
const MAX_INPUT_LENGTH = 64;

/**
 * Unambiguous on purpose (no ReDoS): every character can be matched in only one way —
 * digits then an optional ".digits", an optional exponent, at most one space, an optional prefix,
 * at most one space, then a unit that cannot start with a digit/sign/dot. Whitespace runs are
 * collapsed and the length is capped before matching.
 */
const NUMBER_WITH_PREFIX =
  /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?) ?(meg|MEG|[TGMkKmµμunp])? ?([^ \d.+-][^ ]*)?$/;

/**
 * RKM code (IEC 60062), as printed on resistors and capacitors: the multiplier letter stands where
 * the decimal point would be — "4k7" = 4.7 k, "1M5" = 1.5 M, "4n7" = 4.7 n, "R47" = 0.47.
 * Bounded digits on both sides, letter in the middle: unambiguous, no ReDoS.
 */
const RKM = /^(\d{0,6})(R|F|[TGMkKmµμunp])(\d{1,6})$/;

/**
 * Parses an RKM code. `decimalLetter` allows the unit letter used as a plain decimal point:
 * "R" for resistance ("2R2" = 2.2 Ω), "F" for capacitance ("1F5" = 1.5 F). Returns `null` otherwise.
 */
export function parseRKM(input: string, decimalLetter?: "R" | "F"): number | null {
  if (input.length > MAX_INPUT_LENGTH) return null;
  const match = RKM.exec(input.trim());
  if (!match) return null;
  const [, whole = "", letter = "", fraction = ""] = match;
  let exponent: number;
  if (letter === "R" || letter === "F") {
    if (letter !== decimalLetter) return null;
    exponent = 0;
  } else {
    const known = PARSE_PREFIX[letter];
    if (known === undefined) return null;
    exponent = known;
  }
  const value = Number(`${whole || "0"}.${fraction}`) * 10 ** exponent;
  return Number.isFinite(value) ? normalise(value) : null;
}

/**
 * Parses "4.7k", "100 nF", "-3.3", "2.2e-6", "1meg" and RKM codes ("4k7", "4k7 Ω", "2R2").
 * Returns `null` for anything that is not a finite number (never NaN), so callers can show a
 * friendly message instead of propagating bad values into a simulation.
 * A trailing unit (e.g. "F", "Ω", "Hz") is allowed and ignored; pass `unit` to restrict it
 * (`""` = no unit allowed).
 */
export function parseSI(input: string, unit?: string): number | null {
  if (input.length > MAX_INPUT_LENGTH) return null;
  const text = input.trim().replace(/\s+/g, " ");
  if (text === "") return null;
  const plain = parsePlain(text, unit);
  if (plain !== null) return plain;
  // "4k7" also looks like the number 4 with a unit "k7", so RKM is tried whenever that fails.
  const body = unit && text.endsWith(unit) ? text.slice(0, -unit.length).trimEnd() : text;
  return parseRKM(body, unit === undefined || unit === "Ω" ? "R" : unit === "F" ? "F" : undefined);
}

function parsePlain(text: string, unit: string | undefined): number | null {
  const match = NUMBER_WITH_PREFIX.exec(text);
  if (!match) return null;
  const [, numberPart = "", rawPrefix, rest = ""] = match;

  // Prefixes are case-sensitive (m = milli, M = mega); the lookup table is the single source of truth.
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
