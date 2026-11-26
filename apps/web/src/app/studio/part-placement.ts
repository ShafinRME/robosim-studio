/**
 * Lets the parts drawer start the canvas's place tool (both are separate dock panels). The canvas
 * registers a handler while it is mounted; without a canvas the request is refused, so the drawer
 * can say so instead of doing nothing.
 */
import { partFor, resolveProps, type Part } from "@robosim/core";

export type PlaceRequest = {
  readonly type: string;
  /** Starting values from the search ("10k" → resistance 10 000), already range-checked. */
  readonly props?: Part["props"];
};

type Handler = (request: PlaceRequest) => boolean;
let handler: Handler | null = null;

/** Called by the canvas; returns the unregister function for its effect cleanup. */
export function setPlaceHandler(next: Handler): () => void {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

/** True when a canvas took the request (its place tool is now active). */
export function requestPlace(request: PlaceRequest): boolean {
  return handler ? handler(request) : false;
}

// ─── Drag and drop from the parts drawer ─────────────────────────────────────────────────────────

/** Drag data type of a part dragged from the drawer (our own, so other drops are ignored). */
export const PART_DRAG_TYPE = "application/x-robosim-part";

export function encodePartDrag(request: PlaceRequest): string {
  return JSON.stringify(request);
}

/**
 * Reads drag data. It can come from any page, so it is untrusted: size-limited, the type must be in
 * the library, and only known properties with valid values are kept.
 */
export function decodePartDrag(text: string): PlaceRequest | null {
  if (!text || text.length > 2_000) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const { type, props } = data as { type?: unknown; props?: unknown };
  if (typeof type !== "string") return null;
  const part = partFor(type);
  if (!part) return null;
  if (props === undefined || typeof props !== "object" || props === null) return { type };
  const known = new Map((part.component?.properties ?? []).map((p) => [p.key, p]));
  const clean: Record<string, number | string | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!known.has(key)) continue;
    if (typeof value !== "number" && typeof value !== "string" && typeof value !== "boolean")
      continue;
    clean[key] = value;
  }
  if (part.component && !resolveProps(part.component, clean).ok) return { type };
  return Object.keys(clean).length ? { type, props: clean } : { type };
}

// ─── "Add part" (A): jump to the drawer's search ─────────────────────────────────────────────────

let focusSearch: (() => void) | null = null;

/** Called by the parts drawer while it is mounted. */
export function setPartSearchFocus(next: () => void): () => void {
  focusSearch = next;
  return () => {
    if (focusSearch === next) focusSearch = null;
  };
}

/** Puts the cursor in the parts search; false when the Parts panel is closed. */
export function focusPartSearch(): boolean {
  if (!focusSearch) return false;
  focusSearch();
  return true;
}

// Browsers hide drag data until the drop, so the canvas learns *what* is being dragged (for its
// preview) from the drawer directly; the drop itself is still read and checked from the data.
let activeDrag: PlaceRequest | null = null;

export function setActiveDrag(request: PlaceRequest | null): void {
  activeDrag = request;
}

export function getActiveDrag(): PlaceRequest | null {
  return activeDrag;
}
