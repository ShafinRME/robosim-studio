"use client";

/**
 * Schematic canvas (ADR 008): our own SVG editor surface.
 *
 * One <svg> with one viewport transform: panning and zooming change a single matrix, the parts
 * layer is memoised. Controls follow EDA conventions — wheel zooms about the cursor, middle-drag or
 * Space + drag pans, F fits; a place tool drops parts on the grid (R / X / Y turn the ghost, Esc or
 * right-click ends it); the select tool clicks, Shift/Ctrl-clicks and box-selects (left → right:
 * inside, right → left: touching), drags, nudges with the arrows, rotates (R), mirrors (X / Y) and
 * deletes. Every change is one undoable edit.
 */
import {
  PLACEABLE_PARTS,
  ProjectEditError,
  SCHEMATIC_GRID,
  boxModeOf,
  connectivityOf,
  createPart,
  fitBounds,
  gridLevel,
  hitTest,
  newId,
  panBy,
  partBounds,
  partsInRect,
  placedPinsOf,
  projectEdits,
  rectFromPoints,
  routeL,
  scaleOf,
  segmentAt,
  simplifyWire,
  snapToGrid,
  stepZoom,
  symbolFor,
  toWorld,
  unionRects,
  wheelZoom,
  zoomTo,
  type Part,
  type Point,
  type Posture,
  type ProjectEdit,
  type ProjectStore,
  type Size,
  type SymbolStyle,
  type Viewport,
  type Wire,
  type WirePoint,
} from "@robosim/core";
import {
  Toolbar,
  ToolbarButton,
  ToolbarSeparator,
  ToolbarToggleGroup,
  ToolbarToggleItem,
} from "@robosim/ui/components/toolbar";
import { cn } from "@robosim/ui/lib/utils";
import {
  FlipHorizontal2,
  FlipVertical2,
  Maximize,
  MousePointer2,
  RotateCw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import {
  DESIGNATOR_SIZE,
  PlacedSymbol,
  SymbolBody,
} from "../../components/schematic/schematic-symbol";
import { useSchematicPrefs } from "../../lib/schematic-prefs";
import { setSelection, useSelection } from "./schematic-selection";
import { SimReadout } from "./sim-controls";
import { useActiveProject } from "./studio-project";
import { useSetCanvasCursor, useStudioStatus } from "./studio-status";

/** Pointer travel (px) before a press becomes a drag. */
const DRAG_THRESHOLD = 3;

type Tool =
  | { kind: "select" }
  | { kind: "place"; type: string; rotation: number; flip: boolean }
  /** Wire tool (ADR 009): `points` are the fixed points of the wire being drawn (empty: not started). */
  | {
      kind: "wire";
      posture: Posture;
      points: readonly WirePoint[];
      /** `points` before each click, so Backspace undoes exactly the last click. */
      before: readonly (readonly WirePoint[])[];
    };
const SELECT_TOOL: Tool = { kind: "select" };

type Drag =
  | { kind: "pan"; last: Point }
  | {
      kind: "move";
      ids: readonly string[];
      startScreen: Point;
      startWorld: Point;
      active: boolean;
      delta: Point;
      /** Part to select alone if the press ends without dragging (click inside a group). */
      narrowTo: string | null;
    }
  | { kind: "box"; startScreen: Point; startWorld: Point; additive: boolean; active: boolean };

function UnknownPart({ part, showLabels }: { part: Part; showLabels: boolean }) {
  const b = partBounds(part);
  return (
    <>
      <rect
        x={b.minX}
        y={b.minY}
        width={b.maxX - b.minX}
        height={b.maxY - b.minY}
        fill="none"
        strokeDasharray="20 16"
        style={{ stroke: "var(--schematic-ink)", strokeWidth: "var(--schematic-stroke)" }}
      />
      {showLabels ? (
        <text
          x={part.x}
          y={part.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={50}
          className="fill-muted-foreground"
        >
          {part.name || part.type}
        </text>
      ) : null}
    </>
  );
}

const PartView = memo(function PartView({
  part,
  style,
  showLabels,
  selected,
  connectedPins,
}: {
  part: Part;
  style: SymbolStyle;
  showLabels: boolean;
  selected: boolean;
  connectedPins: string;
}) {
  const symbol = symbolFor(part.type);
  const b = partBounds(part);
  return (
    <g
      data-part={part.id}
      data-selected={selected || undefined}
      className="schematic-part"
      style={selected ? ({ "--schematic-ink": "var(--brand)" } as CSSProperties) : undefined}
    >
      {/* Invisible hit area: thin symbols are easy to point at. */}
      <rect
        x={b.minX - 20}
        y={b.minY - 20}
        width={b.maxX - b.minX + 40}
        height={b.maxY - b.minY + 40}
        fill="transparent"
      />
      {selected ? (
        <rect
          x={b.minX - 30}
          y={b.minY - 30}
          width={b.maxX - b.minX + 60}
          height={b.maxY - b.minY + 60}
          rx={12}
          style={{
            fill: "var(--brand-soft)",
            stroke: "var(--brand)",
            strokeWidth: "var(--schematic-pin-stroke)",
          }}
        />
      ) : null}
      {symbol ? (
        <PlacedSymbol
          symbol={symbol}
          style={style}
          placement={part}
          designator={part.name}
          value={symbol.value ? part.props[symbol.value.key] : undefined}
          showLabels={showLabels}
          connectedPins={connectedPins}
        />
      ) : (
        <UnknownPart part={part} showLabels={showLabels} />
      )}
    </g>
  );
});

/**
 * All parts in two layers: the selection is drawn last (on top) in its own group, so a drag only
 * changes that group's transform — set directly by the canvas, without re-rendering React — and
 * the project is edited once, on release.
 */
const PartsLayer = memo(function PartsLayer({
  parts,
  style,
  showLabels,
  selected,
  moveLayer,
  connected,
}: {
  parts: readonly Part[];
  style: SymbolStyle;
  showLabels: boolean;
  selected: ReadonlySet<string>;
  moveLayer: RefObject<SVGGElement | null>;
  /** Connected pin ids per part id ("1,2"). */
  connected: ReadonlyMap<string, string>;
}) {
  const view = (part: Part, isSelected: boolean) => (
    <PartView
      key={part.id}
      part={part}
      style={style}
      showLabels={showLabels}
      selected={isSelected}
      connectedPins={connected.get(part.id) ?? ""}
    />
  );
  return (
    <g data-testid="schematic-parts">
      <g>{parts.filter((p) => !selected.has(p.id)).map((p) => view(p, false))}</g>
      <g ref={moveLayer} data-testid="schematic-selection-layer">
        {parts.filter((p) => selected.has(p.id)).map((p) => view(p, true))}
      </g>
    </g>
  );
});

const pointsAttr = (points: readonly WirePoint[]) => points.map(([x, y]) => `${x},${y}`).join(" ");

/** Wires and junction dots (ADR 009). */
const WiresLayer = memo(function WiresLayer({
  wires,
  junctions,
}: {
  wires: readonly Wire[];
  junctions: readonly WirePoint[];
}) {
  return (
    <g data-testid="schematic-wires">
      {wires.map((wire) => (
        <polyline
          key={wire.id}
          data-wire={wire.id}
          points={pointsAttr(wire.points)}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ stroke: "var(--schematic-wire)", strokeWidth: "var(--schematic-stroke)" }}
        />
      ))}
      {junctions.map(([x, y]) => (
        <circle
          key={`${x},${y}`}
          data-junction={`${x},${y}`}
          cx={x}
          cy={y}
          r={20}
          style={{ fill: "var(--schematic-wire)" }}
        />
      ))}
    </g>
  );
});

