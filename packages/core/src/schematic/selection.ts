/**
 * Schematic selection and placement helpers (ADR 008), pure and unit-tested.
 *
 * Hit-testing uses each part's placed bounding box (plus a small tolerance in mils); the part
 * drawn last (on top) wins. Box selection follows EDA/CAD tools: dragging left → right selects
 * parts fully inside the box, right → left selects everything the box touches.
 */
import { REFERENCE_PARTS } from "../circuit/reference-parts";
import type { ComponentDefinition } from "../circuit/component";
import type { Part } from "../project";
import { designatorPrefix, nextDesignator, placedBounds, symbolFor } from "./symbols";
import type { Point, Rect } from "./viewport";

/** Half-size of the box drawn for a part type without a symbol (mils). */
export const UNKNOWN_PART_HALF = 200;

/** World bounding box of a part (its symbol, or a placeholder box for unknown types). */
export function partBounds(part: Pick<Part, "type" | "x" | "y" | "rotation" | "flip">): Rect {
  const symbol = symbolFor(part.type);
  if (symbol) return placedBounds(part, symbol);
  return {
    minX: part.x - UNKNOWN_PART_HALF,
    minY: part.y - UNKNOWN_PART_HALF / 2,
    maxX: part.x + UNKNOWN_PART_HALF,
    maxY: part.y + UNKNOWN_PART_HALF / 2,
  };
}

export function rectFromPoints(a: Point, b: Point): Rect {
  return {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
  };
}

function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.minX >= outer.minX &&
    inner.maxX <= outer.maxX &&
    inner.minY >= outer.minY &&
    inner.maxY <= outer.maxY
  );
}

function intersects(a: Rect, b: Rect): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

/** The topmost part under `point`, or null. `tolerance` widens thin symbols (mils). */
export function hitTest(parts: readonly Part[], point: Point, tolerance = 30): Part | null {
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (!part) continue;
    const b = partBounds(part);
    if (
      point.x >= b.minX - tolerance &&
      point.x <= b.maxX + tolerance &&
      point.y >= b.minY - tolerance &&
      point.y <= b.maxY + tolerance
    ) {
      return part;
    }
  }
  return null;
}

export type BoxMode = "inside" | "touch";

/** Box-selection mode from the drag direction: left → right = inside, right → left = touch. */
export function boxModeOf(start: Point, end: Point): BoxMode {
  return end.x >= start.x ? "inside" : "touch";
}

/** Ids of the parts selected by a box. */
export function partsInRect(parts: readonly Part[], rect: Rect, mode: BoxMode): string[] {
  return parts
    .filter((part) =>
      mode === "inside" ? contains(rect, partBounds(part)) : intersects(rect, partBounds(part)),
    )
    .map((part) => part.id);
}

// ─── Placement catalogue ─────────────────────────────────────────────────────────────────────────

export interface PlaceablePart {
  readonly type: string;
  readonly label: string;
  readonly definition?: ComponentDefinition;
}

/**
 * Parts that can be placed today (Day 12). The searchable parts library (Day 14) replaces this
 * list with the full registry; the reference parts plus ground are enough to draw DC circuits.
 */
export const PLACEABLE_PARTS: readonly PlaceablePart[] = [
  ...REFERENCE_PARTS.map((definition) => ({
    type: definition.type,
    label: definition.name,
    definition,
  })),
  { type: "ground", label: "Ground" },
];

/**
 * A new part of `type` at `at` with the next free designator (R1, R2…) and the definition's
 * default property values (stored explicitly, so the file says what was simulated).
 */
export function createPart(
  type: string,
  at: Point,
  existing: readonly Pick<Part, "name">[],
  options: { id: string; rotation?: number; flip?: boolean },
): Part {
  const placeable = PLACEABLE_PARTS.find((p) => p.type === type);
  const props: Part["props"] = {};
  for (const property of placeable?.definition?.properties ?? [])
    props[property.key] = property.default;
  const prefix = placeable?.definition?.designatorPrefix ?? designatorPrefix(type);
  return {
    id: options.id,
    type,
    name: nextDesignator(
      prefix,
      existing.map((p) => p.name),
    ),
    x: at.x,
    y: at.y,
    rotation: options.rotation ?? 0,
    flip: options.flip ?? false,
    props,
  };
}
