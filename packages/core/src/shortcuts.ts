/**
 * Keyboard shortcuts: parse "Mod+Shift+K" style strings, match key events, format keys for
 * display (Ctrl on Windows/Linux, ⌘ on Mac) and find conflicts. Framework-free and tested.
 *
 * Keys are matched by physical key (`KeyboardEvent.code`), so shortcuts work the same on any
 * keyboard layout and are not changed by Shift or Alt producing other characters.
 */

export type Platform = "mac" | "other";

export type Shortcut = {
  /** Ctrl on Windows/Linux, ⌘ Command on Mac. */
  mod: boolean;
  alt: boolean;
  shift: boolean;
  /** `KeyboardEvent.code` of the main key, e.g. "KeyK", "Digit1", "Slash". */
  code: string;
};

/** The parts of a keyboard event a shortcut needs. */
export type KeyInput = {
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
};

const NAMED_CODES: Record<string, string> = {
  "/": "Slash",
  "\\": "Backslash",
  "[": "BracketLeft",
  "]": "BracketRight",
  ",": "Comma",
  ".": "Period",
  ";": "Semicolon",
  "'": "Quote",
  "`": "Backquote",
  "-": "Minus",
  "=": "Equal",
  Space: "Space",
  Enter: "Enter",
  Escape: "Escape",
  Esc: "Escape",
  Tab: "Tab",
  Backspace: "Backspace",
  Delete: "Delete",
  Up: "ArrowUp",
  Down: "ArrowDown",
  Left: "ArrowLeft",
  Right: "ArrowRight",
  PageUp: "PageUp",
  PageDown: "PageDown",
  Home: "Home",
  End: "End",
};

/** Turns a key name ("K", "1", "/", "F5", "Up") into a `KeyboardEvent.code`. */
function keyToCode(key: string): string | null {
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  if (/^F([1-9]|1[0-2])$/.test(key)) return key;
  return NAMED_CODES[key] ?? null;
}

/** Parses "Mod+Shift+K". Throws on unknown keys, repeated modifiers or a missing main key. */
export function parseShortcut(text: string): Shortcut {
  const parts = text.split("+").map((p) => p.trim());
  const key = parts.pop();
  if (!key) throw new Error(`Shortcut "${text}" has no key`);
  const shortcut: Shortcut = { mod: false, alt: false, shift: false, code: "" };
  for (const part of parts) {
    const name = part.toLowerCase();
    const flag =
      name === "mod" ? "mod" : name === "alt" ? "alt" : name === "shift" ? "shift" : null;
    if (!flag) throw new Error(`Shortcut "${text}" has an unknown modifier "${part}"`);
    if (shortcut[flag]) throw new Error(`Shortcut "${text}" repeats "${part}"`);
    shortcut[flag] = true;
  }
  const code = keyToCode(key);
  if (!code) throw new Error(`Shortcut "${text}" has an unknown key "${key}"`);
  shortcut.code = code;
  return shortcut;
}

/** Whether a key event is exactly this shortcut (no extra modifiers). */
export function matchesShortcut(shortcut: Shortcut, input: KeyInput, platform: Platform): boolean {
  const mod = platform === "mac" ? input.metaKey : input.ctrlKey;
  const otherMod = platform === "mac" ? input.ctrlKey : input.metaKey;
  return (
    input.code === shortcut.code &&
    mod === shortcut.mod &&
    !otherMod &&
    input.altKey === shortcut.alt &&
    input.shiftKey === shortcut.shift
  );
}

const CODE_LABELS: Record<string, string> = {
  Slash: "/",
  Backslash: "\\",
  BracketLeft: "[",
  BracketRight: "]",
  Comma: ",",
  Period: ".",
  Semicolon: ";",
  Quote: "'",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Escape: "Esc",
  PageUp: "PgUp",
  PageDown: "PgDn",
};

/** Keys to show, e.g. ["Ctrl", "Shift", "K"] or on a Mac ["⌘", "⇧", "K"]. */
export function formatShortcut(shortcut: Shortcut, platform: Platform): string[] {
  const mac = platform === "mac";
  const keys: string[] = [];
  if (shortcut.mod) keys.push(mac ? "⌘" : "Ctrl");
  if (shortcut.alt) keys.push(mac ? "⌥" : "Alt");
  if (shortcut.shift) keys.push(mac ? "⇧" : "Shift");
  const { code } = shortcut;
  keys.push(CODE_LABELS[code] ?? code.replace(/^Key/, "").replace(/^Digit/, ""));
  return keys;
}

