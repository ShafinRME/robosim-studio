import { describe, expect, it } from "vitest";
import type { WirePoint } from "../project";
import { isOrthogonal, onSegment, routeL, segmentAt, simplifyWire } from "./wires";

const pts = (...p: WirePoint[]) => p;

describe("simplifyWire", () => {
  it("drops repeated points", () => {
    expect(simplifyWire(pts([0, 0], [0, 0], [100, 0], [100, 0]))).toEqual([
      [0, 0],
      [100, 0],
    ]);
  });

  it("merges straight runs", () => {
    expect(simplifyWire(pts([0, 0], [100, 0], [300, 0], [300, 200]))).toEqual([
      [0, 0],
      [300, 0],
      [300, 200],
    ]);
  });

  it("removes back-tracking", () => {
    expect(simplifyWire(pts([0, 0], [300, 0], [100, 0]))).toEqual([
      [0, 0],
      [100, 0],
    ]);
    // Back to the start along the same line: nothing left but the start.
    expect(simplifyWire(pts([0, 0], [300, 0], [0, 0]))).toEqual([[0, 0]]);
  });

  it("keeps real corners", () => {
    const wire = pts([0, 0], [100, 0], [100, 100], [200, 100]);
    expect(simplifyWire(wire)).toEqual(wire);
  });
});

describe("routeL", () => {
  it("goes horizontally first by default, vertically first on request", () => {
    expect(routeL([0, 0], [300, 200])).toEqual([
      [0, 0],
      [300, 0],
      [300, 200],
    ]);
    expect(routeL([0, 0], [300, 200], "vertical-first")).toEqual([
      [0, 0],
      [0, 200],
      [300, 200],
    ]);
  });

  it("draws a straight wire without a corner", () => {
    expect(routeL([0, 0], [0, 400])).toEqual([
      [0, 0],
      [0, 400],
    ]);
  });
});

describe("isOrthogonal / onSegment / segmentAt", () => {
  it("accepts only horizontal and vertical segments", () => {
    expect(isOrthogonal(pts([0, 0], [100, 0], [100, 50]))).toBe(true);
    expect(isOrthogonal(pts([0, 0], [100, 100]))).toBe(false);
    expect(isOrthogonal(pts([0, 0], [0, 0]))).toBe(false);
  });

  it("finds points on segments, ends included", () => {
    expect(onSegment([50, 0], [0, 0], [100, 0])).toBe(true);
    expect(onSegment([100, 0], [0, 0], [100, 0])).toBe(true);
    expect(onSegment([150, 0], [0, 0], [100, 0])).toBe(false);
    expect(onSegment([0, 50], [0, 100], [0, 0])).toBe(true);
    expect(onSegment([50, 10], [0, 0], [100, 0])).toBe(false);
  });

  it("returns the segment index under a point", () => {
    const wire = pts([0, 0], [100, 0], [100, 200]);
    expect(segmentAt(wire, [50, 0])).toBe(0);
    expect(segmentAt(wire, [100, 150])).toBe(1);
    expect(segmentAt(wire, [0, 150])).toBe(-1);
  });
});
