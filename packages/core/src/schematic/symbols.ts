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
}

const line = (x1: number, y1: number, x2: number, y2: number): Primitive => ({
  kind: "line",
  x1,
  y1,
  x2,
  y2,
});
const both = (primitives: readonly Primitive[]) => ({ iec: primitives, ansi: primitives });

/** "+" and "−" signs drawn as lines (crisp at every zoom, no font needed). */
const plus = (cx: number, cy: number, s = 22): Primitive[] => [
  line(cx - s, cy, cx + s, cy),
  line(cx, cy - s, cx, cy + s),
];
const minus = (cx: number, cy: number, s = 22): Primitive[] => [line(cx - s, cy, cx + s, cy)];

/** ANSI zig-zag between x = −100 and 100: six peaks, ±40 mil. */
const ZIGZAG: readonly (readonly [number, number])[] = [
  [-100, 0],
  [-83, -40],
  [-50, 40],
  [-17, -40],
  [17, 40],
  [50, -40],
  [83, 40],
  [100, 0],
];

/** Resistor, horizontal: pin 1 left, pin 2 right, 400 mil long. */
export const RESISTOR_SYMBOL: SymbolDefinition = {
  type: "resistor",
  bounds: { minX: -200, minY: -40, maxX: 200, maxY: 40 },
  pins: [
    { id: "1", x: -200, y: 0 },
    { id: "2", x: 200, y: 0 },
  ],
  body: {
    iec: [
      line(-200, 0, -100, 0),
      { kind: "rect", x: -100, y: -40, width: 200, height: 80 },
      line(100, 0, 200, 0),
    ],
    ansi: [line(-200, 0, -100, 0), { kind: "polyline", points: ZIGZAG }, line(100, 0, 200, 0)],
  },
  labels: { designator: { x: 0, y: -90 }, value: { x: 0, y: 90 } },
  value: { key: "resistance", quantity: "resistance" },
};

/** DC voltage source, vertical: "+" on top. */
export const DC_VOLTAGE_SYMBOL: SymbolDefinition = {
  type: "source.dc-voltage",
  bounds: { minX: -100, minY: -200, maxX: 100, maxY: 200 },
  pins: [
    { id: "+", x: 0, y: -200 },
    { id: "-", x: 0, y: 200 },
  ],
  body: {
    // IEC 60617: circle with the conductor drawn through it, polarity mark outside.
    iec: [line(0, -200, 0, 200), { kind: "circle", cx: 0, cy: 0, r: 100 }, ...plus(55, -150, 18)],
    // ANSI: circle with + and − inside.
    ansi: [
      line(0, -200, 0, -100),
      { kind: "circle", cx: 0, cy: 0, r: 100 },
      line(0, 100, 0, 200),
      ...plus(0, -42),
      ...minus(0, 45),
    ],
  },
  labels: { designator: { x: 150, y: -40 }, value: { x: 150, y: 40 } },
  value: { key: "voltage", quantity: "voltage" },
};

/** DC current source, vertical: current flows in at the bottom and out at the top (arrow up). */
export const DC_CURRENT_SYMBOL: SymbolDefinition = {
  type: "source.dc-current",
  // Wider on the right for the IEC direction arrow.
  bounds: { minX: -100, minY: -200, maxX: 170, maxY: 200 },
  pins: [
    { id: "in", x: 0, y: 200 },
    { id: "out", x: 0, y: -200 },
  ],
  body: {
    // IEC 60617: circle with a bar across the conductor; direction arrow beside it.
    iec: [
      line(0, -200, 0, -100),
      { kind: "circle", cx: 0, cy: 0, r: 100 },
      line(-100, 0, 100, 0),
      line(0, 100, 0, 200),
      line(150, 60, 150, -40),
      {
        kind: "polygon",
        points: [
          [150, -75],
          [132, -35],
          [168, -35],
        ],
      },
    ],
    // ANSI: circle with an arrow inside.
    ansi: [
      line(0, -200, 0, -100),
      { kind: "circle", cx: 0, cy: 0, r: 100 },
      line(0, 100, 0, 200),
      line(0, 60, 0, -25),
      {
        kind: "polygon",
        points: [
          [0, -65],
          [-20, -22],
          [20, -22],
        ],
      },
    ],
  },
  labels: { designator: { x: -150, y: -40 }, value: { x: -150, y: 40 } },
  value: { key: "current", quantity: "current" },
};

/** Ground (signal / 0 V reference): pin on top, three bars. */
export const GROUND_SYMBOL: SymbolDefinition = {
  type: "ground",
  bounds: { minX: -100, minY: 0, maxX: 100, maxY: 180 },
  pins: [{ id: "1", x: 0, y: 0 }],
  body: both([
    line(0, 0, 0, 100),
    line(-100, 100, 100, 100),
    line(-60, 140, 60, 140),
    line(-20, 180, 20, 180),
  ]),
};

export const SYMBOLS: readonly SymbolDefinition[] = [
  RESISTOR_SYMBOL,
  DC_VOLTAGE_SYMBOL,
  DC_CURRENT_SYMBOL,
  GROUND_SYMBOL,
];
const BY_TYPE = new Map(SYMBOLS.map((s) => [s.type, s]));

export function symbolFor(type: string): SymbolDefinition | undefined {
  return BY_TYPE.get(type);
}

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

/** Designator prefix for symbol types that are not circuit components ("ground" → "GND"). */
const DESIGNATOR_PREFIXES: Readonly<Record<string, string>> = {
  resistor: "R",
  "source.dc-voltage": "V",
  "source.dc-current": "I",
  ground: "GND",
};

export function designatorPrefix(type: string): string {
  return DESIGNATOR_PREFIXES[type] ?? "X";
}

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
