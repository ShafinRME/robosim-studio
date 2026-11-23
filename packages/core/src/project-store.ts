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
