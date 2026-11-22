/**
 * Saved workspace layouts (ADR 003).
 *
 * The studio stores its docking layout in the browser as `{ version, layout }`. Stored data can be
 * old, hand-edited or corrupt, so it is checked here before the docking library ever sees it.
 * Anything unexpected is rejected and the studio falls back to its default layout.
 *
 * The layout shape mirrors Dockview's `SerializedDockview`, described structurally so this package
 * stays framework-free.
 */

export const LAYOUT_STORAGE_KEY = "robosim-layout";
export const LAYOUT_VERSION = 1;
/** Stored layouts larger than this are ignored (a normal layout is a few kB). */
export const MAX_LAYOUT_CHARS = 100_000;
/** More panels than this is not a real layout. */
export const MAX_LAYOUT_PANELS = 200;
const MAX_GRID_DEPTH = 32;
const MAX_TITLE_CHARS = 200;

export type LayoutGroup = {
  id: string;
  views: string[];
  activeView?: string;
  [key: string]: unknown;
};

export type LayoutGridNode =
  | { type: "leaf"; data: LayoutGroup; size?: number; visible?: boolean }
  | { type: "branch"; data: LayoutGridNode[]; size?: number; visible?: boolean };

export type LayoutPanel = {
  id: string;
  contentComponent: string;
  title?: string;
  params?: Record<string, unknown>;
  [key: string]: unknown;
};

export type LayoutFloatingGroup = {
  data: LayoutGroup;
  position: Record<string, number>;
  [key: string]: unknown;
};

export type DockLayout = {
  grid: {
    root: LayoutGridNode;
    width: number;
    height: number;
    orientation: "HORIZONTAL" | "VERTICAL";
    [key: string]: unknown;
  };
  panels: Record<string, LayoutPanel>;
  activeGroup?: string;
  floatingGroups?: LayoutFloatingGroup[];
  [key: string]: unknown;
};

export type SavedLayout = { version: typeof LAYOUT_VERSION; layout: DockLayout };

export type LayoutRejection =
  "missing" | "too-large" | "corrupt" | "unsupported-version" | "invalid";

export type LayoutParseResult =
  { ok: true; layout: DockLayout } | { ok: false; reason: LayoutRejection; detail?: string };

/** Wraps a layout for storage. */
export function serializeLayout(layout: DockLayout): string {
  const saved: SavedLayout = { version: LAYOUT_VERSION, layout };
  return JSON.stringify(saved);
}

/**
 * Reads a stored layout. `knownPanels` are the panel component ids the studio can render;
 * a layout that names any other component is rejected.
 */
export function parseSavedLayout(
  raw: string | null | undefined,
  knownPanels: ReadonlySet<string>,
): LayoutParseResult {
  if (raw === null || raw === undefined || raw === "") return { ok: false, reason: "missing" };
  if (raw.length > MAX_LAYOUT_CHARS) return { ok: false, reason: "too-large" };

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "corrupt" };
  }
  if (!isRecord(data)) return { ok: false, reason: "corrupt" };
  if (data.version !== LAYOUT_VERSION) return { ok: false, reason: "unsupported-version" };

  const problem = checkLayout(data.layout, knownPanels);
  if (problem) return { ok: false, reason: "invalid", detail: problem };
  return { ok: true, layout: data.layout as DockLayout };
}

