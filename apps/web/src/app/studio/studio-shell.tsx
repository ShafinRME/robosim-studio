"use client";

import { redoLabel, rememberRecent, undoLabel, type Command } from "@robosim/core";
import { Button } from "@robosim/ui/components/button";
import { CommandPalette } from "@robosim/ui/components/command-palette";
import { FilePlus2 } from "lucide-react";
import { useSetTheme } from "@robosim/ui/components/theme-provider";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ProjectTabStrip } from "./project-tab-strip";
import { StatusBar } from "./status-bar";
import { useStudioCommands } from "./studio-commands";
import { TEXT_EDITING_COMMANDS, isTypingTarget, useShortcutMap } from "./studio-shortcuts";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { useOpenProjects } from "./open-projects";
import { exportProject, useProjectImport } from "./project-files";
import { ActiveProjectProvider, useProjectState } from "./studio-project";
import { StudioStatusProvider, useStudioStatus } from "./studio-status";
import { TopBar } from "./top-bar";
import { StudioWorkspace, type StudioWorkspaceControls } from "./studio-workspace";

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
  const open = useOpenProjects(post);
  const projects = open.tabs;
  const [openPanels, setOpenPanels] = useState<ReadonlySet<string>>(new Set());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const shortcuts = useShortcutMap();
  const activeStore = open.activeStore;
  const activeState = useProjectState(activeStore);
  const history = activeState?.history;

  const undoEdit = () => {
    const label = activeStore?.getState().undo();
    post("info", label ? `Undo: ${label}.` : "Nothing to undo.");
  };
  const redoEdit = () => {
    const label = activeStore?.getState().redo();
    post("info", label ? `Redo: ${label}.` : "Nothing to redo.");
  };

  const importer = useProjectImport(open.openProject, post);
  const newProject = open.newProject;
  const closeProject = open.closeProject;
  const hasProject = projects.activeId !== null;

  const registry = useStudioCommands({
    newProject,
    closeProject: () => projects.activeId && closeProject(projects.activeId),
    hasProject,
    exportProject: () => {
      if (activeStore) exportProject(activeStore.getState().project, post);
    },
    importProject: importer.pick,
    undo: undoEdit,
    redo: redoEdit,
    undoLabel: history ? undoLabel(history) : null,
    redoLabel: history ? redoLabel(history) : null,
    cycleProject: open.cycle,
    projectCount: projects.tabs.length,
    togglePanel: (id) => controls.current?.togglePanel(id),
    resetLayout: () => controls.current?.resetLayout(),
    lowEnd,
    setLowEnd,
    setTheme,
    togglePalette: () => setPaletteOpen((open) => !open),
    openShortcuts: () => {
      setPaletteOpen(false);
      setShortcutsOpen(true);
    },
  });
  const commands = useSyncExternalStore(registry.subscribe, registry.list, registry.list);
  const run = (id: string) => {
    if (registry.run(id)) setRecent((r) => (id === "palette.open" ? r : rememberRecent(r, id)));
  };
  const keysById = Object.fromEntries(
    commands.flatMap((c: Command) => {
      const keys = shortcuts.keysFor(c.id);
      return keys ? [[c.id, keys]] : [];
    }),
  ) as Record<string, string[]>;

  // Global keyboard shortcuts (see studio-shortcuts.ts). While typing, only Ctrl/⌘ ones work.
  const latestRun = useRef(run);
  useEffect(() => {
    latestRun.current = run;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.defaultPrevented) return;
      const hit = shortcuts.find(event);
      if (!hit) return;
      // In a text box, plain keys type and Ctrl+Z / Ctrl+Y undo the typing, not the project.
      if (
        isTypingTarget(event.target) &&
        (!hit.shortcut.mod || TEXT_EDITING_COMMANDS.has(hit.commandId))
      ) {
        return;
      }
      event.preventDefault();
      latestRun.current(hit.commandId);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [shortcuts]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopBar
        run={run}
        openPanels={openPanels}
        hasProject={hasProject}
        undoLabel={history ? undoLabel(history) : null}
        redoLabel={history ? redoLabel(history) : null}
        keysById={keysById}
      />
      <ProjectTabStrip
        state={projects}
        onActivate={open.activate}
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
        <ActiveProjectProvider store={activeStore}>
          <StudioWorkspace
            onControls={(c) => (controls.current = c)}
            onOpenPanelsChange={(ids) => setOpenPanels(new Set(ids))}
          />
        </ActiveProjectProvider>
        {!open.restored ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-blueprint">
            <p className="text-sm text-muted-foreground">Opening your projects…</p>
          </div>
        ) : (
          !hasProject && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-blueprint">
              <p className="text-sm text-muted-foreground">No project open</p>
              <Button onClick={newProject}>
                <FilePlus2 /> New project
              </Button>
            </div>
          )
        )}
      </main>
      <StatusBar />
      {importer.input}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        commands={commands.filter((c: Command) => c.id !== "palette.open")}
        recent={recent}
        shortcuts={keysById}
        onRun={run}
      />
      <ShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        commands={commands}
        shortcuts={shortcuts}
      />
    </div>
  );
}
