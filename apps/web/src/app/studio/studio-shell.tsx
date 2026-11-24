"use client";

import { redoLabel, rememberRecent, undoLabel, type Command } from "@robosim/core";
import { Button } from "@robosim/ui/components/button";
import { CommandPalette } from "@robosim/ui/components/command-palette";
import { FilePlus2, History } from "lucide-react";
import { useSetTheme } from "@robosim/ui/components/theme-provider";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ProjectTabStrip } from "./project-tab-strip";
import { StatusBar } from "./status-bar";
import { useStudioCommands } from "./studio-commands";
import { TEXT_EDITING_COMMANDS, isTypingTarget, useShortcutMap } from "./studio-shortcuts";
import { useDevCrash } from "./panel-error-boundary";
import { RecentProjectsDialog } from "./recent-projects-dialog";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { SystemInfoDialog } from "./system-info-dialog";
import { useOpenProjects } from "./open-projects";
import {
  copyShareLink,
  exportProject,
  useProjectImport,
  useShareLinkOpener,
} from "./project-files";
import { ActiveProjectProvider, useProjectState } from "./studio-project";
import { SimulationProvider, useSimController } from "./studio-simulation";
import { StudioStatusProvider, useStudioStatus } from "./studio-status";
import { TopBar } from "./top-bar";
import { StudioWorkspace, type StudioWorkspaceControls } from "./studio-workspace";

/** Studio window: top bar, project tabs, the docking workspace and the status bar. */
export function StudioShell() {
  return (
    <StudioStatusProvider>
      <StudioSimulation>
        <StudioWindow />
      </StudioSimulation>
    </StudioStatusProvider>
  );
}

/** The simulation reports to the status bar and Console. */
function StudioSimulation({ children }: { children: ReactNode }) {
  const { post, lowEnd } = useStudioStatus();
  return (
    <SimulationProvider post={post} lowEnd={lowEnd}>
      {children}
    </SimulationProvider>
  );
}

function StudioWindow() {
  useDevCrash("studio");
  const { post, lowEnd, setLowEnd } = useStudioStatus();
  const setTheme = useSetTheme();
  const controls = useRef<StudioWorkspaceControls | null>(null);
  const open = useOpenProjects(post);
  const sim = useSimController();
  const projects = open.tabs;
  const [openPanels, setOpenPanels] = useState<ReadonlySet<string>>(new Set());
  // Stable callbacks, so the memoised workspace does not re-render with the studio around it.
  const onWorkspaceControls = useCallback((c: StudioWorkspaceControls) => {
    controls.current = c;
  }, []);
  const onOpenPanels = useCallback((ids: string[]) => setOpenPanels(new Set(ids)), []);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [systemOpen, setSystemOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
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
  useShareLinkOpener(open.restored, open.openProject, post);
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
    openRecent: () => {
      setPaletteOpen(false);
      setRecentOpen(true);
    },
    shareProject: () => {
      if (activeStore) copyShareLink(activeStore.getState().project, post);
    },
    sim,
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
    openSystemInfo: () => {
      setPaletteOpen(false);
      setSystemOpen(true);
    },
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
        ready={open.restored}
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
          <StudioWorkspace onControls={onWorkspaceControls} onOpenPanelsChange={onOpenPanels} />
        </ActiveProjectProvider>
        {!open.restored ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-blueprint">
            <p className="text-sm text-muted-foreground">Opening your projects…</p>
          </div>
        ) : (
          !hasProject && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-blueprint">
              <p className="text-sm text-muted-foreground">No project open</p>
              <div className="flex gap-2">
                <Button onClick={newProject}>
                  <FilePlus2 /> New project
                </Button>
                <Button variant="outline" onClick={() => setRecentOpen(true)}>
                  <History /> Recent projects
                </Button>
              </div>
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
      <RecentProjectsDialog
        open={recentOpen}
        onOpenChange={setRecentOpen}
        openIds={new Set(projects.tabs.map((t) => t.id))}
        listSaved={open.listSaved}
        openSaved={open.openSaved}
        deleteSaved={open.deleteSaved}
        post={post}
      />
      <SystemInfoDialog open={systemOpen} onOpenChange={setSystemOpen} />
      <ShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        commands={commands}
        shortcuts={shortcuts}
      />
    </div>
  );
}
