import { describe, expect, it } from "vitest";
import { partSchema, type Part } from "../project";
import {
  boxModeOf,
  createPart,
  hitTest,
  hitTestWire,
  partBounds,
  partsInRect,
  rectFromPoints,
  wiresInRect,
} from "./selection";

const part = (id: string, x: number, y: number, overrides: Partial<Part> = {}): Part => ({
  id,
  type: "resistor",
  name: id.toUpperCase(),
  x,
  y,
  rotation: 0,
  flip: false,
  props: {},
  ...overrides,
});

/** R1 at (0, 0) spans x −200…200, y −40…40; R2 at (1000, 0); R3 vertical at (0, 500). */
const PARTS = [part("r1", 0, 0), part("r2", 1000, 0), part("r3", 0, 500, { rotation: 90 })];

describe("hitTest", () => {
  it("finds the part under the point, with a small tolerance", () => {
    expect(hitTest(PARTS, { x: 150, y: 10 })?.id).toBe("r1");
    expect(hitTest(PARTS, { x: 150, y: 60 })?.id).toBe("r1"); // 20 mil outside, within tolerance
    expect(hitTest(PARTS, { x: 150, y: 100 })).toBeNull();
    expect(hitTest(PARTS, { x: 20, y: 650 })?.id).toBe("r3");
  });

  it("prefers the part drawn on top (last)", () => {
    const overlapping = [part("a", 0, 0), part("b", 100, 0)];
    expect(hitTest(overlapping, { x: 50, y: 0 })?.id).toBe("b");
  });

  it("hits unknown part types by their placeholder box", () => {
    expect(hitTest([part("x", 0, 0, { type: "mystery" })], { x: 190, y: 90 })?.id).toBe("x");
    expect(partBounds(part("x", 0, 0, { type: "mystery" }))).toEqual({
      minX: -200,
      minY: -100,
      maxX: 200,
      maxY: 100,
    });
  });
});

describe("box selection", () => {
  it("chooses the mode from the drag direction", () => {
    expect(boxModeOf({ x: 0, y: 0 }, { x: 10, y: -5 })).toBe("inside");
    expect(boxModeOf({ x: 10, y: 0 }, { x: 0, y: 5 })).toBe("touch");
  });

  it("selects parts fully inside (left → right)", () => {
    const box = rectFromPoints({ x: -250, y: -100 }, { x: 1100, y: 100 });
    expect(partsInRect(PARTS, box, "inside")).toEqual(["r1"]); // R2 sticks out to 1200
  });

  it("selects parts the box touches (right → left)", () => {
    const box = rectFromPoints({ x: 1100, y: 100 }, { x: -250, y: -100 });
    expect(partsInRect(PARTS, box, "touch")).toEqual(["r1", "r2"]);
  });

  it("normalises the box whatever corner it starts from", () => {
    expect(rectFromPoints({ x: 5, y: -3 }, { x: -1, y: 7 })).toEqual({
      minX: -1,
      minY: -3,
      maxX: 5,
      maxY: 7,
    });
  });
});

describe("createPart", () => {
  it("gives the next free designator and the default values", () => {
    const created = createPart("resistor", { x: 300, y: 400 }, [{ name: "R1" }, { name: "V1" }], {
      id: "n1",
    });
    expect(created).toEqual({
      id: "n1",
      type: "resistor",
      name: "R2",
      x: 300,
      y: 400,
      rotation: 0,
      flip: false,
      props: { resistance: 1000, tolerance: 0.05, powerRating: 0.25 },
    });
    expect(partSchema.safeParse(created).success).toBe(true);
  });

  it("creates ground symbols named GND1, GND2…", () => {
    const g = createPart("ground", { x: 0, y: 0 }, [{ name: "GND1" }], {
      id: "g",
      rotation: 180,
      flip: true,
    });
    expect(g).toMatchObject({ name: "GND2", props: {}, rotation: 180, flip: true });
  });
});

describe("wire selection", () => {
  const wires = [
    {
      id: "a",
      points: [
        [0, 0],
        [500, 0],
        [500, 500],
      ] as [number, number][],
    },
    {
      id: "b",
      points: [
        [1000, 0],
        [1000, 500],
      ] as [number, number][],
    },
  ];

  it("hits a wire near any of its segments", () => {
    expect(hitTestWire(wires, { x: 250, y: 10 })?.id).toBe("a");
    expect(hitTestWire(wires, { x: 510, y: 300 })?.id).toBe("a");
    expect(hitTestWire(wires, { x: 990, y: 250 })?.id).toBe("b");
    expect(hitTestWire(wires, { x: 250, y: 100 })).toBeNull();
  });

  it("box-selects wires fully inside, or touched when dragging right to left", () => {
    const rect = { minX: -10, minY: -10, maxX: 600, maxY: 200 };
    expect(wiresInRect(wires, rect, "inside")).toEqual([]);
    expect(wiresInRect(wires, rect, "touch")).toEqual(["a"]);
    expect(wiresInRect(wires, { minX: -10, minY: -10, maxX: 600, maxY: 600 }, "inside")).toEqual([
      "a",
    ]);
  });
});
