/**
 * Small helpers for drawing symbol artwork in part files (mils, rotation 0, y down).
 */
import type { Primitive } from "../schematic/symbols";

export const line = (x1: number, y1: number, x2: number, y2: number): Primitive => ({
  kind: "line",
  x1,
  y1,
  x2,
  y2,
});

/** The same artwork in IEC and ANSI style. */
export const both = (primitives: readonly Primitive[]) => ({ iec: primitives, ansi: primitives });

/** "+" sign drawn as lines (crisp at every zoom, no font needed). */
export const plus = (cx: number, cy: number, s = 22): Primitive[] => [
  line(cx - s, cy, cx + s, cy),
  line(cx, cy - s, cx, cy + s),
];

/** "−" sign drawn as a line. */
export const minus = (cx: number, cy: number, s = 22): Primitive[] => [
  line(cx - s, cy, cx + s, cy),
];

/** ANSI resistor zig-zag between x = −100 and 100: six peaks, ±40 mil. */
export const ZIGZAG: readonly (readonly [number, number])[] = [
  [-100, 0],
  [-83, -40],
  [-50, 40],
  [-17, -40],
  [17, 40],
  [50, -40],
  [83, 40],
  [100, 0],
];
