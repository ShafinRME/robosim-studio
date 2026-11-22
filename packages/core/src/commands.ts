/**
 * Command registry (ADR 003): every studio action is a command with an id, so menus, the command
 * palette and keyboard shortcuts all run the same code. Includes the palette's fuzzy search.
 */

export type Command = {
  /** Stable id, e.g. "view.resetLayout". */
  id: string;
  /** What the palette shows, e.g. "Reset layout". */
  title: string;
  /** Group shown next to the title, e.g. "View". */
  category: string;
  /** Extra words that should find this command ("panels", "dock"…). */
  keywords?: readonly string[];
  /** Whether the command can run right now (default: always). */
  enabled?: () => boolean;
  run: () => void;
};

export type CommandRegistry = {
  /** Adds commands; returns a function that removes them again. Duplicate ids throw. */
  register: (commands: readonly Command[]) => () => void;
  get: (id: string) => Command | undefined;
  /** All commands in registration order; the same array until commands change. */
  list: () => Command[];
  /** Runs a command if it exists and is enabled. Returns whether it ran. */
  run: (id: string) => boolean;
  /** Called after any register / unregister. Returns an unsubscribe function. */
  subscribe: (listener: () => void) => () => void;
};

export function isCommandEnabled(command: Command): boolean {
  return command.enabled ? command.enabled() : true;
}

export function createCommandRegistry(): CommandRegistry {
  const commands = new Map<string, Command>();
  const listeners = new Set<() => void>();
  // `list()` returns the same array until commands change (safe for React's useSyncExternalStore).
  let snapshot: Command[] | null = null;
  const notify = () => {
    snapshot = null;
    for (const listener of listeners) listener();
  };

  return {
    register(list) {
      const ids = new Set<string>();
      for (const command of list) {
        if (commands.has(command.id) || ids.has(command.id)) {
          throw new Error(`Command "${command.id}" is already registered`);
        }
        ids.add(command.id);
      }
      for (const command of list) commands.set(command.id, command);
      notify();
      return () => {
        let changed = false;
        for (const command of list) {
          if (commands.get(command.id) === command) {
            commands.delete(command.id);
            changed = true;
          }
        }
        if (changed) notify();
      };
    },
    get: (id) => commands.get(id),
    list: () => (snapshot ??= [...commands.values()]),
    run(id) {
      const command = commands.get(id);
      if (!command || !isCommandEnabled(command)) return false;
      command.run();
      return true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** A fuzzy match: higher score is better; `indices` are matched characters, for highlighting. */
export type FuzzyMatch = { score: number; indices: number[] };

const isWordStart = (text: string, i: number) =>
  i === 0 || /[\s\-_./:]/.test(text[i - 1] ?? "") || /[a-z][A-Z]/.test(text.slice(i - 1, i + 1));

/**
 * Matches `query` as an in-order subsequence of `text`, ignoring case and spaces in the query.
 * Rewards matches at the start, at word starts and in runs; returns null when not all characters
 * of the query are found.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const q = query.toLowerCase().replace(/\s+/g, "");
  if (q === "") return { score: 0, indices: [] };
  const t = text.toLowerCase();

  // Prefer the first occurrence of each character that starts a word, falling back to any.
  const indices: number[] = [];
  let from = 0;
  for (const ch of q) {
    let found = -1;
    for (let i = from; i < t.length; i++) {
      if (t[i] !== ch) continue;
      if (found === -1) found = i;
      if (isWordStart(text, i) || indices.at(-1) === i - 1) {
        found = i;
        break;
      }
    }
    if (found === -1) return null;
    indices.push(found);
    from = found + 1;
  }

  let score = 0;
  for (let k = 0; k < indices.length; k++) {
    const i = indices[k] ?? 0;
    score += 1;
    if (i === 0) score += 8;
    else if (isWordStart(text, i)) score += 5;
    if (k > 0 && indices[k - 1] === i - 1) score += 4;
  }
  // Shorter texts and earlier first matches rank higher.
  score -= (indices[0] ?? 0) * 0.5 + t.length * 0.05;
  return { score, indices };
}

export type CommandResult = { command: Command; score: number; titleIndices: number[] };

/**
 * Filters and ranks commands for the palette. Titles count most; category and keywords help
 * ("view reset" finds "Reset layout" in View). Empty query: all commands, `recent` first.
 */
export function searchCommands(
  commands: readonly Command[],
  query: string,
  recent: readonly string[] = [],
): CommandResult[] {
  const trimmed = query.trim();
  if (trimmed === "") {
    const rank = (id: string) => {
      const i = recent.indexOf(id);
      return i === -1 ? Number.POSITIVE_INFINITY : i;
    };
    return commands
      .map((command, order) => ({ command, order }))
      .sort((a, b) => rank(a.command.id) - rank(b.command.id) || a.order - b.order)
      .map(({ command }) => ({ command, score: 0, titleIndices: [] }));
  }

  const words = trimmed.split(/\s+/);
  const results: CommandResult[] = [];
  for (const command of commands) {
    const title = fuzzyMatch(trimmed, command.title);
    if (title) {
      results.push({ command, score: title.score + 10, titleIndices: title.indices });
      continue;
    }
    // Otherwise every typed word must match within one field (title, category or a keyword),
    // so letters are never picked from unrelated words.
    const fields = [command.title, command.category, ...(command.keywords ?? [])];
    let score = 0;
    let all = true;
    for (const word of words) {
      const best = Math.max(
        ...fields.map((field) => fuzzyMatch(word, field)?.score ?? Number.NEGATIVE_INFINITY),
      );
      if (best === Number.NEGATIVE_INFINITY) {
        all = false;
        break;
      }
      score += best;
    }
    if (all) results.push({ command, score, titleIndices: [] });
  }
  return results.sort((a, b) => b.score - a.score);
}

/** Puts `id` first in the recent list, without duplicates, keeping at most `max` ids. */
export function rememberRecent(recent: readonly string[], id: string, max = 5): string[] {
  return [id, ...recent.filter((r) => r !== id)].slice(0, max);
}
