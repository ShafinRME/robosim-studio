import { describe, expect, it } from "vitest";
import {
  MAX_PROJECT_CHARS,
  MAX_PROJECT_PARTS,
  PROJECT_FORMAT,
  PROJECT_VERSION,
  createProject,
  loadProject,
  migrateProjectData,
  newId,
  parseProject,
  serializeProject,
  type Part,
  type Project,
  type ProjectMigration,
} from "./project";

const NOW = new Date("2026-11-23T10:00:00.000Z");

const part = (overrides: Partial<Part> = {}): Part => ({
  id: "r1",
  type: "resistor",
  name: "R1",
  x: 120,
  y: -40,
  rotation: 90,
  flip: false,
  props: { resistance: 220, tolerance: "5%", placed: true },
  ...overrides,
});

const project = (overrides: Partial<Project> = {}): Project => ({
  ...createProject({ name: "Blink", lab: "circuit", id: "p1", now: NOW }),
  ...overrides,
});

const issuesOf = (data: unknown) => {
  const result = loadProject(data);
  return result.ok ? [] : result.issues;
};

describe("createProject", () => {
  it("creates an empty, valid project in the current format", () => {
    expect(project()).toEqual({
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      id: "p1",
      name: "Blink",
      lab: "circuit",
      createdAt: "2026-11-23T10:00:00.000Z",
      updatedAt: "2026-11-23T10:00:00.000Z",
      parts: [],
    });
  });

  it("defaults to no lab and a generated id", () => {
    const p = createProject({ name: "Untitled" });
    expect(p.lab).toBeNull();
    expect(p.id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });

  it("refuses an empty name", () => {
    expect(() => createProject({ name: "   " })).toThrow();
  });
});

describe("newId", () => {
  it("makes valid, different ids", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });
});

describe("serializeProject / parseProject", () => {
  it("round-trips a project with parts", () => {
    const p = project({ parts: [part(), part({ id: "led1", type: "led", props: {} })] });
    const result = parseProject(serializeProject(p));
    expect(result).toEqual({ ok: true, project: p, fromVersion: PROJECT_VERSION });
  });

  it("refuses text that is too large before parsing", () => {
    const result = parseProject(" ".repeat(MAX_PROJECT_CHARS + 1));
    expect(result).toMatchObject({ ok: false, reason: "too-large" });
  });

  it("refuses broken JSON", () => {
    expect(parseProject("{broken")).toMatchObject({ ok: false, reason: "corrupt" });
  });

  it.each([
    ["null", null],
    ["an array", []],
    ["another format", { format: "something-else", version: 1 }],
    ["no version", { format: PROJECT_FORMAT }],
    ["a fractional version", { format: PROJECT_FORMAT, version: 1.5 }],
    ["version 0", { format: PROJECT_FORMAT, version: 0 }],
  ])("refuses %s as not a project", (_name, data) => {
    expect(loadProject(data)).toMatchObject({ ok: false, reason: "not-a-project" });
  });

  it("refuses a project from a newer version", () => {
    const result = loadProject({ ...project(), version: PROJECT_VERSION + 1 });
    expect(result).toMatchObject({ ok: false, reason: "newer-version" });
  });
});

