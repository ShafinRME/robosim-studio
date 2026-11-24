"use client";

/**
 * Schematic canvas (ADR 008): our own SVG editor surface.
 *
 * One <svg> with one viewport transform: panning and zooming change a single matrix, the parts
 * layer is memoised and does not re-render. Controls follow EDA conventions — wheel zooms about the
 * cursor, middle-drag or Space + drag pans, F (or Home) fits the drawing, + / − step the zoom.
 * The status bar shows the grid-snapped cursor position in mm or inches.
 */
import {
  SCHEMATIC_GRID,
  fitBounds,
  gridLevel,
  panBy,
  placedBounds,
  scaleOf,
  snapToGrid,
  stepZoom,
  symbolFor,
  toWorld,
  unionRects,
  wheelZoom,
  zoomTo,
  type Part,
  type Rect,
  type Size,
  type SymbolStyle,
  type Viewport,
} from "@robosim/core";
import { Toolbar, ToolbarButton } from "@robosim/ui/components/toolbar";
import { cn } from "@robosim/ui/lib/utils";
import { Maximize, ZoomIn, ZoomOut } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { DESIGNATOR_SIZE, PlacedSymbol } from "../../components/schematic/schematic-symbol";
import { useSchematicPrefs } from "../../lib/schematic-prefs";
import { SimReadout } from "./sim-controls";
import { useActiveProject } from "./studio-project";
import { useCanvasCursor, useStudioStatus } from "./studio-status";

/** Size of the box drawn for a part type without a symbol (mils). */
const UNKNOWN_HALF = 200;

function partBounds(part: Part): Rect {
  const symbol = symbolFor(part.type);
  if (symbol) return placedBounds(part, symbol);
  return {
    minX: part.x - UNKNOWN_HALF,
    minY: part.y - UNKNOWN_HALF / 2,
    maxX: part.x + UNKNOWN_HALF,
    maxY: part.y + UNKNOWN_HALF / 2,
  };
}

const PartsLayer = memo(function PartsLayer({
  parts,
  style,
  showLabels,
}: {
  parts: readonly Part[];
  style: SymbolStyle;
  showLabels: boolean;
}) {
  return (
    <g data-testid="schematic-parts">
      {parts.map((part) => {
        const symbol = symbolFor(part.type);
        if (!symbol) {
          // A part type this version cannot draw: shown honestly, never hidden.
          return (
            <g key={part.id} data-part={part.id}>
              <rect
                x={part.x - UNKNOWN_HALF}
                y={part.y - UNKNOWN_HALF / 2}
                width={UNKNOWN_HALF * 2}
                height={UNKNOWN_HALF}
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
            </g>
          );
        }
        return (
          <g key={part.id} data-part={part.id}>
            <PlacedSymbol
              symbol={symbol}
              style={style}
              placement={part}
              designator={part.name}
              value={symbol.value ? part.props[symbol.value.key] : undefined}
              showLabels={showLabels}
            />
          </g>
        );
      })}
    </g>
  );
});

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

function percent(zoom: number): string {
  return `${Math.round(zoom * 100)} %`;
}

export function SchematicCanvas() {
  const { store, state } = useActiveProject();
  const parts = state?.project.parts;
  const projectId = state?.project.id ?? null;
  const { symbolStyle } = useSchematicPrefs();
  const { lowEnd } = useStudioStatus();
  const { setCursor } = useCanvasCursor();

  const helpId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const panFrom = useRef<{ x: number; y: number } | null>(null);
  const fittedFor = useRef<string | null | undefined>(undefined);

  const bounds = useMemo(() => unionRects((parts ?? []).map(partBounds)), [parts]);

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
      const box = element.getBoundingClientRect();
      const at = { x: event.clientX - box.left, y: event.clientY - box.top };
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? box.height : 1;
      setViewport((v) => {
        if (!v) return v;
        if (event.shiftKey) return panBy(v, -event.deltaY * unit, 0);
        return wheelZoom(v, event.deltaY * unit, at);
      });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  const localPoint = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.focus({ preventScroll: true });
    if (event.button === 1 || (event.button === 0 && spaceHeld)) {
      event.preventDefault(); // no middle-click autoscroll
      event.currentTarget.setPointerCapture(event.pointerId);
      panFrom.current = localPoint(event);
      setPanning(true);
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const point = localPoint(event);
    if (panFrom.current) {
      const from = panFrom.current;
      panFrom.current = point;
      setViewport((v) => (v ? panBy(v, point.x - from.x, point.y - from.y) : v));
    }
    if (viewport) setCursor(snapToGrid(toWorld(viewport, point), SCHEMATIC_GRID));
  };

  const endPan = (event: PointerEvent<HTMLDivElement>) => {
    if (!panFrom.current) return;
    panFrom.current = null;
    setPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    switch (event.key) {
      case " ":
        event.preventDefault();
        setSpaceHeld(true);
        return;
      case "f":
      case "F":
      case "Home":
        event.preventDefault();
        fit();
        return;
      case "+":
      case "=":
        event.preventDefault();
        zoomStep(1);
        return;
      case "-":
      case "_":
        event.preventDefault();
        zoomStep(-1);
        return;
    }
  };

  const scale = viewport ? scaleOf(viewport) : 1;
  const showLabels = DESIGNATOR_SIZE * scale >= 6;
  const count = parts?.length ?? 0;

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="application"
      aria-roledescription="schematic canvas"
      aria-label="Schematic"
      aria-describedby={helpId}
      data-testid="studio-canvas"
      className={cn(
        "relative h-full overflow-hidden bg-canvas outline-none select-none",
        "focus-visible:ring-1 focus-visible:ring-brand/60 focus-visible:ring-inset",
        panning ? "cursor-grabbing" : spaceHeld ? "cursor-grab" : "cursor-crosshair",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onPointerLeave={() => setCursor(null)}
      onKeyDown={onKeyDown}
      onKeyUp={(event) => {
        if (event.key === " ") setSpaceHeld(false);
      }}
      onBlur={() => setSpaceHeld(false)}
      onAuxClick={(event) => event.preventDefault()}
    >
      <p id={helpId} className="sr-only">
        Mouse wheel zooms, middle button or Space and drag pans, F fits the drawing, plus and minus
        zoom in and out.
      </p>
      {viewport && size.width > 0 ? (
        <svg
          width={size.width}
          height={size.height}
          className="absolute inset-0"
          aria-hidden
          data-zoom={viewport.zoom}
        >
          <Grid viewport={viewport} size={size} lowEnd={lowEnd} />
          <OriginMark viewport={viewport} />
          <g
            transform={`matrix(${scale} 0 0 ${scale} ${-viewport.originX * scale} ${-viewport.originY * scale})`}
            style={
              {
                "--schematic-stroke": Math.max(6, 1.4 / scale),
                "--schematic-pin-stroke": Math.max(4, 1.1 / scale),
              } as CSSProperties
            }
          >
            {parts ? (
              <PartsLayer parts={parts} style={symbolStyle} showLabels={showLabels} />
            ) : null}
          </g>
        </svg>
      ) : null}

      <span className="pointer-events-none absolute top-2 left-2 font-mono text-2xs text-faint-foreground">
        {store
          ? `SCHEMATIC · ${symbolStyle.toUpperCase()} · ${count} ${count === 1 ? "part" : "parts"}`
          : "SCHEMATIC"}
      </span>
      {!store ? (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-faint-foreground">
          Create or open a project to start drawing.
        </p>
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
