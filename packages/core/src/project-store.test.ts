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
  flip: false,
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

describe("group edits (schematic, ADR 008)", () => {
  /** R1 at (0, 0), R2 at (200, 0), R3 at (200, 100) — mils. */
  function storeWithThree() {
    const store = createProjectStore(base());
    store.getState().apply(edits.addPart(resistor()));
    store.getState().apply(edits.addPart(resistor({ id: "r2", name: "R2", x: 200 })));
    store.getState().apply(edits.addPart(resistor({ id: "r3", name: "R3", x: 200, y: 100 })));
    return store;
  }
  const parts = (store: ReturnType<typeof storeWithThree>) =>
    store
      .getState()
      .project.parts.map(({ id, x, y, rotation, flip }) => ({ id, x, y, rotation, flip }));
  const lastLabel = (store: ReturnType<typeof storeWithThree>) =>
    store.getState().history.past.at(-1)?.label;

  it("moves several parts as one undo step", () => {
    const store = storeWithThree();
    expect(store.getState().apply(edits.moveParts(["r1", "r3"], 100, -100))).toBe(true);
    expect(parts(store).map((p) => [p.x, p.y])).toEqual([
      [100, -100],
      [200, 0],
      [300, 0],
    ]);
    expect(lastLabel(store)).toBe("Move 2 parts");
    store.getState().undo();
    expect(parts(store).map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [200, 0],
      [200, 100],
    ]);
  });

  it("names a single part in the label", () => {
    const store = storeWithThree();
    store.getState().apply(edits.rotateParts(["r2"], 1));
    expect(lastLabel(store)).toBe("Rotate R2");
  });

  it("rotates one part in place, clockwise", () => {
    const store = storeWithThree();
    store.getState().apply(edits.rotateParts(["r2"], 1));
    expect(parts(store)[1]).toEqual({ id: "r2", x: 200, y: 0, rotation: 90, flip: false });
    store.getState().apply(edits.rotateParts(["r2"], -2));
    expect(parts(store)[1]?.rotation).toBe(270);
  });

  it("rotates a group about its grid-snapped centre, keeping the layout", () => {
    const store = storeWithThree();
    // Centre of (0..200, 0..100) = (100, 50) → snapped half-to-even to (100, 0) on the 100-mil grid.
    store.getState().apply(edits.rotateParts(["r1", "r2", "r3"], 1));
    expect(parts(store)).toEqual([
      { id: "r1", x: 100, y: -100, rotation: 90, flip: false },
      { id: "r2", x: 100, y: 100, rotation: 90, flip: false },
      { id: "r3", x: 0, y: 100, rotation: 90, flip: false },
    ]);
    expect(lastLabel(store)).toBe("Rotate 3 parts");
    // Four quarter turns restore the layout and orientation (the group may sit one grid step away,
    // as in other EDA tools, because each turn snaps its centre to the grid).
    for (let i = 0; i < 3; i++) store.getState().apply(edits.rotateParts(["r1", "r2", "r3"], 1));
    const after = parts(store);
    const [dx, dy] = [after[0]!.x, after[0]!.y];
    expect(after.map((p) => [p.x - dx, p.y - dy, p.rotation])).toEqual([
      [0, 0, 0],
      [200, 0, 0],
      [200, 100, 0],
    ]);
  });

  it("keeps every rotated part on the grid", () => {
    const store = storeWithThree();
    store.getState().apply(edits.rotateParts(["r1", "r2", "r3"], 1));
    for (const p of parts(store)) {
      expect(Math.abs(p.x % 100)).toBe(0);
      expect(Math.abs(p.y % 100)).toBe(0);
    }
  });

  it("rotates about a given centre", () => {
    const store = storeWithThree();
    store.getState().apply(edits.rotateParts(["r2"], 1, { center: { x: 0, y: 0 } }));
    expect(parts(store)[1]).toMatchObject({ x: 0, y: 200, rotation: 90 });
  });

  it("flips left–right: mirrors positions and the symbol (rotate(−r) ∘ mirror)", () => {
    const store = storeWithThree();
    store.getState().apply(edits.rotateParts(["r3"], 1));
    store.getState().apply(edits.flipParts(["r1", "r2", "r3"], "x"));
    expect(parts(store)).toEqual([
      { id: "r1", x: 200, y: 0, rotation: 0, flip: true },
      { id: "r2", x: 0, y: 0, rotation: 0, flip: true },
      { id: "r3", x: 0, y: 100, rotation: 270, flip: true },
    ]);
    expect(lastLabel(store)).toBe("Flip 3 parts");
  });

  it("flips top–bottom (rotate(180° − r) ∘ mirror)", () => {
    const store = storeWithThree();
    store.getState().apply(edits.flipParts(["r1", "r3"], "y"));
    expect(parts(store)).toEqual([
      { id: "r1", x: 0, y: 0, rotation: 180, flip: true },
      { id: "r2", x: 200, y: 0, rotation: 0, flip: false },
      { id: "r3", x: 200, y: -100, rotation: 180, flip: true },
    ]);
  });

  it("flipping twice restores the parts", () => {
    for (const axis of ["x", "y"] as const) {
      const store = storeWithThree();
      store.getState().apply(edits.rotateParts(["r2"], 1));
      const before = parts(store);
      store.getState().apply(edits.flipParts(["r1", "r2", "r3"], axis));
      store.getState().apply(edits.flipParts(["r1", "r2", "r3"], axis));
      expect(parts(store)).toEqual(before);
    }
  });

  it("sets the flip of one part in place", () => {
    const store = storeWithThree();
    store.getState().apply(edits.setPartFlip("r1", true));
    expect(parts(store)[0]).toMatchObject({ x: 0, y: 0, flip: true });
    expect(lastLabel(store)).toBe("Flip R1");
  });

  it("deletes several parts as one undo step", () => {
    const store = storeWithThree();
    store.getState().apply(edits.removeParts(["r1", "r3"]));
    expect(parts(store).map((p) => p.id)).toEqual(["r2"]);
    expect(lastLabel(store)).toBe("Delete 2 parts");
    store.getState().undo();
    expect(parts(store).map((p) => p.id)).toEqual(["r1", "r2", "r3"]);
  });

  it("changes nothing (and records nothing) for unknown ids", () => {
    const store = storeWithThree();
    expect(store.getState().apply(edits.moveParts(["nope"], 100, 0))).toBe(false);
    expect(store.getState().apply(edits.removeParts([]))).toBe(false);
    expect(store.getState().history.past).toHaveLength(3);
  });

  it("refuses moves outside the canvas and keeps the project unchanged", () => {
    const store = storeWithThree();
    expect(() => store.getState().apply(edits.moveParts(["r2", "r3"], 999_900, 0))).toThrow(
      ProjectEditError,
    );
    expect(parts(store)[1]?.x).toBe(200);
    expect(() => edits.rotateParts(["r1"], 0.5)).toThrow(/whole/);
  });

  it("keeps the project valid after group edits", () => {
    const store = storeWithThree();
    store.getState().apply(edits.rotateParts(["r1", "r2"], 3));
    store.getState().apply(edits.flipParts(["r2", "r3"], "y"));
    store.getState().apply(edits.moveParts(["r1", "r2", "r3"], -300, 700));
    expect(projectSchema.safeParse(store.getState().project).success).toBe(true);
  });
});

