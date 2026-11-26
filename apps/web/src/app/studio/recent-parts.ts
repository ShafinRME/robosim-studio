"use client";

/**
 * Recently placed part types (newest first), shown at the top of the parts drawer. Kept in this
 * browser only; stored data is checked (known part types, short list) before it is used.
 */
import { partFor } from "@robosim/core";
import { useSyncExternalStore } from "react";

const KEY = "robosim-recent-parts";
export const MAX_RECENT_PARTS = 5;

const EMPTY: readonly string[] = [];
let current: readonly string[] | null = null;
const listeners = new Set<() => void>();

function load(): readonly string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw || raw.length > 2_000) return EMPTY;
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return EMPTY;
    const types = data.filter((t): t is string => typeof t === "string" && !!partFor(t));
    return [...new Set(types)].slice(0, MAX_RECENT_PARTS);
  } catch {
    return EMPTY;
  }
}

function read(): readonly string[] {
  current ??= load();
  return current;
}

/** Remembers that a part of `type` was just placed. */
export function rememberPart(type: string): void {
  if (!partFor(type)) return;
  const list = read();
  if (list[0] === type) return;
  current = [type, ...list.filter((t) => t !== type)].slice(0, MAX_RECENT_PARTS);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Only a convenience.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRecentParts(): readonly string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
