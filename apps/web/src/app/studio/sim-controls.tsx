"use client";

import { RATE_PRESETS, type SignalDefinition, type SignalValue } from "@robosim/core";
import { IconButton } from "@robosim/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@robosim/ui/components/select";
import { cn } from "@robosim/ui/lib/utils";
import { Pause, Play, SkipForward, Square, TriangleAlert } from "lucide-react";
import { formatSimTime, simStateLabel, useSimController, useSimView } from "./studio-simulation";

const withKeys = (label: string, keys: readonly string[] | undefined) =>
  keys ? `${label} (${keys.join("+")})` : label;

/** Top-bar simulation controls: Run / Pause, Step, Stop and the speed (real-time factor). */
export function SimControls({
  keysById,
}: {
  keysById: Readonly<Record<string, readonly string[]>>;
}) {
  const controller = useSimController();
  const { snapshot } = useSimView();
  const running = snapshot?.state === "running";
  const atStart = !snapshot || (snapshot.state === "stopped" && snapshot.steps === 0);

  return (
    <div
      role="group"
      aria-label="Simulation"
      className="mx-auto flex items-center gap-0.5 rounded-md border bg-canvas p-0.5"
    >
      <IconButton
        label={running ? "Pause" : "Run"}
        title={withKeys(running ? "Pause" : "Run", keysById["sim.toggle"])}
        size="icon-sm"
        className={cn(running && "text-brand")}
        onClick={controller.toggle}
      >
        {running ? <Pause /> : <Play />}
      </IconButton>
      <IconButton
        label="Step"
        title={withKeys("Step 1 ms", keysById["sim.step"])}
        size="icon-sm"
        disabled={running}
        onClick={controller.step}
      >
        <SkipForward />
      </IconButton>
      <IconButton
        label="Stop"
        title={withKeys("Stop and go back to 0 s", keysById["sim.stop"])}
        size="icon-sm"
        disabled={atStart}
        onClick={controller.stop}
      >
        <Square />
      </IconButton>
      <Select
        value={String(snapshot?.rate ?? 1)}
        onValueChange={(value) => controller.setRate(Number(value))}
      >
        <SelectTrigger size="sm" aria-label="Simulation speed" className="w-[4.5rem] font-mono">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RATE_PRESETS.map((rate) => (
            <SelectItem key={rate} value={String(rate)} className="font-mono">
              {rate}×
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Status-bar part: simulation state, simulated time, steps per second and a "behind" warning. */
export function SimStatus() {
  const { snapshot } = useSimView();
  const label = simStateLabel(snapshot);
  const running = snapshot?.state === "running";
  return (
    <span className="flex items-center gap-3" data-testid="sim-status">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            running ? "bg-success" : label === "Paused" ? "bg-warning" : "bg-faint-foreground",
          )}
        />
        {label}
      </span>
      {snapshot && label !== "Idle" && (
        <>
          <span className="tabular min-w-20" title="Simulated time" data-testid="sim-time">
            t {formatSimTime(snapshot.time)}
          </span>
          {running && (
            <span className="tabular min-w-20" title="Simulation steps per second of real time">
              {snapshot.stepsPerSecond} steps/s
            </span>
          )}
          {snapshot.behind && (
            <span
              className="flex items-center gap-1 text-warning"
              title="This computer cannot keep up: the simulation runs slower than real time."
            >
              <TriangleAlert className="size-3" aria-hidden /> Behind
            </span>
          )}
        </>
      )}
    </span>
  );
}

function formatValue(value: SignalValue, def: SignalDefinition | undefined): string {
  if (typeof value === "boolean") return value ? "on" : "off";
  const unit = def?.kind === "number" && def.unit ? ` ${def.unit}` : "";
  return `${value.toFixed(4)}${unit}`;
}

/** Live signal values, shown on the canvas while a simulation is loaded. */
export function SimReadout() {
  const { snapshot, signals } = useSimView();
  if (!snapshot?.model) return null;
  const defs = new Map(signals.map((d) => [d.name, d]));
  return (
    <dl
      aria-label="Simulation signals"
      className="absolute top-2 right-2 rounded-md border bg-surface-1 px-2.5 py-1.5 font-mono text-2xs [contain:layout_paint]"
    >
      {Object.entries(snapshot.signals).map(([name, value]) => (
        <div key={name} className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{name}</dt>
          <dd className="tabular text-foreground">{formatValue(value, defs.get(name))}</dd>
        </div>
      ))}
    </dl>
  );
}
