import { describe, expect, it } from "vitest";
import {
  MAX_PROJECT_TABS,
  activateProjectTab,
  closeProjectTab,
  cycleProjectTab,
  emptyProjectTabs,
  nextUntitledName,
  openProjectTab,
  type ProjectTabsState,
} from "./project-tabs";

function withTabs(...ids: string[]): ProjectTabsState {
  return ids.reduce((state, id) => openProjectTab(state, id), emptyProjectTabs);
}

describe("nextUntitledName", () => {
  it("starts with Untitled, then numbers from 2", () => {
    expect(nextUntitledName([])).toBe("Untitled");
    expect(nextUntitledName([{ id: "a", name: "Untitled" }])).toBe("Untitled 2");
  });

  it("reuses the lowest free number", () => {
    const tabs = [
      { id: "a", name: "Untitled" },
      { id: "c", name: "Untitled 3" },
    ];
    expect(nextUntitledName(tabs)).toBe("Untitled 2");
  });

  it("ignores other names", () => {
    expect(nextUntitledName([{ id: "a", name: "Line follower" }])).toBe("Untitled");
  });
});

describe("openProjectTab", () => {
  it("adds the tab at the end and activates it", () => {
    const state = withTabs("a", "b");
    expect(state.tabs.map((t) => t.name)).toEqual(["Untitled", "Untitled 2"]);
    expect(state.activeId).toBe("b");
  });

  it("uses a given name", () => {
    expect(openProjectTab(emptyProjectTabs, "a", "Blink").tabs[0]).toEqual({
      id: "a",
      name: "Blink",
    });
  });

  it("ignores a duplicate id", () => {
    const state = withTabs("a");
    expect(openProjectTab(state, "a")).toBe(state);
  });

  it("stops at the tab limit", () => {
    const ids = Array.from({ length: MAX_PROJECT_TABS + 3 }, (_, i) => `t${i}`);
    const state = withTabs(...ids);
    expect(state.tabs).toHaveLength(MAX_PROJECT_TABS);
    expect(state.activeId).toBe(`t${MAX_PROJECT_TABS - 1}`);
  });
});

describe("activateProjectTab", () => {
  it("switches the active tab", () => {
    expect(activateProjectTab(withTabs("a", "b"), "a").activeId).toBe("a");
  });

  it("ignores unknown ids", () => {
    const state = withTabs("a");
    expect(activateProjectTab(state, "zzz")).toBe(state);
  });
});

describe("closeProjectTab", () => {
  it("activates the tab to the right when the active tab closes", () => {
    const state = activateProjectTab(withTabs("a", "b", "c"), "b");
    expect(closeProjectTab(state, "b")).toMatchObject({ activeId: "c" });
  });

  it("activates the tab to the left when the last tab closes", () => {
    expect(closeProjectTab(withTabs("a", "b", "c"), "c")).toMatchObject({ activeId: "b" });
  });

  it("keeps the active tab when another tab closes", () => {
    const state = closeProjectTab(withTabs("a", "b", "c"), "a");
    expect(state.activeId).toBe("c");
    expect(state.tabs.map((t) => t.id)).toEqual(["b", "c"]);
  });

  it("leaves no active tab when the only tab closes", () => {
    expect(closeProjectTab(withTabs("a"), "a")).toEqual({ tabs: [], activeId: null });
  });

  it("ignores unknown ids", () => {
    const state = withTabs("a");
    expect(closeProjectTab(state, "zzz")).toBe(state);
  });
});

describe("cycleProjectTab", () => {
  it("moves forward and wraps around", () => {
    const state = activateProjectTab(withTabs("a", "b", "c"), "c");
    expect(cycleProjectTab(state, 1).activeId).toBe("a");
  });

  it("moves backward and wraps around", () => {
    const state = activateProjectTab(withTabs("a", "b", "c"), "a");
    expect(cycleProjectTab(state, -1).activeId).toBe("c");
  });

  it("does nothing with fewer than two tabs", () => {
    const state = withTabs("a");
    expect(cycleProjectTab(state, 1)).toBe(state);
  });
});
