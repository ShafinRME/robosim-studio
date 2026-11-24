"use client";

import { createCommandRegistry, type Command, type CommandRegistry } from "@robosim/core";
import { useEffect, useRef, useState } from "react";
import { ISSUES_URL, REPO_URL } from "../../lib/links";
import { setSchematicPrefs } from "../../lib/schematic-prefs";
import type { SimController } from "./studio-simulation";
import { STUDIO_PANELS, type StudioPanelId } from "./studio-workspace";

/** Everything the studio commands act on. Read fresh each time a command runs. */
export type StudioCommandContext = {
  newProject: () => void;
  closeProject: () => void;
  hasProject: boolean;
  exportProject: () => void;
  importProject: () => void;
  openRecent: () => void;
  shareProject: () => void;
  sim: SimController;
  undo: () => void;
  redo: () => void;
  /** Label of the edit Undo / Redo would act on, or null. */
  undoLabel: string | null;
  redoLabel: string | null;
  cycleProject: (step: 1 | -1) => void;
  projectCount: number;
  togglePanel: (id: StudioPanelId) => void;
  resetLayout: () => void;
  lowEnd: boolean;
  setLowEnd: (on: boolean) => void;
  setTheme: (theme: "system" | "light" | "dark") => void;
  togglePalette: () => void;
  openShortcuts: () => void;
  openSystemInfo: () => void;
};

function openExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function studioCommands(ctx: () => StudioCommandContext): Command[] {
  return [
    {
      id: "palette.open",
      title: "Show all commands",
      category: "Help",
      keywords: ["command palette", "search"],
      run: () => ctx().togglePalette(),
    },
    {
      id: "help.shortcuts",
      title: "Keyboard shortcuts",
      category: "Help",
      keywords: ["keys", "hotkeys"],
      run: () => ctx().openShortcuts(),
    },
    {
      id: "file.newProject",
      title: "New project",
      category: "File",
      keywords: ["create", "tab"],
      run: () => ctx().newProject(),
    },
    {
      id: "file.openRecent",
      title: "Recent projects…",
      category: "File",
      keywords: ["open", "saved", "history", "delete"],
      run: () => ctx().openRecent(),
    },
    {
      id: "file.closeProject",
      title: "Close project",
      category: "File",
      keywords: ["tab"],
      enabled: () => ctx().hasProject,
      run: () => ctx().closeProject(),
    },
    {
      id: "file.export",
      title: "Export project (.rsim)",
      category: "File",
      keywords: ["download", "save as", "file", "backup"],
      enabled: () => ctx().hasProject,
      run: () => ctx().exportProject(),
    },
    {
      id: "file.import",
      title: "Import project (.rsim)…",
      category: "File",
      keywords: ["open file", "upload", "load"],
      run: () => ctx().importProject(),
    },
    {
      id: "file.share",
      title: "Copy share link",
      category: "File",
      keywords: ["link", "url", "send", "share"],
      enabled: () => ctx().hasProject,
      run: () => ctx().shareProject(),
    },
    {
      id: "edit.undo",
      title: "Undo",
      category: "Edit",
      keywords: ["revert", "back"],
      enabled: () => ctx().undoLabel !== null,
      run: () => ctx().undo(),
    },
    {
      id: "edit.redo",
      title: "Redo",
      category: "Edit",
      keywords: ["again", "forward"],
      enabled: () => ctx().redoLabel !== null,
      run: () => ctx().redo(),
    },
    {
      id: "sim.toggle",
      title: "Run / pause simulation",
      category: "Simulation",
      keywords: ["start", "play", "stop", "pause"],
      run: () => ctx().sim.toggle(),
    },
    {
      id: "sim.step",
      title: "Step simulation (1 ms)",
      category: "Simulation",
      keywords: ["single step", "advance"],
      run: () => ctx().sim.step(),
    },
    {
      id: "sim.stop",
      title: "Stop simulation (back to 0 s)",
      category: "Simulation",
      keywords: ["reset", "restart"],
      run: () => ctx().sim.stop(),
    },
    {
      id: "project.next",
      title: "Next project tab",
      category: "File",
      keywords: ["switch"],
      enabled: () => ctx().projectCount > 1,
      run: () => ctx().cycleProject(1),
    },
    {
      id: "project.previous",
      title: "Previous project tab",
      category: "File",
      keywords: ["switch"],
      enabled: () => ctx().projectCount > 1,
      run: () => ctx().cycleProject(-1),
    },
    ...STUDIO_PANELS.map((panel): Command => ({
      id: `view.toggle.${panel.id}`,
      title: `Show or hide ${panel.title}`,
      category: "View",
      keywords: ["panel", "toggle", "open", "close"],
      run: () => ctx().togglePanel(panel.id),
    })),
    {
      id: "view.resetLayout",
      title: "Reset layout",
      category: "View",
      keywords: ["panels", "default", "dock"],
      run: () => ctx().resetLayout(),
    },
    {
      id: "view.toggleLowEnd",
      title: "Toggle Low-end mode",
      category: "View",
      keywords: ["performance", "animations", "slow computer"],
      run: () => ctx().setLowEnd(!ctx().lowEnd),
    },
    {
      id: "view.symbols.iec",
      title: "IEC symbols (box resistor)",
      category: "View",
      keywords: ["schematic", "symbol style", "IEC 60617", "european"],
      run: () => setSchematicPrefs({ symbolStyle: "iec" }),
    },
    {
      id: "view.symbols.ansi",
      title: "ANSI symbols (zig-zag resistor)",
      category: "View",
      keywords: ["schematic", "symbol style", "IEEE 315", "american"],
      run: () => setSchematicPrefs({ symbolStyle: "ansi" }),
    },
    {
      id: "view.units.mm",
      title: "Units: millimetres",
      category: "View",
      keywords: ["schematic", "metric", "mm", "position"],
      run: () => setSchematicPrefs({ lengthUnit: "mm" }),
    },
    {
      id: "view.units.in",
      title: "Units: inches",
      category: "View",
      keywords: ["schematic", "imperial", "inch", "mil", "position"],
      run: () => setSchematicPrefs({ lengthUnit: "in" }),
    },
    {
      id: "view.theme.dark",
      title: "Dark theme",
      category: "View",
      keywords: ["colour", "color", "appearance"],
      run: () => ctx().setTheme("dark"),
    },
    {
      id: "view.theme.light",
      title: "Light theme",
      category: "View",
      keywords: ["colour", "color", "appearance"],
      run: () => ctx().setTheme("light"),
    },
    {
      id: "view.theme.system",
      title: "System theme",
      category: "View",
      keywords: ["colour", "color", "appearance", "auto"],
      run: () => ctx().setTheme("system"),
    },
    {
      id: "help.system",
      title: "System information",
      category: "Help",
      keywords: ["computer", "graphics", "webgl", "memory", "low-end", "performance"],
      run: () => ctx().openSystemInfo(),
    },
    {
      id: "help.source",
      title: "Source code on GitHub",
      category: "Help",
      run: () => openExternal(REPO_URL),
    },
    {
      id: "help.report",
      title: "Report a problem",
      category: "Help",
      keywords: ["bug", "issue"],
      run: () => openExternal(ISSUES_URL),
    },
  ];
}

/** One command registry for the studio window, with the studio's commands registered. */
export function useStudioCommands(context: StudioCommandContext): CommandRegistry {
  const [registry] = useState(createCommandRegistry);
  const latest = useRef(context);
  useEffect(() => {
    latest.current = context;
  });
  useEffect(() => registry.register(studioCommands(() => latest.current)), [registry]);
  return registry;
}
