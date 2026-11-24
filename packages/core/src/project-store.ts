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
  MAX_PROJECT_PARTS,
  coordinateSchema,
  partSchema,
  propKeySchema,
  propValueSchema,
  type Part,
  type PartValue,
  type Project,
} from "./project";

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
    if (parts.length) change(parts);
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
        if (findPart(draft, value.id)) throw new ProjectEditError(`Part id "${value.id}" is taken`);
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
