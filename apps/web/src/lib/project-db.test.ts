import {
  PROJECT_VERSION,
  createProject,
  createProjectStore,
  projectEdits,
  type Project,
} from "@robosim/core";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StorageError, openProjectDatabase, type ProjectDatabase } from "./project-db";

const T0 = new Date("2026-11-23T10:00:00.000Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

let factory: IDBFactory;
let db: ProjectDatabase;
const open = () => openProjectDatabase("test-db", { indexedDB: factory, IDBKeyRange });

beforeEach(() => {
  factory = new IDBFactory(); // a fresh, empty browser database for every test
  db = open();
});
afterEach(() => db.close());

function project(id: string, name = id): Project {
  return createProject({ id, name, lab: "circuit", now: T0 });
}

describe("project database", () => {
  it("saves and loads a project, setting updatedAt in the saved copy", async () => {
    const store = createProjectStore(project("p1", "Blink"));
    store.getState().apply(
      projectEdits.addPart({
        id: "r1",
        type: "resistor",
        name: "R1",
        x: 10,
        y: 20,
        rotation: 90,
        flip: false,
        props: { resistance: 220 },
      }),
    );
    const original = store.getState().project;

    const saved = await db.saveProject(original, at(5));
    expect(saved).toEqual({ ...original, updatedAt: at(5).toISOString() });
    expect(original.updatedAt).toBe(T0.toISOString()); // the open project is not changed

    expect(await db.loadProject("p1")).toEqual({
      ok: true,
      project: saved,
      fromVersion: PROJECT_VERSION,
    });
  });

  it("returns null for a project that does not exist", async () => {
    expect(await db.loadProject("missing")).toBeNull();
  });

  it("keeps projects after the database is closed and opened again (a reload)", async () => {
    await db.saveProject(project("p1"), at(1));
    db.close();
    db = open();
    expect((await db.loadProject("p1"))?.ok).toBe(true);
  });

  it("overwrites a project saved again under the same id", async () => {
    await db.saveProject(project("p1", "Old"), at(1));
    await db.saveProject(project("p1", "New"), at(2));
    const recent = await db.listRecent();
    expect(recent).toHaveLength(1);
    expect(recent[0]?.name).toBe("New");
  });

  it("lists recent projects newest first, with summaries only", async () => {
    await db.saveProject(project("a", "Alpha"), at(1));
    await db.saveProject(project("b", "Beta"), at(3));
    await db.saveProject(project("c", "Gamma"), at(2));
    const recent = await db.listRecent();
    expect(recent.map((p) => p.name)).toEqual(["Beta", "Gamma", "Alpha"]);
    expect(recent[0]).toEqual({
      id: "b",
      name: "Beta",
      lab: "circuit",
      updatedAt: at(3).toISOString(),
      partCount: 0,
    });
    expect(await db.listRecent(2)).toHaveLength(2);
  });

  it("deletes a project", async () => {
    await db.saveProject(project("p1"), at(1));
    await db.deleteProject("p1");
    expect(await db.loadProject("p1")).toBeNull();
    expect(await db.listRecent()).toEqual([]);
  });
});

describe("stored data is not trusted", () => {
  /** Writes a raw record, as a tampered or very old database could contain. */
  async function writeRaw(record: Record<string, unknown>) {
    const raw = indexedDbOpen();
    await new Promise<void>((resolve, reject) => {
      raw.onsuccess = () => {
        const tx = raw.result.transaction("projects", "readwrite");
        tx.objectStore("projects").put(record);
        tx.oncomplete = () => {
          raw.result.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error ?? new Error("write failed"));
      };
      raw.onerror = () => reject(raw.error ?? new Error("open failed"));
    });
  }
  // Dexie stores its version 1 schema as IndexedDB version 10.
  const indexedDbOpen = () => factory.open("test-db", 10);

  it("rejects a stored project that fails validation", async () => {
    await db.saveProject(project("p1"), at(1)); // creates the database
    db.close();
    await writeRaw({
      id: "p1",
      name: "x",
      lab: null,
      updatedAt: at(1).toISOString(),
      partCount: 0,
      project: { ...project("p1"), parts: [{ id: "bad", onclick: "alert(1)" }] },
    });
    db = open();
    const result = await db.loadProject("p1");
    expect(result).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("rejects a stored project whose id differs from its key", async () => {
    await db.saveProject(project("p1"), at(1));
    db.close();
    await writeRaw({
      id: "p1",
      name: "x",
      lab: null,
      updatedAt: at(1).toISOString(),
      partCount: 0,
      project: project("other"),
    });
    db = open();
    expect(await db.loadProject("p1")).toMatchObject({ ok: false, reason: "invalid" });
  });
});

describe("session (open tabs)", () => {
  it("is empty at first", async () => {
    expect(await db.loadSession()).toEqual({ openIds: [], activeId: null });
  });

  it("round-trips the open tabs", async () => {
    await db.saveSession({ openIds: ["a", "b"], activeId: "b" });
    expect(await db.loadSession()).toEqual({ openIds: ["a", "b"], activeId: "b" });
  });

  it("cleans bad ids, duplicates, too many tabs and an unknown active id", async () => {
    const ids = ["a", "a", "../x", "", ...Array.from({ length: 20 }, (_, i) => `t${i}`)];
    await db.saveSession({ openIds: ids, activeId: "nope" });
    const session = await db.loadSession();
    expect(session.openIds[0]).toBe("a");
    expect(session.openIds).not.toContain("../x");
    expect(session.openIds).toHaveLength(12);
    expect(session.activeId).toBe("a");
  });
});

describe("storage errors", () => {
  it("reports a database that cannot be opened as unavailable", async () => {
    const broken = {
      open: () => {
        throw Object.assign(new Error("blocked"), { name: "SecurityError" });
      },
    } as unknown as IDBFactory;
    const blocked = openProjectDatabase("blocked", { indexedDB: broken, IDBKeyRange });
    const error = await blocked.listRecent().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StorageError);
    expect((error as StorageError).kind).toBe("unavailable");
  });
});
