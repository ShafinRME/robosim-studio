"use client";

import { IconButton } from "@robosim/ui/components/button";
import { Logo } from "@robosim/ui/components/logo";
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarHint,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@robosim/ui/components/menubar";
import { ThemeSwitcher } from "@robosim/ui/components/theme-switcher";
import {
  Bug,
  CodeXml,
  FilePlus2,
  Keyboard,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  Search,
  SkipForward,
  Square,
  Undo2,
  X,
} from "lucide-react";
import { Kbd, KbdGroup } from "@robosim/ui/components/kbd";
import { REPO_URL } from "./studio-commands";
import { STUDIO_PANELS } from "./studio-workspace";

/** Studio top bar: logo, application menus, simulation controls and theme switch. */
export function TopBar({
  run,
  openPanels,
  hasProject,
  undoLabel,
  redoLabel,
  keysById,
}: {
  /** Runs a studio command by id (menus use the same commands as the palette). */
  run: (id: string) => void;
  openPanels: ReadonlySet<string>;
  hasProject: boolean;
  /** Label of the edit Undo / Redo would act on (null: nothing to undo / redo). */
  undoLabel: string | null;
  redoLabel: string | null;
  /** Display keys per command id, for menu hints. */
  keysById: Readonly<Record<string, readonly string[]>>;
}) {
  const hint = (id: string) => {
    const keys = keysById[id];
    return keys ? <MenubarHint>{keys.join("+")}</MenubarHint> : null;
  };
  const paletteKeys = keysById["palette.open"] ?? [];
  return (
    <header className="flex h-10 shrink-0 items-center gap-3 border-b bg-surface-1 px-3">
      <Logo className="shrink-0" />

      <Menubar aria-label="Studio menu">
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onSelect={() => run("file.newProject")}>
              <FilePlus2 /> New project
              {hint("file.newProject")}
            </MenubarItem>
            <MenubarItem disabled={!hasProject} onSelect={() => run("file.closeProject")}>
              <X /> Close project
              {hint("file.closeProject")}
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger>Edit</MenubarTrigger>
          <MenubarContent>
            <MenubarItem disabled={undoLabel === null} onSelect={() => run("edit.undo")}>
              <Undo2 /> {undoLabel ? `Undo ${undoLabel}` : "Undo"}
              {hint("edit.undo")}
            </MenubarItem>
            <MenubarItem disabled={redoLabel === null} onSelect={() => run("edit.redo")}>
              <Redo2 /> {redoLabel ? `Redo ${redoLabel}` : "Redo"}
              {hint("edit.redo")}
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger>View</MenubarTrigger>
          <MenubarContent>
            <MenubarLabel>Panels</MenubarLabel>
            {STUDIO_PANELS.map((panel) => (
              <MenubarCheckboxItem
                key={panel.id}
                checked={openPanels.has(panel.id)}
                onCheckedChange={() => run(`view.toggle.${panel.id}`)}
              >
                {panel.title}
                {hint(`view.toggle.${panel.id}`)}
              </MenubarCheckboxItem>
            ))}
            <MenubarSeparator />
            <MenubarItem onSelect={() => run("view.resetLayout")}>
              <RotateCcw /> Reset layout
              {hint("view.resetLayout")}
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger>Help</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onSelect={() => run("help.shortcuts")}>
              <Keyboard /> Keyboard shortcuts
              {hint("help.shortcuts")}
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem asChild>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                <CodeXml /> Source code on GitHub
              </a>
            </MenubarItem>
            <MenubarItem asChild>
              <a href={`${REPO_URL}/issues/new`} target="_blank" rel="noopener noreferrer">
                <Bug /> Report a problem
              </a>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>

      {/* Simulation controls: enabled once a lab can run a simulation. */}
      <div
        role="group"
        aria-label="Simulation"
        title="No simulation loaded"
        className="mx-auto flex items-center gap-0.5 rounded-md border bg-canvas p-0.5"
      >
        <IconButton label="Run" size="icon-sm" disabled>
          <Play />
        </IconButton>
        <IconButton label="Pause" size="icon-sm" disabled>
          <Pause />
        </IconButton>
        <IconButton label="Step" size="icon-sm" disabled>
          <SkipForward />
        </IconButton>
        <IconButton label="Stop" size="icon-sm" disabled>
          <Square />
        </IconButton>
      </div>

      <button
        type="button"
        onClick={() => run("palette.open")}
        className="flex h-(--control-h-sm) w-56 shrink-0 items-center gap-2 rounded-md border bg-canvas px-2 text-xs text-faint-foreground outline-none hover:border-border-strong hover:text-muted-foreground focus-visible:outline-2"
      >
        <Search className="size-3.5" aria-hidden />
        <span className="flex-1 text-left">Search commands…</span>
        <KbdGroup aria-hidden>
          {paletteKeys.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </KbdGroup>
      </button>

      <ThemeSwitcher className="shrink-0" />
    </header>
  );
}
