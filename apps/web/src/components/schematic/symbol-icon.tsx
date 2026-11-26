/**
 * A small drawing of a part's own schematic symbol (our artwork, not a stock icon), scaled to fit
 * a square: tool buttons, the parts drawer and the drag image.
 */
import { symbolFor, type SymbolStyle } from "@robosim/core";
import type { CSSProperties } from "react";
import { SymbolBody } from "./schematic-symbol";

export function SymbolIcon({
  type,
  style,
  strokeWidth = 26,
  className,
}: {
  type: string;
  style: SymbolStyle;
  /** Line width in symbol units (mils): thicker for tiny icons. */
  strokeWidth?: number;
  className?: string;
}) {
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
      className={className}
      style={
        { "--schematic-ink": "currentColor", "--schematic-stroke": strokeWidth } as CSSProperties
      }
    >
      <SymbolBody symbol={symbol} style={style} />
    </svg>
  );
}
