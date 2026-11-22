import { describe, expect, it } from "vitest";
import {
  LAYOUT_VERSION,
  MAX_LAYOUT_CHARS,
  checkLayout,
  parseSavedLayout,
  serializeLayout,
  type DockLayout,
} from "./layout";

const KNOWN = new Set(["explorer", "canvas", "inspector", "console"]);

/** A real layout saved by the studio (Console floated), as written by Dockview 8.9.1. */
function realLayout(): DockLayout {
  return {
    grid: {
      root: {
        type: "branch",
        data: [
          {
            type: "leaf",
            data: { views: ["explorer"], activeView: "explorer", id: "2" },
            size: 237.33,
          },
          {
            type: "leaf",
            data: { views: ["canvas"], activeView: "canvas", id: "1" },
            size: 493.33,
          },
          {
            type: "leaf",
            data: { views: ["inspector"], activeView: "inspector", id: "3" },
            size: 277.33,
          },
        ],
        size: 720,
      },
      width: 1016,
      height: 720,
      orientation: "HORIZONTAL",
    },
    panels: {
      canvas: { id: "canvas", contentComponent: "canvas", title: "Canvas" },
      explorer: { id: "explorer", contentComponent: "explorer", title: "Explorer" },
      inspector: { id: "inspector", contentComponent: "inspector", title: "Inspector" },
      console: { id: "console", contentComponent: "console", title: "Console" },
    },
    activeGroup: "4",
    floatingGroups: [
      {
        data: { views: ["console"], activeView: "console", id: "4" },
        position: { top: 146.656, left: 298, width: 420, height: 280 },
      },
    ],
  };
}

const stored = (layout: unknown, version: unknown = LAYOUT_VERSION) =>
  JSON.stringify({ version, layout });

/** Applies a change to a copy of the real layout and checks it. */
function checkWith(change: (layout: Record<string, unknown> & DockLayout) => void) {
  const layout = JSON.parse(JSON.stringify(realLayout())) as Record<string, unknown> & DockLayout;
  change(layout);
  return checkLayout(layout, KNOWN);
}

describe("serializeLayout / parseSavedLayout", () => {
  it("round-trips a real layout", () => {
    const result = parseSavedLayout(serializeLayout(realLayout()), KNOWN);
    expect(result).toEqual({ ok: true, layout: realLayout() });
  });

  it("stores the version", () => {
    expect(JSON.parse(serializeLayout(realLayout()))).toMatchObject({ version: 1 });
  });

  it.each([
    [null, "missing"],
    [undefined, "missing"],
    ["", "missing"],
    ["{not json", "corrupt"],
    ["[]", "corrupt"],
    ["42", "corrupt"],
    ["null", "corrupt"],
    [stored(realLayout(), 2), "unsupported-version"],
    [stored(realLayout(), "1"), "unsupported-version"],
    [JSON.stringify({ layout: realLayout() }), "unsupported-version"],
    [stored(null), "invalid"],
  ])("rejects %j as %s", (raw, reason) => {
    expect(parseSavedLayout(raw, KNOWN)).toMatchObject({ ok: false, reason });
  });

  it("rejects data larger than the size limit without parsing it", () => {
    const raw = `{"version":1,"pad":"${"x".repeat(MAX_LAYOUT_CHARS)}"}`;
    expect(parseSavedLayout(raw, KNOWN)).toEqual({ ok: false, reason: "too-large" });
  });

  it("explains why a layout is invalid", () => {
    const layout = realLayout();
    layout.panels.canvas!.contentComponent = "evil";
    expect(parseSavedLayout(stored(layout), KNOWN)).toEqual({
      ok: false,
      reason: "invalid",
      detail: "panel canvas has an unknown component",
    });
  });
});

