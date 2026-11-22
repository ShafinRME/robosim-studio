import { describe, expect, it } from "vitest";
import {
  MAX_HISTORY,
  applyEdit,
  emptyHistory,
  redo,
  redoLabel,
  undo,
  undoLabel,
  type Edit,
  type History,
} from "./history";

type Doc = { count: number; items: string[]; meta: { title: string } };
const start: Doc = { count: 0, items: [], meta: { title: "A" } };

const add = (n: number): Edit<Doc> => ({
  label: `Add ${n}`,
  recipe: (d) => {
    d.count += n;
  },
});
const push = (item: string): Edit<Doc> => ({
  label: `Push ${item}`,
  recipe: (d) => {
    d.items.push(item);
  },
});
const nothing: Edit<Doc> = { label: "Nothing", recipe: () => {} };

function run(edits: Edit<Doc>[], state = start, history: History = emptyHistory()) {
  for (const edit of edits) ({ state, history } = applyEdit(state, history, edit));
  return { state, history };
}

describe("applyEdit", () => {
  it("applies the edit without changing the input", () => {
    const result = applyEdit(start, emptyHistory(), push("x"));
    expect(result.changed).toBe(true);
    expect(result.state.items).toEqual(["x"]);
    expect(start.items).toEqual([]);
    expect(result.state.meta).toBe(start.meta); // untouched parts are shared
  });

  it("does not record an edit that changes nothing", () => {
    const history = emptyHistory();
    const result = applyEdit(start, history, nothing);
    expect(result).toEqual({ state: start, history, changed: false });
    expect(applyEdit(start, history, add(0)).changed).toBe(false);
  });

  it("stores patches, not snapshots", () => {
    const { history } = run([push("x")]);
    expect(history.past).toHaveLength(1);
    expect(history.past[0]).toMatchObject({ label: "Push x" });
    expect(JSON.stringify(history.past[0]!.patches)).not.toContain('"meta"');
  });

  it("clears the redo list on a new edit", () => {
    let { state, history } = run([add(1), add(2)]);
    ({ state, history } = undo(state, history));
    expect(redoLabel(history)).toBe("Add 2");
    ({ state, history } = applyEdit(state, history, add(5)));
    expect(history.future).toEqual([]);
    expect(state.count).toBe(6);
  });

  it("keeps at most the history limit, dropping the oldest", () => {
    let state = start;
    let history = emptyHistory();
    for (let i = 1; i <= 5; i++) ({ state, history } = applyEdit(state, history, add(i), 3));
    expect(history.past.map((e) => e.label)).toEqual(["Add 3", "Add 4", "Add 5"]);
    while (history.past.length) ({ state, history } = undo(state, history));
    expect(state.count).toBe(1 + 2); // the first two edits can no longer be undone
  });

  it("uses a limit of 200 by default", () => {
    const { history } = run(Array.from({ length: MAX_HISTORY + 10 }, () => add(1)));
    expect(history.past).toHaveLength(MAX_HISTORY);
  });
});

describe("undo / redo", () => {
  it("undoes and redoes in order", () => {
    let { state, history } = run([add(1), push("a"), add(10)]);
    expect(undoLabel(history)).toBe("Add 10");

    const labels: (string | null)[] = [];
    let label: string | null;
    do {
      ({ state, history, label } = undo(state, history));
      labels.push(label);
    } while (label);
    expect(labels).toEqual(["Add 10", "Push a", "Add 1", null]);
    expect(state).toEqual(start);

    ({ state, history } = redo(state, history));
    ({ state, history } = redo(state, history));
    expect(state).toEqual({ ...start, count: 1, items: ["a"] });
    expect(undoLabel(history)).toBe("Push a");
    expect(redoLabel(history)).toBe("Add 10");
  });

  it("does nothing when there is nothing to undo or redo", () => {
    const history = emptyHistory();
    expect(undo(start, history)).toEqual({ state: start, history, label: null });
    expect(redo(start, history)).toEqual({ state: start, history, label: null });
    expect(undoLabel(history)).toBeNull();
    expect(redoLabel(history)).toBeNull();
  });

  it("restores removed array items and object keys", () => {
    const base: Doc = { count: 0, items: ["a", "b", "c"], meta: { title: "A" } };
    let { state, history } = run(
      [
        {
          label: "Remove b",
          recipe: (d) => {
            d.items.splice(1, 1);
          },
        },
        {
          label: "Rename",
          recipe: (d) => {
            d.meta = { title: "B" };
          },
        },
      ],
      base,
    );
    ({ state, history } = undo(state, history));
    ({ state, history } = undo(state, history));
    expect(state).toEqual(base);
    expect(history.future).toHaveLength(2);
  });
});
