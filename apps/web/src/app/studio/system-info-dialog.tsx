"use client";

import { describeLowEndReason } from "@robosim/core";
import { Button } from "@robosim/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@robosim/ui/components/dialog";
import { useState } from "react";
import { readCapabilities } from "../../lib/device-capabilities";
import { useStudioStatus } from "./studio-status";

/**
 * "System information": what the studio found out about this computer and why Low-end mode is (or
 * is not) on. Nothing here leaves the computer.
 */
export function SystemInfoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { lowEnd, setLowEnd, lowEndAuto } = useStudioStatus();
  const [report] = useState(readCapabilities);
  const reasons = report.lowEndReasons.map((reason) => describeLowEndReason(reason, report));

  const rows: [string, string][] = [
    [
      "Memory",
      report.memoryGb === null
        ? "Not reported by this browser"
        : report.memoryGb >= 8
          ? "8 GB or more"
          : `About ${report.memoryGb} GB`,
    ],
    ["Processor cores", report.cores === null ? "Not reported" : String(report.cores)],
    [
      "3D graphics (WebGL2)",
      report.webgl2 === null ? "Not checked" : report.webgl2 ? "Available" : "Not available",
    ],
    ["Graphics", report.renderer ?? "Unknown"],
    [
      "Drawn by",
      report.webgl2 === false
        ? "—"
        : report.softwareGraphics
          ? "The processor (no graphics card in use) — 3D will be slow"
          : "The graphics card",
    ],
    ["Low-end mode recommended", reasons.length ? `Yes: ${reasons.join(", ")}` : "No"],
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>System information</DialogTitle>
          <DialogDescription>
            What RoboSim Studio found out about this computer. It is used only to choose settings
            here and is never sent anywhere.
          </DialogDescription>
        </DialogHeader>
        <dl aria-label="This computer" className="px-4 py-2 text-xs">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[42%_1fr] gap-2 py-1">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-words text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-xs">
          <span>
            Low-end mode is <strong>{lowEnd ? "on" : "off"}</strong>
            {lowEndAuto ? " (chosen automatically)" : " (your choice)"}.
          </span>
          <Button size="sm" variant="outline" onClick={() => setLowEnd(!lowEnd)}>
            Turn {lowEnd ? "off" : "on"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
