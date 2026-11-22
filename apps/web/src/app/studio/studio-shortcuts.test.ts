import { checkShortcuts, createShortcutMap } from "@robosim/core";
import { describe, expect, it } from "vitest";
import { STUDIO_SHORTCUTS } from "./studio-shortcuts";

describe("STUDIO_SHORTCUTS", () => {
  it("has no conflicts, invalid keys or browser-reserved keys", () => {
    expect(checkShortcuts(STUDIO_SHORTCUTS)).toEqual([]);
  });

  it("builds a map on both platforms", () => {
    expect(createShortcutMap(STUDIO_SHORTCUTS, "other").keysFor("palette.open")).toEqual([
      "Ctrl",
      "K",
    ]);
    expect(createShortcutMap(STUDIO_SHORTCUTS, "mac").keysFor("palette.open")).toEqual(["⌘", "K"]);
  });
});
