import { describe, expect, it } from "vitest";
import {
  checkShortcuts,
  createShortcutMap,
  detectPlatform,
  formatShortcut,
  isReservedShortcut,
  matchesShortcut,
  parseShortcut,
  type KeyInput,
} from "./shortcuts";

const key = (code: string, mods: Partial<Omit<KeyInput, "code">> = {}): KeyInput => ({
  code,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("parseShortcut", () => {
  it.each([
    ["Mod+K", { mod: true, alt: false, shift: false, code: "KeyK" }],
    ["Alt+Shift+r", { mod: false, alt: true, shift: true, code: "KeyR" }],
    ["Alt+1", { mod: false, alt: true, shift: false, code: "Digit1" }],
    ["Mod+/", { mod: true, alt: false, shift: false, code: "Slash" }],
    ["Alt+]", { mod: false, alt: true, shift: false, code: "BracketRight" }],
    ["F1", { mod: false, alt: false, shift: false, code: "F1" }],
    ["shift + up", null],
  ])("parses %s", (text, expected) => {
    if (expected) expect(parseShortcut(text)).toEqual(expected);
    else expect(() => parseShortcut(text)).toThrow();
  });

  it.each(["", "Mod+", "Ctrl+K", "Mod+Mod+K", "Alt+Ü", "F13"])("rejects %j", (text) => {
    expect(() => parseShortcut(text)).toThrow();
  });
});

describe("matchesShortcut", () => {
  const modK = parseShortcut("Mod+K");

  it("uses Ctrl on Windows/Linux and ⌘ on Mac", () => {
    expect(matchesShortcut(modK, key("KeyK", { ctrlKey: true }), "other")).toBe(true);
    expect(matchesShortcut(modK, key("KeyK", { metaKey: true }), "other")).toBe(false);
    expect(matchesShortcut(modK, key("KeyK", { metaKey: true }), "mac")).toBe(true);
    expect(matchesShortcut(modK, key("KeyK", { ctrlKey: true }), "mac")).toBe(false);
  });

  it("requires exactly the listed modifiers", () => {
    expect(matchesShortcut(modK, key("KeyK", { ctrlKey: true, shiftKey: true }), "other")).toBe(
      false,
    );
    expect(matchesShortcut(modK, key("KeyK"), "other")).toBe(false);
    expect(matchesShortcut(modK, key("KeyJ", { ctrlKey: true }), "other")).toBe(false);
  });

  it("matches by physical key, whatever character Alt produces", () => {
    const alt1 = parseShortcut("Alt+1");
    expect(matchesShortcut(alt1, key("Digit1", { altKey: true }), "mac")).toBe(true);
  });
});

describe("formatShortcut", () => {
  it("shows Windows/Linux names", () => {
    expect(formatShortcut(parseShortcut("Mod+Shift+K"), "other")).toEqual(["Ctrl", "Shift", "K"]);
    expect(formatShortcut(parseShortcut("Alt+]"), "other")).toEqual(["Alt", "]"]);
    expect(formatShortcut(parseShortcut("Alt+1"), "other")).toEqual(["Alt", "1"]);
  });

  it("shows Mac symbols", () => {
    expect(formatShortcut(parseShortcut("Mod+Alt+Shift+/"), "mac")).toEqual(["⌘", "⌥", "⇧", "/"]);
  });
});

describe("isReservedShortcut", () => {
  it("knows the browser's own shortcuts", () => {
    expect(isReservedShortcut(parseShortcut("Mod+W"))).toBe(true);
    expect(isReservedShortcut(parseShortcut("Mod+Shift+T"))).toBe(true);
    expect(isReservedShortcut(parseShortcut("Mod+K"))).toBe(false);
  });
});

describe("checkShortcuts", () => {
  it("accepts clean bindings", () => {
    expect(checkShortcuts({ a: ["Mod+K"], b: ["Alt+1", "Alt+Shift+1"] })).toEqual([]);
  });

  it("finds conflicts, also when written differently", () => {
    expect(checkShortcuts({ a: ["Mod+Shift+K"], b: ["shift+mod+k"] })).toEqual([
      { kind: "conflict", shortcut: "Mod+Shift+K", commandIds: ["a", "b"] },
    ]);
  });

  it("finds reserved and invalid shortcuts", () => {
    expect(checkShortcuts({ a: ["Mod+T"], b: ["Hyper+K"] })).toEqual([
      { kind: "reserved", shortcut: "Mod+T", commandId: "a" },
      expect.objectContaining({ kind: "invalid", shortcut: "Hyper+K", commandId: "b" }),
    ]);
  });

  it("does not report one command listing the same key twice as a conflict", () => {
    expect(checkShortcuts({ a: ["Mod+K", "Mod+K"] })).toEqual([]);
  });
});

describe("createShortcutMap", () => {
  const map = createShortcutMap({ open: ["Mod+K"], help: ["Mod+/", "Shift+/"] }, "other");

  it("finds the command for a key event", () => {
    expect(map.find(key("KeyK", { ctrlKey: true }))?.commandId).toBe("open");
    expect(map.find(key("Slash", { shiftKey: true }))?.commandId).toBe("help");
    expect(map.find(key("KeyK"))).toBeUndefined();
  });

  it("formats a command's first shortcut", () => {
    expect(map.keysFor("help")).toEqual(["Ctrl", "/"]);
    expect(map.keysFor("nope")).toBeUndefined();
  });

  it("refuses bindings with problems", () => {
    expect(() => createShortcutMap({ a: ["Mod+K"], b: ["Mod+K"] }, "other")).toThrow(/conflict/);
  });
});

describe("detectPlatform", () => {
  it.each([
    ["MacIntel", "", "mac"],
    ["", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "mac"],
    ["Win32", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "other"],
    [undefined, undefined, "other"],
  ])("%s / %s → %s", (platform, ua, expected) => {
    expect(detectPlatform(platform, ua)).toBe(expected);
  });
});
