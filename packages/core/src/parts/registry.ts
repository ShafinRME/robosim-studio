/**
 * Part registry (ADR 010): the one list every feature reads — symbols, designators, placement,
 * netlist pins, ERC and the simulator's `DefinitionLookup`. Built from the generated library index.
 */
import type { ComponentDefinition } from "../circuit/component";
import type { SymbolDefinition } from "../schematic/symbols";
import { LIBRARY } from "./library";
import type { PartDefinition } from "./part";

export const PARTS: readonly PartDefinition[] = LIBRARY;

const BY_TYPE: ReadonlyMap<string, PartDefinition> = new Map(PARTS.map((p) => [p.type, p]));

/** Every part's electrical model (parts with a fixed role, like ground, have none). */
export const COMPONENTS: readonly ComponentDefinition[] = PARTS.flatMap((p) =>
  p.component ? [p.component] : [],
);

/** Every part's schematic symbol. */
export const SYMBOLS: readonly SymbolDefinition[] = PARTS.map((p) => p.symbol);

export function partFor(type: string): PartDefinition | undefined {
  return BY_TYPE.get(type);
}

/** The electrical model of a part type (ADR 007 `DefinitionLookup`). */
export function componentFor(type: string): ComponentDefinition | undefined {
  return BY_TYPE.get(type)?.component;
}

export function symbolFor(type: string): SymbolDefinition | undefined {
  return BY_TYPE.get(type)?.symbol;
}

/** Designator prefix of a part type; "X" for types not in the library. */
export function designatorPrefix(type: string): string {
  return BY_TYPE.get(type)?.designatorPrefix ?? "X";
}

/** A part that must exist (tests and built-in features). */
export function requirePart(type: string): PartDefinition {
  const part = BY_TYPE.get(type);
  if (!part) throw new Error(`no part "${type}" in the library`);
  return part;
}

/** The electrical model of a part that must have one. */
export function requireComponent(type: string): ComponentDefinition {
  const component = requirePart(type).component;
  if (!component) throw new Error(`part "${type}" has no electrical model`);
  return component;
}