/** A stable text form for comparing shortcuts ("mod+shift+KeyK"). */
export function shortcutId(shortcut: Shortcut): string {
  return [shortcut.mod && "mod", shortcut.alt && "alt", shortcut.shift && "shift", shortcut.code]
    .filter(Boolean)
    .join("+");
}

/**
 * Shortcuts the browser keeps for itself (new tab, close tab, address bar…). A web page cannot
 * reliably use these, so the studio never binds them.
 */
export const RESERVED_SHORTCUTS: readonly string[] = [
  "Mod+T",
  "Mod+W",
  "Mod+N",
  "Mod+Shift+T",
  "Mod+Shift+N",
  "Mod+Shift+W",
  "Mod+Tab",
  "Mod+Shift+Tab",
  "Mod+L",
  "Mod+R",
  "Mod+Shift+R",
  "Mod+Q",
  "Alt+F",
  "Alt+E",
  "Alt+D",
  "Alt+Left",
  "Alt+Right",
  "F5",
  "F11",
  "F12",
];
const RESERVED_IDS = new Set(RESERVED_SHORTCUTS.map((s) => shortcutId(parseShortcut(s))));

export function isReservedShortcut(shortcut: Shortcut): boolean {
  return RESERVED_IDS.has(shortcutId(shortcut));
}

/** Command id → shortcut strings. A command may have several shortcuts. */
export type ShortcutBindings = Readonly<Record<string, readonly string[]>>;

export type ShortcutProblem =
  | { kind: "conflict"; shortcut: string; commandIds: string[] }
  | { kind: "reserved"; shortcut: string; commandId: string }
  | { kind: "invalid"; shortcut: string; commandId: string; message: string };

/** Checks bindings: invalid strings, browser-reserved keys, and keys used by more than one command. */
export function checkShortcuts(bindings: ShortcutBindings): ShortcutProblem[] {
  const problems: ShortcutProblem[] = [];
  const owners = new Map<string, { text: string; ids: string[] }>();
  for (const [commandId, list] of Object.entries(bindings)) {
    for (const text of list) {
      let shortcut: Shortcut;
      try {
        shortcut = parseShortcut(text);
      } catch (error) {
        problems.push({
          kind: "invalid",
          shortcut: text,
          commandId,
          message: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
      if (isReservedShortcut(shortcut)) {
        problems.push({ kind: "reserved", shortcut: text, commandId });
      }
      const id = shortcutId(shortcut);
      const entry = owners.get(id) ?? { text, ids: [] };
      if (!entry.ids.includes(commandId)) entry.ids.push(commandId);
      owners.set(id, entry);
    }
  }
  for (const { text, ids } of owners.values()) {
    if (ids.length > 1) problems.push({ kind: "conflict", shortcut: text, commandIds: ids });
  }
  return problems;
}

export type ShortcutMap = {
  /** The command a key event triggers, if any. */
  find: (input: KeyInput) => { commandId: string; shortcut: Shortcut } | undefined;
  /** Display keys of a command's first shortcut. */
  keysFor: (commandId: string) => string[] | undefined;
};

/** Builds a lookup from bindings. Throws if `checkShortcuts` finds any problem. */
export function createShortcutMap(bindings: ShortcutBindings, platform: Platform): ShortcutMap {
  const problems = checkShortcuts(bindings);
  if (problems.length > 0) {
    throw new Error(`Invalid shortcuts: ${JSON.stringify(problems)}`);
  }
  const entries = Object.entries(bindings).flatMap(([commandId, list]) =>
    list.map((text) => ({ commandId, shortcut: parseShortcut(text) })),
  );
  return {
    find: (input) => entries.find((e) => matchesShortcut(e.shortcut, input, platform)),
    keysFor(commandId) {
      const entry = entries.find((e) => e.commandId === commandId);
      return entry ? formatShortcut(entry.shortcut, platform) : undefined;
    },
  };
}

/** Best guess of the platform from `navigator` values. */
export function detectPlatform(
  platform: string | undefined,
  userAgent: string | undefined,
): Platform {
  return /mac|iphone|ipad/i.test(platform ?? "") || /Mac OS X/.test(userAgent ?? "")
    ? "mac"
    : "other";
}
