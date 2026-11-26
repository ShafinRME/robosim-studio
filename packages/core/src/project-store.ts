/**
 * Project store and edits (ADR 004).
 *
 * The store is a framework-free Zustand store: the web app subscribes to it, tests and Web Workers
 * can use it directly. Every change to the project goes through a named edit, so it can be undone.
 * Edit helpers check their input and throw `ProjectEditError` for values the project format does
 * not allow; an edit on a part that does not exist simply changes nothing.
 */
import type { Draft } from "immer";
import { createStore, type StoreApi } from "zustand/vanilla";
import {
  applyEdit,
  emptyHistory,
  redo as redoHistory,
  undo as undoHistory,
  MAX_HISTORY,
  type Edit,
  type History,
} from "./history";
import {
  MAX_NAME_CHARS,
  MAX_PART_PROPS,
  MAX_PROJECT_LABELS,
  MAX_PROJECT_PARTS,
  MAX_PROJECT_WIRES,
  WIRE_GRID,
  coordinateSchema,
  netLabelSchema,
  partSchema,
  propKeySchema,
  propValueSchema,
  wireSchema,
  type NetLabel,
  type Part,
  type PartValue,
  type Project,
  type Wire,
  type WirePoint,
} from "./project";
import { pinKey, placedPinsOf } from "./schematic/connectivity";
import { rubberBandWire, type PointMover } from "./schematic/rubber-band";
import { segmentAt, simplifyWire } from "./schematic/wires";

const pointKey = (x: number, y: number) => `${x},${y}`;

/**
 * Runs `change`, which moves the parts in `movedParts` (any way) and the wires / labels in `rigid`
 * by `delta`, then rubber-bands (ADR 009): every other wire whose END sat on a moved pin or on a
 * rigidly moved wire follows it, and free labels on such points move too. A point that is also an
 * unmoved part's pin stays put. All in the same draft, so it is one undo step.
 */
function withRubberBand(
  draft: Draft<Project>,
  movedParts: ReadonlySet<string>,
  rigid: ReadonlySet<string>,
  delta: Point | null,
  change: () => void,
): void {
  const moving = draft.parts.filter((p) => movedParts.has(p.id));
  const rigidWires =
    delta && rigid.size
      ? draft.wires
          .filter((w) => rigid.has(w.id))
          .map((w) => w.points.map(([x, y]): WirePoint => [x, y]))
      : [];
  if (moving.length === 0 && rigidWires.length === 0) return change();
  const oldPins = placedPinsOf(moving);
  const fixed = new Set(
    placedPinsOf(draft.parts.filter((p) => !movedParts.has(p.id))).map((p) => pointKey(p.x, p.y)),
  );
  change();
  const newPins = new Map(placedPinsOf(moving).map((p) => [pinKey(p.part, p.pin), p]));
  const anchors = new Map<string, WirePoint>();
  for (const p of oldPins) {
    const to = newPins.get(pinKey(p.part, p.pin));
    const k = pointKey(p.x, p.y);
    if (to && !anchors.has(k)) anchors.set(k, [to.x, to.y]);
  }
  const move: PointMover = ([x, y]) => {
    const k = pointKey(x, y);
    if (fixed.has(k)) return null;
    const anchor = anchors.get(k);
    if (anchor) return anchor;
    if (delta && rigidWires.some((points) => segmentAt(points, [x, y]) >= 0)) {
      return [x + delta.x, y + delta.y];
    }
    return null;
  };
  const kept = draft.wires.filter((wire) => {
    if (rigid.has(wire.id)) return true;
    const points = rubberBandWire(wire.points, move);
    if (points === null) return false;
    if (points !== wire.points)
      wire.points = checkWire({ id: wire.id, points: [...points] }).points;
    return true;
  });
  if (kept.length !== draft.wires.length) draft.wires = kept;
  for (const label of draft.labels) {
    if (rigid.has(label.id)) continue;
    const to = move([label.x, label.y]);
    if (to) [label.x, label.y] = to;
  }
}

