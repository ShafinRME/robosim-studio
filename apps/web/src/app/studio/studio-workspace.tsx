"use client";

import {
  LABS,
  LAYOUT_STORAGE_KEY,
  MAX_NAME_CHARS,
  ProjectEditError,
  projectEdits,
  formatClock,
  parseSavedLayout,
  serializeLayout,
  type DockLayout,
  type LayoutRejection,
  type MessageLevel,
  type ProjectStore,
} from "@robosim/core";
import { Input } from "@robosim/ui/components/input";
import {
  Inspector,
  InspectorRow,
  InspectorSection,
  InspectorValue,
} from "@robosim/ui/components/inspector";
import { PanelErrorBoundary, useDevCrash } from "./panel-error-boundary";
import { SimReadout } from "./sim-controls";
import { useActiveProject } from "./studio-project";
import { cn } from "@robosim/ui/lib/utils";
import { useCanvasCursor, useStudioMessages, useStudioStatus } from "./studio-status";
import {
  Dock,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
  type SerializedDockview,
} from "@robosim/ui/components/dock";
import { FolderTree, SlidersHorizontal, SquareTerminal, type LucideIcon } from "lucide-react";
import { memo, useEffect, useRef, useState, type FunctionComponent } from "react";

/** Empty state shown until a lab fills the panel. Says honestly what will appear here. */
function EmptyPanel({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
      <Icon className="size-5 text-faint-foreground" aria-hidden />
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className="max-w-56 text-2xs text-faint-foreground">{text}</p>
    </div>
  );
}

function ExplorerPanel() {
  return (
    <EmptyPanel
      icon={FolderTree}
      title="No files yet"
      text="Project files and parts will be listed here."
    />
  );
}

function CanvasPanel() {
  const { setCursor } = useCanvasCursor();
  return (
    <div
      className="relative h-full bg-blueprint"
      data-testid="studio-canvas"
      onPointerMove={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        setCursor({
          x: Math.round(event.clientX - box.left),
          y: Math.round(event.clientY - box.top),
        });
      }}
      onPointerLeave={() => setCursor(null)}
    >
      <span className="absolute top-2 left-2 font-mono text-2xs text-faint-foreground">
        CANVAS · empty
      </span>
      <SimReadout />
    </div>
  );
}

/**
 * Project name field. Typing is local; the rename is one undoable edit, made on Enter or when the
 * field loses focus. Esc puts the current name back.
 */
function ProjectNameField({ id, store, name }: { id: string; store: ProjectStore; name: string }) {
  const { post } = useStudioStatus();
  const [draft, setDraft] = useState(name);
  const commit = () => {
    if (draft.trim() === name) return setDraft(name);
    try {
      store.getState().apply(projectEdits.renameProject(draft));
    } catch (error) {
      if (!(error instanceof ProjectEditError)) throw error;
      post("warning", `A project name must be 1–${MAX_NAME_CHARS} characters.`);
      setDraft(name);
    }
  };
  return (
    <Input
      id={id}
      value={draft}
      maxLength={MAX_NAME_CHARS}
      spellCheck={false}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          const input = event.currentTarget;
          setDraft(name);
          // Blur after React has put the old name back, so the blur commits nothing.
          requestAnimationFrame(() => input.blur());
        }
      }}
    />
  );
}

function InspectorPanel() {
  useDevCrash("inspector");
  const { store, state } = useActiveProject();
  if (!store || !state) {
    return (
      <EmptyPanel
        icon={SlidersHorizontal}
        title="No project"
        text="Open or create a project to see its properties."
      />
    );
  }
  const { project } = state;
  const lab = LABS.find((l) => l.id === project.lab)?.name ?? "None yet";
  return (
    <div className="h-full overflow-auto">
      {/* Headings in order for assistive tech: h1 (workspace) → h2 (panel) → h3 (section). */}
      <h2 className="sr-only">Inspector</h2>
      <Inspector defaultOpen={["project"]}>
        <InspectorSection id="project" title="Project">
          <InspectorRow label="Name">
            {(id) => (
              // A new key resets the field when the name changes elsewhere (Undo, another tab).
              <ProjectNameField
                key={`${project.id}:${project.name}`}
                id={id}
                store={store}
                name={project.name}
              />
            )}
          </InspectorRow>
          <InspectorRow label="Lab">
            <InspectorValue tone="muted">{lab}</InspectorValue>
          </InspectorRow>
          <InspectorRow label="Parts">
            <InspectorValue tone="muted">{project.parts.length}</InspectorValue>
          </InspectorRow>
        </InspectorSection>
      </Inspector>
      <p className="px-2.5 py-3 text-2xs text-faint-foreground">
        Select a part to see and edit its properties.
      </p>
    </div>
  );
}

const LEVEL_CLASS: Record<MessageLevel, string> = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  error: "text-danger",
};

