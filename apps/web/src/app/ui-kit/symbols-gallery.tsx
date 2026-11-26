/**
 * Schematic symbol gallery (ADR 007 §5, ADR 008): every symbol in IEC and ANSI style, as placed,
 * rotated 90° and mirrored — for reviewing our own artwork. Static: no client JavaScript.
 */
import {
  SYMBOLS,
  designatorPrefix,
  partFor,
  placedBounds,
  type Placement,
  type SymbolDefinition,
  type SymbolStyle,
} from "@robosim/core";
import type { CSSProperties } from "react";
import { PlacedSymbol } from "../../components/schematic/schematic-symbol";

/** Sample values that read well; other parts show their default value (ADR 010 registry). */
const SAMPLE_VALUES: Readonly<Record<string, number>> = {
  resistor: 4_700,
  "source.dc-voltage": 9,
  "source.dc-current": 0.002,
};

function sampleOf(type: string): { designator: string; value?: number } {
  const part = partFor(type);
  if (part?.role === "ground") return { designator: "" };
  const key = part?.symbol.value?.key;
  const fallback = part?.component?.properties.find((p) => p.key === key)?.default;
  const value = SAMPLE_VALUES[type] ?? (typeof fallback === "number" ? fallback : undefined);
  return { designator: `${designatorPrefix(type)}1`, ...(value === undefined ? {} : { value }) };
}

const VARIANTS: readonly { label: string; rotation: number; flip: boolean }[] = [
  { label: "0°", rotation: 0, flip: false },
  { label: "90°", rotation: 90, flip: false },
  { label: "Mirrored", rotation: 0, flip: true },
];

function Cell({
  symbol,
  style,
  rotation,
  flip,
}: { symbol: SymbolDefinition; style: SymbolStyle } & Omit<Placement, "x" | "y">) {
  const placement: Placement = { x: 0, y: 0, rotation, flip };
  const b = placedBounds(placement, symbol);
  // Room for the labels around the body.
  const pad = 260;
  const viewBox = `${b.minX - pad} ${b.minY - pad} ${b.maxX - b.minX + 2 * pad} ${b.maxY - b.minY + 2 * pad}`;
  const sample = sampleOf(symbol.type);
  return (
    <svg
      viewBox={viewBox}
      className="h-28 w-28 rounded-md border bg-canvas"
      style={{ "--schematic-stroke": 10, "--schematic-pin-stroke": 7 } as CSSProperties}
      role="img"
      aria-label={`${symbol.type}, ${style.toUpperCase()}`}
    >
      <PlacedSymbol
        symbol={symbol}
        style={style}
        placement={placement}
        designator={sample.designator}
        value={sample.value}
      />
    </svg>
  );
}

export function SymbolsGallery() {
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Our own symbol artwork on a 100-mil grid (pin ends marked in amber). IEC 60617 is the
        default; ANSI / IEEE 315 is chosen in the studio under View → Schematic. Labels stay upright
        when a part is rotated or mirrored.
      </p>
      {(["iec", "ansi"] as const).map((style) => (
        <div key={style} className="flex flex-col gap-2">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {style === "iec" ? "IEC 60617" : "ANSI / IEEE 315"}
          </h3>
          <div className="flex flex-wrap gap-4">
            {SYMBOLS.map((symbol) => (
              <figure key={symbol.type} className="flex flex-col gap-1">
                <div className="flex gap-1.5">
                  {VARIANTS.map((v) => (
                    <Cell
                      key={v.label}
                      symbol={symbol}
                      style={style}
                      rotation={v.rotation}
                      flip={v.flip}
                    />
                  ))}
                </div>
                <figcaption className="font-mono text-2xs text-faint-foreground">
                  {symbol.type} · 0° / 90° / mirrored
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
