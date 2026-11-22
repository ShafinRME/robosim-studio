import { describe, expect, it } from "vitest";
import { createProject, projectSchema, type Part } from "./project";
import {
  ProjectEditError,
  createProjectStore,
  normalizeRotation,
  projectEdits as edits,
} from "./project-store";

const NOW = new Date("2026-11-23T10:00:00.000Z");
const base = () => createProject({ name: "Blink", lab: "circuit", id: "p1", now: NOW });
const resistor = (overrides: Partial<Part> = {}): Part => ({
  id: "r1",
  type: "resistor",
  name: "R1",
  x: 0,
  y: 0,
  rotation: 0,
  props: { resistance: 220 },
  ...overrides,
});

function storeWithResistor() {
  const store = createProjectStore(base());
  store.getState().apply(edits.addPart(resistor()));
  return store;
}

describe("project store", () => {
  it("starts with the project and an empty history", () => {
    const store = createProjectStore(base());
    expect(store.getState().project).toEqual(base());
    expect(store.getState().history).toEqual({ past: [], future: [] });
  });

  it("applies edits, notifies subscribers and records named history", () => {
    const store = createProjectStore(base());
    let notified = 0;
    store.subscribe(() => notified++);

    expect(store.getState().apply(edits.addPart(resistor()))).toBe(true);
    expect(store.getState().apply(edits.movePart("r1", 40, -20))).toBe(true);
    expect(store.getState().apply(edits.setPartProp("r1", "resistance", 1000))).toBe(true);

    expect(notified).toBe(3);
    expect(store.getState().project.parts[0]).toMatchObject({
      x: 40,
      y: -20,
      props: { resistance: 1000 },
    });
    expect(store.getState().history.past.map((e) => e.label)).toEqual([
      "Add R1",
      "Move R1",
      "Set resistance of R1",
    ]);
  });

  it("undoes and redoes through the store", () => {
    const store = storeWithResistor();
    store.getState().apply(edits.renamePart("r1", "Pull-up"));
    expect(store.getState().history.past.at(-1)?.label).toBe("Rename R1");

    expect(store.getState().undo()).toBe("Rename R1");
    expect(store.getState().project.parts[0]?.name).toBe("R1");
    expect(store.getState().undo()).toBe("Add R1");
    expect(store.getState().project).toEqual(base());
    expect(store.getState().undo()).toBeNull();

    expect(store.getState().redo()).toBe("Add R1");
    expect(store.getState().redo()).toBe("Rename R1");
    expect(store.getState().redo()).toBeNull();
    expect(store.getState().project.parts[0]?.name).toBe("Pull-up");
  });

  it("does not record or notify for edits that change nothing", () => {
    const store = storeWithResistor();
    let notified = 0;
    store.subscribe(() => notified++);
    expect(store.getState().apply(edits.movePart("r1", 0, 0))).toBe(false);
    expect(store.getState().apply(edits.movePart("missing", 5, 5))).toBe(false);
    expect(store.getState().apply(edits.removePartProp("r1", "nope"))).toBe(false);
    expect(store.getState().undo()).toBe("Add R1");
    expect(notified).toBe(1);
  });

  it("names a removed part from before it was removed", () => {
    const store = storeWithResistor();
    store.getState().apply(edits.removePart("r1"));
    expect(store.getState().history.past.at(-1)?.label).toBe("Remove R1");
    store.getState().undo();
    expect(store.getState().project.parts).toEqual([resistor()]);
  });

  it("replace() opens another project and clears the history", () => {
    const store = storeWithResistor();
    const other = createProject({ name: "Other", id: "p2", now: NOW });
    store.getState().replace(other);
    expect(store.getState().project).toBe(other);
    expect(store.getState().undo()).toBeNull();
  });

  it("respects the history limit", () => {
    const store = createProjectStore(base(), { historyLimit: 2 });
    for (const name of ["A", "B", "C"]) store.getState().apply(edits.renameProject(name));
    expect(store.getState().history.past.map((e) => e.label)).toHaveLength(2);
  });

  it("keeps the project valid after every kind of edit", () => {
    const store = storeWithResistor();
    const { apply } = store.getState();
    apply(edits.renameProject("  Line follower  "));
    apply(edits.addPart(resistor({ id: "led1", type: "led", name: "", props: {} })));
    apply(edits.rotatePart("r1", -90));
    apply(edits.setPartProp("led1", "color", "red"));
    apply(edits.setPartProp("led1", "on", true));
    apply(edits.removePartProp("r1", "resistance"));
    const { project } = store.getState();
    expect(projectSchema.safeParse(project).success).toBe(true);
    expect(project.name).toBe("Line follower");
    expect(project.parts[0]?.rotation).toBe(270);
    expect(store.getState().history.past.at(-3)?.label).toBe("Set color of led");
  });

  it("returns frozen state, so nothing can change the project behind the history", () => {
    const store = storeWithResistor();
    const { project } = store.getState();
    expect(Object.isFrozen(project)).toBe(true);
    expect(Object.isFrozen(project.parts[0])).toBe(true);
  });
});

describe("project edits check their input", () => {
  it.each([
    ["an empty project name", () => edits.renameProject("  ")],
    ["a long project name", () => edits.renameProject("x".repeat(101))],
    ["a long part name", () => edits.renamePart("r1", "x".repeat(101))],
    ["an invalid part", () => edits.addPart(resistor({ type: "Bad Type" }))],
    ["a part with extra keys", () => edits.addPart({ ...resistor(), extra: 1 } as Part)],
    ["a move out of range", () => edits.movePart("r1", 2e6, 0)],
    ["a move to NaN", () => edits.movePart("r1", 0, Number.NaN)],
    ["a rotation of Infinity", () => edits.rotatePart("r1", Infinity)],
    ["a bad property name", () => edits.setPartProp("r1", "a b", 1)],
    ["a __proto__ property", () => edits.setPartProp("r1", "__proto__", 1)],
    ["a 'constructor' property", () => edits.setPartProp("r1", "constructor", 1)],
    ["a long text value", () => edits.setPartProp("r1", "note", "x".repeat(1001))],
  ])("refuses %s", (_name, make) => {
    expect(make).toThrow(ProjectEditError);
  });

  it("refuses a duplicate part id and leaves the project unchanged", () => {
    const store = storeWithResistor();
    const before = store.getState().project;
    expect(() => store.getState().apply(edits.addPart(resistor()))).toThrow(/taken/);
    expect(store.getState().project).toBe(before);
    expect(store.getState().history.past).toHaveLength(1);
  });

  it("refuses more than 64 properties on a part", () => {
    const props = Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`p${i}`, i]));
    const store = createProjectStore(base());
    store.getState().apply(edits.addPart(resistor({ props })));
    expect(() => store.getState().apply(edits.setPartProp("r1", "extra", 1))).toThrow(/64/);
    expect(store.getState().apply(edits.setPartProp("r1", "p0", 99))).toBe(true);
  });
});

describe("normalizeRotation", () => {
  it.each([
    [0, 0],
    [90, 90],
    [360, 0],
    [450, 90],
    [-90, 270],
    [-720, 0],
    [359.5, 359.5],
  ])("%d° → %d°", (input, expected) => {
    expect(normalizeRotation(input)).toBe(expected);
  });
});
