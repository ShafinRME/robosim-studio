"use client";

import { APP_VERSION, type MessageLevel } from "@robosim/core";
import { cn } from "@robosim/ui/lib/utils";
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Gauge,
  Info,
  MousePointer2,
  type LucideIcon,
} from "lucide-react";
import { SimStatus } from "./sim-controls";
import { useCanvasCursor, useStudioMessages, useStudioStatus } from "./studio-status";

const LEVEL: Record<MessageLevel, { icon: LucideIcon; className: string }> = {
  info: { icon: Info, className: "text-info" },
  success: { icon: CircleCheck, className: "text-success" },
  warning: { icon: CircleAlert, className: "text-warning" },
  error: { icon: CircleX, className: "text-danger" },
};

function CursorReadout() {
  const { cursor } = useCanvasCursor();
  return (
    <span
      className="tabular flex w-28 items-center gap-1.5"
      title="Pointer position on the canvas, in pixels"
      data-testid="status-cursor"
    >
      <MousePointer2 className="size-3" aria-hidden />
      {cursor ? `X ${cursor.x}  Y ${cursor.y}` : "—"}
    </span>
  );
}

/** Bottom status bar: simulation state, latest message, canvas cursor, Low-end mode, version. */
export function StatusBar() {
  const { lowEnd, setLowEnd, lowEndAuto, lowEndReasons } = useStudioStatus();
  const messages = useStudioMessages();
  const autoWhy = lowEndAuto && lowEndReasons.length ? ` (${lowEndReasons.join(", ")})` : "";
  const latest = messages.at(-1);
  const level = latest ? LEVEL[latest.level] : null;

  return (
    <footer
      aria-label="Status bar"
      // Containment: the readouts here change many times a second; this keeps each change from
      // making the browser lay out and repaint the rest of the page.
      className="flex h-6 shrink-0 items-center gap-4 border-t bg-surface-1 px-3 font-mono text-2xs text-muted-foreground [contain:strict]"
    >
      <SimStatus />

      <span role="status" className="flex min-w-0 flex-1 items-center gap-1.5">
        {latest && level && (
          <>
            <level.icon className={cn("size-3 shrink-0", level.className)} aria-hidden />
            <span className="truncate" title={latest.text}>
              {latest.text}
            </span>
          </>
        )}
      </span>

      <CursorReadout />

      <button
        type="button"
        aria-pressed={lowEnd}
        title={
          lowEnd
            ? `Low-end mode is on${autoWhy}: animations off, lighter updates. Click to turn it off.`
            : "Turn on Low-end mode for slower computers (animations off, lighter updates)."
        }
        onClick={() => setLowEnd(!lowEnd)}
        className={cn(
          "flex h-5 items-center gap-1 rounded-sm px-1.5 outline-none hover:bg-surface-3 hover:text-foreground focus-visible:outline-2",
          lowEnd && "text-highlight",
        )}
      >
        <Gauge className="size-3" aria-hidden />
        Low-end {lowEnd ? "on" : "off"}
        {lowEnd && lowEndAuto && <span className="text-faint-foreground">· auto</span>}
      </button>

      <span className="text-faint-foreground">v{APP_VERSION}</span>
    </footer>
  );
}
