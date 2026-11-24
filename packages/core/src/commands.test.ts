import { describe, expect, it, vi } from "vitest";
import {
  createCommandRegistry,
  fuzzyMatch,
  rememberRecent,
  searchCommands,
  type Command,
} from "./commands";

const cmd = (id: string, title: string, category = "View", extra: Partial<Command> = {}) =>
  ({ id, title, category, run: vi.fn(), ...extra }) satisfies Command;

describe("createCommandRegistry", () => {
  it("registers, lists and runs commands", () => {
    const registry = createCommandRegistry();
    const reset = cmd("view.reset", "Reset layout");
    registry.register([reset, cmd("file.new", "New project", "File")]);
    expect(registry.list().map((c) => c.id)).toEqual(["view.reset", "file.new"]);
    expect(registry.run("view.reset")).toBe(true);
    expect(reset.run).toHaveBeenCalledOnce();
  });

  it("does not run unknown or disabled commands", () => {
    const registry = createCommandRegistry();
    const close = cmd("file.close", "Close project", "File", { enabled: () => false });
    registry.register([close]);
    expect(registry.run("file.close")).toBe(false);
    expect(registry.run("nope")).toBe(false);
    expect(close.run).not.toHaveBeenCalled();
  });

  it("rejects duplicate ids, also within one call, without registering any", () => {
    const registry = createCommandRegistry();
    registry.register([cmd("a", "A")]);
    expect(() => registry.register([cmd("b", "B"), cmd("a", "A again")])).toThrow(/"a"/);
    expect(() => registry.register([cmd("c", "C"), cmd("c", "C")])).toThrow(/"c"/);
    expect(registry.list().map((c) => c.id)).toEqual(["a"]);
  });

  it("unregisters and notifies listeners", () => {
    const registry = createCommandRegistry();
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);
    const unregister = registry.register([cmd("a", "A")]);
    unregister();
    expect(registry.get("a")).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    registry.register([cmd("b", "B")]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("returns the same list until commands change", () => {
    const registry = createCommandRegistry();
    registry.register([cmd("a", "A")]);
    const first = registry.list();
    expect(registry.list()).toBe(first);
    registry.register([cmd("b", "B")]);
    expect(registry.list()).not.toBe(first);
    expect(registry.list()).toHaveLength(2);
  });

  it("unregistering twice or after re-registration leaves the new command alone", () => {
    const registry = createCommandRegistry();
    const unregister = registry.register([cmd("a", "A")]);
    unregister();
    const fresh = cmd("a", "A2");
    registry.register([fresh]);
    unregister();
    expect(registry.get("a")).toBe(fresh);
  });
});

describe("fuzzyMatch", () => {
  it("matches an in-order subsequence, ignoring case and spaces", () => {
    expect(fuzzyMatch("rsl", "Reset layout")?.indices).toEqual([0, 2, 6]);
    expect(fuzzyMatch("RESET LAY", "Reset layout")).not.toBeNull();
  });

  it("prefers word starts", () => {
    expect(fuzzyMatch("rl", "Reset layout")?.indices).toEqual([0, 6]);
  });

  it("returns null when characters are missing or out of order", () => {
    expect(fuzzyMatch("xyz", "Reset layout")).toBeNull();
    expect(fuzzyMatch("lr", "Reset layout")).toBeNull();
  });

  it("an empty query matches everything with score 0", () => {
    expect(fuzzyMatch("  ", "Anything")).toEqual({ score: 0, indices: [] });
  });

  it("scores prefixes and runs above scattered matches", () => {
    const prefix = fuzzyMatch("new", "New project")!.score;
    const scattered = fuzzyMatch("new", "Show Inspector window")!.score;
    expect(prefix).toBeGreaterThan(scattered);
  });

  it("treats camelCase humps as word starts", () => {
    expect(fuzzyMatch("le", "lowEnd")?.indices).toEqual([0, 3]);
  });
});

describe("searchCommands", () => {
  const commands = [
    cmd("view.reset", "Reset layout", "View", { keywords: ["panels", "default"] }),
    cmd("file.new", "New project", "File"),
    cmd("file.close", "Close project", "File"),
    cmd("view.lowEnd", "Toggle Low-end mode", "View", { keywords: ["performance"] }),
  ];

  it("ranks the best title match first", () => {
    const results = searchCommands(commands, "new");
    expect(results[0]?.command.id).toBe("file.new");
    expect(results[0]?.titleIndices).toEqual([0, 1, 2]);
  });

  it("finds commands by keyword and category", () => {
    expect(searchCommands(commands, "performance").map((r) => r.command.id)).toEqual([
      "view.lowEnd",
    ]);
    const viaCategory = searchCommands(commands, "file close").map((r) => r.command.id);
    expect(viaCategory[0]).toBe("file.close");
  });

  it("does not mix letters from different keywords", () => {
    const theme = cmd("view.dark", "Dark theme", "View", { keywords: ["colour", "appearance"] });
    expect(searchCommands([theme], "rl")).toEqual([]);
  });

  it("returns nothing for no match", () => {
    expect(searchCommands(commands, "qqq")).toEqual([]);
  });

  it("with an empty query lists all, recently used first", () => {
    const ids = searchCommands(commands, " ", ["file.close", "view.lowEnd"]).map(
      (r) => r.command.id,
    );
    expect(ids).toEqual(["file.close", "view.lowEnd", "view.reset", "file.new"]);
  });
});

describe("rememberRecent", () => {
  it("moves the id to the front without duplicates and caps the list", () => {
    expect(rememberRecent(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
    expect(rememberRecent(["a", "b"], "z", 2)).toEqual(["z", "a"]);
  });
});
