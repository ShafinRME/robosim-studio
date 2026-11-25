/**
 * Schematic selection and placement helpers (ADR 008), pure and unit-tested.
 *
 * Hit-testing uses each part's placed bounding box (plus a small tolerance in mils); the part
 * drawn last (on top) wins. Box selection follows EDA/CAD tools: dragging left → right selects
 * parts fully inside the box, right → left selects everything the box touches.
 */
import { REFERENCE_PARTS } from "../circuit/reference-parts";
import type { ComponentDefinition } from "../circuit/component";
import type { NetLabel, Part, Wire, WirePoint } from "../project";
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

/** Distance (mils) from `p` to the orthogonal segment a–b. */
function segmentDistance(p: Point, a: WirePoint, b: WirePoint): number {
  const x = Math.min(Math.max(p.x, Math.min(a[0], b[0])), Math.max(a[0], b[0]));
  const y = Math.min(Math.max(p.y, Math.min(a[1], b[1])), Math.max(a[1], b[1]));
  return Math.hypot(p.x - x, p.y - y);
}

/** The topmost wire with a segment within `tolerance` (mils) of `point`, or null. */
export function hitTestWire(wires: readonly Wire[], point: Point, tolerance = 20): Wire | null {
  for (let i = wires.length - 1; i >= 0; i--) {
    const wire = wires[i];
    if (!wire) continue;
    for (let j = 1; j < wire.points.length; j++) {
      const a = wire.points[j - 1] as WirePoint;
      const b = wire.points[j] as WirePoint;
      if (segmentDistance(point, a, b) <= tolerance) return wire;
    }
  }
  return null;
}

/** Ids of the wires selected by a box: all points inside, or (touch) any segment crossing it. */
export function wiresInRect(wires: readonly Wire[], rect: Rect, mode: BoxMode): string[] {
  return wires
    .filter((wire) => {
      if (mode === "inside") {
        return wire.points.every(([x, y]) =>
          contains(rect, { minX: x, minY: y, maxX: x, maxY: y }),
        );
      }
      for (let j = 1; j < wire.points.length; j++) {
        const [x1, y1] = wire.points[j - 1] as WirePoint;
        const [x2, y2] = wire.points[j] as WirePoint;
        const seg = {
          minX: Math.min(x1, x2),
          minY: Math.min(y1, y2),
          maxX: Math.max(x1, x2),
          maxY: Math.max(y1, y2),
        };
        if (intersects(rect, seg)) return true;
      }
      return false;
    })
    .map((wire) => wire.id);
}

// ─── Net labels ──────────────────────────────────────────────────────────────────────────────────

/** Net label text size (mils) and how far the text sits off its wire. */
export const LABEL_TEXT_SIZE = 50;
export const LABEL_GAP = 15;
/** Advance of one monospace character (≈ 0.6 em) plus a little padding at the start. */
const LABEL_CHAR = 0.6 * LABEL_TEXT_SIZE;
const LABEL_PAD = 10;

/**
 * Text box of a net label (KiCad-style local label): the text starts at the label's point and runs
 * along its wire — right (0°), left (180°), up (90°) or down (270°) — on the upper / left side.
 */
export function labelBounds(label: Pick<NetLabel, "x" | "y" | "name" | "rotation">): Rect {
  const w = LABEL_PAD + label.name.length * LABEL_CHAR;
  const h = LABEL_GAP + LABEL_TEXT_SIZE;
  const { x, y } = label;
  switch (label.rotation) {
    case 90:
      return { minX: x - h, minY: y - w, maxX: x, maxY: y };
    case 180:
      return { minX: x - w, minY: y - h, maxX: x, maxY: y };
    case 270:
      return { minX: x - h, minY: y, maxX: x, maxY: y + w };
    default:
      return { minX: x, minY: y - h, maxX: x + w, maxY: y };
  }
}

/** The topmost label whose text box is within `tolerance` of `point`, or null. */
export function hitTestLabel(
  labels: readonly NetLabel[],
  point: Point,
  tolerance = 20,
): NetLabel | null {
  for (let i = labels.length - 1; i >= 0; i--) {
    const label = labels[i];
    if (!label) continue;
    const b = labelBounds(label);
    if (
      point.x >= b.minX - tolerance &&
      point.x <= b.maxX + tolerance &&
      point.y >= b.minY - tolerance &&
      point.y <= b.maxY + tolerance
    ) {
      return label;
    }
  }
  return null;
}

/** Ids of the labels selected by a box. */
export function labelsInRect(labels: readonly NetLabel[], rect: Rect, mode: BoxMode): string[] {
  return labels
    .filter((label) =>
      mode === "inside" ? contains(rect, labelBounds(label)) : intersects(rect, labelBounds(label)),
    )
    .map((label) => label.id);
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
