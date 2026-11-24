"use client";

/**
 * Which parts are selected on the schematic — shared by the canvas (draws and edits them) and the
 * Inspector (shows them). Selection is a view state, not part of the project: it is never saved and
 * never undone. It belongs to one project; switching tabs starts with nothing selected.
 */
import { useSyncExternalStore } from "react";

type Selection = { readonly projectId: string | null; readonly ids: readonly string[] };

const EMPTY: readonly string[] = [];
let current: Selection = { projectId: null, ids: EMPTY };
const listeners = new Set<() => void>();

export function setSelection(projectId: string | null, ids: readonly string[]): void {
  const unique = [...new Set(ids)];
  if (current.projectId === projectId && sameIds(current.ids, unique)) return;
  current = { projectId, ids: unique.length ? unique : EMPTY };
  for (const listener of listeners) listener();
}

function sameIds(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const read = () => current;
const SERVER: Selection = { projectId: null, ids: EMPTY };
const readServer = () => SERVER;

/** Selected part ids of `projectId` (empty for any other project). */
export function useSelection(projectId: string | null): readonly string[] {
  const selection = useSyncExternalStore(subscribe, read, readServer);
  return selection.projectId === projectId ? selection.ids : EMPTY;
}

/** For tests and commands that run outside React. */
export function getSelection(): Selection {
  return current;
}