describe("project validation", () => {
  it("accepts every lab id and no lab", () => {
    expect(issuesOf(project({ lab: "gesture" }))).toEqual([]);
    expect(issuesOf(project({ lab: null }))).toEqual([]);
  });

  it.each<[string, Record<string, unknown>, string]>([
    ["unknown top-level keys", { extra: 1 }, "(project)"],
    ["an unknown lab", { lab: "chemistry" }, "lab"],
    ["an empty name", { name: "" }, "name"],
    ["a very long name", { name: "x".repeat(101) }, "name"],
    ["a bad id", { id: "../etc/passwd" }, "id"],
    ["a bad date", { createdAt: "yesterday" }, "createdAt"],
    ["parts that are not a list", { parts: {} }, "parts"],
  ])("rejects %s", (_name, overrides, path) => {
    const issues = issuesOf({ ...project(), ...overrides });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((issue) => issue.startsWith(path))).toBe(true);
  });

  it.each<[string, Record<string, unknown>, string]>([
    ["an unknown part key", { onclick: "alert(1)" }, "parts.0"],
    ["a bad part type", { type: "Resistor!" }, "parts.0.type"],
    ["a part type with an empty word", { type: "sensor..x" }, "parts.0.type"],
    ["a coordinate out of range", { x: 1e9 }, "parts.0.x"],
    ["a non-number coordinate", { y: "10" }, "parts.0.y"],
    ["rotation of 360", { rotation: 360 }, "parts.0.rotation"],
    ["a negative rotation", { rotation: -1 }, "parts.0.rotation"],
    ["a nested property value", { props: { pins: [1, 2] } }, "parts.0.props.pins"],
    ["a bad property name", { props: { "__proto__ x": 1 } }, "parts.0.props"],
    ["a 'constructor' property", { props: { constructor: 1 } }, "parts.0.props"],
    ["a very long text property", { props: { note: "x".repeat(1001) } }, "parts.0.props.note"],
    [
      "too many properties",
      { props: Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`p${i}`, i])) },
      "parts.0.props",
    ],
  ])("rejects a part with %s", (_name, overrides, path) => {
    const issues = issuesOf({ ...project(), parts: [{ ...part(), ...overrides }] });
    expect(issues.some((issue) => issue.startsWith(path))).toBe(true);
  });

  it("drops a __proto__ property without touching any prototype", () => {
    const text = serializeProject(project({ parts: [part({ props: {} })] })).replace(
      '"props": {}',
      '"props": { "__proto__": { "polluted": true }, "ok": 1 }',
    );
    const result = parseProject(text);
    if (!result.ok) throw new Error(result.issues.join("; "));
    const props = result.project.parts[0]!.props;
    expect(props).toEqual({ ok: 1 });
    expect(Object.getPrototypeOf(props)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("rejects duplicate part ids", () => {
    const issues = issuesOf(project({ parts: [part(), part({ name: "copy" })] }));
    expect(issues).toEqual(['parts.1.id: duplicate part id "r1"']);
  });

  it("rejects more parts than the limit", () => {
    const parts = Array.from({ length: MAX_PROJECT_PARTS + 1 }, (_, i) => part({ id: `p${i}` }));
    expect(issuesOf(project({ parts })).some((issue) => issue.startsWith("parts"))).toBe(true);
  });

  it("reports at most 10 issues", () => {
    const parts = Array.from({ length: 20 }, (_, i) => ({ ...part({ id: `p${i}` }), x: "bad" }));
    expect(issuesOf({ ...project(), parts })).toHaveLength(10);
  });
});

describe("migrations", () => {
  // Pretend the current format is 3: v1 named parts "items", v2 had no rotation.
  const migrations: Record<number, ProjectMigration> = {
    1: ({ items, ...rest }) => ({ ...rest, parts: items }),
    2: (data) => ({
      ...data,
      parts: (data.parts as Record<string, unknown>[]).map((p) => ({ ...p, rotation: 0 })),
    }),
  };
  const v1 = {
    format: PROJECT_FORMAT,
    version: 1,
    name: "Old",
    items: [{ id: "a", x: 1 }],
  };

  it("runs the chain from the stored version to the target", () => {
    const result = migrateProjectData(v1, migrations, 3);
    expect(result).toEqual({
      ok: true,
      fromVersion: 1,
      data: {
        format: PROJECT_FORMAT,
        version: 3,
        name: "Old",
        parts: [{ id: "a", x: 1, rotation: 0 }],
      },
    });
  });

  it("starts from the middle of the chain", () => {
    const v2 = { format: PROJECT_FORMAT, version: 2, parts: [{ id: "a" }] };
    const result = migrateProjectData(v2, migrations, 3);
    expect(result).toMatchObject({ ok: true, fromVersion: 2, data: { version: 3 } });
  });

  it("does not change the input", () => {
    const input = structuredCloneJson(v1);
    migrateProjectData(input, migrations, 3);
    expect(input).toEqual(v1);
  });

  it("fails when a migration is missing", () => {
    expect(migrateProjectData(v1, { 1: migrations[1]! }, 3)).toMatchObject({
      ok: false,
      reason: "migration-failed",
      issue: "no migration from version 2",
    });
  });

  it("fails cleanly when a migration throws", () => {
    const broken = {
      1: () => ({}),
      2: () => {
        throw new Error("boom");
      },
    };
    expect(migrateProjectData(v1, broken, 3)).toMatchObject({
      ok: false,
      reason: "migration-failed",
      issue: "migration 2 → 3 failed: boom",
    });
  });

  it("has a migration for every old version of the real format", () => {
    for (let version = 1; version < PROJECT_VERSION; version++) {
      expect(migrateProjectData({ format: PROJECT_FORMAT, version })).toMatchObject({ ok: true });
    }
  });
});

function structuredCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("format v2 (Day 12): parts can be flipped", () => {
  it("upgrades a v1 project: every part gets flip = false", () => {
    const v1 = {
      ...createProject({ name: "Old", lab: "circuit", id: "p1", now: NOW }),
      version: 1,
      parts: [
        { id: "r1", type: "resistor", name: "R1", x: 0, y: 0, rotation: 90, props: {} },
        { id: "r2", type: "resistor", name: "R2", x: 100, y: 0, rotation: 0, props: {} },
      ],
    };
    const result = loadProject(v1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fromVersion).toBe(1);
    expect(result.project.version).toBe(2);
    expect(result.project.parts.map((p) => p.flip)).toEqual([false, false]);
    expect(result.project.parts[0]?.rotation).toBe(90);
  });

  it("leaves broken v1 data for the validator to explain", () => {
    const result = loadProject({ format: PROJECT_FORMAT, version: 1, parts: "nope" });
    expect(result).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("requires flip in v2 files", () => {
    const { flip: _flip, ...noFlip } = part();
    expect(issuesOf({ ...project(), parts: [noFlip] }).join()).toMatch(/parts\.0\.flip/);
  });
});