/** Studio message log, newest at the bottom. */
function ConsolePanel() {
  const messages = useStudioMessages();
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [messages.length]);

  // The log role sits on a wrapper: on the <ol> itself it would hide the list from assistive tech.
  return (
    <div
      role="log"
      aria-label="Studio messages"
      className="h-full overflow-auto p-2 font-mono text-2xs leading-5 text-muted-foreground"
    >
      <ol>
        <li>
          <SquareTerminal className="mr-1.5 inline size-3.5 align-[-2px]" aria-hidden />
          Studio ready.
        </li>
        {messages.map((message) => (
          <li key={message.id} className="flex gap-2">
            <time className="shrink-0 text-faint-foreground">{formatClock(message.time)}</time>
            <span className={cn("w-12 shrink-0 uppercase", LEVEL_CLASS[message.level])}>
              {message.level === "warning" ? "warn" : message.level}
            </span>
            <span className="min-w-0 text-foreground">{message.text}</span>
          </li>
        ))}
        <li ref={end} aria-hidden />
      </ol>
    </div>
  );
}

/** Wraps a panel so a crash inside it stays inside it (see PanelErrorBoundary). */
function guarded(title: string, Panel: FunctionComponent): FunctionComponent<IDockviewPanelProps> {
  function GuardedPanel() {
    return (
      <PanelErrorBoundary title={title}>
        <Panel />
      </PanelErrorBoundary>
    );
  }
  GuardedPanel.displayName = `Guarded(${title})`;
  return GuardedPanel;
}

/** Panel registry: Dockview creates panels by these ids. Labs will add their own later. */
const PANELS: Record<string, FunctionComponent<IDockviewPanelProps>> = {
  explorer: guarded("Explorer", ExplorerPanel),
  canvas: guarded("Canvas", CanvasPanel),
  inspector: guarded("Inspector", InspectorPanel),
  console: guarded("Console", ConsolePanel),
};

export type StudioPanelId = "explorer" | "canvas" | "inspector" | "console";

/** Studio panels in menu order, with their titles. */
export const STUDIO_PANELS: readonly { id: StudioPanelId; title: string }[] = [
  { id: "explorer", title: "Explorer" },
  { id: "canvas", title: "Canvas" },
  { id: "inspector", title: "Inspector" },
  { id: "console", title: "Console" },
];
const TITLES = Object.fromEntries(STUDIO_PANELS.map((p) => [p.id, p.title])) as Record<
  StudioPanelId,
  string
>;

const PANEL_IDS: ReadonlySet<string> = new Set(Object.keys(PANELS));
/** Wait this long after the last layout change before saving. */
const SAVE_DELAY_MS = 300;
const SIDE_WIDTH = { explorer: 240, inspector: 280 } as const;
const CONSOLE_HEIGHT = 180;

/**
 * Adds a panel at its "home" place: Explorer on the far left, Inspector on the far right,
 * Console under the canvas, Canvas in the middle.
 */
function addPanelAtHome(api: DockviewApi, id: StudioPanelId) {
  const base = { id, component: id, title: TITLES[id] };
  switch (id) {
    case "explorer":
    case "inspector": {
      const direction = id === "explorer" ? "left" : "right";
      api.addPanel({ ...base, position: { direction }, initialWidth: SIDE_WIDTH[id] });
      // `initialWidth` is only a hint when splitting; set the width explicitly.
      api.getPanel(id)?.group.api.setSize({ width: SIDE_WIDTH[id] });
      break;
    }
    case "console": {
      const canvas = api.getPanel("canvas");
      api.addPanel({
        ...base,
        position: canvas ? { referencePanel: canvas, direction: "below" } : { direction: "below" },
      });
      api.getPanel(id)?.group.api.setSize({ height: CONSOLE_HEIGHT });
      break;
    }
    case "canvas": {
      const explorer = api.getPanel("explorer");
      if (explorer) {
        api.addPanel({ ...base, position: { referencePanel: explorer, direction: "right" } });
      } else if (api.panels.length > 0) {
        api.addPanel({ ...base, position: { direction: "left" } });
      } else {
        api.addPanel(base);
      }
      break;
    }
  }
}

/** Default layout: Explorer | Canvas over Console | Inspector. */
function addDefaultLayout(api: DockviewApi) {
  for (const id of ["canvas", "explorer", "inspector", "console"] as const) {
    addPanelAtHome(api, id);
  }
  api.getPanel("canvas")?.api.setActive();
  applyHomeSizes(api);
  // On first load the workspace may not be measured yet, so sizes set now can be lost: set them
  // again once the browser has laid the page out.
  requestAnimationFrame(() => applyHomeSizes(api));
}

