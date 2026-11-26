/**
 * The one-file part format (ADR 010): everything about one part — catalogue entry, schematic
 * symbol and electrical model — in one `definePart({...})` call in `parts/library/<part>.ts`.
 *
 * `definePart` only joins the pieces (no checks at import time, so a broken file never breaks the
 * whole studio); `checkPart` lists every mistake and is run over the whole library by unit tests.
 */
import {
  PART_CATEGORIES,
  checkDefinition,
  type ComponentDefinition,
  type PartCategory,
} from "../circuit/component";
import type { SymbolDefinition } from "../schematic/symbols";

/** The electrical model: a component definition without the catalogue fields it shares. */
export type PartModel = Omit<
  ComponentDefinition,
  "type" | "name" | "category" | "designatorPrefix"
>;

/** What a part file writes. */
export interface PartSpec {
  /** Stable id stored in projects ("resistor", "source.dc-voltage"). Never change it once released. */
  readonly type: string;
  /** Name in the parts drawer ("Resistor"). */
  readonly name: string;
  /** One plain sentence for beginners, shown in the drawer and tooltips. */
  readonly description: string;
  readonly category: PartCategory;
  /** Extra lowercase search words ("res", "ohm", "battery"). */
  readonly keywords: readonly string[];
  /** Reference designator prefix: R, V, I, SW, RV, GND… */
  readonly designatorPrefix: string;
  /** IEC and ANSI artwork with pins on the 100-mil grid (ADR 008). */
  readonly symbol: Omit<SymbolDefinition, "type">;
  /** Electrical model (ADR 007). Omitted only for parts with a fixed netlist `role`. */
  readonly model?: PartModel;
  /** "ground": the part's pin is node 0 (ground symbols). */
  readonly role?: "ground";
}

/** A part as the registry hands it out: symbol and component carry the part's type. */
export interface PartDefinition {
  readonly type: string;
  readonly name: string;
  readonly description: string;
  readonly category: PartCategory;
  readonly keywords: readonly string[];
  readonly designatorPrefix: string;
  readonly symbol: SymbolDefinition;
  /** Undefined for parts with a fixed role (ground). */
  readonly component?: ComponentDefinition;
  readonly role?: "ground";
}

/** Joins a part file's pieces into a registry entry (see `checkPart` for the rules). */
export function definePart(spec: PartSpec): PartDefinition {
  const { model, symbol, ...entry } = spec;
  return {
    ...entry,
    symbol: { ...symbol, type: spec.type },
    ...(model
      ? {
          component: {
            ...model,
            type: spec.type,
            name: spec.name,
            category: spec.category,
            designatorPrefix: spec.designatorPrefix,
          },
        }
      : {}),
  };
}

const PREFIX = /^[A-Z]{1,3}$/;
const KEYWORD = /^[a-z0-9][a-z0-9 .+-]{0,31}$/;
const GRID = 100;

/** Every mistake in one part (empty = valid). */
export function checkPart(part: PartDefinition): string[] {
  const where = `"${part.type}"`;
  const problems: string[] = [];
  if (part.name.trim().length === 0 || part.name.length > 40) problems.push(`${where}: bad name`);
  if (part.description.trim().length === 0 || part.description.length > 200) {
    problems.push(`${where}: description must be 1–200 characters`);
  }
  if (!PART_CATEGORIES.includes(part.category)) problems.push(`${where}: unknown category`);
  if (!PREFIX.test(part.designatorPrefix)) {
    problems.push(`${where}: designator prefix must be 1–3 capital letters`);
  }
  for (const word of part.keywords) {
    if (!KEYWORD.test(word)) problems.push(`${where}: keyword "${word}" must be lowercase`);
  }

  // Symbol: pins on the grid and inside the bounds, unique ids.
  const { symbol } = part;
  const { minX, minY, maxX, maxY } = symbol.bounds;
  const symbolPins = symbol.pins.map((p) => p.id);
  if (symbolPins.length === 0) problems.push(`${where}: symbol has no pins`);
  if (new Set(symbolPins).size !== symbolPins.length)
    problems.push(`${where}: duplicate symbol pin`);
  for (const pin of symbol.pins) {
    if (pin.x % GRID !== 0 || pin.y % GRID !== 0) {
      problems.push(`${where}: pin "${pin.id}" is not on the 100-mil grid`);
    }
    if (pin.x < minX || pin.x > maxX || pin.y < minY || pin.y > maxY) {
      problems.push(`${where}: pin "${pin.id}" is outside the symbol bounds`);
    }
  }
  if (symbol.body.iec.length === 0 || symbol.body.ansi.length === 0) {
    problems.push(`${where}: symbol needs artwork in both styles`);
  }

  // Model: the ADR 007 checks, and the same pins as the symbol.
  if (part.role === "ground") {
    if (part.component) problems.push(`${where}: a ground part has no electrical model`);
  } else if (!part.component) {
    problems.push(`${where}: needs an electrical model (or a role)`);
  } else {
    problems.push(...checkDefinition(part.component));
    const modelPins = part.component.pins.map((p) => p.id);
    if ([...modelPins].sort().join("|") !== [...symbolPins].sort().join("|")) {
      problems.push(`${where}: symbol pins [${symbolPins}] ≠ model pins [${modelPins}]`);
    }
  }

  // The value label shows a number property of the same quantity.
  if (symbol.value) {
    const property = part.component?.properties.find((p) => p.key === symbol.value?.key);
    if (property?.kind !== "number" || property.quantity !== symbol.value.quantity) {
      problems.push(
        `${where}: value label "${symbol.value.key}" is not a matching number property`,
      );
    }
  }
  return problems;
}