/** The wire being drawn: fixed part solid, the L-shaped route to the pointer dashed. */
function WirePreview({
  fixed,
  route,
}: {
  fixed: readonly WirePoint[];
  route: readonly WirePoint[];
}) {
  return (
    <g data-testid="wire-preview" style={{ pointerEvents: "none" }}>
      {fixed.length >= 2 ? (
        <polyline
          points={pointsAttr(fixed)}
          fill="none"
          strokeLinejoin="round"
          style={{ stroke: "var(--brand)", strokeWidth: "var(--schematic-stroke)" }}
        />
      ) : null}
      {route.length >= 2 ? (
        <polyline
          points={pointsAttr(route)}
          fill="none"
          strokeDasharray="24 16"
          strokeLinejoin="round"
          style={{ stroke: "var(--brand)", strokeWidth: "var(--schematic-stroke)" }}
        />
      ) : null}
      {fixed[0] ? (
        <circle cx={fixed[0][0]} cy={fixed[0][1]} r={18} style={{ fill: "var(--brand)" }} />
      ) : null}
    </g>
  );
}

/** Icon for the wire tool: an L-shaped wire between two dots (our artwork). */
function WireIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="4,18 4,6 20,6" strokeLinejoin="round" />
      <circle cx="4" cy="18" r="2" fill="currentColor" />
      <circle cx="20" cy="6" r="2" fill="currentColor" />
    </svg>
  );
}

