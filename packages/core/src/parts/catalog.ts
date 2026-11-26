/**
 * Parts catalogue for the parts drawer (ADR 010): category order and names, and a ranked search
 * over name, type, keywords, category and description. Typing a value ("10k", "4k7", "9V")
 * finds the parts that can have it and suggests it as the starting value — no server needed.
 */
import type { PartCategory } from "../circuit/component";
import { parseQuantity, unitOf } from "../circuit/quantities";
import type { PartDefinition } from "./part";
import { PARTS } from "./registry";

/** Drawer order and headings (only categories that have parts are shown). */
export const CATEGORY_LABELS: Readonly<Record<PartCategory, string>> = {
  source: "Sources",
  power: "Power & ground",
  passive: "Passives",
  electromechanical: "Switches & relays",
  semiconductor: "Semiconductors",
  ic: "Integrated circuits",
  input: "Inputs & sensors",
  output: "Outputs & displays",
  instrument: "Instruments",
  connector: "Connectors",
};
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as PartCategory[];

export interface PartGroup {
  readonly category: PartCategory;
  readonly label: string;
  readonly parts: readonly PartDefinition[];
}

/** Parts grouped by category in drawer order, alphabetical inside a group. */
export function groupParts(parts: readonly PartDefinition[] = PARTS): PartGroup[] {
  return CATEGORY_ORDER.flatMap((category) => {
    const inGroup = parts
      .filter((p) => p.category === category)
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
    return inGroup.length ? [{ category, label: CATEGORY_LABELS[category], parts: inGroup }] : [];
  });
}

export interface PartMatch {
  readonly part: PartDefinition;
  readonly score: number;
  /** A value typed in the search ("10k") to give the new part, already checked against its range. */
  readonly preset?: { readonly key: string; readonly value: number; readonly text: string };
}

/** Longest search text looked at (characters). */
const MAX_QUERY = 64;

function textScore(part: PartDefinition, token: string): number {
  const name = part.name.toLowerCase();
  if (name === token) return 100;
  if (name.startsWith(token)) return 80;
  if (name.split(/[^a-z0-9]+/).some((word) => word.startsWith(token))) return 60;
  if (part.keywords.some((k) => k === token)) return 55;
  if (part.keywords.some((k) => k.startsWith(token))) return 45;
  if (part.designatorPrefix.toLowerCase() === token) return 40;
  if (part.type.includes(token)) return 35;
  if (CATEGORY_LABELS[part.category].toLowerCase().includes(token)) return 25;
  if (part.description.toLowerCase().includes(token)) return 10;
  return 0;
}

/** A typed value ("10k", "9V") this part can take as its main value, or null. */
function valueMatch(
  part: PartDefinition,
  token: string,
): (PartMatch["preset"] & { score: number }) | null {
  const key = part.symbol.value?.key;
  const property = part.component?.properties.find((p) => p.key === key);
  // Only text that looks like a value (starts with a digit and has a letter: "10k", "4k7", "9v").
  if (
    !property ||
    property.kind !== "number" ||
    !/^[0-9.]/.test(token) ||
    !/[a-zµΩ]/i.test(token)
  ) {
    return null;
  }
  // "9v" → also try "9V": the unit's case is fixed, the prefix keeps its case (m ≠ M).
  const symbol = unitOf(property.quantity);
  const fixed = token.toLowerCase().endsWith(symbol.toLowerCase())
    ? token.slice(0, -symbol.length) + symbol
    : token;
  let parsed = parseQuantity(token, property.quantity, property);
  if (!parsed.ok && fixed !== token) parsed = parseQuantity(fixed, property.quantity, property);
  if (!parsed.ok) return null;
  const unit = symbol.toLowerCase();
  // Ohms can also be written as a word ("10kohm") or as the R letter of RKM codes ("220R", "4R7").
  const namesOhms = /ohm/i.test(token) || /^[0-9.]+r[0-9]*$/i.test(token);
  const namesUnit = token.toLowerCase().includes(unit) || (unit === "ω" && namesOhms);
  // "10k" with no unit means ohms (the usual shorthand); other quantities need their unit.
  const score = namesUnit ? 70 : property.quantity === "resistance" ? 65 : 0;
  return score ? { key: property.key, value: parsed.value, text: token, score } : null;
}

/**
 * Parts matching every word of `query`, best first. An empty query lists all parts in drawer
 * order. A word that is a value ("10k") matches parts that can take it and sets `preset`.
 */
export function searchParts(query: string, parts: readonly PartDefinition[] = PARTS): PartMatch[] {
  // Words as typed: values need their case ("2mA" is milli, "2MA" mega); text matching is lowercase.
  // Brackets and punctuation around a word are ignored ("(SPST)", "resistor,"), not inside ("4.7k").
  const words = query
    .slice(0, MAX_QUERY)
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}µΩ]+|[^\p{L}\p{N}µΩ%]+$/gu, ""))
    .filter(Boolean)
    .slice(0, 8);
  if (words.length === 0) {
    return groupParts(parts).flatMap((g) => g.parts.map((part) => ({ part, score: 0 })));
  }
  const matches: PartMatch[] = [];
  for (const part of parts) {
    let total = 0;
    let preset: PartMatch["preset"];
    let all = true;
    for (const word of words) {
      const token = word.toLowerCase();
      const text = textScore(part, token);
      const value = text ? null : valueMatch(part, word);
      if (!text && !value) {
        all = false;
        break;
      }
      total += text || (value?.score ?? 0);
      if (value) preset = { key: value.key, value: value.value, text: value.text };
    }
    if (all) matches.push({ part, score: total, ...(preset ? { preset } : {}) });
  }
  // Ties: the simpler part (fewer pins) first, so "10k" offers a resistor before a potentiometer.
  return matches.sort(
    (a, b) =>
      b.score - a.score ||
      a.part.symbol.pins.length - b.part.symbol.pins.length ||
      a.part.name.localeCompare(b.part.name, "en"),
  );
}
