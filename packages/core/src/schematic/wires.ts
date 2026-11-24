/**
 * Wire geometry (ADR 009): orthogonal polylines on the 50-mil grid. Pure and unit-tested.
 */
import type { WirePoint } from "../project";

/**
 * Cleans a polyline: drops repeated points and middle points on a straight run (including
 * back-tracking, e.g. 0 → 100 → 50 becomes 0 → 50). Never changes the two ends.
 */
export function simplifyWire(points: readonly WirePoint[]): WirePoint[] {
  const out: WirePoint[] = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (last && last[0] === point[0] && last[1] === point[1]) continue;
    out.push([point[0], point[1]]);
    // Merge while the last three points are on one horizontal or vertical line.
    while (out.length >= 3) {
      const a = out[out.length - 3] as WirePoint;
      const b = out[out.length - 2] as WirePoint;
      const c = out[out.length - 1] as WirePoint;
      const straight = (a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1]);
      if (!straight) break;
      out.splice(out.length - 2, 1);
      // A full back-track can leave two equal points: drop the repeat.
      const p = out[out.length - 2] as WirePoint;
      const q = out[out.length - 1] as WirePoint;
      if (p[0] === q[0] && p[1] === q[1]) out.pop();
    }
  }
  return out;
}

export type Posture = "horizontal-first" | "vertical-first";

/** An L-shaped route from `from` to `to` (one corner at most), like the wire tool's preview. */
export function routeL(
  from: WirePoint,
  to: WirePoint,
  posture: Posture = "horizontal-first",
): WirePoint[] {
  const corner: WirePoint = posture === "horizontal-first" ? [to[0], from[1]] : [from[0], to[1]];
  return simplifyWire([from, corner, to]);
}

/** True when every segment is horizontal or vertical and no two consecutive points are equal. */
export function isOrthogonal(points: readonly WirePoint[]): boolean {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as WirePoint;
    const b = points[i] as WirePoint;
    const sameX = a[0] === b[0];
    const sameY = a[1] === b[1];
    if (sameX === sameY) return false; // both equal (repeat) or both different (diagonal)
  }
  return true;
}

/** True when point `p` lies on segment a–b (ends included). Segments are orthogonal. */
export function onSegment(p: WirePoint, a: WirePoint, b: WirePoint): boolean {
  if (a[0] === b[0])
    return p[0] === a[0] && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);
  if (a[1] === b[1])
    return p[1] === a[1] && p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0]);
  return false;
}

/** Index of the first segment of `points` containing `p`, or −1. */
export function segmentAt(points: readonly WirePoint[], p: WirePoint): number {
  for (let i = 1; i < points.length; i++) {
    if (onSegment(p, points[i - 1] as WirePoint, points[i] as WirePoint)) return i - 1;
  }
  return -1;
}