/** Returns a description of the first problem found, or `null` when the layout is valid. */
export function checkLayout(value: unknown, knownPanels: ReadonlySet<string>): string | null {
  if (!isRecord(value)) return "layout is not an object";

  // Popout windows and edge groups are not enabled in the studio (ADR 003).
  if (value.popoutGroups !== undefined && !isEmptyArray(value.popoutGroups)) {
    return "popout groups are not allowed";
  }
  if (value.edgeGroups !== undefined) return "edge groups are not allowed";

  // Panels
  const panels = value.panels;
  if (!isRecord(panels)) return "panels missing";
  const panelIds = Object.keys(panels);
  if (panelIds.length === 0) return "no panels";
  if (panelIds.length > MAX_LAYOUT_PANELS) return "too many panels";
  for (const key of panelIds) {
    const panel = panels[key];
    if (!isRecord(panel)) return `panel ${key} is not an object`;
    if (panel.id !== key) return `panel ${key} has a different id`;
    if (typeof panel.contentComponent !== "string" || !knownPanels.has(panel.contentComponent)) {
      return `panel ${key} has an unknown component`;
    }
    if (panel.tabComponent !== undefined) return `panel ${key} has a custom tab`;
    if (
      panel.title !== undefined &&
      (typeof panel.title !== "string" || panel.title.length > MAX_TITLE_CHARS)
    ) {
      return `panel ${key} has an invalid title`;
    }
    if (panel.params !== undefined && !isRecord(panel.params)) {
      return `panel ${key} has invalid params`;
    }
  }

  // Groups: every panel must sit in exactly one group (grid or floating).
  const placed = new Set<string>();
  const groupIds = new Set<string>();
  const checkGroup = (group: unknown): string | null => {
    if (!isRecord(group)) return "group is not an object";
    if (typeof group.id !== "string" || group.id === "") return "group without id";
    if (groupIds.has(group.id)) return `group ${group.id} appears twice`;
    groupIds.add(group.id);
    if (!Array.isArray(group.views)) return `group ${group.id} has no views`;
    for (const view of group.views) {
      if (typeof view !== "string" || !(view in panels)) {
        return `group ${group.id} shows an unknown panel`;
      }
      if (placed.has(view)) return `panel ${view} is in two places`;
      placed.add(view);
    }
    if (
      group.activeView !== undefined &&
      (typeof group.activeView !== "string" || !group.views.includes(group.activeView))
    ) {
      return `group ${group.id} has an invalid active panel`;
    }
    return null;
  };

  // Grid
  const grid = value.grid;
  if (!isRecord(grid)) return "grid missing";
  if (!isSize(grid.width) || !isSize(grid.height)) return "grid has an invalid size";
  if (grid.orientation !== "HORIZONTAL" && grid.orientation !== "VERTICAL") {
    return "grid has an invalid orientation";
  }
  const checkNode = (node: unknown, depth: number): string | null => {
    if (depth > MAX_GRID_DEPTH) return "grid is nested too deeply";
    if (!isRecord(node)) return "grid node is not an object";
    if (node.size !== undefined && !isSize(node.size)) return "grid node has an invalid size";
    if (node.visible !== undefined && typeof node.visible !== "boolean") {
      return "grid node has an invalid visibility";
    }
    if (node.type === "leaf") return checkGroup(node.data);
    if (node.type === "branch") {
      if (!Array.isArray(node.data)) return "grid branch has no children";
      for (const child of node.data) {
        const problem = checkNode(child, depth + 1);
        if (problem) return problem;
      }
      return null;
    }
    return "grid node has an unknown type";
  };
  const gridProblem = checkNode(grid.root, 0);
  if (gridProblem) return gridProblem;

  // Floating groups
  if (value.floatingGroups !== undefined) {
    if (!Array.isArray(value.floatingGroups)) return "floating groups are not a list";
    for (const floating of value.floatingGroups) {
      if (!isRecord(floating)) return "floating group is not an object";
      const position = floating.position;
      if (!isRecord(position) || !Object.values(position).every(isFiniteNumber)) {
        return "floating group has an invalid position";
      }
      const problem = checkGroup(floating.data);
      if (problem) return problem;
    }
  }

  if (placed.size !== panelIds.length) return "some panels are not placed in any group";
  if (
    value.activeGroup !== undefined &&
    (typeof value.activeGroup !== "string" || !groupIds.has(value.activeGroup))
  ) {
    return "active group does not exist";
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSize(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}
