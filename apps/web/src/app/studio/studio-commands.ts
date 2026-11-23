"use client";

import { createCommandRegistry, type Command, type CommandRegistry } from "@robosim/core";
import { useEffect, useRef, useState } from "react";
import { STUDIO_PANELS, type StudioPanelId } from "./studio-workspace";

export const REPO_URL = "https://github.com/ShafinRME/robosim-studio";

/** Everything the studio commands act on. Read fresh each time a command runs. */
export type StudioCommandContext = {
  newProject: () => void;
  closeProject: () => void;
  hasProject: boolean;
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
      id: "file.closeProject",
      title: "Close project",
      category: "File",
      keywords: ["tab"],
      enabled: () => ctx().hasProject,
      run: () => ctx().closeProject(),
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
      run: () => openExternal(`${REPO_URL}/issues/new`),
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
