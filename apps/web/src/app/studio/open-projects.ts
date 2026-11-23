"use client";

import {
  MAX_PROJECT_TABS,
  activateProjectTab,
  closeProjectTab,
  createProject,
  createProjectStore,
  cycleProjectTab,
  emptyProjectTabs,
  nextUntitledName,
  openProjectTab,
  renameProjectTab,
  type MessageLevel,
  type Project,
  type ProjectStore,
  type ProjectTabsState,
} from "@robosim/core";
import { useEffect, useState } from "react";
import { StorageError, openProjectDatabase, type ProjectDatabase } from "../../lib/project-db";
import { backUpUnsaved, clearUnsaved, readUnsaved } from "../../lib/unsaved-backup";

/** localStorage, or null where it is missing or blocked. */
function localStore(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Save this long after the last edit (and at once when the page is hidden or closed). */
export const AUTOSAVE_DELAY_MS = 1_000;

type Post = (level: MessageLevel, text: string) => void;

/**
 * Plain (non-React) part: one store per open project, with autosave. Each store keeps its own
 * undo history, so Undo in one tab never touches another project.
 */
function createOpenProjectsEngine(
  db: ProjectDatabase | null,
  rename: (id: string, name: string) => void,
) {
  const stores = new Map<string, ProjectStore>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let post: Post = () => {};
  // A storage problem is reported once, not on every autosave; again only after it went away.
  let problem: string | null = null;

  const reportStorage = (error: unknown) => {
    const storageError =
      error instanceof StorageError
        ? error
        : new StorageError("unknown", "Saving in the browser failed.", { cause: error });
    if (problem === storageError.kind) return;
    problem = storageError.kind;
    console.warn("Project storage:", storageError.cause ?? storageError);
    post("warning", `${storageError.message} Your projects are not being saved.`);
  };

  const save = (project: Project) => {
    if (!db) return;
    db.saveProject(project).then(() => {
      problem = null;
      const storage = localStore();
      if (storage) clearUnsaved(storage, project.id);
    }, reportStorage);
  };

  const schedule = (id: string) => {
    clearTimeout(timers.get(id));
    timers.set(
      id,
      setTimeout(() => flush(id), AUTOSAVE_DELAY_MS),
    );
  };

  const flush = (id: string) => {
    const timer = timers.get(id);
    if (timer === undefined) return;
    clearTimeout(timer);
    timers.delete(id);
    const store = stores.get(id);
    if (store) save(store.getState().project);
  };

  return {
    get: (id: string | null) => (id === null ? null : (stores.get(id) ?? null)),
    save,
    reportStorage,
    /** Where messages go (the status bar); set by the hook. */
    setPost(next: Post) {
      post = next;
    },
    notify: (level: MessageLevel, text: string) => post(level, text),
    /**
     * Starts managing a project (no-op if it is already open). `unsaved`: it is not in the database
     * yet, so it is saved soon (and backed up if the page closes first).
     */
    adopt(project: Project, unsaved = false): ProjectStore {
      const existing = stores.get(project.id);
      if (existing) return existing;
      const store = createProjectStore(project);
      const id = project.id;
      store.subscribe((next, previous) => {
        if (next.project === previous.project) return;
        // The tab follows its project's name, also after Undo / Redo.
        if (next.project.name !== previous.project.name) rename(id, next.project.name);
        schedule(id);
      });
      stores.set(id, store);
      if (unsaved) schedule(id);
      return store;
    },
    /** Saves any pending change, then forgets the project and its history (tab closed). */
    remove(id: string) {
      flush(id);
      stores.delete(id);
    },
    flushAll() {
      for (const id of [...timers.keys()]) flush(id);
    },
    /**
     * The page is closing: start saving every pending edit, and also back it up synchronously,
     * because the database write may not finish before the page is gone.
     */
    flushForUnload() {
      const pending = [...timers.keys()].flatMap((id) => {
        const store = stores.get(id);
        return store ? [store.getState().project] : [];
      });
      const storage = localStore();
      if (storage) backUpUnsaved(storage, pending);
      for (const id of [...timers.keys()]) flush(id);
    },
  };
}

export type OpenProjects = {
  tabs: ProjectTabsState;
  /** False until the saved projects have been read back after a (re)load. */
  restored: boolean;
  activeStore: ProjectStore | null;
  newProject: () => void;
  /** Opens a project that came from outside (file, link). Returns false if it could not. */
  openProject: (project: Project) => boolean;
  closeProject: (id: string) => void;
  activate: (id: string) => void;
  cycle: (step: 1 | -1) => void;
};

/**
 * The studio's open projects: tabs, one store per project, autosave to the browser database and,
 * after a reload, the same tabs again (ADR 005).
 */
export function useOpenProjects(post: Post): OpenProjects {
  const [db] = useState(() => (typeof window === "undefined" ? null : openProjectDatabase()));
  const [tabs, setTabs] = useState<ProjectTabsState>(emptyProjectTabs);
  const [restored, setRestored] = useState(false);
  const [engine] = useState(() =>
    createOpenProjectsEngine(db, (id, name) => setTabs((s) => renameProjectTab(s, id, name))),
  );
  useEffect(() => {
    engine.setPost(post);
  });

  // Read the open projects back after a (re)load.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded: Project[] = [];
      let activeId: string | null = null;
      let skipped = 0;
      // Edits that were not saved when the page closed last time (validated in readUnsaved).
      const storage = localStore();
      const unsaved = storage ? readUnsaved(storage) : new Map<string, Project>();
      if (db) {
        try {
          const session = await db.loadSession();
          activeId = session.activeId;
          for (const id of session.openIds) {
            const backup = unsaved.get(id);
            if (backup) {
              loaded.push(backup);
              continue;
            }
            const result = await db.loadProject(id);
            if (result?.ok) loaded.push(result.project);
            else skipped++;
          }
        } catch (error) {
          if (!cancelled) engine.reportStorage(error);
        }
      }
      if (cancelled) return;
      if (skipped > 0) {
        engine.notify(
          "warning",
          skipped === 1
            ? "A saved project could not be opened and was skipped."
            : `${skipped} saved projects could not be opened and were skipped.`,
        );
      }
      // Projects opened just before the page closed may be missing from the saved tabs.
      for (const backup of unsaved.values()) {
        if (!loaded.some((p) => p.id === backup.id) && loaded.length < MAX_PROJECT_TABS) {
          loaded.push(backup);
        }
      }
      let fresh: Project | null = null;
      if (loaded.length === 0) {
        fresh = createProject({ name: nextUntitledName([]) });
        loaded.push(fresh);
      }
      for (const project of loaded) {
        // A backed-up or brand-new project still has to be written to the database.
        engine.adopt(project, project === fresh || unsaved.has(project.id));
      }
      const active = loaded.find((p) => p.id === activeId) ?? loaded[0]!;
      setTabs({ tabs: loaded.map((p) => ({ id: p.id, name: p.name })), activeId: active.id });
      setRestored(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, engine]);

  // Remember the open tabs.
  useEffect(() => {
    if (!restored || !db) return;
    db.saveSession({ openIds: tabs.tabs.map((t) => t.id), activeId: tabs.activeId }).catch(
      () => {},
    );
  }, [db, restored, tabs]);

  // Save pending edits at once when the page is hidden or closed.
  useEffect(() => {
    const onHide = () => engine.flushForUnload();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") engine.flushAll();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      engine.flushAll();
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [engine]);

  const tooMany = () => {
    if (tabs.tabs.length < MAX_PROJECT_TABS) return false;
    post("warning", "Too many projects open. Close one first.");
    return true;
  };

  return {
    tabs,
    restored,
    activeStore: engine.get(tabs.activeId),
    newProject() {
      if (tooMany()) return;
      const project = createProject({ name: nextUntitledName(tabs.tabs) });
      engine.adopt(project, true);
      setTabs(openProjectTab(tabs, project.id, project.name));
      post("info", `New project “${project.name}”.`);
    },
    openProject(project) {
      if (engine.get(project.id)) {
        setTabs(activateProjectTab(tabs, project.id));
        return true;
      }
      if (tooMany()) return false;
      engine.adopt(project, true);
      setTabs(openProjectTab(tabs, project.id, project.name));
      return true;
    },
    closeProject(id) {
      const name = tabs.tabs.find((t) => t.id === id)?.name;
      engine.remove(id);
      setTabs(closeProjectTab(tabs, id));
      if (name) post("info", `Closed “${name}”.`);
    },
    activate: (id) => setTabs((s) => activateProjectTab(s, id)),
    cycle: (step) => setTabs((s) => cycleProjectTab(s, step)),
  };
}
