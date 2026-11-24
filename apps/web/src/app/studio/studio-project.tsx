"use client";

import type { ProjectStore, ProjectStoreState } from "@robosim/core";
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

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
