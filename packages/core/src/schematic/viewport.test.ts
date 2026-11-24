import { describe, expect, it } from "vitest";
import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  PX_PER_MIL,
  centerOn,
  fitBounds,
  formatLength,
  gridLevel,
  panBy,
  snapToGrid,
  stepZoom,
  toScreen,
  toWorld,
  unionRects,
  visibleRect,
  wheelZoom,
  zoomTo,
  type Viewport,
} from "./viewport";

const SIZE = { width: 800, height: 600 };
const view = (zoom = 1, originX = 0, originY = 0): Viewport => ({ zoom, originX, originY });

describe("viewport", () => {
  it("uses real size at 100 %: 1 inch = 96 px", () => {
    expect(toScreen(view(1), { x: 1000, y: 500 })).toEqual({ x: 96, y: 48 });
    expect(PX_PER_MIL).toBe(0.096);
  });

  it("converts screen ↔ world both ways", () => {
    const v = view(2.5, -1234, 567);
    const world = { x: 300, y: -400 };
    const back = toWorld(v, toScreen(v, world));
    expect(back.x).toBeCloseTo(300, 9);
    expect(back.y).toBeCloseTo(-400, 9);
  });

  it("centres a world point", () => {
    const v = centerOn({ x: 1000, y: 2000 }, SIZE, 1);
    const centre = toScreen(v, { x: 1000, y: 2000 });
    expect(centre.x).toBeCloseTo(400, 9);
    expect(centre.y).toBeCloseTo(300, 9);
  });

  it("pans with the drag direction", () => {
    const v = panBy(view(1), 96, -48);
    expect(toScreen(v, { x: 0, y: 0 })).toEqual({ x: 96, y: -48 });
  });

  it("zooms about the cursor: the point under it stays put", () => {
    const v = view(1, 100, 200);
    const cursor = { x: 250, y: 130 };
    const under = toWorld(v, cursor);
    const zoomed = zoomTo(v, 4, cursor);
    const after = toScreen(zoomed, under);
    expect(zoomed.zoom).toBe(4);
    expect(after.x).toBeCloseTo(cursor.x, 9);
    expect(after.y).toBeCloseTo(cursor.y, 9);
  });

  it("limits zoom to 10 %–3 200 % and ignores NaN", () => {
    expect(zoomTo(view(), 1000, { x: 0, y: 0 }).zoom).toBe(MAX_ZOOM);
    expect(zoomTo(view(), 0.001, { x: 0, y: 0 }).zoom).toBe(MIN_ZOOM);
    expect(zoomTo(view(), Number.NaN, { x: 0, y: 0 }).zoom).toBe(DEFAULT_ZOOM);
  });

  it("zooms in on wheel up, out on wheel down, limited per event", () => {
    expect(wheelZoom(view(1), -100, { x: 0, y: 0 }).zoom).toBeGreaterThan(1);
    expect(wheelZoom(view(1), 100, { x: 0, y: 0 }).zoom).toBeLessThan(1);
    expect(wheelZoom(view(1), -1e9, { x: 0, y: 0 }).zoom).toBeCloseTo(Math.exp(0.4), 9);
    expect(wheelZoom(view(1), Number.NaN, { x: 0, y: 0 }).zoom).toBe(1);
  });

  it("steps through standard zoom levels", () => {
    expect(stepZoom(1, 1)).toBe(1.25);
    expect(stepZoom(1, -1)).toBe(0.75);
    expect(stepZoom(1.1, -1)).toBe(1);
    expect(stepZoom(MAX_ZOOM, 1)).toBe(MAX_ZOOM);
    expect(stepZoom(MIN_ZOOM, -1)).toBe(MIN_ZOOM);
  });

  it("fits a drawing with padding, centred", () => {
    const bounds = { minX: 0, minY: 0, maxX: 2000, maxY: 1000 };
    const v = fitBounds(bounds, SIZE, 50);
    const topLeft = toScreen(v, { x: 0, y: 0 });
    const bottomRight = toScreen(v, { x: 2000, y: 1000 });
    expect(topLeft.x).toBeCloseTo(50, 6);
    expect(bottomRight.x).toBeCloseTo(750, 6);
    expect((topLeft.y + bottomRight.y) / 2).toBeCloseTo(300, 6);
  });

  it("does not zoom a single small part to 3 200 %", () => {
    expect(fitBounds({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, SIZE).zoom).toBe(4);
  });

  it("fits an empty drawing by showing the origin", () => {
    const origin = toScreen(fitBounds(null, SIZE), { x: 0, y: 0 });
    expect(origin.x).toBeCloseTo(400, 9);
    expect(origin.y).toBeCloseTo(300, 9);
  });

  it("reports the visible world rectangle", () => {
    expect(visibleRect(view(1, 10, 20), { width: 96, height: 48 })).toEqual({
      minX: 10,
      minY: 20,
      maxX: 1010,
      maxY: 520,
    });
  });

  it("snaps to the 100-mil grid (and never to −0)", () => {
    expect(snapToGrid({ x: 149, y: -151 })).toEqual({ x: 100, y: -200 });
    expect(snapToGrid({ x: 26, y: 24 }, 50)).toEqual({ x: 50, y: 0 });
    expect(Object.is(snapToGrid({ x: -10, y: 0 }).x, 0)).toBe(true);
  });

  it("draws a coarser grid when the lines would be too close", () => {
    expect(gridLevel(view(2))).toEqual({ minor: 100, major: 1000 }); // 19.2 px apart
    expect(gridLevel(view(0.5))).toEqual({ minor: 500, major: 5000 }); // 4.8 px → ×5
    expect(gridLevel(view(0.1)).minor).toBe(1000); // 0.96 px → ×5 → ×2
    expect(gridLevel(view(2), 100, 24).minor).toBe(500); // Low-end: wider spacing
  });

  it("formats lengths for the status bar", () => {
    expect(formatLength(500)).toBe("12.70 mm");
    expect(formatLength(500, "in")).toBe("0.500 in");
    expect(formatLength(-1)).toBe("-0.03 mm");
    expect(formatLength(-0.1)).toBe("0.00 mm");
    expect(formatLength(Number.NaN)).toBe("—");
  });

  it("unions rectangles", () => {
    expect(unionRects([])).toBeNull();
    expect(
      unionRects([
        { minX: 0, minY: 0, maxX: 10, maxY: 10 },
        { minX: -5, minY: 3, maxX: 4, maxY: 20 },
      ]),
    ).toEqual({ minX: -5, minY: 0, maxX: 10, maxY: 20 });
  });
});