/** Any id in the project (part, wire or label) is free: ids are unique across all three. */
function idTaken(draft: Draft<Project>, id: string): boolean {
  return (
    draft.parts.some((p) => p.id === id) ||
    draft.wires.some((w) => w.id === id) ||
    draft.labels.some((l) => l.id === id)
  );
}

function checkWire(wire: Wire): Wire {
  const simplified = { id: wire.id, points: simplifyWire(wire.points) };
  const parsed = wireSchema.safeParse(simplified);
  if (!parsed.success) {
    throw new ProjectEditError(`Invalid wire: ${parsed.error.issues[0]?.message ?? "bad points"}`);
  }
  return parsed.data;
}

function countLabel(verb: string, count: number, noun = "item"): string {
  return `${verb} ${count} ${noun}${count === 1 ? "" : "s"}`;
}

export class ProjectEditError extends Error {
  override name = "ProjectEditError";
}

/**
 * An edit of the project. Edits of one part set `part`: the store then names the part in the
 * label ("Move" + "R1" → "Move R1").
 */
export type ProjectEdit = Edit<Project> & { part?: string };

function findPart(draft: Draft<Project>, id: string) {
  return draft.parts.find((part) => part.id === id);
}

function checkName(name: string, what: string, allowEmpty: boolean) {
  const trimmed = name.trim();
  if ((!allowEmpty && trimmed.length === 0) || trimmed.length > MAX_NAME_CHARS) {
    throw new ProjectEditError(
      `${what} must be ${allowEmpty ? "0" : "1"}–${MAX_NAME_CHARS} characters`,
    );
  }
  return trimmed;
}

function checkCoordinate(value: number, axis: string) {
  if (!coordinateSchema.safeParse(value).success) {
    throw new ProjectEditError(`${axis} is out of range`);
  }
  return value;
}

/** Rotation in degrees, normalised to 0 ≤ r < 360. */
export function normalizeRotation(degrees: number): number {
  if (!Number.isFinite(degrees)) throw new ProjectEditError("rotation must be a number");
  const r = ((degrees % 360) + 360) % 360;
  return r === 360 ? 0 : r;
}

export type Point = { x: number; y: number };

/** Default schematic grid in mils (ADR 008): group centres snap to it. */
export const DEFAULT_GRID = 100;

