/**
 * Projects saved in the browser (ADR 005), with Dexie over IndexedDB.
 *
 * The database is untrusted input like any file: every project read back goes through
 * `loadProject` (migrate + validate) before the studio uses it. Storage can fail (quota full,
 * IndexedDB blocked in private windows); such errors become a `StorageError` with a simple kind
 * the studio can explain.
 */
import {
  MAX_PROJECT_TABS,
  loadProject,
  type LabId,
  type Project,
  type ProjectLoadResult,
} from "@robosim/core";
import { Dexie, type Table } from "dexie";

export const PROJECT_DB_NAME = "robosim-studio";
/** At most this many projects are listed as recent. */
export const MAX_RECENT_PROJECTS = 50;

/** What is stored per project: the project plus a small summary for the recent list. */
export type StoredProject = {
  id: string;
  name: string;
  lab: LabId | null;
  updatedAt: string;
  partCount: number;
  project: Project;
};

export type ProjectSummary = Omit<StoredProject, "project">;

/** Open tabs, so a reload brings the same projects back. */
export type StudioSession = { openIds: string[]; activeId: string | null };

type Setting = { key: string; value: unknown };

export type StorageErrorKind = "quota" | "unavailable" | "unknown";

export class StorageError extends Error {
  override name = "StorageError";
  constructor(
    readonly kind: StorageErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

const UNAVAILABLE_ERRORS = [
  "MissingAPIError",
  "OpenFailedError",
  "DatabaseClosedError",
  "InvalidStateError",
  "SecurityError",
];

function toStorageError(error: unknown): StorageError {
  if (error instanceof StorageError) return error;
  // Dexie wraps the browser's error (e.g. DatabaseClosedError around a SecurityError): check both.
  const names = new Set<string>();
  if (error instanceof Error) names.add(error.name);
  if (error instanceof Dexie.DexieError && error.inner instanceof Error)
    names.add(error.inner.name);
  if (names.has("QuotaExceededError")) {
    return new StorageError("quota", "The browser storage is full.", { cause: error });
  }
  if (UNAVAILABLE_ERRORS.some((name) => names.has(name))) {
    return new StorageError("unavailable", "Browser storage is not available.", { cause: error });
  }
  return new StorageError("unknown", "Saving in the browser failed.", { cause: error });
}

async function guard<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw toStorageError(error);
  }
}

class StudioDatabase extends Dexie {
  projects!: Table<StoredProject, string>;
  settings!: Table<Setting, string>;

  constructor(
    name: string,
    dependencies?: { indexedDB: IDBFactory; IDBKeyRange: typeof IDBKeyRange },
  ) {
    super(name, dependencies);
    this.version(1).stores({ projects: "id, updatedAt", settings: "key" });
  }
}

const SESSION_KEY = "session";
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function parseSession(value: unknown): StudioSession {
  const empty: StudioSession = { openIds: [], activeId: null };
  if (typeof value !== "object" || value === null) return empty;
  const { openIds, activeId } = value as Record<string, unknown>;
  if (!Array.isArray(openIds)) return empty;
  const ids = [
    ...new Set(openIds.filter((id): id is string => typeof id === "string" && ID_PATTERN.test(id))),
  ].slice(0, MAX_PROJECT_TABS);
  return {
    openIds: ids,
    activeId: typeof activeId === "string" && ids.includes(activeId) ? activeId : (ids[0] ?? null),
  };
}

export type ProjectDatabase = ReturnType<typeof openProjectDatabase>;

/** Opens (and creates on first use) the studio's project database. */
export function openProjectDatabase(
  name: string = PROJECT_DB_NAME,
  dependencies?: { indexedDB: IDBFactory; IDBKeyRange: typeof IDBKeyRange },
) {
  const db = new StudioDatabase(name, dependencies);

  return {
    /** Saves a project; `updatedAt` is set to `now` in the saved copy. Returns the saved copy. */
    saveProject(project: Project, now: Date = new Date()): Promise<Project> {
      return guard(async () => {
        const saved: Project = { ...project, updatedAt: now.toISOString() };
        await db.projects.put({
          id: saved.id,
          name: saved.name,
          lab: saved.lab,
          updatedAt: saved.updatedAt,
          partCount: saved.parts.length,
          project: saved,
        });
        return saved;
      });
    },

    /** Reads and validates a project. `null` if there is no project with this id. */
    loadProject(id: string): Promise<ProjectLoadResult | null> {
      return guard(async () => {
        const stored = await db.projects.get(id);
        if (!stored) return null;
        const result = loadProject(stored.project);
        // A stored project must not claim another id than the one it is stored under.
        if (result.ok && result.project.id !== id) {
          return { ok: false, reason: "invalid", issues: ["id: does not match the saved project"] };
        }
        return result;
      });
    },

    /** Saved projects, most recently changed first. */
    listRecent(limit: number = MAX_RECENT_PROJECTS): Promise<ProjectSummary[]> {
      return guard(async () => {
        const rows = await db.projects.orderBy("updatedAt").reverse().limit(limit).toArray();
        return rows.map(({ project: _project, ...summary }) => summary);
      });
    },

    deleteProject(id: string): Promise<void> {
      return guard(() => db.projects.delete(id));
    },

    saveSession(session: StudioSession): Promise<void> {
      return guard(async () => {
        await db.settings.put({ key: SESSION_KEY, value: parseSession(session) });
      });
    },

    /** The saved open tabs (checked; unknown shapes give an empty session). */
    loadSession(): Promise<StudioSession> {
      return guard(async () => parseSession((await db.settings.get(SESSION_KEY))?.value));
    },

    close() {
      db.close();
    },

    /** Deletes the whole database (tests and "clear all data"). */
    destroy(): Promise<void> {
      return guard(() => db.delete());
    },
  };
}