describe("checkLayout", () => {
  it("accepts the real layout", () => {
    expect(checkLayout(realLayout(), KNOWN)).toBeNull();
  });

  it("accepts a layout without floating groups or active group", () => {
    const layout = realLayout();
    const leaf = { type: "leaf" as const, data: { views: ["console"], id: "4" }, size: 100 };
    (layout.grid.root.data as unknown[]).push(leaf);
    delete layout.floatingGroups;
    delete layout.activeGroup;
    expect(checkLayout(layout, KNOWN)).toBeNull();
  });

  it("accepts several panels as tabs in one group", () => {
    const layout = realLayout();
    layout.floatingGroups![0]!.data.views = ["console", "explorer"];
    layout.grid.root.data = (layout.grid.root.data as { data: { id: string } }[]).filter(
      (node) => node.data.id !== "2",
    ) as typeof layout.grid.root.data;
    expect(checkLayout(layout, KNOWN)).toBeNull();
  });

  it.each<[string, (layout: Record<string, unknown> & DockLayout) => void, string]>([
    ["not an object", (l) => Object.assign(l, { panels: [] }), "panels missing"],
    ["no panels", (l) => (l.panels = {}), "no panels"],
    [
      "panel id mismatch",
      (l) => (l.panels.canvas!.id = "other"),
      "panel canvas has a different id",
    ],
    [
      "unknown component",
      (l) => (l.panels.console!.contentComponent = "iframe"),
      "panel console has an unknown component",
    ],
    [
      "missing component",
      (l) => delete (l.panels.console as Partial<DockLayout["panels"][string]>).contentComponent,
      "panel console has an unknown component",
    ],
    [
      "custom tab component",
      (l) => (l.panels.console!.tabComponent = "x"),
      "panel console has a custom tab",
    ],
    [
      "non-string title",
      (l) => Object.assign(l.panels.canvas!, { title: 5 }),
      "panel canvas has an invalid title",
    ],
    [
      "huge title",
      (l) => (l.panels.canvas!.title = "x".repeat(201)),
      "panel canvas has an invalid title",
    ],
    [
      "params not an object",
      (l) => Object.assign(l.panels.canvas!, { params: "x" }),
      "panel canvas has invalid params",
    ],
    [
      "group shows a missing panel",
      (l) => l.floatingGroups![0]!.data.views.push("ghost"),
      "group 4 shows an unknown panel",
    ],
    [
      "panel placed twice",
      (l) => l.floatingGroups![0]!.data.views.push("canvas"),
      "panel canvas is in two places",
    ],
    [
      "panel never placed",
      (l) => delete l.floatingGroups,
      "some panels are not placed in any group",
    ],
    ["duplicate group id", (l) => (l.floatingGroups![0]!.data.id = "1"), "group 1 appears twice"],
    [
      "active view not in group",
      (l) => (l.floatingGroups![0]!.data.activeView = "canvas"),
      "group 4 has an invalid active panel",
    ],
    ["unknown active group", (l) => (l.activeGroup = "99"), "active group does not exist"],
    ["negative grid size", (l) => (l.grid.width = -1), "grid has an invalid size"],
    [
      "NaN-like grid size",
      (l) => Object.assign(l.grid, { height: "720" }),
      "grid has an invalid size",
    ],
    [
      "bad orientation",
      (l) => Object.assign(l.grid, { orientation: "DIAGONAL" }),
      "grid has an invalid orientation",
    ],
    [
      "unknown node type",
      (l) => Object.assign(l.grid.root, { type: "window" }),
      "grid node has an unknown type",
    ],
    [
      "invalid node size",
      (l) => Object.assign(l.grid.root, { size: Number.POSITIVE_INFINITY }),
      "grid node has an invalid size",
    ],
    [
      "floating position not numbers",
      (l) => Object.assign(l.floatingGroups![0]!.position, { top: "0" }),
      "floating group has an invalid position",
    ],
    [
      "popout groups",
      (l) => (l.popoutGroups = [{ data: { views: [], id: "9" } }]),
      "popout groups are not allowed",
    ],
    ["edge groups", (l) => (l.edgeGroups = {}), "edge groups are not allowed"],
  ])("rejects %s", (_name, change, problem) => {
    expect(checkWith(change)).toBe(problem);
  });

  it("accepts an empty popout list", () => {
    expect(checkWith((l) => (l.popoutGroups = []))).toBeNull();
  });

  it("rejects grids nested too deeply", () => {
    const layout = realLayout();
    let root: DockLayout["grid"]["root"] = {
      type: "leaf",
      data: { views: ["canvas"], id: "1" },
    };
    for (let i = 0; i < 40; i++) root = { type: "branch", data: [root] };
    layout.grid.root = root;
    expect(checkLayout(layout, KNOWN)).toBe("grid is nested too deeply");
  });

  it("rejects non-objects", () => {
    expect(checkLayout(null, KNOWN)).toBe("layout is not an object");
    expect(checkLayout([], KNOWN)).toBe("layout is not an object");
  });
});