function applyHomeSizes(api: DockviewApi) {
  api.getPanel("explorer")?.group.api.setSize({ width: SIDE_WIDTH.explorer });
  api.getPanel("inspector")?.group.api.setSize({ width: SIDE_WIDTH.inspector });
  api.getPanel("console")?.group.api.setSize({ height: CONSOLE_HEIGHT });
}

// localStorage can be missing or blocked (private mode, site data disabled): never let it throw.
function readStoredLayout(): string | null {
  try {
    return window.localStorage.getItem(LAYOUT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredLayout(value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(LAYOUT_STORAGE_KEY);
    else window.localStorage.setItem(LAYOUT_STORAGE_KEY, value);
  } catch {
    // Saving is a convenience; the studio keeps working without it.
  }
}

/**
 * Loads the saved layout if it passes the checks in `@robosim/core`, otherwise the default.
 * Returns a message for the status bar (none on a first visit).
 */
function restoreLayout(api: DockviewApi): { level: MessageLevel; text: string } | null {
  const saved = parseSavedLayout(readStoredLayout(), PANEL_IDS);
  let problem: string | null = null;
  if (saved.ok) {
    try {
      api.fromJSON(saved.layout as unknown as SerializedDockview);
      if (api.panels.length > 0) return { level: "info", text: "Saved layout restored." };
      problem = "had no panels";
    } catch {
      problem = "could not be opened";
    }
  } else if (saved.reason !== "missing") {
    problem = REJECTION_TEXT[saved.reason];
    if (saved.detail) console.warn(`Saved layout ignored: ${saved.detail}`);
  }
  writeStoredLayout(null);
  api.clear();
  addDefaultLayout(api);
  return problem
    ? { level: "warning", text: `The saved layout ${problem}, so the default layout is shown.` }
    : null;
}

const REJECTION_TEXT: Record<Exclude<LayoutRejection, "missing">, string> = {
  "too-large": "was too large",
  corrupt: "was damaged",
  "unsupported-version": "is from another version",
  invalid: "did not match the studio's panels",
};

export type StudioWorkspaceControls = {
  /** Forget the saved layout and go back to the default one. */
  resetLayout: () => void;
  /** Close an open panel, or open a closed one at its home place. */
  togglePanel: (id: StudioPanelId) => void;
};

/**
 * The docking workspace. Memoised: the studio around it re-renders often (tabs, menus, status),
 * and re-rendering Dockview each time cost start-up time (Lighthouse, Day 10).
 */
export const StudioWorkspace = memo(function StudioWorkspace({
  onControls,
  onOpenPanelsChange,
}: {
  onControls?: (controls: StudioWorkspaceControls) => void;
  /** Called with the ids of the open panels whenever a panel opens or closes. */
  onOpenPanelsChange?: (ids: string[]) => void;
}) {
  const [api, setApi] = useState<DockviewApi | null>(null);
  const { post } = useStudioStatus();
  const onControlsRef = useRef(onControls);
  const onOpenPanelsRef = useRef(onOpenPanelsChange);
  const postRef = useRef(post);
  useEffect(() => {
    onControlsRef.current = onControls;
    onOpenPanelsRef.current = onOpenPanelsChange;
    postRef.current = post;
  });

  const onReady = ({ api }: DockviewReadyEvent) => {
    const message = restoreLayout(api);
    if (message) post(message.level, message.text);
    setApi(api);
  };

  // Saving lives in an effect (not in onReady) so React can unsubscribe and re-subscribe cleanly.
  useEffect(() => {
    if (!api) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      clearTimeout(timer);
      timer = undefined;
      writeStoredLayout(serializeLayout(api.toJSON() as unknown as DockLayout));
    };
    const scheduleSave = () => {
      clearTimeout(timer);
      timer = setTimeout(save, SAVE_DELAY_MS);
    };
    // Save a pending change right away when the page is closed or reloaded.
    const flush = () => {
      if (timer !== undefined) save();
    };
    const reportOpenPanels = () => onOpenPanelsRef.current?.(api.panels.map((p) => p.id));
    const subscriptions = [
      api.onDidLayoutChange(scheduleSave),
      api.onDidAddPanel(reportOpenPanels),
      api.onDidRemovePanel(reportOpenPanels),
    ];
    window.addEventListener("pagehide", flush);
    reportOpenPanels();

    onControlsRef.current?.({
      resetLayout: () => {
        clearTimeout(timer);
        api.clear();
        addDefaultLayout(api);
        save();
        postRef.current("success", "Layout reset to the default.");
      },
      togglePanel: (id) => {
        const panel = api.getPanel(id);
        if (panel) api.removePanel(panel);
        else {
          addPanelAtHome(api, id);
          api.getPanel(id)?.api.setActive();
        }
      },
    });

    return () => {
      flush();
      for (const subscription of subscriptions) subscription.dispose();
      window.removeEventListener("pagehide", flush);
    };
  }, [api]);

  return <Dock components={PANELS} onReady={onReady} />;
});
