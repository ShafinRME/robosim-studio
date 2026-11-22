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
