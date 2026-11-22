"use client";

import {
  activateProjectTab,
  closeProjectTab,
  cycleProjectTab,
  emptyProjectTabs,
  openProjectTab,
  rememberRecent,
  type Command,
  type ProjectTabsState,
} from "@robosim/core";
import { Button } from "@robosim/ui/components/button";
import { CommandPalette } from "@robosim/ui/components/command-palette";
import { FilePlus2 } from "lucide-react";
import { useSetTheme } from "@robosim/ui/components/theme-provider";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ProjectTabStrip } from "./project-tab-strip";
import { StatusBar } from "./status-bar";
import { useStudioCommands } from "./studio-commands";
import { StudioStatusProvider, useStudioStatus } from "./studio-status";
import { TopBar } from "./top-bar";
import { StudioWorkspace, type StudioWorkspaceControls } from "./studio-workspace";

/** Keys shown in the palette and menus. Step 7 turns this into a full shortcut registry. */
const SHORTCUTS: Record<string, readonly string[]> = { "palette.open": ["Ctrl", "K"] };

/** Studio window: top bar, project tabs, the docking workspace and the status bar. */
export function StudioShell() {
  return (
    <StudioStatusProvider>
      <StudioWindow />
    </StudioStatusProvider>
  );
}

function StudioWindow() {
  const { post, lowEnd, setLowEnd } = useStudioStatus();
  const setTheme = useSetTheme();
  const controls = useRef<StudioWorkspaceControls | null>(null);
  const nextId = useRef(2);
  const [projects, setProjects] = useState<ProjectTabsState>(() =>
    openProjectTab(emptyProjectTabs, "project-1"),
  );
  const [openPanels, setOpenPanels] = useState<ReadonlySet<string>>(new Set());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  const newProject = () => {
    const next = openProjectTab(projects, `project-${nextId.current++}`);
    if (next === projects) return post("warning", "Too many projects open. Close one first.");
    setProjects(next);
    post("info", `New project “${next.tabs.at(-1)?.name}”.`);
  };
  const closeProject = (id: string) => {
    const name = projects.tabs.find((t) => t.id === id)?.name;
    setProjects(closeProjectTab(projects, id));
    if (name) post("info", `Closed “${name}”.`);
  };
  const hasProject = projects.activeId !== null;

  const registry = useStudioCommands({
    newProject,
    closeProject: () => projects.activeId && closeProject(projects.activeId),
    hasProject,
    cycleProject: (step) => setProjects((s) => cycleProjectTab(s, step)),
    projectCount: projects.tabs.length,
    togglePanel: (id) => controls.current?.togglePanel(id),
    resetLayout: () => controls.current?.resetLayout(),
    lowEnd,
    setLowEnd,
    setTheme,
    openPalette: () => setPaletteOpen(true),
  });
  const commands = useSyncExternalStore(registry.subscribe, registry.list, registry.list);
  const run = (id: string) => {
    if (registry.run(id)) setRecent((r) => (id === "palette.open" ? r : rememberRecent(r, id)));
  };

  // Ctrl+K (⌘K on a Mac) opens and closes the palette from anywhere.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopBar
        run={run}
        openPanels={openPanels}
        hasProject={hasProject}
        paletteKeys={SHORTCUTS["palette.open"] ?? []}
      />
      <ProjectTabStrip
        state={projects}
        onActivate={(id) => setProjects((s) => activateProjectTab(s, id))}
        onClose={closeProject}
        onNew={newProject}
      />
      <main
        aria-label="Workspace"
        data-testid="studio-workspace"
        className="relative min-h-0 flex-1 bg-canvas"
      >
        <h1 className="sr-only">RoboSim Studio workspace</h1>
        {/* The workspace stays mounted with no project open, so the layout is kept. */}
        <StudioWorkspace
          onControls={(c) => (controls.current = c)}
          onOpenPanelsChange={(ids) => setOpenPanels(new Set(ids))}
        />
        {!hasProject && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-blueprint">
            <p className="text-sm text-muted-foreground">No project open</p>
            <Button onClick={newProject}>
              <FilePlus2 /> New project
            </Button>
          </div>
        )}
      </main>
      <StatusBar />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        commands={commands.filter((c: Command) => c.id !== "palette.open")}
        recent={recent}
        shortcuts={SHORTCUTS}
        onRun={run}
      />
    </div>
  );
}
