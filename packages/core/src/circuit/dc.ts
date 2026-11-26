/**
 * DC operating point (ADR 011 §2, ADR 012): netlist → beginner checks → devices → stamps →
 * sparse LU → checked solve → results.
 *
 * Pure and synchronous, so the same code runs in unit tests, the analysis worker and CI examples.
 * It never throws for a circuit the user drew: every problem becomes a plain-word `CircuitIssue`
 * naming the parts involved, and every number in the result is finite. Parts with no DC path to
 * ground are left out of the results (a warning), so a half-drawn circuit still shows the values
 * of everything already connected.
 */
import type { Device, Readout } from "./component";
import { createDevice, numberProp, resolveProps } from "./component";
import { formatQuantity } from "./quantities";
import {
  canSimulate,
  checkCircuit,
  floatingNodes,
  solverIssues,
  sortIssues,
  type CircuitIssue,
  type DefinitionLookup,
} from "./issues";
import { SingularMatrixError } from "./lu";
import { MnaStampError, createSolution } from "./mna";
import {
  NetlistError,
  buildNetlist,
  type CircuitInput,
  type Netlist,
  type PinRef,
} from "./netlist";
import { createSparseMna, factorSparse, solveChecked } from "./sparse";

/** Largest circuit solved (unknowns = nodes − 1 + branches). Well under the 2 s worker limit. */
export const MAX_UNKNOWNS = 50_000;

/** Conductance (S) tying a floating node to ground so the matrix stays regular (SPICE's GMIN). */
export const FLOATING_GMIN = 1e-12;

/** More current than a bench supply or battery gives (A): reported as a short circuit. */
export const SHORT_CIRCUIT_CURRENT = 10;

/** Voltage of one net (nets with no DC path to ground are not listed). */
export interface DcNet {
  readonly node: number;
  readonly name: string;
  readonly voltage: number;
  readonly pins: readonly PinRef[];
}

/** One part's results (from its device `report`). */
export interface DcPart {
  readonly id: string;
  readonly designator: string;
  readonly type: string;
  /** Not connected to ground: no values (`readouts` is empty). */
  readonly floating: boolean;
  readonly readouts: readonly Readout[];
}

/** Plain data (crosses the worker boundary as is). */
export type DcResult =
  | {
      readonly ok: true;
      readonly nets: readonly DcNet[];
      readonly parts: readonly DcPart[];
      /** Warnings and tips that did not stop the solve (unconnected pins, over-rating…). */
      readonly issues: readonly CircuitIssue[];
    }
  | { readonly ok: false; readonly issues: readonly CircuitIssue[] };

type Placed = { id: string; designator: string; type: string; device: Device };

/** The plain-word singular-matrix issue for the unknown the solver could not determine. */
function singularIssue(
  netlist: Netlist,
  unknown: number,
  branchOwner: readonly string[],
  devices: readonly Placed[],
): CircuitIssue {
  const nameOf = (id: string) => devices.find((d) => d.id === id)?.designator ?? id;
  const nodeCount = netlist.nets.length;
  if (unknown < nodeCount - 1) {
    const net = netlist.nets.find((n) => n.node === unknown + 1);
    const parts = [...new Set((net?.pins ?? []).map((p) => p.part))].sort();
    const names = [...new Set(parts.map(nameOf))].sort();
    return solverIssues.singularMatrix(parts, {
      kind: "voltage",
      names,
      nets: net ? [net.node] : [],
    });
  }
  const owner = branchOwner[unknown - (nodeCount - 1)];
  return owner
    ? solverIssues.singularMatrix([owner], { kind: "current", names: [nameOf(owner)] })
    : solverIssues.singularMatrix();
}

const currentOf = (part: DcPart) =>
  Math.abs(part.readouts.find((r) => r.key === "current")?.value ?? 0);

