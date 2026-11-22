export const APP_NAME = "RoboSim Studio";
export const APP_VERSION = "0.0.0";

export { LABS } from "./labs";
export type { LabId, LabInfo } from "./labs";
export { clampStep, formatSI, parseSI } from "./units";
export {
  LAYOUT_STORAGE_KEY,
  LAYOUT_VERSION,
  MAX_LAYOUT_CHARS,
  MAX_LAYOUT_PANELS,
  checkLayout,
  parseSavedLayout,
  serializeLayout,
} from "./layout";
export type {
  DockLayout,
  LayoutFloatingGroup,
  LayoutGridNode,
  LayoutGroup,
  LayoutPanel,
  LayoutParseResult,
  LayoutRejection,
  SavedLayout,
} from "./layout";
export {
  MAX_PROJECT_TABS,
  activateProjectTab,
  closeProjectTab,
  cycleProjectTab,
  emptyProjectTabs,
  nextUntitledName,
  openProjectTab,
  renameProjectTab,
} from "./project-tabs";
export type { ProjectTab, ProjectTabsState } from "./project-tabs";
export {
  LOW_END_MAX_CORES,
  LOW_END_MAX_MEMORY_GB,
  MAX_STATUS_MESSAGES,
  appendMessage,
  detectLowEnd,
  formatClock,
  resolveLowEnd,
} from "./status";
export type { DeviceHints, MessageLevel, StatusMessage } from "./status";
export {
  createCommandRegistry,
  fuzzyMatch,
  isCommandEnabled,
  rememberRecent,
  searchCommands,
} from "./commands";
export type { Command, CommandRegistry, CommandResult, FuzzyMatch } from "./commands";
export {
  RESERVED_SHORTCUTS,
  checkShortcuts,
  createShortcutMap,
  detectPlatform,
  formatShortcut,
  isReservedShortcut,
  matchesShortcut,
  parseShortcut,
  shortcutId,
} from "./shortcuts";
export type {
  KeyInput,
  Platform,
  Shortcut,
  ShortcutBindings,
  ShortcutMap,
  ShortcutProblem,
} from "./shortcuts";
export {
  MAX_COORDINATE,
  MAX_NAME_CHARS,
  MAX_PART_PROPS,
  MAX_PROJECT_CHARS,
  MAX_PROJECT_PARTS,
  PROJECT_FORMAT,
  PROJECT_MIGRATIONS,
  PROJECT_VERSION,
  createProject,
  loadProject,
  migrateProjectData,
  newId,
  parseProject,
  partSchema,
  projectSchema,
  serializeProject,
} from "./project";
export type {
  MigrationResult,
  Part,
  PartValue,
  Project,
  ProjectLoadResult,
  ProjectMigration,
  ProjectRejection,
} from "./project";
export { MAX_HISTORY, applyEdit, emptyHistory, redo, redoLabel, undo, undoLabel } from "./history";
export type { Edit, EditResult, History, HistoryEntry, StepResult } from "./history";
export {
  ProjectEditError,
  createProjectStore,
  normalizeRotation,
  projectEdits,
} from "./project-store";
export type { ProjectEdit, ProjectStore, ProjectStoreState } from "./project-store";
