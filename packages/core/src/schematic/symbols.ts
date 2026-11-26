/**
 * Schematic symbols (ADR 007 §5, ADR 008): our own artwork as simple vector primitives in mils,
 * drawn at rotation 0 around the part's origin. Two styles: IEC 60617 and ANSI/IEEE 315.
 *
 * Pins sit on the 100-mil grid, so wires always meet them exactly. Geometry lives in core (pure)
 * because wiring (Day 13), hit-testing and export need the same pin positions as the drawing.
 */
import type { Quantity } from "../circuit/quantities";
import type { Point, Rect } from "./viewport";

export type SymbolStyle = "iec" | "ansi";
export const SYMBOL_STYLES: readonly SymbolStyle[] = ["iec", "ansi"];

export type Primitive =
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "polyline"; points: readonly (readonly [number, number])[] }
  /** Closed and filled with the stroke colour (arrow heads). */
  | { kind: "polygon"; points: readonly (readonly [number, number])[] }
  | { kind: "rect"; x: number; y: number; width: number; height: number }
  | { kind: "circle"; cx: number; cy: number; r: number };

export interface SymbolPin {
  readonly id: string;
  /** Connection point (end of the pin line), in mils at rotation 0. */
  readonly x: number;
  readonly y: number;
}

export interface SymbolDefinition {
  /** Part type it draws ("resistor", "ground"…). */
  readonly type: string;
  /** Body outline at rotation 0 (pins included), for selection, fit and hit-testing. */
  readonly bounds: Rect;
  readonly pins: readonly SymbolPin[];
  readonly body: Readonly<Record<SymbolStyle, readonly Primitive[]>>;
  /** Where the designator and value labels sit at rotation 0 (text is always drawn upright). */
  readonly labels?: { readonly designator: Point; readonly value: Point };
  /** The property shown as the value label ("4.7 kΩ"). */
  readonly value?: { readonly key: string; readonly quantity: Quantity };
  /**
   * Other artwork while a property has a given value (a closed switch). The first matching state
   * wins; otherwise `body` is drawn.
   */
  readonly states?: readonly SymbolState[];
}

export interface SymbolState {
  readonly key: string;
  readonly value: string | number | boolean;
  readonly body: Readonly<Record<SymbolStyle, readonly Primitive[]>>;
}

/** The artwork to draw for a part with these property values. */
export function bodyFor(
  symbol: SymbolDefinition,
  props?: Readonly<Record<string, string | number | boolean>>,
): Readonly<Record<SymbolStyle, readonly Primitive[]>> {
  if (!props || !symbol.states) return symbol.body;
  return symbol.states.find((state) => props[state.key] === state.value)?.body ?? symbol.body;
}

// Symbols live in the part files (ADR 010); the registry is the one list.
export { SYMBOLS, designatorPrefix, symbolFor } from "../parts/registry";

// ─── Transforms ──────────────────────────────────────────────────────────────────────────────────

export interface Placement {
  readonly x: number;
  readonly y: number;
  /** Degrees clockwise (multiples of 90 on the schematic). */
  readonly rotation: number;
  readonly flip: boolean;
}

/** Symbol-local point → world: mirror X first (if flipped), then rotate clockwise, then move. */
export function placePoint(placement: Placement, local: Point): Point {
  const mx = placement.flip ? -local.x : local.x;
  const rad = (placement.rotation * Math.PI) / 180;
  const cos = Math.round(Math.cos(rad) * 1e12) / 1e12;
  const sin = Math.round(Math.sin(rad) * 1e12) / 1e12;
  // Clockwise on screen with y down: (x, y) → (x·cos − y·sin, x·sin + y·cos).
  return {
    x: placement.x + mx * cos - local.y * sin + 0,
    y: placement.y + mx * sin + local.y * cos + 0,
  };
}

/** SVG transform for a placed symbol (SVG applies the list right to left: mirror, rotate, move). */
export function placementTransform(placement: Placement): string {
  const parts = [`translate(${placement.x} ${placement.y})`];
  if (placement.rotation) parts.push(`rotate(${placement.rotation})`);
  if (placement.flip) parts.push("scale(-1 1)");
  return parts.join(" ");
}

