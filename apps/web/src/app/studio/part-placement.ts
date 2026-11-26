/**
 * Lets the parts drawer start the canvas's place tool (both are separate dock panels). The canvas
 * registers a handler while it is mounted; without a canvas the request is refused, so the drawer
 * can say so instead of doing nothing.
 */
import type { Part } from "@robosim/core";

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
