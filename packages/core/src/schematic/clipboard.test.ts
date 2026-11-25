import { describe, expect, it } from "vitest";
import { createProject, type Project } from "../project";
import { createProjectStore, projectEdits } from "../project-store";
import {
  CLIPBOARD_FORMAT,
  MAX_CLIPBOARD_CHARS,
  copyItems,
  parseClipboard,
  preparePaste,
  serializeClipboard,
} from "./clipboard";
import { hitTestLabel, labelBounds, labelsInRect } from "./selection";

function sample(): Project {
  return {
    ...createProject({ name: "Clipboard" }),
    parts: [
      {
        id: "r1",
        type: "resistor",
        name: "R1",
        x: 0,
        y: 0,
        rotation: 0,
        flip: false,
        props: { resistance: 1000 },
      },
      {
        id: "r2",
        type: "resistor",
        name: "R2",
        x: 1000,
        y: 0,
        rotation: 0,
        flip: false,
        props: { resistance: 2200 },
      },
    ],
    wires: [
      {
        id: "w1",
        points: [
          [200, 0],
          [800, 0],
        ],
      },
    ],
    labels: [{ id: "l1", x: 500, y: 0, name: "OUT", rotation: 0 }],
  };
}

let counter = 0;
const ids = () => `new${++counter}`;

describe("schematic clipboard", () => {
  it("copies only the selected items and round-trips through text", () => {
    const clip = copyItems(sample(), ["r1", "w1", "l1"]);
    expect(clip?.parts.map((p) => p.id)).toEqual(["r1"]);
    expect(clip?.wires).toHaveLength(1);
    const text = serializeClipboard(clip!);
    expect(parseClipboard(text)).toEqual(clip);
    expect(copyItems(sample(), [])).toBeNull();
  });

  it("refuses text that is not valid clipboard content", () => {
    expect(parseClipboard("hello")).toBeNull();
    expect(parseClipboard(`{"format":"${CLIPBOARD_FORMAT}"`)).toBeNull();
    expect(
      parseClipboard(
        JSON.stringify({
          format: CLIPBOARD_FORMAT,
          version: 1,
          parts: [],
          wires: [],
          labels: [],
          x: 1,
        }),
      ),
    ).toBeNull();
    // A diagonal wire is not allowed, exactly as in project files.
    expect(
      parseClipboard(
        JSON.stringify({
          format: CLIPBOARD_FORMAT,
          version: 1,
          parts: [],
          wires: [
            {
              id: "w",
              points: [
                [0, 0],
                [100, 100],
              ],
            },
          ],
          labels: [],
        }),
      ),
    ).toBeNull();
    expect(parseClipboard(CLIPBOARD_FORMAT + " ".repeat(MAX_CLIPBOARD_CHARS))).toBeNull();
  });

  it("pastes with new ids and free designators, centred on the pointer", () => {
    const project = sample();
    const clip = copyItems(project, ["r1", "r2", "w1", "l1"])!;
    const pasted = preparePaste(clip, project, { at: { x: 3020, y: 990 } }, ids);
    expect(pasted.parts.map((p) => p.name)).toEqual(["R3", "R4"]);
    expect(pasted.parts.map((p) => [p.x, p.y])).toEqual([
      [2500, 1000],
      [3500, 1000],
    ]);
    expect(pasted.wires[0]?.points).toEqual([
      [2700, 1000],
      [3300, 1000],
    ]);
    expect(pasted.labels[0]).toMatchObject({ name: "OUT", x: 3000, y: 1000 });
    const all = [...pasted.parts, ...pasted.wires, ...pasted.labels].map((x) => x.id);
    expect(all.every((id) => id.startsWith("new"))).toBe(true);
  });

  it("adds pasted items as one undo step", () => {
    const store = createProjectStore(sample());
    const clip = copyItems(store.getState().project, ["r1", "w1"])!;
    const pasted = preparePaste(
      clip,
      store.getState().project,
      { offset: { x: 200, y: 200 } },
      ids,
    );
    store.getState().apply(projectEdits.addItems(pasted));
    expect(store.getState().project.parts).toHaveLength(3);
    expect(store.getState().project.wires).toHaveLength(2);
    expect(store.getState().history.past.at(-1)?.label).toBe("Paste 2 items");
    store.getState().undo();
    expect(store.getState().project.parts).toHaveLength(2);
  });

  it("refuses to add items whose ids are taken", () => {
    const store = createProjectStore(sample());
    expect(() =>
      store.getState().apply(projectEdits.addItems({ parts: [sample().parts[0]!] })),
    ).toThrow(/taken/);
  });
});

describe("net labels", () => {
  const label = { id: "l", x: 1000, y: 500, name: "VCC", rotation: 0 as const };

  it("puts the text box along the wire, above or to the left", () => {
    const right = labelBounds(label);
    expect(right.minX).toBe(1000);
    expect(right.maxY).toBe(500);
    expect(right.minY).toBeLessThan(500);
    const left = labelBounds({ ...label, rotation: 180 });
    expect(left.maxX).toBe(1000);
    const up = labelBounds({ ...label, rotation: 90 });
    expect(up.maxX).toBe(1000);
    expect(up.maxY).toBe(500);
    const down = labelBounds({ ...label, rotation: 270 });
    expect(down.minY).toBe(500);
  });

  it("hit-tests and box-selects labels", () => {
    expect(hitTestLabel([label], { x: 1040, y: 470 })?.id).toBe("l");
    expect(hitTestLabel([label], { x: 900, y: 800 })).toBeNull();
    expect(
      labelsInRect([label], { minX: 900, minY: 300, maxX: 1300, maxY: 600 }, "inside"),
    ).toEqual(["l"]);
  });

  it("rotates labels about their point and renames them", () => {
    const store = createProjectStore(sample());
    store.getState().apply(projectEdits.rotateLabels(["l1"], 1));
    expect(store.getState().project.labels[0]?.rotation).toBe(90);
    store.getState().apply(projectEdits.rotateLabels(["l1"], -2));
    expect(store.getState().project.labels[0]?.rotation).toBe(270);
    store.getState().apply(projectEdits.renameLabel("l1", "VOUT"));
    expect(store.getState().project.labels[0]?.name).toBe("VOUT");
    expect(() => projectEdits.renameLabel("l1", "bad name")).toThrow();
  });
});
