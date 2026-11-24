import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { describe, expect, it } from "vitest";
import {
  ARCHIVE_FORMAT,
  MAX_ARCHIVE_BYTES,
  MAX_ARCHIVE_ENTRIES,
  archiveFileName,
  readArchive,
  writeArchive,
} from "./archive";
import {
  PROJECT_VERSION,
  copyProject,
  createProject,
  serializeProject,
  type Project,
} from "./project";
import { createProjectStore, projectEdits } from "./project-store";

const NOW = new Date("2026-11-23T10:00:00.000Z");

function sampleProject(): Project {
  const store = createProjectStore(
    createProject({ name: "Line follower", lab: "robotics-2d", id: "p1", now: NOW }),
  );
  const { apply } = store.getState();
  apply(
    projectEdits.addPart({
      id: "m1",
      type: "motor.dc",
      name: "Left motor",
      x: -40.5,
      y: 12,
      rotation: 270,
      flip: false,
      props: { rpm: 120, reversed: false, label: "M1 — left" },
    }),
  );
  apply(
    projectEdits.addPart({
      id: "s1",
      type: "sensor.ir",
      name: "",
      x: 0,
      y: 0,
      rotation: 0,
      flip: false,
      props: {},
    }),
  );
  return store.getState().project;
}

const manifest = (overrides: Record<string, unknown> = {}) =>
  strToU8(JSON.stringify({ format: ARCHIVE_FORMAT, version: 1, ...overrides }));

const zip = (files: Zippable) => zipSync(files);

describe(".rsim round trip", () => {
  it("writes and reads back exactly the same project", () => {
    const project = sampleProject();
    expect(readArchive(writeArchive(project))).toEqual({
      ok: true,
      project,
      fromVersion: PROJECT_VERSION,
    });
  });

  it("is a normal zip with a manifest and the project", () => {
    const files = unzipSync(writeArchive(sampleProject()));
    expect(Object.keys(files).sort()).toEqual(["manifest.json", "project.json"]);
    expect(JSON.parse(strFromU8(files["manifest.json"]!))).toMatchObject({
      format: "robosim-archive",
      version: 1,
      app: { name: "RoboSim Studio" },
    });
  });

  it("gives the same bytes for the same project", () => {
    expect(writeArchive(sampleProject())).toEqual(writeArchive(sampleProject()));
  });

  it("round-trips a project with many parts", () => {
    const base = sampleProject();
    const parts = Array.from({ length: 500 }, (_, i) => ({ ...base.parts[0]!, id: `m${i}` }));
    const project = { ...base, parts };
    const result = readArchive(writeArchive(project));
    expect(result.ok && result.project.parts).toHaveLength(500);
  });
});

describe("reading untrusted files", () => {
  it("refuses a file that is too large before reading it", () => {
    expect(readArchive(new Uint8Array(MAX_ARCHIVE_BYTES + 1))).toMatchObject({
      ok: false,
      reason: "too-large",
    });
  });

  it.each([
    ["empty bytes", new Uint8Array()],
    ["plain text", strToU8("hello")],
    ["a JSON project", strToU8(serializeProject(sampleProject()))],
  ])("refuses %s as not an archive", (_name, bytes) => {
    expect(readArchive(bytes)).toMatchObject({ ok: false, reason: "not-an-archive" });
  });

  it("refuses a damaged zip", () => {
    const bytes = writeArchive(sampleProject());
    const damaged = bytes.slice(0, 60);
    const result = readArchive(damaged);
    expect(result.ok).toBe(false);
  });

  it("refuses unknown entries (no hidden files, no path tricks)", () => {
    for (const name of ["evil.js", "../project.json", "sub/project.json", "PROJECT.JSON"]) {
      const bytes = zip({
        "manifest.json": manifest(),
        "project.json": strToU8(serializeProject(sampleProject())),
        [name]: strToU8("x"),
      });
      expect(readArchive(bytes)).toMatchObject({ ok: false, reason: "unknown-entry" });
    }
  });

  it("refuses too many entries", () => {
    const files: Zippable = {};
    for (let i = 0; i <= MAX_ARCHIVE_ENTRIES; i++) files[`dir${i}/`] = new Uint8Array();
    expect(readArchive(zip(files))).toMatchObject({ ok: false, reason: "too-many-entries" });
  });

  it("stops a zip bomb by counting the real decompressed size", () => {
    // ~30 MB of spaces compresses to a few kB; the declared sizes are not what stops it.
    const bomb = zip({
      "manifest.json": manifest(),
      "project.json": new Uint8Array(30 * 1024 * 1024).fill(32),
    });
    expect(bomb.length).toBeLessThan(100_000);
    expect(readArchive(bomb)).toMatchObject({ ok: false, reason: "too-large" });
  });

  it("refuses an oversized manifest", () => {
    const bytes = zip({
      "manifest.json": new Uint8Array(10_000).fill(32),
      "project.json": strToU8("{}"),
    });
    expect(readArchive(bytes)).toMatchObject({ ok: false, reason: "too-large" });
  });

  it.each([
    ["no manifest", { "project.json": strToU8("{}") }, "missing-entry"],
    ["no project", { "manifest.json": manifest() }, "missing-entry"],
    ["another format", { "manifest.json": manifest({ format: "zip" }) }, "not-an-archive"],
    ["a broken manifest", { "manifest.json": strToU8("{oops") }, "corrupt"],
    ["a newer file version", { "manifest.json": manifest({ version: 2 }) }, "newer-version"],
  ])("refuses a file with %s", (_name, files, reason) => {
    expect(readArchive(zip(files as Zippable))).toMatchObject({ ok: false, reason });
  });

  it("validates the project inside", () => {
    const bad = { ...sampleProject(), parts: [{ id: "x", onload: "alert(1)" }] };
    const bytes = zip({
      "manifest.json": manifest(),
      "project.json": strToU8(JSON.stringify(bad)),
    });
    expect(readArchive(bytes)).toMatchObject({ ok: false, reason: "invalid" });
  });
});

describe("copyProject", () => {
  it("gives the project a new id and keeps everything else", () => {
    const project = sampleProject();
    const copy = copyProject(project, "new-id");
    expect(copy).toEqual({ ...project, id: "new-id" });
    expect(copyProject(project).id).not.toBe(project.id);
  });
});

describe("archiveFileName", () => {
  it.each([
    ["Line follower", "line-follower.rsim"],
    ["  My  Robot_v2  ", "my-robot-v2.rsim"],
    ["Rövér", "rover.rsim"],
    ["../../etc/passwd", "etcpasswd.rsim"],
    ['CON<>:"/\\|?*', "con.rsim"],
    ["!!!", "project.rsim"],
    ["x".repeat(200), `${"x".repeat(60)}.rsim`],
  ])("%s → %s", (name, expected) => {
    expect(archiveFileName({ name })).toBe(expected);
  });
});
