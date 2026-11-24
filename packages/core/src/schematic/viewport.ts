/**
 * Schematic viewport maths (ADR 008): world units are mils (0.001 inch), y points down.
 *
 * Pure functions only — the canvas component keeps a `Viewport` in state and asks these how to
 * pan, zoom about the cursor, fit a drawing, snap to the grid and which grid to draw.
 */

export const MILS_PER_INCH = 1_000;
export const MM_PER_MIL = 0.0254;
/** 100 % zoom = real size on a 96-dpi screen: 1 inch = 96 px. */
export const PX_PER_MIL = 96 / MILS_PER_INCH;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 32;
export const DEFAULT_ZOOM = 2;
/** Standard schematic grid (2.54 mm) and fine grid. */
export const SCHEMATIC_GRID = 100;
export const FINE_GRID = 50;
/** Zoom steps for the +/− buttons and keys (as fractions: 1 = 100 %). */
export const ZOOM_STEPS: readonly number[] = [
  0.1, 0.15, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32,
];

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Rect = { minX: number; minY: number; maxX: number; maxY: number };

export interface Viewport {
  /** 1 = 100 %. */
  readonly zoom: number;
  /** World point (mils) shown at the top-left corner of the canvas. */
  readonly originX: number;
  readonly originY: number;
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return DEFAULT_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Screen pixels per mil. */
export function scaleOf(viewport: Viewport): number {
  return viewport.zoom * PX_PER_MIL;
}

export function toScreen(viewport: Viewport, world: Point): Point {
  const s = scaleOf(viewport);
  return { x: (world.x - viewport.originX) * s, y: (world.y - viewport.originY) * s };
}

export function toWorld(viewport: Viewport, screen: Point): Point {
  const s = scaleOf(viewport);
  return { x: viewport.originX + screen.x / s, y: viewport.originY + screen.y / s };
}

/** A viewport showing `world` at the centre of a canvas of `size`. */
export function centerOn(world: Point, size: Size, zoom = DEFAULT_ZOOM): Viewport {
  const z = clampZoom(zoom);
  const s = z * PX_PER_MIL;
  return { zoom: z, originX: world.x - size.width / 2 / s, originY: world.y - size.height / 2 / s };
}

/** Moves the view by a screen distance (dragging the canvas right moves the drawing right). */
export function panBy(viewport: Viewport, dx: number, dy: number): Viewport {
  const s = scaleOf(viewport);
  return { ...viewport, originX: viewport.originX - dx / s, originY: viewport.originY - dy / s };
}

/** Zooms to `zoom` keeping the world point under `screen` (the cursor) where it is. */
export function zoomTo(viewport: Viewport, zoom: number, screen: Point): Viewport {
  const z = clampZoom(zoom);
  const anchor = toWorld(viewport, screen);
  const s = z * PX_PER_MIL;
  return { zoom: z, originX: anchor.x - screen.x / s, originY: anchor.y - screen.y / s };
}

/**
 * Mouse-wheel zoom: smooth and proportional to the wheel distance, limited per event so one
 * fast flick cannot jump from 10 % to 3 200 %.
 */
export function wheelZoom(viewport: Viewport, deltaY: number, screen: Point): Viewport {
  const step = Math.max(-200, Math.min(200, Number.isFinite(deltaY) ? deltaY : 0));
  return zoomTo(viewport, viewport.zoom * Math.exp(-step * 0.002), screen);
}

/** Next zoom step up (`+1`) or down (`-1`) from the current zoom. */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  const eps = 1e-9;
  if (direction > 0) return ZOOM_STEPS.find((z) => z > zoom + eps) ?? MAX_ZOOM;
  return [...ZOOM_STEPS].reverse().find((z) => z < zoom - eps) ?? MIN_ZOOM;
}

/** Fits `bounds` (world) into `size` with `padding` pixels on every side; never above 400 %. */
export function fitBounds(bounds: Rect | null, size: Size, padding = 48, maxZoom = 4): Viewport {
  if (!bounds || size.width <= 0 || size.height <= 0) return centerOn({ x: 0, y: 0 }, size);
  const w = Math.max(bounds.maxX - bounds.minX, 1);
  const h = Math.max(bounds.maxY - bounds.minY, 1);
  const availW = Math.max(size.width - 2 * padding, 1);
  const availH = Math.max(size.height - 2 * padding, 1);
  const zoom = clampZoom(Math.min(availW / (w * PX_PER_MIL), availH / (h * PX_PER_MIL), maxZoom));
  return centerOn(
    { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 },
    size,
    zoom,
  );
}

/** The world rectangle visible in a canvas of `size`. */
export function visibleRect(viewport: Viewport, size: Size): Rect {
  const s = scaleOf(viewport);
  return {
    minX: viewport.originX,
    minY: viewport.originY,
    maxX: viewport.originX + size.width / s,
    maxY: viewport.originY + size.height / s,
  };
}

export function snapToGrid(point: Point, grid = SCHEMATIC_GRID): Point {
  if (!(grid > 0)) return point;
  // `+ 0` turns −0 into 0.
  return { x: Math.round(point.x / grid) * grid + 0, y: Math.round(point.y / grid) * grid + 0 };
}

/**
 * Grid spacing to draw at this zoom: the schematic grid while it is at least `minPx` apart on
 * screen, otherwise ×5, ×10, ×50… so the canvas never turns into a grey haze. Major lines every 10.
 */
export function gridLevel(
  viewport: Viewport,
  grid = SCHEMATIC_GRID,
  minPx = 8,
): { minor: number; major: number } {
  const s = scaleOf(viewport);
  let minor = grid;
  for (let i = 0; minor * s < minPx && i < 12; i++) minor *= i % 2 === 0 ? 5 : 2;
  return { minor, major: minor * 10 };
}

export type LengthUnit = "mm" | "in";

/** "12.70 mm" / "0.500 in" — a world length (mils) for the status bar. */
export function formatLength(mils: number, unit: LengthUnit = "mm"): string {
  if (!Number.isFinite(mils)) return "—";
  const value = unit === "mm" ? mils * MM_PER_MIL : mils / MILS_PER_INCH;
  const text = value.toFixed(unit === "mm" ? 2 : 3);
  return `${text === "-0.00" || text === "-0.000" ? text.slice(1) : text} ${unit}`;
}

/** Smallest rectangle around all rectangles, or null for none. */
export function unionRects(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  return rects.reduce((a, b) => ({
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }));
}
