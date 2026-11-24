/**
 * Last-moment backup of unsaved edits (ADR 005).
 *
 * IndexedDB writes are asynchronous, and a write started while the page is closing may never finish.
 * So when the page closes with edits not yet saved, those projects are also written to
 * `localStorage`, which is synchronous. On the next load they are validated like any other input,
 * put back into the database and the backup is removed. A successful database save also removes
 * that project's backup, so an old backup can never win over newer saved work.
 */
import { loadProject, type Project } from "@robosim/core";

export const UNSAVED_BACKUP_KEY = "robosim-unsaved-projects";
/** Never use more than this much of the small localStorage quota. */
export const MAX_BACKUP_CHARS = 2_000_000;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function read(storage: StorageLike): unknown[] {
  try {
    const raw = storage.getItem(UNSAVED_BACKUP_KEY);
    if (raw === null || raw.length > MAX_BACKUP_CHARS) return [];
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return [];
    const { version, projects } = data as Record<string, unknown>;
    return version === 1 && Array.isArray(projects) ? projects : [];
  } catch {
    return [];
  }
}

function write(storage: StorageLike, projects: readonly unknown[]) {
  try {
    if (projects.length === 0) return storage.removeItem(UNSAVED_BACKUP_KEY);
    const text = JSON.stringify({ version: 1, projects });
    if (text.length <= MAX_BACKUP_CHARS) storage.setItem(UNSAVED_BACKUP_KEY, text);
  } catch {
    // A backup is best effort (storage blocked or full).
  }
}

const idOf = (item: unknown) =>
  typeof item === "object" && item !== null ? (item as { id?: unknown }).id : undefined;

/** Adds or replaces the backup of these projects (called while the page closes). */
export function backUpUnsaved(storage: StorageLike, projects: readonly Project[]) {
  if (projects.length === 0) return;
  const ids = new Set(projects.map((p) => p.id));
  write(storage, [...read(storage).filter((item) => !ids.has(idOf(item) as string)), ...projects]);
}

/** Removes one project's backup (after it was saved to the database). */
export function clearUnsaved(storage: StorageLike, id: string) {
  const items = read(storage);
  const kept = items.filter((item) => idOf(item) !== id);
  if (kept.length !== items.length) write(storage, kept);
}

/** Valid backed-up projects by id. Invalid entries are dropped. */
export function readUnsaved(storage: StorageLike): Map<string, Project> {
  const result = new Map<string, Project>();
  for (const item of read(storage)) {
    const loaded = loadProject(item);
    if (loaded.ok) result.set(loaded.project.id, loaded.project);
  }
  return result;
}