/** World positions of a placed symbol's pins. */
export function placedPins(
  placement: Placement,
  symbol: SymbolDefinition,
): { id: string; x: number; y: number }[] {
  return symbol.pins.map((pin) => ({ id: pin.id, ...placePoint(placement, pin) }));
}

/** World bounding box of a placed symbol. */
export function placedBounds(placement: Placement, symbol: SymbolDefinition): Rect {
  const { minX, minY, maxX, maxY } = symbol.bounds;
  const corners = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: minX, y: maxY },
    { x: maxX, y: maxY },
  ].map((c) => placePoint(placement, c));
  return {
    minX: Math.min(...corners.map((c) => c.x)),
    minY: Math.min(...corners.map((c) => c.y)),
    maxX: Math.max(...corners.map((c) => c.x)),
    maxY: Math.max(...corners.map((c) => c.y)),
  };
}

/**
 * Where an upright label goes and how it is aligned: the anchor follows the part's rotation and
 * flip, the text itself never turns upside down (as in professional EDA tools).
 */
export function placeLabel(
  placement: Placement,
  local: Point,
): {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  baseline: "auto" | "middle" | "hanging";
} {
  const origin = placePoint(placement, { x: 0, y: 0 });
  const at = placePoint(placement, local);
  const dx = at.x - origin.x;
  const dy = at.y - origin.y;
  const anchor = Math.abs(dx) < 1 ? "middle" : dx > 0 ? "start" : "end";
  // Beside the body (left/right): centre vertically. Above/below: sit on/hang from the line.
  const baseline =
    anchor !== "middle" && Math.abs(dy) < Math.abs(dx) ? "middle" : dy < 0 ? "auto" : "hanging";
  return { x: at.x, y: at.y, anchor, baseline };
}

export type PlacedLabel = ReturnType<typeof placeLabel>;

/** Distance between the designator line and the value line when they are stacked (mils). */
const LABEL_LINE = 70;

/**
 * Places the designator and value labels together. When both end up on the same side of the part
 * they are stacked like in EDA tools — designator on top, value under it — instead of sharing a
 * line ("V1" over "9 V", never "9 V V1").
 */
export function placeLabels(
  placement: Placement,
  symbol: SymbolDefinition,
): { designator: PlacedLabel; value: PlacedLabel } | null {
  if (!symbol.labels) return null;
  const origin = placePoint(placement, { x: 0, y: 0 });
  const d = placeLabel(placement, symbol.labels.designator);
  const v = placeLabel(placement, symbol.labels.value);
  const side = (l: PlacedLabel) => {
    const dx = l.x - origin.x;
    const dy = l.y - origin.y;
    return Math.abs(dx) >= Math.abs(dy)
      ? dx >= 0
        ? "right"
        : "left"
      : dy >= 0
        ? "below"
        : "above";
  };
  const sd = side(d);
  if (sd !== side(v)) return { designator: d, value: v };
  if (sd === "left" || sd === "right") {
    const spread = Math.max(Math.abs(d.y - origin.y), Math.abs(v.y - origin.y), LABEL_LINE / 2);
    return {
      designator: { ...d, y: origin.y - spread, baseline: "middle" },
      value: { ...v, x: d.x, y: origin.y + spread, baseline: "middle" },
    };
  }
  const distance = Math.max(Math.abs(d.y - origin.y), Math.abs(v.y - origin.y));
  const first = sd === "below" ? origin.y + distance : origin.y - distance - LABEL_LINE;
  const centred = { x: origin.x, anchor: "middle" as const };
  return {
    designator: { ...centred, y: first, baseline: sd === "below" ? "hanging" : "auto" },
    value: { ...centred, y: first + LABEL_LINE, baseline: sd === "below" ? "hanging" : "auto" },
  };
}

// ─── Reference designators ───────────────────────────────────────────────────────────────────────

/** Lowest free designator for a prefix: R1, R2, … (gaps are reused, like EDA annotation). */
export function nextDesignator(prefix: string, existing: Iterable<string>): string {
  const used = new Set<number>();
  for (const name of existing) {
    if (!name.startsWith(prefix)) continue;
    const digits = name.slice(prefix.length);
    if (/^[1-9]\d{0,5}$/.test(digits)) used.add(Number(digits));
  }
  let n = 1;
  while (used.has(n)) n++;
  return `${prefix}${n}`;
}
