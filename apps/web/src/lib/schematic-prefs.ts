"use client";

/**
 * Schematic preferences (ADR 008): symbol style (IEC 60617 / ANSI IEEE 315) and the unit the status
 * bar shows positions in. Kept in this browser only (localStorage), validated on read, shared by
 * every canvas through a tiny external store so changing it redraws all symbols at once.
 */
import type { LengthUnit, SymbolStyle } from "@robosim/core";
import { useSyncExternalStore } from "react";

export const SCHEMATIC_PREFS_KEY = "robosim-schematic";

export type SchematicPrefs = { symbolStyle: SymbolStyle; lengthUnit: LengthUnit };

export const DEFAULT_SCHEMATIC_PREFS: SchematicPrefs = { symbolStyle: "iec", lengthUnit: "mm" };

/** Reads stored prefs; anything unexpected falls back to the default for that field. */
export function parseSchematicPrefs(text: string | null): SchematicPrefs {
  if (!text || text.length > 200) return DEFAULT_SCHEMATIC_PREFS;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return DEFAULT_SCHEMATIC_PREFS;
  }
  const record = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  return {
    symbolStyle:
      record.symbolStyle === "ansi" || record.symbolStyle === "iec"
        ? record.symbolStyle
        : DEFAULT_SCHEMATIC_PREFS.symbolStyle,
    lengthUnit:
      record.lengthUnit === "in" || record.lengthUnit === "mm"
        ? record.lengthUnit
        : DEFAULT_SCHEMATIC_PREFS.lengthUnit,
  };
}

let current: SchematicPrefs | null = null;
const listeners = new Set<() => void>();

function read(): SchematicPrefs {
  if (current) return current;
  try {
    current = parseSchematicPrefs(window.localStorage.getItem(SCHEMATIC_PREFS_KEY));
  } catch {
    current = DEFAULT_SCHEMATIC_PREFS;
  }
  return current;
}

export function setSchematicPrefs(change: Partial<SchematicPrefs>): void {
  current = { ...read(), ...change };
  try {
    window.localStorage.setItem(SCHEMATIC_PREFS_KEY, JSON.stringify(current));
  } catch {
    // Storage full or blocked: the choice still applies until the page closes.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSchematicPrefs(): SchematicPrefs {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_SCHEMATIC_PREFS);
}
