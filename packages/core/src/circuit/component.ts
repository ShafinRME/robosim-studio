/**
 * Component interface (ADR 007 §2): a part = a static **definition** + a **device** per instance.
 *
 * The definition is data the UI, solver, ERC and exports all read (pins, properties, designator
 * prefix). `create()` turns one placed part into a device that adds its stamp to the MNA system.
 * Devices are pure: no I/O, no hidden mutable state — history lives in the circuit's shared state
 * array at `stateOffset`, so a snapshot is a copy of one Float64Array.
 */
import type { MnaContext, Solution } from "./mna";
import type { NetlistComponent } from "./netlist";
import { QUANTITIES, type Quantity } from "./quantities";

/** Pin electrical types for the electrical rules check, as in professional EDA tools (ADR 007 §5). */
export const PIN_TYPES = [
  "passive",
  "input",
  "output",
  "bidirectional",
  "power-in",
  "power-out",
  "open-collector",
  "not-connected",
] as const;
export type PinType = (typeof PIN_TYPES)[number];

export const PART_CATEGORIES = [
  "passive",
  "source",
  "semiconductor",
  "ic",
  "power",
  "input",
  "output",
  "electromechanical",
  "instrument",
  "connector",
] as const;
export type PartCategory = (typeof PART_CATEGORIES)[number];

export interface PinDefinition {
  /** Stable id used in wires and the netlist: "1", "anode", "+". */
  readonly id: string;
  /** Shown in tooltips: "Anode", "Pin 1". */
  readonly name: string;
  readonly type: PinType;
}

export interface NumberProperty {
  readonly kind: "number";
  readonly key: string;
  readonly label: string;
  readonly quantity: Quantity;
  /** In SI base units (percent as a fraction). */
  readonly default: number;
  readonly min?: number;
  readonly max?: number;
  /** When true the value must be strictly greater than `min` (resistance > 0 Ω). */
  readonly exclusiveMin?: boolean;
}
export interface ChoiceProperty {
  readonly kind: "choice";
  readonly key: string;
  readonly label: string;
  readonly options: readonly string[];
  readonly default: string;
}
export interface BooleanProperty {
  readonly kind: "boolean";
  readonly key: string;
  readonly label: string;
  readonly default: boolean;
}
export type PropertyDefinition = NumberProperty | ChoiceProperty | BooleanProperty;

export type PropValue = number | string | boolean;
export type ResolvedProps = Readonly<Record<string, PropValue>>;

export type IntegrationMethod = "be" | "trap";

/** A value shown by instruments and the inspector (always SI, always finite). */
export interface Readout {
  readonly key: string;
  readonly label: string;
  readonly quantity: Quantity;
  readonly value: number;
}

export interface Device {
  /** Linear, time-independent part of the stamp (resistors, ideal sources). */
  stamp(ctx: MnaContext): void;
  /** Re-stamped every Newton–Raphson iteration from the present guess (Day 17). */
  stampNonlinear?(ctx: MnaContext, guess: Solution): void;
  /** Companion model for one time step of `dt` seconds (Day 18). `state` is the whole circuit's. */
  stampTransient?(
    ctx: MnaContext,
    state: Float64Array,
    dt: number,
    method: IntegrationMethod,
  ): void;
  /** A step was accepted: update this device's state slots from the solution. */
  accept?(solution: Solution, state: Float64Array): void;
  /** Voltages, currents, power… for instruments and the inspector. */
  report(solution: Solution): readonly Readout[];
}

export interface DeviceSetup {
  readonly props: ResolvedProps;
  /** Node of each pin, in definition order. */
  readonly nodes: readonly number[];
  /** Global branch index of each of this device's branches. */
  readonly branches: readonly number[];
  /** Index of this device's first slot in the circuit state array. */
  readonly stateOffset: number;
}

export interface ComponentDefinition {
  /** Part type as stored in projects: "resistor", "source.dc-voltage". */
  readonly type: string;
  readonly name: string;
  readonly category: PartCategory;
  /** Reference designator prefix: R, C, L, D, Q, U, V, I, SW… */
  readonly designatorPrefix: string;
  readonly pins: readonly PinDefinition[];
  readonly properties: readonly PropertyDefinition[];
  /** Extra current unknowns this part needs (V source = 1). */
  readonly branches: number;
  /** State slots this part keeps between time steps. */
  readonly stateSize: number;
  create(setup: DeviceSetup): Device;
}

// ─── Checks ──────────────────────────────────────────────────────────────────────────────────────

const TYPE_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const PIN_ID_PATTERN = /^[A-Za-z0-9+_-]{1,32}$/;
const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const PREFIX_PATTERN = /^[A-Z]{1,3}$/;
const RESERVED_KEYS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

