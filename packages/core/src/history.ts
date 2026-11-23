/**
 * Undo / redo on Immer patches (ADR 004).
 *
 * Every edit is a named command: a label for the Edit menu and a recipe that changes a draft.
 * The history keeps only the patches of each edit and their inverse, never full snapshots, so
 * memory grows with the size of the edits, not with the size of the project.
 */
import {
  applyPatches,
  enablePatches,
  produceWithPatches,
  type Draft,
  type Objectish,
  type Patch,
} from "immer";

enablePatches();

/** Edits kept for undo; the oldest is dropped beyond this. */
export const MAX_HISTORY = 200;

export type Edit<T> = {
  /** Shown as "Undo <label>" / "Redo <label>", e.g. "Move R1". */
  label: string;
  recipe: (draft: Draft<T>) => void;
};

export type HistoryEntry = { label: string; patches: Patch[]; inverse: Patch[] };

export type History = {
  readonly past: readonly HistoryEntry[];
  readonly future: readonly HistoryEntry[];
};

export const emptyHistory = (): History => ({ past: [], future: [] });

export type EditResult<T> = { state: T; history: History; changed: boolean };

/**
 * Runs an edit. An edit that changes nothing is not recorded. A recorded edit clears the redo
 * list, and the history keeps at most `limit` edits.
 */
export function applyEdit<T>(
  state: T,
  history: History,
  edit: Edit<T>,
  limit: number = MAX_HISTORY,
): EditResult<T> {
  const [next, patches, inverse] = produceWithPatches(state, edit.recipe);
  if (patches.length === 0) return { state, history, changed: false };
  const past = [...history.past, { label: edit.label, patches, inverse }];
  return {
    state: next,
    history: { past: past.slice(Math.max(0, past.length - Math.max(1, limit))), future: [] },
    changed: true,
  };
}

export type StepResult<T> = { state: T; history: History; label: string | null };

/** Undoes the last edit. `label` is null when there was nothing to undo. */
export function undo<T extends Objectish>(state: T, history: History): StepResult<T> {
  const entry = history.past.at(-1);
  if (!entry) return { state, history, label: null };
  return {
    state: applyPatches(state, entry.inverse),
    history: { past: history.past.slice(0, -1), future: [entry, ...history.future] },
    label: entry.label,
  };
}

/** Redoes the last undone edit. `label` is null when there was nothing to redo. */
export function redo<T extends Objectish>(state: T, history: History): StepResult<T> {
  const [entry, ...future] = history.future;
  if (!entry) return { state, history, label: null };
  return {
    state: applyPatches(state, entry.patches),
    history: { past: [...history.past, entry], future },
    label: entry.label,
  };
}

export const undoLabel = (history: History): string | null => history.past.at(-1)?.label ?? null;
export const redoLabel = (history: History): string | null => history.future[0]?.label ?? null;
