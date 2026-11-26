"use client";

/**
 * DC results on the schematic (ADR 011 §5): a voltage tag on every net (on its longest wire, or
 * beside a pin when it has no wire), problem halos for the parts an error names, and a status chip
 * with the list of problems — click one to select the parts it is about.
 */
import {
  formatQuantity,
  pinKey,
  placedPinsOf,
  type CircuitIssue,
  type Connectivity,
  type DcNet,
  type DcResult,
  type Part,
  type Wire,
  type WirePoint,
} from "@robosim/core";
import { cn } from "@robosim/ui/lib/utils";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, XCircle } from "lucide-react";
import { memo, useState } from "react";

/** Voltage tag text size and offset from its wire (mils). */
const TAG_SIZE = 58;
const TAG_OFFSET = 34;

export type VoltageTag = {
  readonly node: number;
  readonly name: string;
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly horizontal: boolean;
};

/** Where each net's voltage is written: middle of its longest wire segment, else next to a pin. */
export function voltageTags(
  result: DcResult,
  connectivity: Connectivity,
  wires: readonly Wire[],
  parts: readonly Part[],
): VoltageTag[] {
  if (!result.ok) return [];
  const netOfPin = new Map<string, DcNet>();
  for (const net of result.nets) for (const p of net.pins) netOfPin.set(pinKey(p.part, p.pin), net);
  const best = new Map<number, { length: number; x: number; y: number; horizontal: boolean }>();
  for (const wire of wires) {
    const group = connectivity.groupOf.get(wire.id);
    const pin = group === undefined ? undefined : connectivity.groupPin.get(group);
    const net = pin ? netOfPin.get(pinKey(pin.part, pin.pin)) : undefined;
    if (!net || net.node === 0) continue;
    for (let i = 1; i < wire.points.length; i++) {
      const [x1, y1] = wire.points[i - 1] as WirePoint;
      const [x2, y2] = wire.points[i] as WirePoint;
      const length = Math.abs(x2 - x1) + Math.abs(y2 - y1);
      if (length > (best.get(net.node)?.length ?? 0)) {
        best.set(net.node, { length, x: (x1 + x2) / 2, y: (y1 + y2) / 2, horizontal: y1 === y2 });
      }
    }
  }
  const pinPlace = new Map(placedPinsOf(parts).map((p) => [pinKey(p.part, p.pin), p]));
  const tags: VoltageTag[] = [];
  for (const net of result.nets) {
    if (net.node === 0) continue; // ground is 0 V by definition
    const text = formatQuantity(net.voltage, "voltage", 3);
    const place = best.get(net.node);
    if (place) {
      tags.push({
        node: net.node,
        name: net.name,
        text,
        x: place.x,
        y: place.y,
        horizontal: place.horizontal,
      });
      continue;
    }
    const pin = net.pins.map((p) => pinPlace.get(pinKey(p.part, p.pin))).find(Boolean);
    if (pin)
      tags.push({ node: net.node, name: net.name, text, x: pin.x, y: pin.y, horizontal: true });
  }
  return tags;
}

/** Voltage tags, drawn in world units inside the schematic transform. */
export const NetVoltages = memo(function NetVoltages({ tags }: { tags: readonly VoltageTag[] }) {
  return (
    <g data-testid="net-voltages" style={{ pointerEvents: "none" }}>
      {tags.map((tag) => {
        const width = tag.text.length * TAG_SIZE * 0.62 + 24;
        const height = TAG_SIZE + 16;
        // Above a horizontal wire, right of a vertical one.
        const x = tag.horizontal ? tag.x - width / 2 : tag.x + TAG_OFFSET;
        const y = tag.horizontal ? tag.y - TAG_OFFSET - height : tag.y - height / 2;
        return (
          <g key={tag.node} data-net-voltage={tag.name}>
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              rx={height / 2}
              style={{
                fill: "var(--canvas)",
                fillOpacity: 0.85,
                stroke: "var(--schematic-voltage)",
                strokeWidth: "var(--schematic-pin-stroke)",
              }}
            />
            <text
              x={x + width / 2}
              y={y + height / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={TAG_SIZE}
              style={{
                fill: "var(--schematic-voltage)",
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
              }}
            >
              {tag.text}
            </text>
          </g>
        );
      })}
    </g>
  );
});

/** Parts to mark: red for errors, amber for over-rating warnings. */
export function problemParts(result: DcResult | null): ReadonlyMap<string, "error" | "warning"> {
  const marks = new Map<string, "error" | "warning">();
  for (const issue of result?.issues ?? []) {
    const level =
      issue.severity === "error" ? "error" : issue.code === "over-limit" ? "warning" : null;
    if (!level) continue;
    for (const part of issue.parts) if (marks.get(part) !== "error") marks.set(part, level);
  }
  return marks;
}

/** The DC chip at the bottom left of the canvas, with the list of problems. */
export function DcStatus({
  result,
  solving,
  onSelectParts,
}: {
  result: DcResult | null;
  solving: boolean;
  onSelectParts: (parts: readonly string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!result) {
    return solving ? (
      <div className="pointer-events-none absolute bottom-2 left-12 flex items-center gap-1.5 rounded-md border bg-surface-1/90 px-2 py-1 font-mono text-2xs text-faint-foreground shadow-panel">
        <Loader2 className="size-3 animate-spin" aria-hidden /> DC…
      </div>
    ) : null;
  }
  const problems = result.issues.filter((i) => i.severity !== "info");
  const errors = problems.filter((i) => i.severity === "error");
  const tone = !result.ok ? "danger" : problems.length ? "warning" : "success";
  const Icon = tone === "danger" ? XCircle : tone === "warning" ? AlertTriangle : CheckCircle2;
  const summary = !result.ok
    ? `DC · cannot solve${errors.length > 1 ? ` · ${errors.length} problems` : ""}`
    : problems.length
      ? `DC · ${problems.length} ${problems.length === 1 ? "warning" : "warnings"}`
      : "DC · solved";
  return (
    <div
      className="absolute bottom-2 left-12 z-10 flex max-w-[min(28rem,60%)] flex-col-reverse items-start gap-1"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        data-testid="dc-status"
        data-state={tone}
        aria-expanded={problems.length ? open : undefined}
        disabled={!problems.length}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-md border bg-surface-1/90 px-2 py-1 font-mono text-2xs shadow-panel",
          tone === "danger" && "border-danger/60 text-danger",
          tone === "warning" && "border-warning/60 text-warning",
          tone === "success" && "text-success",
          problems.length && "cursor-pointer hover:bg-surface-2",
        )}
      >
        <Icon className="size-3.5" aria-hidden />
        {summary}
        {solving ? (
          <Loader2 className="size-3 animate-spin opacity-60" aria-label="Updating" />
        ) : null}
        {problems.length ? (
          <ChevronDown
            className={cn("size-3 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        ) : null}
      </button>
      {open && problems.length ? (
        <ul
          aria-label="Circuit problems"
          className="max-h-56 w-full overflow-y-auto rounded-md border bg-surface-1 p-1 text-xs shadow-panel"
        >
          {problems.map((issue: CircuitIssue, i) => (
            <li key={`${issue.code}-${i}`}>
              <button
                type="button"
                className="flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-surface-2"
                onClick={() => onSelectParts(issue.parts)}
              >
                {issue.severity === "error" ? (
                  <XCircle className="mt-0.5 size-3.5 shrink-0 text-danger" aria-hidden />
                ) : (
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                )}
                <span>
                  <span className="text-foreground">{issue.message}</span>
                  {issue.hint ? (
                    <span className="block text-2xs text-muted-foreground">{issue.hint}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
