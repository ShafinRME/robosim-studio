"use client";

import {
  createProject,
  createProjectStore,
  type ProjectStore,
  type ProjectStoreState,
  type ProjectTab,
} from "@robosim/core";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/**
 * One project store per open project tab (ADR 004). Each store keeps its own undo history, so
 * Undo in one tab never touches another project.
 */
export function useProjectStores(onRename: (tabId: string, name: string) => void) {
  const [stores] = useState(() => new Map<string, ProjectStore>());
  const latestOnRename = useRef(onRename);
  useEffect(() => {
    latestOnRename.current = onRename;
  });

  return {
    /** The store of a tab, created (with an empty project named like the tab) on first use. */
    storeFor(tab: ProjectTab): ProjectStore {
      let store = stores.get(tab.id);
      if (!store) {
        store = createProjectStore(createProject({ name: tab.name, id: tab.id }));
        // The tab follows its project's name, also after Undo / Redo.
        store.subscribe((next, previous) => {
          if (next.project.name !== previous.project.name) {
            latestOnRename.current(tab.id, next.project.name);
          }
        });
        stores.set(tab.id, store);
      }
      return store;
    },
    /** Forgets a closed tab's project and its history. */
    remove(tabId: string) {
      stores.delete(tabId);
    },
  };
}

const ActiveProjectContext = createContext<ProjectStore | null>(null);

export function ActiveProjectProvider({
  store,
  children,
}: {
  store: ProjectStore | null;
  children: ReactNode;
}) {
  return <ActiveProjectContext.Provider value={store}>{children}</ActiveProjectContext.Provider>;
}

const noSubscribe = () => () => {};

/** The active project's store and its current state (null with no project open). */
export function useProjectState(store: ProjectStore | null): ProjectStoreState | null {
  const get = () => store?.getState() ?? null;
  return useSyncExternalStore(store?.subscribe ?? noSubscribe, get, get);
}

export function useActiveProject(): {
  store: ProjectStore | null;
  state: ProjectStoreState | null;
} {
  const store = useContext(ActiveProjectContext);
  return { store, state: useProjectState(store) };
}
