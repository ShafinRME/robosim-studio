export { APP_NAME, APP_VERSION } from "./app";

export { LABS } from "./labs";
export type { LabId, LabInfo } from "./labs";
export { clampStep, formatSI, parseRKM, parseSI } from "./units";
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
  MAX_PROJECT_LABELS,
  MAX_PROJECT_WIRES,
  MAX_WIRE_POINTS,
  WIRE_GRID,
  netLabelSchema,
  wireSchema,
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
  NetLabel,
  Part,
  Wire,
  WirePoint,
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
export {
  LOW_END_MAX_CORES,
  LOW_END_MAX_MEMORY_GB,
  assessCapabilities,
  describeLowEndReason,
  isMaskedRenderer,
  isSoftwareRenderer,
  performanceProfile,
} from "./capabilities";
export type {
  CapabilityHints,
  CapabilityReport,
  LowEndReason,
  PerformanceProfile,
} from "./capabilities";
export {
  GROUND_NET_NAME,
  GROUND_NODE,
  GROUND_PART_TYPE,
  MAX_CONNECTIONS,
  MAX_NETLIST_NODES,
  MAX_NETLIST_PARTS,
  MAX_NET_LABELS,
  MAX_PART_PINS,
  NetlistError,
  buildNetlist,
  circuitInputSchema,
  netlistSchema,
  parseNetlist,
} from "./circuit/netlist";
export type {
  CircuitInput,
  CircuitPart,
  Net,
  Netlist,
  NetlistComponent,
  PinRef,
} from "./circuit/netlist";
export {
  GROUND_UNKNOWN,
  MAX_DENSE_UNKNOWNS,
  MnaStampError,
  createDenseMna,
  createSolution,
} from "./circuit/mna";
export type { DenseMna, MnaContext, Solution, Unknown } from "./circuit/mna";
export {
  PART_CATEGORIES,
  PIN_TYPES,
  checkDefinition,
  createDevice,
  numberProp,
  resolveProps,
} from "./circuit/component";
export type {
  BooleanProperty,
  ChoiceProperty,
  ComponentDefinition,
  Device,
  DeviceSetup,
  IntegrationMethod,
  NumberProperty,
  PartCategory,
  PinDefinition,
  PinType,
  PropProblem,
  PropValue,
  PropertyDefinition,
  Readout,
  ResolvedProps,
} from "./circuit/component";
export { QUANTITIES, unitOf } from "./circuit/quantities";
export type { Quantity } from "./circuit/quantities";
export {
  COMPONENTS,
  PARTS,
  componentFor,
  partFor,
  requireComponent,
  requirePart,
} from "./parts/registry";
export { checkPart, definePart } from "./parts/part";
export type { PartDefinition, PartModel, PartSpec } from "./parts/part";
export { dcPathsOf } from "./circuit/component";
export { formatQuantity, parseQuantity } from "./circuit/quantities";
export type { QuantityParseResult, QuantityRange } from "./circuit/quantities";
export {
  ISSUE_CODES,
  ISSUE_SEVERITY,
  MAX_REPORTED_ISSUES,
  canSimulate,
  checkCircuit,
  listNames,
  solverIssues,
  sortIssues,
} from "./circuit/issues";
export type { CircuitIssue, DefinitionLookup, IssueCode, IssueSeverity } from "./circuit/issues";
export {
  DEFAULT_ZOOM,
  FINE_GRID,
  MAX_ZOOM,
  MILS_PER_INCH,
  MIN_ZOOM,
  MM_PER_MIL,
  PX_PER_MIL,
  SCHEMATIC_GRID,
  ZOOM_STEPS,
  centerOn,
  clampZoom,
  fitBounds,
  formatLength,
  gridLevel,
  panBy,
  scaleOf,
  snapToGrid,
  stepZoom,
  toScreen,
  toWorld,
  unionRects,
  visibleRect,
  wheelZoom,
  zoomTo,
} from "./schematic/viewport";
export type { LengthUnit, Point, Rect, Size, Viewport } from "./schematic/viewport";
export {
  SYMBOLS,
  bodyFor,
  SYMBOL_STYLES,
  designatorPrefix,
  nextDesignator,
  placeLabel,
  placeLabels,
  placePoint,
  placedBounds,
  placedPins,
  placementTransform,
  symbolFor,
} from "./schematic/symbols";
export type {
  PlacedLabel,
  Placement,
  Primitive,
  SymbolDefinition,
  SymbolPin,
  SymbolState,
  SymbolStyle,
} from "./schematic/symbols";
export { DEFAULT_GRID } from "./project-store";
export {
  UNKNOWN_PART_HALF,
  boxModeOf,
  createPart,
  hitTest,
  LABEL_GAP,
  LABEL_TEXT_SIZE,
  hitTestLabel,
  hitTestWire,
  labelBounds,
  labelsInRect,
  partBounds,
  partsInRect,
  rectFromPoints,
  wiresInRect,
} from "./schematic/selection";
export type { BoxMode } from "./schematic/selection";
export { isOrthogonal, onSegment, routeL, segmentAt, simplifyWire } from "./schematic/wires";
export type { Posture } from "./schematic/wires";
export { connectivityOf, netNameOf, pinKey, placedPinsOf } from "./schematic/connectivity";
export type { Connectivity, PlacedPin } from "./schematic/connectivity";
export { rubberBandWire } from "./schematic/rubber-band";
export type { PointMover } from "./schematic/rubber-band";
export {
  CLIPBOARD_FORMAT,
  MAX_CLIPBOARD_CHARS,
  clipboardSchema,
  copyItems,
  parseClipboard,
  preparePaste,
  serializeClipboard,
} from "./schematic/clipboard";
export type { SchematicClipboard } from "./schematic/clipboard";
export { CATEGORY_LABELS, groupParts, searchParts } from "./parts/catalog";
export type { PartGroup, PartMatch } from "./parts/catalog";
export { PIVOT_TOLERANCE, SingularMatrixError, factorLu } from "./circuit/lu";
export type { LuFactors } from "./circuit/lu";
