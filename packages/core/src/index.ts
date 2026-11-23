export { APP_NAME, APP_VERSION } from "./app";

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
  copyProject,
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
export {
  ARCHIVE_EXTENSION,
  ARCHIVE_FORMAT,
  ARCHIVE_MIME_TYPE,
  ARCHIVE_VERSION,
  MAX_ARCHIVE_BYTES,
  MAX_ARCHIVE_ENTRIES,
  MAX_ARCHIVE_TOTAL_BYTES,
  MAX_ENTRY_BYTES,
  archiveFileName,
  readArchive,
  writeArchive,
} from "./archive";
export type { ArchiveReadResult, ArchiveRejection } from "./archive";
export {
  MAX_SHARE_PROJECT_CHARS,
  MAX_SHARE_TOKEN_CHARS,
  SHARE_HASH_KEY,
  createShareToken,
  fromBase64Url,
  readShareToken,
  shareTokenFromHash,
  shareUrl,
  toBase64Url,
} from "./share";
export type { ShareTokenResult } from "./share";
export {
  DEFAULT_MAX_STEPS_PER_FRAME,
  DEFAULT_STEP_SECONDS,
  MAX_MANUAL_STEPS,
  MAX_RATE,
  MIN_RATE,
  RATE_PRESETS,
  SchedulerError,
  createScheduler,
} from "./sim/scheduler";
export type {
  Scheduler,
  SchedulerOptions,
  SchedulerSnapshot,
  SimState,
  StepFunction,
} from "./sim/scheduler";
export {
  MAX_SIGNALS,
  MAX_SIGNAL_NAME_CHARS,
  SignalBusError,
  createSignalBus,
} from "./sim/signal-bus";
export type {
  BooleanSignal,
  NumberSignal,
  SignalBus,
  SignalDefinition,
  SignalValue,
} from "./sim/signal-bus";
export { createSimulation } from "./sim/simulation";
export type { SimModel, Simulation, SimulationSnapshot } from "./sim/simulation";
export { DEMO_SIGNALS, createDemoModels } from "./sim/demo-models";
export type { DemoOptions } from "./sim/demo-models";