describe("wire and label edits (ADR 009)", () => {
  const wire = (id: string, points: [number, number][]) => ({ id, points });
  const label = (id: string, x: number, y: number, name = "VCC") => ({
    id,
    x,
    y,
    name,
    rotation: 0 as const,
  });

  it("draws a wire as one undo step, cleaned of extra points", () => {
    const store = storeWithResistor();
    store.getState().apply(
      edits.addWire(
        wire("w1", [
          [200, 0],
          [400, 0],
          [600, 0],
          [600, 300],
        ]),
      ),
    );
    expect(store.getState().project.wires).toEqual([
      {
        id: "w1",
        points: [
          [200, 0],
          [600, 0],
          [600, 300],
        ],
      },
    ]);
    expect(store.getState().history.past.at(-1)?.label).toBe("Draw wire");
    store.getState().undo();
    expect(store.getState().project.wires).toEqual([]);
  });

  it("refuses diagonal, off-grid or empty wires and taken ids", () => {
    expect(() =>
      edits.addWire(
        wire("w1", [
          [0, 0],
          [100, 100],
        ]),
      ),
    ).toThrow(ProjectEditError);
    expect(() =>
      edits.addWire(
        wire("w1", [
          [0, 0],
          [130, 0],
        ]),
      ),
    ).toThrow(/grid/);
    expect(() =>
      edits.addWire(
        wire("w1", [
          [0, 0],
          [300, 0],
          [0, 0],
        ]),
      ),
    ).toThrow(ProjectEditError);
    const store = storeWithResistor();
    expect(() =>
      store.getState().apply(
        edits.addWire(
          wire("r1", [
            [0, 0],
            [100, 0],
          ]),
        ),
      ),
    ).toThrow(/taken/);
    expect(() => store.getState().apply(edits.addPart(resistor()))).toThrow(/taken/);
  });

  it("replaces a wire's points", () => {
    const store = storeWithResistor();
    store.getState().apply(
      edits.addWire(
        wire("w1", [
          [0, 0],
          [100, 0],
        ]),
      ),
    );
    store.getState().apply(
      edits.setWirePoints("w1", [
        [0, 0],
        [0, 200],
        [100, 200],
      ]),
    );
    expect(store.getState().project.wires[0]?.points).toEqual([
      [0, 0],
      [0, 200],
      [100, 200],
    ]);
  });

  it("adds and renames net labels", () => {
    const store = storeWithResistor();
    store.getState().apply(edits.addLabel(label("l1", 200, 0)));
    expect(store.getState().history.past.at(-1)?.label).toBe("Add label VCC");
    store.getState().apply(edits.renameLabel("l1", "5V"));
    expect(store.getState().project.labels[0]?.name).toBe("5V");
    expect(() => edits.renameLabel("l1", "my net")).toThrow(ProjectEditError);
    expect(() => edits.addLabel({ ...label("l2", 25, 0) })).toThrow(ProjectEditError);
  });

  it("moves and deletes parts, wires and labels together", () => {
    const store = storeWithResistor();
    store.getState().apply(
      edits.addWire(
        wire("w1", [
          [200, 0],
          [400, 0],
        ]),
      ),
    );
    store.getState().apply(edits.addLabel(label("l1", 400, 0)));
    store.getState().apply(edits.moveItems(["r1", "w1", "l1"], 100, -100));
    const { parts, wires, labels } = store.getState().project;
    expect([parts[0]?.x, parts[0]?.y]).toEqual([100, -100]);
    expect(wires[0]?.points).toEqual([
      [300, -100],
      [500, -100],
    ]);
    expect([labels[0]?.x, labels[0]?.y]).toEqual([500, -100]);
    expect(store.getState().history.past.at(-1)?.label).toBe("Move 3 items");
    expect(() => edits.moveItems(["w1"], 25, 0)).toThrow(/grid/);

    store.getState().apply(edits.removeItems(["w1", "l1"]));
    expect(store.getState().history.past.at(-1)?.label).toBe("Delete 2 items");
    expect(store.getState().project.wires).toEqual([]);
    expect(store.getState().project.labels).toEqual([]);
    expect(store.getState().apply(edits.removeItems(["nope"]))).toBe(false);
    expect(projectSchema.safeParse(store.getState().project).success).toBe(true);
  });
});