/** Dot grid (minor) and faint lines (major, every 10), drawn in screen space for crisp pixels. */
function Grid({ viewport, size, lowEnd }: { viewport: Viewport; size: Size; lowEnd: boolean }) {
  const id = useId();
  const s = scaleOf(viewport);
  const { minor, major } = gridLevel(viewport, SCHEMATIC_GRID, lowEnd ? 16 : 8);
  const minorPx = minor * s;
  const majorPx = major * s;
  const offset = (spacing: number, origin: number) =>
    (((-origin * s) % spacing) + spacing) % spacing;
  return (
    <>
      <defs>
        <pattern
          id={`${id}-minor`}
          width={minorPx}
          height={minorPx}
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(${offset(minorPx, viewport.originX)} ${offset(minorPx, viewport.originY)})`}
        >
          <rect width={1.25} height={1.25} style={{ fill: "var(--schematic-grid-dot)" }} />
        </pattern>
        <pattern
          id={`${id}-major`}
          width={majorPx}
          height={majorPx}
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(${offset(majorPx, viewport.originX)} ${offset(majorPx, viewport.originY)})`}
        >
          <path
            d={`M 0.5 0 V ${majorPx} M 0 0.5 H ${majorPx}`}
            fill="none"
            style={{ stroke: "var(--schematic-grid-major)", strokeWidth: 1 }}
          />
        </pattern>
      </defs>
      <rect width={size.width} height={size.height} fill={`url(#${id}-minor)`} />
      {lowEnd ? null : <rect width={size.width} height={size.height} fill={`url(#${id}-major)`} />}
    </>
  );
}

/** Small cross at the world origin (0, 0), like EDA tools. */
function OriginMark({ viewport }: { viewport: Viewport }) {
  const s = scaleOf(viewport);
  const x = -viewport.originX * s;
  const y = -viewport.originY * s;
  return (
    <path
      d={`M ${x - 6} ${y} H ${x + 6} M ${x} ${y - 6} V ${y + 6}`}
      fill="none"
      style={{ stroke: "var(--schematic-origin)", strokeWidth: 1 }}
      aria-hidden
    />
  );
}

/** A tiny drawing of the symbol itself as the tool icon (our artwork, not a stock icon). */
function SymbolIcon({ type, style }: { type: string; style: SymbolStyle }) {
  const symbol = symbolFor(type);
  if (!symbol) return null;
  const { minX, minY, maxX, maxY } = symbol.bounds;
  const size = Math.max(maxX - minX, maxY - minY) + 40;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return (
    <svg
      viewBox={`${cx - size / 2} ${cy - size / 2} ${size} ${size}`}
      aria-hidden
      style={{ "--schematic-ink": "currentColor", "--schematic-stroke": 26 } as CSSProperties}
    >
      <SymbolBody symbol={symbol} style={style} />
    </svg>
  );
}

