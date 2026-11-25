/**
 * Rubber-banding (ADR 009): when parts or wires move, the wires attached to them stretch and stay
 * connected, like Altium / EasyEDA drag (KiCad "G").
 *
 * A wire END follows its anchor (a moved pin, or a point of a moved wire). The rest of the wire
 * keeps its shape: one corner is added next to the moved end so the old neighbouring segment keeps
 * its direction, and the result is cleaned (`simplifyWire`). A wire whose two ends move by the
 * same amount is simply translated. A wire that shrinks to a point is removed. Pure and unit-tested.
 */
import { MAX_WIRE_POINTS, type WirePoint } from "../project";
import { routeL, simplifyWire } from "./wires";

/** New position of an anchored point, or null if the point does not move. */
export type PointMover = (p: WirePoint) => WirePoint | null;

/** Moves the first point of `points` to `to`, adding one corner so the next segment keeps its direction. */
function stretchStart(points: readonly WirePoint[], to: WirePoint): WirePoint[] {
  const next = points[1];
  if (!next) return [to];
  const first = points[0] as WirePoint;
  const horizontal = first[1] === next[1];
  const corner: WirePoint = horizontal ? [to[0], next[1]] : [next[0], to[1]];
  return [to, corner, ...points.slice(1)];
}

/**
 * The wire's points after its anchors moved: the same array when nothing moved, `null` when the
 * wire shrank to a point (it should be removed).
 */
export function rubberBandWire(
  points: readonly WirePoint[],
  move: PointMover,
): readonly WirePoint[] | null {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 2) return points;
  const a = move(first);
  const b = move(last);
  if (!a && !b) return points;
  let out: WirePoint[];
  if (a && b && a[0] - first[0] === b[0] - last[0] && a[1] - first[1] === b[1] - last[1]) {
    const dx = a[0] - first[0];
    const dy = a[1] - first[1];
    out = points.map(([x, y]) => [x + dx, y + dy]);
  } else {
    out = [...points];
    if (a) out = stretchStart(out, a);
    if (b) out = stretchStart([...out].reverse(), b).reverse();
    out = simplifyWire(out);
  }
  if (out.length < 2) return null;
  if (out.length > MAX_WIRE_POINTS) out = routeL(out[0] as WirePoint, out.at(-1) as WirePoint);
  return out.length < 2 ? null : out;
}
