import { createProject } from "@robosim/core";
import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_BACKUP_CHARS,
  UNSAVED_BACKUP_KEY,
  backUpUnsaved,
  clearUnsaved,
  readUnsaved,
} from "./unsaved-backup";

class MemoryStorage {
  data = new Map<string, string>();
  getItem = (key: string) => this.data.get(key) ?? null;
  setItem = (key: string, value: string) => void this.data.set(key, value);
  removeItem = (key: string) => void this.data.delete(key);
}

const NOW = new Date("2026-11-23T10:00:00.000Z");
const project = (id: string, name = id) => createProject({ id, name, now: NOW });

let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
});

describe("unsaved backup", () => {
  it("backs up projects and reads them back", () => {
    backUpUnsaved(storage, [project("a", "Alpha"), project("b")]);
    const restored = readUnsaved(storage);
    expect([...restored.keys()]).toEqual(["a", "b"]);
    expect(restored.get("a")?.name).toBe("Alpha");
  });

  it("replaces an older backup of the same project", () => {
    backUpUnsaved(storage, [project("a", "Old")]);
    backUpUnsaved(storage, [project("a", "New")]);
    expect(readUnsaved(storage).get("a")?.name).toBe("New");
  });

  it("clears one project after it was saved, and the key when none are left", () => {
    backUpUnsaved(storage, [project("a"), project("b")]);
    clearUnsaved(storage, "a");
    expect([...readUnsaved(storage).keys()]).toEqual(["b"]);
    clearUnsaved(storage, "b");
    expect(storage.getItem(UNSAVED_BACKUP_KEY)).toBeNull();
  });

  it("ignores corrupt, foreign, oversized and invalid backups", () => {
    storage.setItem(UNSAVED_BACKUP_KEY, "{broken");
    expect(readUnsaved(storage).size).toBe(0);
    storage.setItem(UNSAVED_BACKUP_KEY, JSON.stringify({ version: 2, projects: [project("a")] }));
    expect(readUnsaved(storage).size).toBe(0);
    storage.setItem(UNSAVED_BACKUP_KEY, "x".repeat(MAX_BACKUP_CHARS + 1));
    expect(readUnsaved(storage).size).toBe(0);
    storage.setItem(
      UNSAVED_BACKUP_KEY,
      JSON.stringify({ version: 1, projects: [{ ...project("a"), extra: "x" }, project("b")] }),
    );
    expect([...readUnsaved(storage).keys()]).toEqual(["b"]);
  });

  it("never throws when storage is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => backUpUnsaved(blocked, [project("a")])).not.toThrow();
    expect(() => clearUnsaved(blocked, "a")).not.toThrow();
    expect(readUnsaved(blocked).size).toBe(0);
  });
});