/** "Resistor" → "resistor", "DC voltage source" stays (acronyms keep their capitals). */
function sentenceCase(text: string): string {
  return /^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

function percent(zoom: number): string {
  return `${Math.round(zoom * 100)} %`;
}

export function SchematicCanvas() {
  const { store, state } = useActiveProject();
  const parts = state?.project.parts;
  const projectId = state?.project.id ?? null;
  const { symbolStyle } = useSchematicPrefs();
  const { lowEnd, post } = useStudioStatus();
  const setCursorNow = useSetCanvasCursor();
  // Report the pointer only when its grid position changes (the status bar shows grid steps).
  const lastCursor = useRef<Point | null>(null);
  const setCursor = useCallback(
    (point: Point | null) => {
      const last = lastCursor.current;
      if (point && last && point.x === last.x && point.y === last.y) return;
      if (!point && !last) return;
      lastCursor.current = point;
      setCursorNow(point);
    },
    [setCursorNow],
  );
  const selectedIds = useSelection(projectId);

  const helpId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  // The tool belongs to the project it was chosen in: another tab starts with the select tool.
  const [toolState, setToolState] = useState<{ projectId: string | null; tool: Tool }>({
    projectId: null,
    tool: SELECT_TOOL,
  });
  const tool = toolState.projectId === projectId ? toolState.tool : SELECT_TOOL;
  const setTool = (next: Tool) => setToolState({ projectId, tool: next });
  const [ghost, setGhost] = useState<Point | null>(null);
  const moveLayer = useRef<SVGGElement>(null);
  const [box, setBox] = useState<{ start: Point; end: Point } | null>(null);
  const [panning, setPanning] = useState(false);
  const drag = useRef<Drag | null>(null);
  const fittedFor = useRef<string | null | undefined>(undefined);
  const svgRef = useRef<SVGSVGElement>(null);
  /** Pan distance (px) shown by moving the drawn picture, not yet in `viewport`. */
  const panOffset = useRef<Point>({ x: 0, y: 0 });
  /** Extra picture drawn around the visible area so a pan never shows an empty edge. */
  const margin = Math.round(Math.max(size.width, size.height) / 2);

  /** True between a pan commit and the redraw: the picture offset must not move meanwhile. */
  const redrawPending = useRef(false);

  const commitPan = useCallback(() => {
    const { x, y } = panOffset.current;
    panOffset.current = { x: 0, y: 0 };
    if (x === 0 && y === 0) return;
    redrawPending.current = true;
    setViewport((v) => (v ? panBy(v, x, y) : v));
  }, []);
  // The new viewport is drawn: show the offset collected since the commit (usually none).
  useLayoutEffect(() => {
    redrawPending.current = false;
    const { x, y } = panOffset.current;
    if (svgRef.current) svgRef.current.style.transform = x || y ? `translate(${x}px, ${y}px)` : "";
  }, [viewport]);

  const wires = state?.project.wires;
  const labels = state?.project.labels;
  const bounds = useMemo(
    () =>
      unionRects([
        ...(parts ?? []).map(partBounds),
        ...(wires ?? []).map((w) => {
          const xs = w.points.map((p) => p[0]);
          const ys = w.points.map((p) => p[1]);
          return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys),
          };
        }),
      ]),
    [parts, wires],
  );
  // What is connected to what (ADR 009): junction dots, connected pins, the netlist input.
  const connectivity = useMemo(
    () => connectivityOf({ parts: parts ?? [], wires: wires ?? [], labels: labels ?? [] }),
    [parts, wires, labels],
  );
  const connectedByPart = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const k of connectivity.connectedPins) {
      const [part = "", pin = ""] = k.split("\u0000");
      map.set(part, [...(map.get(part) ?? []), pin]);
    }
    return new Map([...map].map(([part, pins]) => [part, pins.join(",")]));
  }, [connectivity]);
  /** Points a wire can end on: pin ends and any point on an existing wire. */
  const pinPoints = useMemo(
    () => new Set(placedPinsOf(parts ?? []).map((p) => `${p.x},${p.y}`)),
    [parts],
  );
  const isConnectable = useCallback(
    (p: WirePoint) =>
      pinPoints.has(`${p[0]},${p[1]}`) || (wires ?? []).some((w) => segmentAt(w.points, p) >= 0),
    [pinPoints, wires],
  );
  // After a move is committed the parts render at their new place: drop the drag offset in the
  // same frame (before paint), so they never jump.
  useLayoutEffect(() => {
    moveLayer.current?.setAttribute("transform", "translate(0 0)");
  }, [parts]);
  // Only ids of parts that still exist (after Undo, delete elsewhere…).
  const selection = useMemo(() => {
    const existing = new Set((parts ?? []).map((p) => p.id));
    return new Set(selectedIds.filter((id) => existing.has(id)));
  }, [parts, selectedIds]);
  const select = useCallback((ids: readonly string[]) => setSelection(projectId, ids), [projectId]);

  // Track the panel size.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((old) => (old.width === width && old.height === height ? old : { width, height }));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Fit the drawing when the canvas first has a size and whenever another project is shown.
  useEffect(() => {
    if (size.width === 0 || size.height === 0) return;
    if (fittedFor.current === projectId && viewport) return;
    fittedFor.current = projectId;
    setViewport(fitBounds(bounds, size));
  }, [bounds, projectId, size, viewport]);

  const fit = useCallback(() => setViewport(fitBounds(bounds, size)), [bounds, size]);
  const zoomStep = useCallback(
    (direction: 1 | -1) =>
      setViewport((v) =>
        v ? zoomTo(v, stepZoom(v.zoom, direction), { x: size.width / 2, y: size.height / 2 }) : v,
      ),
    [size],
  );
  const zoomActual = useCallback(
    () => setViewport((v) => (v ? zoomTo(v, 1, { x: size.width / 2, y: size.height / 2 }) : v)),
    [size],
  );

  // Wheel needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const at = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
      setViewport((v) => {
        if (!v) return v;
        if (event.shiftKey) return panBy(v, -event.deltaY * unit, 0);
        return wheelZoom(v, event.deltaY * unit, at);
      });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  /** Runs an edit; a refused edit (e.g. off the canvas) becomes a status message, not a crash. */
  const apply = useCallback(
    (target: ProjectStore | null, edit: () => ProjectEdit) => {
      if (!target) return false;
      try {
        return target.getState().apply(edit());
      } catch (error) {
        if (!(error instanceof ProjectEditError)) throw error;
        post("warning", "That change would move parts off the drawing area.");
        return false;
      }
    },
    [post],
  );

  const ids = useMemo(() => [...selection], [selection]);
  const rotate = (turns: number) => apply(store, () => projectEdits.rotateParts(ids, turns));
  const flip = (axis: "x" | "y") => apply(store, () => projectEdits.flipParts(ids, axis));
  const remove = () => {
    if (apply(store, () => projectEdits.removeParts(ids))) select([]);
  };

  const startPlacing = (type: string) => {
    setTool({ kind: "place", type, rotation: 0, flip: false });
    select([]);
    ref.current?.focus({ preventScroll: true });
  };
  const stopPlacing = () => {
    setTool({ kind: "select" });
    setGhost(null);
  };
  const startWiring = () => {
    setTool({ kind: "wire", posture: "horizontal-first", points: [], before: [] });
    select([]);
    ref.current?.focus({ preventScroll: true });
  };
  /** Saves the wire being drawn (if it has a length) and stays in the wire tool. */
  const finishWire = (points: readonly WirePoint[]) => {
    const clean = simplifyWire(points);
    if (clean.length >= 2) apply(store, () => projectEdits.addWire({ id: newId(), points: clean }));
    if (tool.kind === "wire") setTool({ ...tool, points: [], before: [] });
  };
  /** The wire tool's route from its last fixed point to `to`. */
  const wireRoute = (to: WirePoint): WirePoint[] => {
    if (tool.kind !== "wire") return [];
    const last = tool.points[tool.points.length - 1];
    return last ? routeL(last, to, tool.posture) : [];
  };

  const localPoint = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.focus({ preventScroll: true });
    if (!viewport) return;
    const screen = localPoint(event);
    const world = toWorld(viewport, screen);

    if (event.button === 1 || (event.button === 0 && spaceHeld)) {
      event.preventDefault(); // no middle-click autoscroll
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { kind: "pan", last: screen };
      setPanning(true);
      return;
    }
    if (event.button === 2) {
      if (tool.kind === "wire" && tool.points.length > 0)
        setTool({ ...tool, points: [], before: [] });
      else if (tool.kind !== "select") stopPlacing();
      return;
    }
    if (event.button !== 0 || !parts || !store) return;

    if (tool.kind === "wire") {
      const snapped = snapToGrid(world, SCHEMATIC_GRID);
      const p: WirePoint = [snapped.x, snapped.y];
      const start = tool.points[0];
      if (!start) {
        setTool({ ...tool, points: [p], before: [] });
        return;
      }
      const last = tool.points[tool.points.length - 1] as WirePoint;
      if (last[0] === p[0] && last[1] === p[1]) return; // second click of a double-click
      const points = simplifyWire([...tool.points, ...wireRoute(p).slice(1)]);
      // Reaching a pin or another wire ends the wire by itself (ADR 009).
      if (isConnectable(p) && !(p[0] === start[0] && p[1] === start[1])) finishWire(points);
      else setTool({ ...tool, points, before: [...tool.before, tool.points] });
      return;
    }

    if (tool.kind === "place") {
      const at = snapToGrid(world, SCHEMATIC_GRID);
      const part = createPart(tool.type, at, parts, {
        id: newId(),
        rotation: tool.rotation,
        flip: tool.flip,
      });
      apply(store, () => projectEdits.addPart(part));
      return;
    }

    const hit = hitTest(parts, world, 6 / scaleOf(viewport));
    event.currentTarget.setPointerCapture(event.pointerId);
    if (hit) {
      const toggle = event.ctrlKey || event.metaKey;
      let next: string[];
      if (toggle) {
        next = selection.has(hit.id) ? ids.filter((id) => id !== hit.id) : [...ids, hit.id];
      } else if (event.shiftKey) {
        next = selection.has(hit.id) ? ids : [...ids, hit.id];
      } else {
        next = selection.has(hit.id) ? ids : [hit.id];
      }
      select(next);
      drag.current = toggle
        ? null
        : {
            kind: "move",
            ids: next,
            startScreen: screen,
            startWorld: world,
            active: false,
            delta: { x: 0, y: 0 },
            narrowTo:
              !event.shiftKey && selection.has(hit.id) && selection.size > 1 ? hit.id : null,
          };
      return;
    }
    drag.current = {
      kind: "box",
      startScreen: screen,
      startWorld: world,
      additive: event.shiftKey || event.ctrlKey || event.metaKey,
      active: false,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!viewport) return;
    const screen = localPoint(event);
    const d = drag.current;
    if (d?.kind === "pan") {
      const off = panOffset.current;
      off.x += screen.x - d.last.x;
      off.y += screen.y - d.last.y;
      d.last = screen;
      // Move the already-drawn picture on the compositor; redraw only when the margin runs out.
      if (Math.abs(off.x) > margin * 0.75 || Math.abs(off.y) > margin * 0.75) commitPan();
      else if (svgRef.current && !redrawPending.current) {
        svgRef.current.style.transform = `translate(${off.x}px, ${off.y}px)`;
      }
    }
    const world = toWorld(panBy(viewport, panOffset.current.x, panOffset.current.y), screen);
    if (d && (d.kind === "move" || d.kind === "box")) {
      if (
        !d.active &&
        Math.hypot(screen.x - d.startScreen.x, screen.y - d.startScreen.y) > DRAG_THRESHOLD
      ) {
        d.active = true;
      }
      if (d.active && d.kind === "move") {
        d.delta = snapToGrid(
          { x: world.x - d.startWorld.x, y: world.y - d.startWorld.y },
          SCHEMATIC_GRID,
        );
        moveLayer.current?.setAttribute("transform", `translate(${d.delta.x} ${d.delta.y})`);
      }
      if (d.active && d.kind === "box") setBox({ start: d.startWorld, end: world });
    }
    if (tool.kind !== "select") setGhost(snapToGrid(world, SCHEMATIC_GRID));
    setCursor(snapToGrid(world, SCHEMATIC_GRID));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!d) return;
    if (d.kind === "pan") {
      commitPan();
      setPanning(false);
      return;
    }
    if (d.kind === "move") {
      const delta = d.delta;
      if (!d.active && d.narrowTo) select([d.narrowTo]);
      const moved =
        d.active &&
        (delta.x !== 0 || delta.y !== 0) &&
        apply(store, () => projectEdits.moveParts(d.ids, delta.x, delta.y));
      // A committed move resets the layer when the new positions render (layout effect below);
      // a refused or empty move resets it now.
      if (!moved) moveLayer.current?.setAttribute("transform", "translate(0 0)");
      return;
    }
    setBox(null);
    if (!d.active || !viewport || !parts) {
      if (!d.additive) select([]);
      return;
    }
    const end = toWorld(viewport, localPoint(event));
    const found = partsInRect(
      parts,
      rectFromPoints(d.startWorld, end),
      boxModeOf(d.startWorld, end),
    );
    select(d.additive ? [...ids, ...found] : found);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const mod = event.ctrlKey || event.metaKey;
    if (mod && !event.altKey && event.key.toLowerCase() === "a") {
      event.preventDefault();
      select((parts ?? []).map((p) => p.id));
      return;
    }
    if (mod || event.altKey) return;
    const placing = tool.kind === "place" ? tool : null;
    const hasSelection = ids.length > 0;
    const step = event.shiftKey ? SCHEMATIC_GRID * 10 : SCHEMATIC_GRID;
    const handled = () => event.preventDefault();
    // Wire tool keys (ADR 009): Enter finishes, Backspace removes the last corner, / switches the
    // corner direction, Esc cancels the wire (a second Esc leaves the tool).
    if (tool.kind === "wire") {
      const drawing = tool.points.length > 0;
      if (event.key === "Enter" && drawing) {
        handled();
        finishWire(tool.points);
        return;
      }
      if (event.key === "Backspace" && drawing) {
        handled();
        setTool({ ...tool, points: tool.before.at(-1) ?? [], before: tool.before.slice(0, -1) });
        return;
      }
      if (event.key === "/") {
        handled();
        setTool({
          ...tool,
          posture: tool.posture === "horizontal-first" ? "vertical-first" : "horizontal-first",
        });
        return;
      }
      if (event.key === "Escape") {
        handled();
        if (drawing) setTool({ ...tool, points: [], before: [] });
        else stopPlacing();
        return;
      }
    }
    switch (event.key) {
      case " ":
        handled();
        setSpaceHeld(true);
        return;
      case "w":
      case "W":
        handled();
        if (tool.kind !== "wire") startWiring();
        return;
      case "Escape":
        if (placing) {
          handled();
          stopPlacing();
        } else if (hasSelection) {
          handled();
          select([]);
        }
        return;
      case "r":
      case "R":
        handled();
        if (placing)
          setTool({ ...placing, rotation: (placing.rotation + (event.shiftKey ? 270 : 90)) % 360 });
        else if (hasSelection) rotate(event.shiftKey ? -1 : 1);
        return;
      case "x":
      case "X":
      case "y":
      case "Y": {
        handled();
        const axis = event.key.toLowerCase() as "x" | "y";
        if (placing) {
          // Same composition rule as flipParts: mirror-X → rotate(−r); mirror-Y → rotate(180 − r).
          const rotation =
            ((axis === "x" ? -placing.rotation : 180 - placing.rotation) + 360) % 360;
          setTool({ ...placing, flip: !placing.flip, rotation });
        } else if (hasSelection) flip(axis);
        return;
      }
      case "Delete":
      case "Backspace":
        if (hasSelection) {
          handled();
          remove();
        }
        return;
      case "ArrowLeft":
      case "ArrowRight":
      case "ArrowUp":
      case "ArrowDown":
        if (!hasSelection) return;
        handled();
        apply(store, () =>
          projectEdits.moveParts(
            ids,
            event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0,
            event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0,
          ),
        );
        return;
      case "f":
      case "F":
      case "Home":
        handled();
        fit();
        return;
      case "+":
      case "=":
        handled();
        zoomStep(1);
        return;
      case "-":
      case "_":
        handled();
        zoomStep(-1);
        return;
    }
  };

  const scale = viewport ? scaleOf(viewport) : 1;
  // The picture is drawn `margin` px bigger on every side: its top-left is at (−margin, −margin).
  const drawViewport = viewport ? panBy(viewport, margin, margin) : null;
  const drawSize = { width: size.width + 2 * margin, height: size.height + 2 * margin };
  const showLabels = DESIGNATOR_SIZE * scale >= 6;
  const count = parts?.length ?? 0;
  const ghostSymbol = tool.kind === "place" ? symbolFor(tool.type) : undefined;
  const placingLabel =
    tool.kind === "place" ? PLACEABLE_PARTS.find((p) => p.type === tool.type)?.label : null;

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="application"
      aria-roledescription="schematic canvas"
      aria-label="Schematic"
      aria-describedby={helpId}
      data-testid="studio-canvas"
      data-tool={tool.kind === "place" ? `place:${tool.type}` : tool.kind}
      className={cn(
        "relative h-full overflow-hidden bg-canvas outline-none select-none",
        "focus-visible:ring-1 focus-visible:ring-brand/60 focus-visible:ring-inset",
        panning
          ? "cursor-grabbing"
          : spaceHeld
            ? "cursor-grab"
            : tool.kind !== "select"
              ? "cursor-crosshair"
              : "cursor-default",
        tool.kind === "select" && !lowEnd && "schematic-hover",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => {
        setCursor(null);
        setGhost(null);
      }}
      onKeyDown={onKeyDown}
      onKeyUp={(event) => {
        if (event.key === " ") setSpaceHeld(false);
      }}
      onBlur={() => setSpaceHeld(false)}
      onDoubleClick={() => {
        if (tool.kind === "wire" && tool.points.length > 0) finishWire(tool.points);
      }}
      onContextMenu={(event) => event.preventDefault()}
      onAuxClick={(event) => event.preventDefault()}
    >
      <p id={helpId} className="sr-only">
        Choose a part in the toolbar and click to place it; R rotates, X and Y mirror, Escape stops.
        W starts the wire tool: click to start and to add corners, the wire ends on a pin or another
        wire, Enter or a double click ends it, Backspace removes the last corner, slash switches the
        corner direction. Click to select, Shift or Control click to add, drag on empty space to
        box-select. Arrow keys move the selection, Delete removes it. Mouse wheel zooms, middle
        button or Space and drag pans, F fits the drawing.
      </p>
      {viewport && drawViewport && size.width > 0 ? (
        <svg
          ref={svgRef}
          width={size.width + 2 * margin}
          height={size.height + 2 * margin}
          className={cn("absolute", panning && "will-change-transform")}
          style={{ left: -margin, top: -margin }}
          aria-hidden
          data-zoom={viewport.zoom}
        >
          <Grid viewport={drawViewport} size={drawSize} lowEnd={lowEnd} />
          <OriginMark viewport={drawViewport} />
          <g
            transform={`matrix(${scale} 0 0 ${scale} ${-drawViewport.originX * scale} ${-drawViewport.originY * scale})`}
            style={
              {
                "--schematic-stroke": Math.max(6, 1.4 / scale),
                "--schematic-pin-stroke": Math.max(4, 1.1 / scale),
              } as CSSProperties
            }
          >
            {wires ? <WiresLayer wires={wires} junctions={connectivity.junctions} /> : null}
            {parts ? (
              <PartsLayer
                parts={parts}
                style={symbolStyle}
                showLabels={showLabels}
                selected={selection}
                moveLayer={moveLayer}
                connected={connectedByPart}
              />
            ) : null}
            {ghostSymbol && ghost && tool.kind === "place" ? (
              <g
                opacity={0.7}
                data-testid="schematic-ghost"
                style={{ "--schematic-ink": "var(--brand)" } as CSSProperties}
              >
                <PlacedSymbol
                  symbol={ghostSymbol}
                  style={symbolStyle}
                  placement={{ ...ghost, rotation: tool.rotation, flip: tool.flip }}
                  showLabels={false}
                />
              </g>
            ) : null}
            {tool.kind === "wire" && tool.points.length > 0 ? (
              <WirePreview fixed={tool.points} route={ghost ? wireRoute([ghost.x, ghost.y]) : []} />
            ) : null}
            {tool.kind === "wire" && ghost ? (
              <circle
                cx={ghost.x}
                cy={ghost.y}
                r={14}
                fill="none"
                style={{ stroke: "var(--brand)", strokeWidth: "var(--schematic-pin-stroke)" }}
              />
            ) : null}
            {box ? (
              <rect
                data-testid="selection-box"
                {...(() => {
                  const r = rectFromPoints(box.start, box.end);
                  return { x: r.minX, y: r.minY, width: r.maxX - r.minX, height: r.maxY - r.minY };
                })()}
                strokeDasharray={
                  boxModeOf(box.start, box.end) === "touch"
                    ? `${6 / scale} ${4 / scale}`
                    : undefined
                }
                style={{
                  fill: "var(--brand-soft)",
                  stroke: "var(--brand)",
                  strokeWidth: 1 / scale,
                }}
              />
            ) : null}
          </g>
        </svg>
      ) : null}

      <span className="pointer-events-none absolute top-2 left-12 font-mono text-2xs text-faint-foreground">
        {store
          ? `SCHEMATIC · ${symbolStyle.toUpperCase()} · ${count} ${count === 1 ? "part" : "parts"}${
              selection.size ? ` · ${selection.size} selected` : ""
            }${placingLabel ? ` · placing ${sentenceCase(placingLabel)}` : ""}${
              tool.kind === "wire" ? " · drawing wires" : ""
            }`
          : "SCHEMATIC"}
      </span>
      {!store ? (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-faint-foreground">
          Create or open a project to start drawing.
        </p>
      ) : null}

      {store ? (
        <Toolbar
          aria-label="Schematic tools"
          orientation="vertical"
          className="absolute top-2 left-2 h-auto flex-col gap-0.5 rounded-md border bg-surface-1/90 p-0.5 shadow-panel"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <ToolbarToggleGroup
            type="single"
            orientation="vertical"
            className="flex-col bg-transparent p-0"
            value={tool.kind === "place" ? tool.type : tool.kind}
            onValueChange={(value) => {
              if (!value || value === "select") stopPlacing();
              else if (value === "wire") startWiring();
              else startPlacing(value);
            }}
          >
            <ToolbarToggleItem value="select" label="Select" shortcut="Esc">
              <MousePointer2 />
            </ToolbarToggleItem>
            <ToolbarToggleItem value="wire" label="Wire" shortcut="W">
              <WireIcon />
            </ToolbarToggleItem>
            {PLACEABLE_PARTS.map((p) => (
              <ToolbarToggleItem
                key={p.type}
                value={p.type}
                label={`Place ${sentenceCase(p.label)}`}
              >
                <SymbolIcon type={p.type} style={symbolStyle} />
              </ToolbarToggleItem>
            ))}
          </ToolbarToggleGroup>
          <ToolbarSeparator className="mx-0 my-0.5 h-px w-5 self-center" />
          <ToolbarButton
            label="Rotate 90°"
            shortcut="R"
            disabled={selection.size === 0}
            onClick={() => rotate(1)}
          >
            <RotateCw />
          </ToolbarButton>
          <ToolbarButton
            label="Mirror left–right"
            shortcut="X"
            disabled={selection.size === 0}
            onClick={() => flip("x")}
          >
            <FlipHorizontal2 />
          </ToolbarButton>
          <ToolbarButton
            label="Mirror top–bottom"
            shortcut="Y"
            disabled={selection.size === 0}
            onClick={() => flip("y")}
          >
            <FlipVertical2 />
          </ToolbarButton>
          <ToolbarButton
            label="Delete"
            shortcut="Del"
            disabled={selection.size === 0}
            onClick={remove}
          >
            <Trash2 />
          </ToolbarButton>
        </Toolbar>
      ) : null}

      {viewport ? (
        <Toolbar
          aria-label="Zoom"
          className="absolute right-2 bottom-2 h-auto gap-0.5 rounded-md border bg-surface-1/90 p-0.5 shadow-panel"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <ToolbarButton label="Zoom out" shortcut="−" onClick={() => zoomStep(-1)}>
            <ZoomOut />
          </ToolbarButton>
          <ToolbarButton
            label="Zoom to 100 %"
            className="w-auto min-w-14 px-1.5 font-mono text-2xs tabular-nums"
            onClick={zoomActual}
            data-testid="zoom-level"
          >
            {percent(viewport.zoom)}
          </ToolbarButton>
          <ToolbarButton label="Zoom in" shortcut="+" onClick={() => zoomStep(1)}>
            <ZoomIn />
          </ToolbarButton>
          <ToolbarButton label="Zoom to fit" shortcut="F" onClick={fit}>
            <Maximize />
          </ToolbarButton>
        </Toolbar>
      ) : null}
      <SimReadout />
    </div>
  );
}