/** Finds mistakes in a part definition (used by tests and the parts registry). Empty = valid. */
export function checkDefinition(definition: ComponentDefinition): string[] {
  const problems: string[] = [];
  const where = `"${definition.type}"`;
  if (definition.type.length > 64 || !TYPE_PATTERN.test(definition.type))
    problems.push(`${where}: invalid type`);
  if (!PREFIX_PATTERN.test(definition.designatorPrefix)) {
    problems.push(`${where}: designator prefix must be 1–3 capital letters`);
  }
  if (!PART_CATEGORIES.includes(definition.category)) problems.push(`${where}: unknown category`);
  if (definition.pins.length === 0) problems.push(`${where}: needs at least one pin`);
  const pinIds = new Set<string>();
  for (const pin of definition.pins) {
    if (!PIN_ID_PATTERN.test(pin.id)) problems.push(`${where}: invalid pin id "${pin.id}"`);
    if (pinIds.has(pin.id)) problems.push(`${where}: duplicate pin "${pin.id}"`);
    if (!PIN_TYPES.includes(pin.type))
      problems.push(`${where}: pin "${pin.id}" has an unknown type`);
    pinIds.add(pin.id);
  }
  const keys = new Set<string>();
  for (const property of definition.properties) {
    if (!KEY_PATTERN.test(property.key) || RESERVED_KEYS.has(property.key)) {
      problems.push(`${where}: invalid property key "${property.key}"`);
    }
    if (keys.has(property.key)) problems.push(`${where}: duplicate property "${property.key}"`);
    keys.add(property.key);
    const fault = checkValue(property, property.default);
    if (fault) problems.push(`${where}: default of "${property.key}" ${fault}`);
    if (property.kind === "number" && !(property.quantity in QUANTITIES)) {
      problems.push(`${where}: "${property.key}" has an unknown quantity`);
    }
  }
  for (const [name, count] of [
    ["branches", definition.branches],
    ["stateSize", definition.stateSize],
  ] as const) {
    if (!Number.isInteger(count) || count < 0 || count > 64)
      problems.push(`${where}: invalid ${name}`);
  }
  return problems;
}

export type PropProblem = {
  key: string;
  reason: "wrong-type" | "not-finite" | "too-small" | "too-large" | "not-an-option";
};

function checkValue(property: PropertyDefinition, value: PropValue): PropProblem["reason"] | null {
  switch (property.kind) {
    case "number": {
      if (typeof value !== "number") return "wrong-type";
      if (!Number.isFinite(value)) return "not-finite";
      if (property.min !== undefined) {
        if (property.exclusiveMin ? value <= property.min : value < property.min)
          return "too-small";
      }
      if (property.max !== undefined && value > property.max) return "too-large";
      return null;
    }
    case "choice":
      if (typeof value !== "string") return "wrong-type";
      return property.options.includes(value) ? null : "not-an-option";
    case "boolean":
      return typeof value === "boolean" ? null : "wrong-type";
  }
}

/**
 * Fills defaults for missing properties and checks the rest. Unknown keys are ignored (kept in the
 * project for forward compatibility, never passed to the device). Problems become the beginner
 * issue `invalid-value` (Step 6).
 */
export function resolveProps(
  definition: ComponentDefinition,
  props: Readonly<Record<string, PropValue>>,
): { ok: true; props: ResolvedProps } | { ok: false; problems: PropProblem[] } {
  const resolved: Record<string, PropValue> = {};
  const problems: PropProblem[] = [];
  for (const property of definition.properties) {
    const value = Object.hasOwn(props, property.key) ? props[property.key] : undefined;
    if (value === undefined) {
      resolved[property.key] = property.default;
      continue;
    }
    const reason = checkValue(property, value);
    if (reason) problems.push({ key: property.key, reason });
    else resolved[property.key] = value;
  }
  return problems.length ? { ok: false, problems } : { ok: true, props: resolved };
}

/** Reads a number property the device declared (a missing one is a bug in the part file). */
export function numberProp(props: ResolvedProps, key: string): number {
  const value = props[key];
  if (typeof value !== "number") throw new Error(`property "${key}" is not a number`);
  return value;
}

/**
 * Creates the device of one netlist component. `firstBranch` / `stateOffset` are handed out by the
 * solver as it walks the components in netlist order.
 */
export function createDevice(
  definition: ComponentDefinition,
  component: NetlistComponent,
  firstBranch: number,
  stateOffset: number,
): { ok: true; device: Device } | { ok: false; problems: PropProblem[] } {
  if (component.type !== definition.type) {
    throw new Error(`component "${component.id}" is a ${component.type}, not a ${definition.type}`);
  }
  const ids = component.pins.map((pin) => pin.id);
  const expected = definition.pins.map((pin) => pin.id);
  if (ids.length !== expected.length || ids.some((id, i) => id !== expected[i])) {
    throw new Error(
      `component "${component.id}" pins [${ids.join(", ")}] ≠ [${expected.join(", ")}]`,
    );
  }
  const resolved = resolveProps(definition, component.props);
  if (!resolved.ok) return resolved;
  const device = definition.create({
    props: resolved.props,
    nodes: component.pins.map((pin) => pin.node),
    branches: Array.from({ length: definition.branches }, (_, i) => firstBranch + i),
    stateOffset,
  });
  return { ok: true, device };
}