/** Solves the DC operating point of a netlist. */
export function solveDc(netlist: Netlist, lookup: DefinitionLookup): DcResult {
  const checked = checkCircuit(netlist, lookup);
  if (!canSimulate(checked)) return { ok: false, issues: checked };

  // Devices, with branches and state slots handed out in netlist order.
  const devices: Placed[] = [];
  const branchOwner: string[] = [];
  let stateOffset = 0;
  for (const component of netlist.components) {
    const definition = lookup(component.type);
    if (!definition) {
      return {
        ok: false,
        issues: [solverIssues.modelError(`unknown part type "${component.type}"`, [component.id])],
      };
    }
    const created = createDevice(definition, component, branchOwner.length, stateOffset);
    if (!created.ok) {
      // checkCircuit reports invalid values first; this is only a safety net.
      return {
        ok: false,
        issues: [
          solverIssues.modelError(`${component.designator} has invalid values`, [component.id]),
        ],
      };
    }
    for (let k = 0; k < definition.branches; k++) branchOwner.push(component.id);
    stateOffset += definition.stateSize;
    devices.push({
      id: component.id,
      designator: component.designator,
      type: component.type,
      device: created.device,
    });
  }

  const nodeCount = netlist.nets.length;
  const unknowns = nodeCount - 1 + branchOwner.length;
  if (unknowns > MAX_UNKNOWNS) {
    return { ok: false, issues: [solverIssues.tooLarge(unknowns, MAX_UNKNOWNS)] };
  }

  const floating = new Set(floatingNodes(netlist, lookup));
  let x: Float64Array;
  let accurate = true;
  try {
    const mna = createSparseMna(nodeCount, branchOwner.length);
    for (const { device } of devices) device.stamp(mna.context);
    for (const node of floating) mna.context.conductance(node, 0, FLOATING_GMIN);
    const matrix = mna.matrix();
    ({ x, accurate } = solveChecked(matrix, factorSparse(matrix), mna.rhs));
  } catch (error) {
    if (error instanceof SingularMatrixError) {
      return {
        ok: false,
        // The warnings found so far often point at the cause ("R2 is short-circuited").
        issues: sortIssues([
          singularIssue(netlist, error.unknown, branchOwner, devices),
          ...checked,
        ]),
      };
    }
    if (error instanceof MnaStampError) {
      return { ok: false, issues: [solverIssues.modelError(error.message)] };
    }
    throw error;
  }

  const solution = createSolution(x, nodeCount, branchOwner.length);
  const nets: DcNet[] = netlist.nets
    .filter((net) => !floating.has(net.node))
    .map((net) => ({
      node: net.node,
      name: net.name,
      voltage: solution.voltage(net.node) + 0, // + 0 turns −0 into 0
      pins: net.pins,
    }));
  const componentById = new Map(netlist.components.map((c) => [c.id, c]));
  const parts: DcPart[] = devices.map(({ id, designator, type, device }) => {
    const isFloating = componentById.get(id)?.pins.some((p) => floating.has(p.node)) ?? false;
    return {
      id,
      designator,
      type,
      floating: isFloating,
      readouts: isFloating
        ? []
        : device.report(solution).map((r) => ({ ...r, value: r.value + 0 })),
    };
  });
  for (const part of parts) {
    if (part.readouts.some((r) => !Number.isFinite(r.value))) {
      return { ok: false, issues: [solverIssues.singularMatrix([part.id])] };
    }
  }

  const found: CircuitIssue[] = [];
  if (!accurate) found.push(solverIssues.lowAccuracy());

  // Short circuits: more current than any real supply gives. Current sources set their own current.
  const isVoltageSource = (part: DcPart) => (lookup(part.type)?.voltagePairs ?? []).length > 0;
  const isCurrentSource = (part: DcPart) => {
    const definition = lookup(part.type);
    return definition?.category === "source" && !isVoltageSource(part);
  };
  const strong = parts.filter((p) => currentOf(p) > SHORT_CIRCUIT_CURRENT && !isCurrentSource(p));
  if (strong.length > 0) {
    const named = (list: DcPart[]) =>
      list
        .map((p) => ({ name: p.designator, id: p.id }))
        .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
    found.push(
      solverIssues.shortCircuit(
        named(strong.filter(isVoltageSource)),
        named(strong.filter((p) => !isVoltageSource(p))),
        Math.max(...strong.map(currentOf)),
      ),
    );
  }

  // Ratings: a part reporting power above its "powerRating" property gets a warning.
  for (const part of parts) {
    const component = componentById.get(part.id);
    const definition = lookup(part.type);
    if (!component || !definition?.properties.some((p) => p.key === "powerRating")) continue;
    const resolved = resolveProps(definition, component.props);
    if (!resolved.ok) continue;
    const rating = numberProp(resolved.props, "powerRating");
    const power = Math.abs(part.readouts.find((r) => r.key === "power")?.value ?? 0);
    if (power > rating) {
      found.push(
        solverIssues.overLimit(
          part.designator,
          `${formatQuantity(power, "power")} of ${formatQuantity(rating, "power")}`,
          part.id,
        ),
      );
    }
  }

  return { ok: true, nets, parts, issues: sortIssues([...checked, ...found]) };
}

/** DC operating point straight from the drawing (`connectivityOf(project).input`). */
export function solveCircuitDc(input: CircuitInput, lookup: DefinitionLookup): DcResult {
  let netlist: Netlist;
  try {
    netlist = buildNetlist(input);
  } catch (error) {
    if (error instanceof NetlistError) {
      return { ok: false, issues: [solverIssues.modelError(error.message)] };
    }
    throw error;
  }
  return solveDc(netlist, lookup);
}