/** Rounds half to even, so ties go the same way from both sides (a flip, then a flip back). */
function roundHalfEven(v: number): number {
  const r = Math.round(v);
  return Math.abs(v % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/**
 * Centre of the parts' positions, snapped to the grid (so rotated or mirrored parts stay on the
 * grid). Half-even rounding makes flipping twice an exact undo.
 */
function groupCenter(parts: readonly { x: number; y: number }[], grid = DEFAULT_GRID): Point {
  if (parts.length === 0) return { x: 0, y: 0 };
  const xs = parts.map((p) => p.x);
  const ys = parts.map((p) => p.y);
  // `+ 0` turns −0 into 0 (JSON cannot keep −0).
  const snap = (v: number) => (grid > 0 ? roundHalfEven(v / grid) * grid + 0 : v);
  return {
    x: snap((Math.min(...xs) + Math.max(...xs)) / 2),
    y: snap((Math.min(...ys) + Math.max(...ys)) / 2),
  };
}

/**
 * One undoable edit over several parts. A single part is named in the label ("Rotate R1"),
 * several are counted ("Rotate 3 parts"). Unknown ids are skipped.
 */
function groupEdit(
  verb: string,
  ids: readonly string[],
  change: (parts: Draft<Project>["parts"]) => void,
): ProjectEdit {
  const unique = [...new Set(ids)];
  if (unique.length > MAX_PROJECT_PARTS) throw new ProjectEditError("too many parts");
  const wanted = new Set(unique);
  const recipe = (draft: Draft<Project>) => {
    const parts = draft.parts.filter((part) => wanted.has(part.id));
    if (parts.length) withRubberBand(draft, wanted, new Set(), null, () => change(parts));
  };
  if (unique.length === 1) return { label: verb, part: unique[0], recipe };
  return { label: `${verb} ${unique.length} parts`, recipe };
}

/** Ready-made, validated edits. Each returns a named command for `store.apply`. */
export const projectEdits = {
  renameProject(name: string): ProjectEdit {
    const value = checkName(name, "Project name", false);
    return {
      label: "Rename project",
      recipe: (draft) => {
        draft.name = value;
      },
    };
  },

  addPart(part: Part): ProjectEdit {
    const parsed = partSchema.safeParse(part);
    if (!parsed.success)
      throw new ProjectEditError(`Invalid part: ${parsed.error.issues[0]?.message}`);
    const value = parsed.data;
    return {
      label: `Add ${value.name || value.type}`,
      recipe: (draft) => {
        if (idTaken(draft, value.id)) throw new ProjectEditError(`Part id "${value.id}" is taken`);
        if (draft.parts.length >= MAX_PROJECT_PARTS) {
          throw new ProjectEditError(`A project can have at most ${MAX_PROJECT_PARTS} parts`);
        }
        draft.parts.push(value);
      },
    };
  },

  removePart(id: string): ProjectEdit {
    return {
      label: "Remove",
      part: id,
      recipe: (draft) => {
        const index = draft.parts.findIndex((part) => part.id === id);
        if (index >= 0) draft.parts.splice(index, 1);
      },
    };
  },

  movePart(id: string, x: number, y: number): ProjectEdit {
    checkCoordinate(x, "x");
    checkCoordinate(y, "y");
    return {
      label: "Move",
      part: id,
      recipe: (draft) => {
        const part = findPart(draft, id);
        if (!part) return;
        part.x = x;
        part.y = y;
      },
    };
  },

  rotatePart(id: string, degrees: number): ProjectEdit {
    const rotation = normalizeRotation(degrees);
    return {
      label: "Rotate",
      part: id,
      recipe: (draft) => {
        const part = findPart(draft, id);
        if (part) part.rotation = rotation;
      },
    };
  },

  /** Mirrors one part about its own vertical axis (keeps its position). */
  setPartFlip(id: string, flip: boolean): ProjectEdit {
    return {
      label: flip ? "Flip" : "Unflip",
      part: id,
      recipe: (draft) => {
        const part = findPart(draft, id);
        if (part) part.flip = flip;
      },
    };
  },

  /** Moves several parts by (dx, dy) as one undo step. */
  moveParts(ids: readonly string[], dx: number, dy: number): ProjectEdit {
    checkCoordinate(dx, "dx");
    checkCoordinate(dy, "dy");
    return groupEdit("Move", ids, (parts) => {
      for (const part of parts) {
        part.x = checkCoordinate(part.x + dx, "x");
        part.y = checkCoordinate(part.y + dy, "y");
      }
    });
  },

  /** Deletes several parts as one undo step. */
  removeParts(ids: readonly string[]): ProjectEdit {
    const remove = new Set(ids);
    return {
      ...groupEdit("Delete", ids, () => undefined),
      recipe: (draft) => {
        if (!draft.parts.some((part) => remove.has(part.id))) return;
        draft.parts = draft.parts.filter((part) => !remove.has(part.id));
      },
    };
  },

  /**
   * Rotates parts clockwise by `quarterTurns` × 90° about `center` (default: the centre of their
   * positions, snapped to `grid`), so a group keeps its layout (ADR 008). One part turns in place.
   */
  rotateParts(
    ids: readonly string[],
    quarterTurns: number,
    options: { center?: Point; grid?: number } = {},
  ): ProjectEdit {
    if (!Number.isInteger(quarterTurns)) throw new ProjectEditError("quarter turns must be whole");
    const turns = ((quarterTurns % 4) + 4) % 4;
    return groupEdit("Rotate", ids, (parts) => {
      const c = options.center ?? groupCenter(parts, options.grid);
      for (const part of parts) {
        let dx = part.x - c.x;
        let dy = part.y - c.y;
        // Clockwise on screen (y points down): (dx, dy) → (−dy, dx).
        for (let i = 0; i < turns; i++) [dx, dy] = [-dy, dx];
        part.x = checkCoordinate(c.x + dx, "x");
        part.y = checkCoordinate(c.y + dy, "y");
        part.rotation = normalizeRotation(part.rotation + turns * 90);
      }
    });
  },

  /**
   * Mirrors parts left–right (`"x"`) or top–bottom (`"y"`) about `center` (default as rotateParts).
   * With transform = rotate(r) ∘ mirror(f): mirror-X gives rotate(−r) ∘ mirror(¬f);
   * mirror-Y = rotate(180°) ∘ mirror-X gives rotate(180° − r) ∘ mirror(¬f).
   */
  flipParts(
    ids: readonly string[],
    axis: "x" | "y",
    options: { center?: Point; grid?: number } = {},
  ): ProjectEdit {
    return groupEdit("Flip", ids, (parts) => {
      const c = options.center ?? groupCenter(parts, options.grid);
      for (const part of parts) {
        if (axis === "x") part.x = checkCoordinate(2 * c.x - part.x, "x");
        else part.y = checkCoordinate(2 * c.y - part.y, "y");
        part.flip = !part.flip;
        part.rotation = normalizeRotation(axis === "x" ? -part.rotation : 180 - part.rotation);
      }
    });
  },

  /** Draws a wire (cleaned: no repeats, straight runs merged). Refuses diagonals and off-grid points. */
  addWire(wire: Wire): ProjectEdit {
    const value = checkWire(wire);
    return {
      label: "Draw wire",
      recipe: (draft) => {
        if (idTaken(draft, value.id)) throw new ProjectEditError(`Id "${value.id}" is taken`);
        if (draft.wires.length >= MAX_PROJECT_WIRES) {
          throw new ProjectEditError(`A project can have at most ${MAX_PROJECT_WIRES} wires`);
        }
        draft.wires.push(value);
      },
    };
  },

  /** Replaces a wire's points (rubber-banding, editing corners). */
  setWirePoints(id: string, points: readonly WirePoint[]): ProjectEdit {
    const value = checkWire({ id, points: [...points] });
    return {
      label: "Edit wire",
      recipe: (draft) => {
        const wire = draft.wires.find((w) => w.id === id);
        if (wire) wire.points = value.points;
      },
    };
  },

  addLabel(label: NetLabel): ProjectEdit {
    const parsed = netLabelSchema.safeParse(label);
    if (!parsed.success) {
      throw new ProjectEditError(`Invalid net label: ${parsed.error.issues[0]?.message ?? ""}`);
    }
    const value = parsed.data;
    return {
      label: `Add label ${value.name}`,
      recipe: (draft) => {
        if (idTaken(draft, value.id)) throw new ProjectEditError(`Id "${value.id}" is taken`);
        if (draft.labels.length >= MAX_PROJECT_LABELS) {
          throw new ProjectEditError(`A project can have at most ${MAX_PROJECT_LABELS} labels`);
        }
        draft.labels.push(value);
      },
    };
  },

  /** Turns labels by `quarterTurns` × 90° about their own point (the text follows its wire). */
  rotateLabels(ids: readonly string[], quarterTurns: number): ProjectEdit {
    if (!Number.isInteger(quarterTurns)) throw new ProjectEditError("quarter turns must be whole");
    const turn = new Set(ids);
    return {
      label: countLabel("Rotate", turn.size, "label"),
      recipe: (draft) => {
        for (const label of draft.labels) {
          if (!turn.has(label.id)) continue;
          label.rotation = normalizeRotation(
            label.rotation + quarterTurns * 90,
          ) as NetLabel["rotation"];
        }
      },
    };
  },

  /**
   * Adds parts, wires and labels as one undo step (paste, duplicate). Every item is checked with
   * the project schemas; ids must be free.
   */
  addItems(
    items: {
      readonly parts?: readonly Part[];
      readonly wires?: readonly Wire[];
      readonly labels?: readonly NetLabel[];
    },
    verb = "Paste",
  ): ProjectEdit {
    const parts = (items.parts ?? []).map((part) => {
      const parsed = partSchema.safeParse(part);
      if (!parsed.success)
        throw new ProjectEditError(`Invalid part: ${parsed.error.issues[0]?.message}`);
      return parsed.data;
    });
    const wires = (items.wires ?? []).map(checkWire);
    const labels = (items.labels ?? []).map((label) => {
      const parsed = netLabelSchema.safeParse(label);
      if (!parsed.success)
        throw new ProjectEditError(`Invalid net label: ${parsed.error.issues[0]?.message}`);
      return parsed.data;
    });
    const ids = [...parts, ...wires, ...labels].map((item) => item.id);
    if (new Set(ids).size !== ids.length) throw new ProjectEditError("Duplicate ids");
    return {
      label: countLabel(verb, ids.length),
      recipe: (draft) => {
        for (const id of ids)
          if (idTaken(draft, id)) throw new ProjectEditError(`Id "${id}" is taken`);
        if (
          draft.parts.length + parts.length > MAX_PROJECT_PARTS ||
          draft.wires.length + wires.length > MAX_PROJECT_WIRES ||
          draft.labels.length + labels.length > MAX_PROJECT_LABELS
        ) {
          throw new ProjectEditError("The project would be too big");
        }
        draft.parts.push(...parts);
        draft.wires.push(...wires);
        draft.labels.push(...labels);
      },
    };
  },

  renameLabel(id: string, name: string): ProjectEdit {
    if (!netLabelSchema.shape.name.safeParse(name).success) {
      throw new ProjectEditError("A net name has 1–32 letters, digits or _ + . -");
    }
    return {
      label: `Rename label to ${name}`,
      recipe: (draft) => {
        const label = draft.labels.find((l) => l.id === id);
        if (label) label.name = name;
      },
    };
  },

  /** Deletes parts, wires and labels with these ids as one undo step ("Delete 2 parts": `noun`). */
  removeItems(ids: readonly string[], noun = "item"): ProjectEdit {
    const remove = new Set(ids);
    return {
      label: countLabel("Delete", remove.size, noun),
      recipe: (draft) => {
        const touches =
          draft.parts.some((p) => remove.has(p.id)) ||
          draft.wires.some((w) => remove.has(w.id)) ||
          draft.labels.some((l) => remove.has(l.id));
        if (!touches) return;
        draft.parts = draft.parts.filter((p) => !remove.has(p.id));
        draft.wires = draft.wires.filter((w) => !remove.has(w.id));
        draft.labels = draft.labels.filter((l) => !remove.has(l.id));
      },
    };
  },

  /**
   * Moves parts, wires and labels rigidly by (dx, dy) as one undo step; other wires attached to
   * them stretch (rubber-banding, ADR 009). `noun` names what is counted in the undo label.
   */
  moveItems(ids: readonly string[], dx: number, dy: number, noun = "item"): ProjectEdit {
    if (dx % WIRE_GRID !== 0 || dy % WIRE_GRID !== 0) {
      throw new ProjectEditError(`moves must be whole ${WIRE_GRID}-mil grid steps`);
    }
    checkCoordinate(dx, "dx");
    checkCoordinate(dy, "dy");
    const move = new Set(ids);
    const moveRigidly = (draft: Draft<Project>) => {
      for (const part of draft.parts) {
        if (!move.has(part.id)) continue;
        part.x = checkCoordinate(part.x + dx, "x");
        part.y = checkCoordinate(part.y + dy, "y");
      }
      for (const wire of draft.wires) {
        if (!move.has(wire.id)) continue;
        wire.points = wire.points.map(([x, y]) => [
          checkCoordinate(x + dx, "x"),
          checkCoordinate(y + dy, "y"),
        ]);
      }
      for (const label of draft.labels) {
        if (!move.has(label.id)) continue;
        label.x = checkCoordinate(label.x + dx, "x");
        label.y = checkCoordinate(label.y + dy, "y");
      }
    };
    return {
      label: countLabel("Move", move.size, noun),
      recipe: (draft) => {
        if (dx === 0 && dy === 0) return;
        const movedParts = new Set(draft.parts.filter((p) => move.has(p.id)).map((p) => p.id));
        withRubberBand(draft, movedParts, move, { x: dx, y: dy }, () => moveRigidly(draft));
      },
    };
  },

  renamePart(id: string, name: string): ProjectEdit {
    const value = checkName(name, "Part name", true);
    return {
      label: "Rename",
      part: id,
      recipe: (draft) => {
        const part = findPart(draft, id);
        if (part) part.name = value;
      },
    };
  },

  setPartProp(id: string, key: string, value: PartValue): ProjectEdit {
    if (!propKeySchema.safeParse(key).success)
      throw new ProjectEditError(`Invalid property "${key}"`);
    if (!propValueSchema.safeParse(value).success) {
      throw new ProjectEditError(`Invalid value for "${key}"`);
    }
    return {
      label: `Set ${key} of`,
      part: id,
      recipe: (draft) => {
        const part = findPart(draft, id);
        if (!part) return;
        if (!Object.hasOwn(part.props, key) && Object.keys(part.props).length >= MAX_PART_PROPS) {
          throw new ProjectEditError(`A part can have at most ${MAX_PART_PROPS} properties`);
        }
        part.props[key] = value;
      },
    };
  },

  /** Sets one property on several parts as one undo step ("Set resistance of 3 parts"). */
  setPartsProp(ids: readonly string[], key: string, value: PartValue): ProjectEdit {
    if (!propKeySchema.safeParse(key).success)
      throw new ProjectEditError(`Invalid property "${key}"`);
    if (!propValueSchema.safeParse(value).success) {
      throw new ProjectEditError(`Invalid value for "${key}"`);
    }
    const wanted = new Set(ids);
    if (wanted.size > MAX_PROJECT_PARTS) throw new ProjectEditError("too many parts");
    const recipe = (draft: Draft<Project>) => {
      for (const part of draft.parts) {
        if (!wanted.has(part.id)) continue;
        if (!Object.hasOwn(part.props, key) && Object.keys(part.props).length >= MAX_PART_PROPS) {
          throw new ProjectEditError(`A part can have at most ${MAX_PART_PROPS} properties`);
        }
        part.props[key] = value;
      }
    };
    const [only] = wanted;
    if (wanted.size === 1 && only !== undefined)
      return { label: `Set ${key} of`, part: only, recipe };
    return { label: `Set ${key} of ${wanted.size} parts`, recipe };
  },

  removePartProp(id: string, key: string): ProjectEdit {
    return {
      label: `Remove ${key} of`,
      part: id,
      recipe: (draft) => {
        const part = findPart(draft, id);
        if (part && Object.hasOwn(part.props, key)) delete part.props[key];
      },
    };
  },
};

function fullLabel(edit: ProjectEdit, project: Project): string {
  if (edit.part === undefined) return edit.label;
  const part = project.parts.find((p) => p.id === edit.part);
  return `${edit.label} ${part?.name || part?.type || edit.part}`;
}

export type ProjectStoreState = {
  project: Project;
  history: History;
  /** Runs an edit. Returns false if it changed nothing (then nothing is recorded). */
  apply: (edit: ProjectEdit) => boolean;
  /** Undoes the last edit; returns its label, or null if there was nothing to undo. */
  undo: () => string | null;
  /** Redoes the last undone edit; returns its label, or null. */
  redo: () => string | null;
  /** Replaces the project (open / new) and clears the history. */
  replace: (project: Project) => void;
};

export type ProjectStore = StoreApi<ProjectStoreState>;

export function createProjectStore(
  project: Project,
  options: { historyLimit?: number } = {},
): ProjectStore {
  const limit = options.historyLimit ?? MAX_HISTORY;
  return createStore<ProjectStoreState>()((set, get) => ({
    project,
    history: emptyHistory(),
    apply: (edit) => {
      const state = get();
      const named = { label: fullLabel(edit, state.project), recipe: edit.recipe };
      const result = applyEdit(state.project, state.history, named, limit);
      if (!result.changed) return false;
      set({ project: result.state, history: result.history });
      return true;
    },
    undo: () => {
      const state = get();
      const result = undoHistory(state.project, state.history);
      if (result.label !== null) set({ project: result.state, history: result.history });
      return result.label;
    },
    redo: () => {
      const state = get();
      const result = redoHistory(state.project, state.history);
      if (result.label !== null) set({ project: result.state, history: result.history });
      return result.label;
    },
    replace: (next) => set({ project: next, history: emptyHistory() }),
  }));
}
