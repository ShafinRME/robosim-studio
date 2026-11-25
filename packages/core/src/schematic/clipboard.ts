/**
 * Copy / cut / paste of schematic items (ADR 009) through a validated JSON clipboard.
 *
 * The clipboard is plain text (\`robosim-clipboard\` JSON), so it works between tabs and windows.
 * Text read back from the clipboard is untrusted: it is size-limited, parsed with a strict schema
 * (the same part / wire / label schemas as project files) and gets fresh ids and free designators
 * before it is added to a project.
 */
import { z } from "zod";
import {
  MAX_PROJECT_LABELS,
  MAX_PROJECT_PARTS,
  MAX_PROJECT_WIRES,
  netLabelSchema,
  newId,
  partSchema,
  wireSchema,
  type NetLabel,
  type Part,
  type Project,
  type Wire,
} from "../project";
import { designatorPrefix, nextDesignator } from "./symbols";

export const CLIPBOARD_FORMAT = "robosim-clipboard";
export const CLIPBOARD_VERSION = 1;
/** Clipboard text longer than this is not read at all (characters). */
export const MAX_CLIPBOARD_CHARS = 2_000_000;
/** Grid that pasted items snap to, so parts and pins stay on the schematic grid (mils). */
const PASTE_GRID = 100;

/** Deep copy of plain JSON data (core has no DOM, so no structuredClone). */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const clipboardSchema = z.strictObject({
  format: z.literal(CLIPBOARD_FORMAT),
  version: z.literal(CLIPBOARD_VERSION),
  parts: z.array(partSchema).max(MAX_PROJECT_PARTS),
  wires: z.array(wireSchema).max(MAX_PROJECT_WIRES),
  labels: z.array(netLabelSchema).max(MAX_PROJECT_LABELS),
});
export type SchematicClipboard = z.infer<typeof clipboardSchema>;

type Items = Pick<Project, "parts" | "wires" | "labels">;

/** The selected items as clipboard content (deep copies). Nothing selected → null. */
export function copyItems(project: Items, ids: Iterable<string>): SchematicClipboard | null {
  const wanted = new Set(ids);
  const clip: SchematicClipboard = {
    format: CLIPBOARD_FORMAT,
    version: CLIPBOARD_VERSION,
    parts: project.parts.filter((p) => wanted.has(p.id)).map((p) => clone(p)),
    wires: project.wires.filter((w) => wanted.has(w.id)).map((w) => clone(w)),
    labels: project.labels.filter((l) => wanted.has(l.id)).map((l) => clone(l)),
  };
  return clip.parts.length + clip.wires.length + clip.labels.length ? clip : null;
}

export function serializeClipboard(clip: SchematicClipboard): string {
  return JSON.stringify(clip);
}

/** Reads clipboard text; anything that is not valid RoboSim clipboard content gives null. */
export function parseClipboard(text: string): SchematicClipboard | null {
  if (text.length > MAX_CLIPBOARD_CHARS || !text.includes(CLIPBOARD_FORMAT)) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = clipboardSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** Centre of everything in the clipboard, snapped to the paste grid. */
function clipCenter(clip: SchematicClipboard): { x: number; y: number } {
  const points: [number, number][] = [
    ...clip.parts.map((p): [number, number] => [p.x, p.y]),
    ...clip.wires.flatMap((w) => w.points),
    ...clip.labels.map((l): [number, number] => [l.x, l.y]),
  ];
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  if (xs.length === 0) return { x: 0, y: 0 };
  const snap = (v: number) => Math.round(v / PASTE_GRID) * PASTE_GRID + 0;
  return {
    x: snap((Math.min(...xs) + Math.max(...xs)) / 2),
    y: snap((Math.min(...ys) + Math.max(...ys)) / 2),
  };
}

/**
 * Items ready to add to `project`: moved so their centre lands on \`at\` (snapped to the grid) or,
 * without \`at\`, by \`offset\`; every item gets a new id and every part a designator that is free in
 * the project (R1 → R3 when R1 and R2 exist), like EDA paste with re-annotation.
 */
export function preparePaste(
  clip: SchematicClipboard,
  project: Items,
  placement: { at: { x: number; y: number } } | { offset: { x: number; y: number } },
  makeId: () => string = newId,
): { parts: Part[]; wires: Wire[]; labels: NetLabel[] } {
  let dx: number;
  let dy: number;
  if ("at" in placement) {
    const c = clipCenter(clip);
    dx = Math.round(placement.at.x / PASTE_GRID) * PASTE_GRID - c.x;
    dy = Math.round(placement.at.y / PASTE_GRID) * PASTE_GRID - c.y;
  } else {
    dx = placement.offset.x;
    dy = placement.offset.y;
  }
  const names = project.parts.map((p) => p.name);
  const parts = clip.parts.map((p): Part => {
    const taken = names.includes(p.name);
    const name = taken || !p.name ? nextDesignator(designatorPrefix(p.type), names) : p.name;
    names.push(name);
    return { ...clone(p), id: makeId(), name, x: p.x + dx, y: p.y + dy };
  });
  const wires = clip.wires.map((w): Wire => ({
    id: makeId(),
    points: w.points.map(([x, y]) => [x + dx, y + dy]),
  }));
  const labels = clip.labels.map((l): NetLabel => ({
    ...l,
    id: makeId(),
    x: l.x + dx,
    y: l.y + dy,
  }));
  return { parts, wires, labels };
}
