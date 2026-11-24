/**
 * Draws schematic symbols (ADR 008) from the vector primitives in `@robosim/core`.
 *
 * Everything is in world units (mils). The parent sets `--schematic-stroke` (line width in mils)
 * from the zoom, so lines have a real width when zoomed in and never get thinner than ~1.4 px when
 * zoomed out. Labels are drawn outside the part's transform, so text is always upright.
 */
import {
  formatQuantity,
  placeLabels,
  placedPins,
  placementTransform,
  type PlacedLabel,
  type Placement,
  type Primitive,
  type SymbolDefinition,
  type SymbolStyle,
} from "@robosim/core";
import { memo } from "react";

/** Label sizes in mils (≈ 1.5 mm / 1.4 mm on paper). */
export const DESIGNATOR_SIZE = 60;
export const VALUE_SIZE = 55;

const STROKE = {
  style: { stroke: "var(--schematic-ink)", strokeWidth: "var(--schematic-stroke, 8)" },
} as const;
const FILLED = {
  style: {
    stroke: "var(--schematic-ink)",
    strokeWidth: "var(--schematic-stroke, 8)",
    fill: "var(--schematic-ink)",
  },
} as const;

function PrimitiveShape({ p }: { p: Primitive }) {
  switch (p.kind) {
    case "line":
      return <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} {...STROKE} strokeLinecap="round" />;
    case "polyline":
      return (
        <polyline
          points={p.points.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          {...STROKE}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      );
    case "polygon":
      return (
        <polygon
          points={p.points.map(([x, y]) => `${x},${y}`).join(" ")}
          {...FILLED}
          strokeLinejoin="round"
        />
      );
    case "rect":
      return <rect x={p.x} y={p.y} width={p.width} height={p.height} fill="none" {...STROKE} />;
    case "circle":
      return <circle cx={p.cx} cy={p.cy} r={p.r} fill="none" {...STROKE} />;
  }
}

/** The symbol's artwork at rotation 0 (no pins markers, no labels). */
export const SymbolBody = memo(function SymbolBody({
  symbol,
  style,
}: {
  symbol: SymbolDefinition;
  style: SymbolStyle;
}) {
  return (
    <>
      {symbol.body[style].map((p, i) => (
        <PrimitiveShape key={i} p={p} />
      ))}
    </>
  );
});

export type PlacedSymbolProps = {
  symbol: SymbolDefinition;
  style: SymbolStyle;
  placement: Placement;
  designator?: string;
  /** Raw property value for the value label (number in SI units, or text). */
  value?: number | string | boolean;
  /** Hide labels when they would be too small to read (performance and clarity). */
  showLabels?: boolean;
  /** Show the small circles at unconnected pin ends. */
  showPins?: boolean;
};

export function formatSymbolValue(
  symbol: SymbolDefinition,
  value: PlacedSymbolProps["value"],
): string | null {
  if (value === undefined || !symbol.value) return null;
  if (typeof value === "number") return formatQuantity(value, symbol.value.quantity);
  return String(value);
}

/** A symbol at its place on the schematic, with pin ends and upright labels. */
export const PlacedSymbol = memo(function PlacedSymbol({
  symbol,
  style,
  placement,
  designator,
  value,
  showLabels = true,
  showPins = true,
}: PlacedSymbolProps) {
  const valueText = formatSymbolValue(symbol, value);
  const labels = showLabels ? placeLabels(placement, symbol) : null;
  return (
    <g>
      <g transform={placementTransform(placement)}>
        <SymbolBody symbol={symbol} style={style} />
      </g>
      {showPins
        ? placedPins(placement, symbol).map((pin) => (
            <circle
              key={pin.id}
              cx={pin.x}
              cy={pin.y}
              r={12}
              fill="none"
              style={{
                stroke: "var(--schematic-pin)",
                strokeWidth: "var(--schematic-pin-stroke, 6)",
              }}
            />
          ))
        : null}
      {labels && designator ? (
        <SymbolLabel label={labels.designator} size={DESIGNATOR_SIZE} strong>
          {designator}
        </SymbolLabel>
      ) : null}
      {labels && valueText ? (
        <SymbolLabel label={labels.value} size={VALUE_SIZE}>
          {valueText}
        </SymbolLabel>
      ) : null}
    </g>
  );
});

function SymbolLabel({
  label,
  size,
  strong = false,
  children,
}: {
  label: PlacedLabel;
  size: number;
  strong?: boolean;
  children: string;
}) {
  return (
    <text
      x={label.x}
      y={label.y}
      textAnchor={label.anchor}
      dominantBaseline={
        label.baseline === "auto"
          ? "alphabetic"
          : label.baseline === "middle"
            ? "central"
            : "hanging"
      }
      fontSize={size}
      className={strong ? "fill-foreground font-medium" : "fill-muted-foreground"}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {children}
    </text>
  );
}
