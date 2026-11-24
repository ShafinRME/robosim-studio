"use client";

import {
  createShortcutMap,
  detectPlatform,
  type Platform,
  type ShortcutBindings,
  type ShortcutMap,
} from "@robosim/core";
import { useMemo, useSyncExternalStore } from "react";

/**
 * Default keyboard shortcuts (command id → keys). "Mod" is Ctrl on Windows/Linux and ⌘ on Mac.
 * Alt is used where Ctrl combinations belong to the browser (Ctrl+N, Ctrl+W, Ctrl+Tab…).
 * `createShortcutMap` refuses conflicts and browser-reserved keys, and a unit test checks this list.
 */
export const STUDIO_SHORTCUTS: ShortcutBindings = {
  "palette.open": ["Mod+K"],
  "help.shortcuts": ["Mod+/", "Shift+/"],
  "sim.toggle": ["Mod+Enter"],
  "sim.step": ["Alt+."],
  "sim.stop": ["Mod+Shift+Enter"],
  "edit.undo": ["Mod+Z"],
  "edit.redo": ["Mod+Shift+Z", "Mod+Y"],
  "file.newProject": ["Alt+N"],
  "file.openRecent": ["Alt+O"],
  "file.closeProject": ["Alt+W"],
  "project.next": ["Alt+]"],
  "project.previous": ["Alt+["],
  "view.toggle.explorer": ["Alt+1"],
  "view.toggle.canvas": ["Alt+2"],
  "view.toggle.inspector": ["Alt+3"],
  "view.toggle.console": ["Alt+4"],
  "view.resetLayout": ["Alt+Shift+R"],
  "view.toggleLowEnd": ["Alt+Shift+L"],
};

const noopSubscribe = () => () => {};
const clientPlatform = (): Platform => detectPlatform(navigator.platform, navigator.userAgent);
const serverPlatform = (): Platform => "other";

/** The shortcut map for this computer (Ctrl or ⌘). The server render assumes Ctrl. */
export function useShortcutMap(): ShortcutMap {
  const platform = useSyncExternalStore(noopSubscribe, clientPlatform, serverPlatform);
  return useMemo(() => createShortcutMap(STUDIO_SHORTCUTS, platform), [platform]);
}

/** Commands that text boxes handle themselves (undo / redo of typing). */
export const TEXT_EDITING_COMMANDS: ReadonlySet<string> = new Set(["edit.undo", "edit.redo"]);

/** Text boxes keep their keys: only Ctrl/⌘ shortcuts work while typing. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return !["button", "checkbox", "radio", "range", "submit", "reset"].includes(target.type);
  }
  return false;
}
