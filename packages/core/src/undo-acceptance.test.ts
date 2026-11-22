/**
 * Day 07 acceptance test (ADR 004): 100 random edits, undone one by one, give back exactly the
 * initial project; redone, they give back exactly the final one. Several fixed seeds, so a failure
 * can always be reproduced.
 */
import { describe, expect, it } from "vitest";
import { createProject, projectSchema, type Project } from "./project";
import { createProjectStore, projectEdits as edits, type ProjectEdit } from "./project-store";

/** Small seeded random generator (mulberry32), so every run makes the same edits. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TYPES = ["resistor", "led", "motor.dc", "sensor.ultrasonic"];
const KEYS = ["value", "color", "enabled", "pin"];

function randomEdit(
  project: Project,
  random: () => number,
  counter: { next: number },
): ProjectEdit {
  const int = (n: number) => Math.floor(random() * n);
  const pick = <T>(items: readonly T[]): T => items[int(items.length)]!;
  const coord = () => Math.round((random() - 0.5) * 2000 * 100) / 100;
  const parts = project.parts;
  const target = parts.length > 0 ? pick(parts).id : "none";
  const kind = parts.length === 0 ? 0 : int(9);
  switch (kind) {
    case 0:
    case 1: {
      const id = `p${counter.next++}`;
      return edits.addPart({
        id,
        type: pick(TYPES),
        name: id.toUpperCase(),
        x: coord(),
        y: coord(),
        rotation: int(4) * 90,
        props: {},
      });
    }
    case 2:
      return edits.removePart(target);
    case 3:
      return edits.movePart(target, coord(), coord());
    case 4:
      return edits.rotatePart(target, int(720) - 360);
    case 5:
      return edits.renamePart(target, `Part ${int(1000)}`);
    case 6: {
      const key = pick(KEYS);
      const values = [int(10_000), `v${int(100)}`, random() < 0.5];
      return edits.setPartProp(target, key, pick(values));
    }
    case 7:
      return edits.removePartProp(target, pick(KEYS));
    default:
      return edits.renameProject(`Project ${int(1000)}`);
  }
}

describe("undo / redo acceptance: 100 random edits", () => {
  for (const seed of [1, 7, 42, 2026, 99_991]) {
    it(`seed ${seed}: undo all → initial project, redo all → final project`, () => {
      const random = seeded(seed);
      const initial = createProject({
        name: "Acceptance",
        lab: "circuit",
        id: "acc",
        now: new Date("2026-11-23T00:00:00.000Z"),
      });
      const store = createProjectStore(initial);
      const counter = { next: 1 };
      const snapshots: Project[] = [initial];

      // Keep editing until 100 edits are recorded (a random edit that changes nothing, such as
      // removing a property that is not there, is not an edit).
      let recorded = 0;
      let attempts = 0;
      while (recorded < 100 && attempts++ < 1_000) {
        const edit = randomEdit(store.getState().project, random, counter);
        if (store.getState().apply(edit)) {
          recorded++;
          snapshots.push(store.getState().project);
        }
      }
      const final = store.getState().project;
      expect(recorded).toBe(100);
      expect(store.getState().history.past).toHaveLength(100);
      expect(final).not.toEqual(initial);
      expect(projectSchema.safeParse(final).success).toBe(true);

      // Undo step by step: every intermediate state matches the one recorded on the way.
      for (let step = recorded; step > 0; step--) {
        expect(store.getState().undo()).not.toBeNull();
        expect(store.getState().project).toEqual(snapshots[step - 1]);
      }
      expect(store.getState().undo()).toBeNull();
      expect(store.getState().project).toEqual(initial);

      // Redo everything.
      for (let step = 1; step <= recorded; step++) {
        expect(store.getState().redo()).not.toBeNull();
        expect(store.getState().project).toEqual(snapshots[step]);
      }
      expect(store.getState().redo()).toBeNull();
      expect(store.getState().project).toEqual(final);
    });
  }
});
