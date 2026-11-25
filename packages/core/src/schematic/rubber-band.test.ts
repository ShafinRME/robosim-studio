import { describe, expect, it } from "vitest";
import { createProject, type Part, type Project, type WirePoint } from "../project";
import { createProjectStore, projectEdits } from "../project-store";
import { connectivityOf } from "./connectivity";
import { rubberBandWire, type PointMover } from "./rubber-band";
import { isOrthogonal } from "./wires";

const at =
  (from: WirePoint, to: WirePoint): PointMover =>
  ([x, y]) =>
    x === from[0] && y === from[1] ? to : null;

describe("rubberBandWire", () => {
  it("leaves a wire alone when none of its ends moves", () => {
    const points: WirePoint[] = [
      [0, 0],
      [500, 0],
    ];
    expect(rubberBandWire(points, () => null)).toBe(points);
  });

  it("adds a corner so a straight wire stays orthogonal", () => {
    const out = rubberBandWire(
      [
        [0, 0],
        [500, 0],
      ],
      at([500, 0], [500, 300]),
    );
    expect(out).toEqual([
      [0, 0],
      [500, 0],
      [500, 300],
    ]);
  });

  it("keeps the direction of the segment next to the moved end", () => {
    // L-shaped wire: right then down; its start moves up by 200.
    const out = rubberBandWire(
      [
        [0, 0],
        [500, 0],
        [500, 500],
      ],
      at([0, 0], [0, -200]),
    );
    expect(out).toEqual([
      [0, -200],
      [0, 0],
      [500, 0],
      [500, 500],
    ]);
    expect(isOrthogonal(out as WirePoint[])).toBe(true);
  });

  it("just stretches a straight run when the end moves along it", () => {
    expect(
      rubberBandWire(
        [
          [0, 0],
          [500, 0],
        ],
        at([500, 0], [800, 0]),
      ),
    ).toEqual([
      [0, 0],
      [800, 0],
    ]);
  });

  it("translates the whole wire when both ends move the same way", () => {
    const move: PointMover = ([x, y]) => [x + 100, y + 200];
    expect(
      rubberBandWire(
        [
          [0, 0],
          [300, 0],
          [300, 300],
        ],
        move,
      ),
    ).toEqual([
      [100, 200],
      [400, 200],
      [400, 500],
    ]);
  });

  it("handles both ends moving differently", () => {
    const move: PointMover = ([x, y]) => (x === 0 ? [0, 100] : x === 500 ? [500, -100] : [x, y]);
    const out = rubberBandWire(
      [
        [0, 0],
        [500, 0],
      ],
      move,
    ) as WirePoint[];
    expect(out[0]).toEqual([0, 100]);
    expect(out.at(-1)).toEqual([500, -100]);
    expect(isOrthogonal(out)).toBe(true);
  });

  it("returns null when the wire shrinks to a point", () => {
    expect(
      rubberBandWire(
        [
          [0, 0],
          [100, 0],
        ],
        at([100, 0], [0, 0]),
      ),
    ).toBeNull();
  });
});

const resistor = (id: string, x: number, y: number): Part => ({
  id,
  type: "resistor",
  name: id.toUpperCase(),
  x,
  y,
  rotation: 0,
  flip: false,
  props: { resistance: 1000 },
});

/** R1 at (0, 0) and R2 at (1000, 0) joined by a wire from R1.2 (200, 0) to R2.1 (800, 0). */
function divider(): Project {
  return {
    ...createProject({ name: "Rubber band" }),
    parts: [resistor("r1", 0, 0), resistor("r2", 1000, 0)],
    wires: [
      {
        id: "w",
        points: [
          [200, 0],
          [800, 0],
        ],
      },
    ],
    labels: [{ id: "l", x: 800, y: 0, name: "OUT", rotation: 0 }],
  };
}

function nodesJoined(project: Project) {
  const c = connectivityOf(project);
  return c.connectedPins.size;
}

describe("rubber-banding edits", () => {
  it("stretches attached wires when a part moves, as one undo step", () => {
    const start = divider();
    const store = createProjectStore(start);
    store.getState().apply(projectEdits.moveParts(["r2"], 0, 300));
    const { project } = store.getState();
    expect(project.wires[0]?.points).toEqual([
      [200, 0],
      [800, 0],
      [800, 300],
    ]);
    expect(project.labels[0]).toMatchObject({ x: 800, y: 300 });
    expect(nodesJoined(project)).toBe(2);
    store.getState().undo();
    expect(store.getState().project).toEqual(start);
  });

  it("follows a rotated part", () => {
    const store = createProjectStore(divider());
    store.getState().apply(projectEdits.rotateParts(["r2"], 1));
    const { project } = store.getState();
    // R2 vertical at (1000, 0): pin 1 at (1000, −200).
    expect(project.wires[0]?.points.at(-1)).toEqual([1000, -200]);
    expect(isOrthogonal(project.wires[0]?.points ?? [])).toBe(true);
    expect(nodesJoined(project)).toBe(2);
  });

  it("translates a wire between two parts that move together", () => {
    const store = createProjectStore(divider());
    store.getState().apply(projectEdits.moveItems(["r1", "r2"], 100, 100));
    expect(store.getState().project.wires[0]?.points).toEqual([
      [300, 100],
      [900, 100],
    ]);
  });

  it("drags other wires that end on a moved wire", () => {
    const store = createProjectStore({
      ...divider(),
      wires: [
        ...divider().wires,
        {
          id: "tap",
          points: [
            [500, 0],
            [500, 400],
          ],
        },
      ],
      labels: [],
    });
    store.getState().apply(projectEdits.moveItems(["w"], 0, -100));
    const tap = store.getState().project.wires.find((w) => w.id === "tap");
    expect(tap?.points).toEqual([
      [500, -100],
      [500, 400],
    ]);
  });

  it("does not drag a wire end that also sits on a part that stays", () => {
    // R3's pin 1 touches R2's pin 1 at (800, 0): the wire end stays with R3.
    const store = createProjectStore({
      ...divider(),
      parts: [...divider().parts, { ...resistor("r3", 1000, 0), x: 1000, y: 0, id: "r3" }],
    });
    store.getState().apply(projectEdits.moveParts(["r2"], 0, 300));
    expect(store.getState().project.wires[0]?.points).toEqual([
      [200, 0],
      [800, 0],
    ]);
  });

  it("removes a wire that shrinks to a point", () => {
    const store = createProjectStore(divider());
    store.getState().apply(projectEdits.moveParts(["r2"], -600, 0));
    expect(store.getState().project.wires).toEqual([]);
  });
});
