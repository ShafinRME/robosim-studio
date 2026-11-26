/**
 * DC operating point (ADR 011 §2): netlist → beginner checks → devices → stamps → LU → results.
 *
 * Pure and synchronous, so the same code runs in unit tests, the analysis worker and CI examples.
 * It never throws for a circuit the user drew: every problem becomes a plain-word `CircuitIssue`
 * naming the parts involved, and every number in the result is finite.
 */
import type { Device, Readout } from "./component";
import { createDevice, numberProp, resolveProps } from "./component";
import { formatQuantity } from "./quantities";
import {
  canSimulate,
  checkCircuit,
  listNames,
  solverIssues,
  sortIssues,
  type CircuitIssue,
  type DefinitionLookup,
} from "./issues";
import { SingularMatrixError, factorLu } from "./lu";
import { MAX_DENSE_UNKNOWNS, MnaStampError, createDenseMna, createSolution } from "./mna";
import {
  NetlistError,
  buildNetlist,
  type CircuitInput,
  type Netlist,
  type PinRef,
} from "./netlist";

/** Voltage of one net. */
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

/** Ids of the parts touching the unknown the solver could not determine. */
function partsOfUnknown(
  netlist: Netlist,
  unknown: number,
  branchOwner: readonly string[],
): string[] {
  const nodeCount = netlist.nets.length;
  if (unknown < nodeCount - 1) {
    const net = netlist.nets.find((n) => n.node === unknown + 1);
    return [...new Set((net?.pins ?? []).map((p) => p.part))];
  }
  const owner = branchOwner[unknown - (nodeCount - 1)];
  return owner ? [owner] : [];
}

/** Solves the DC operating point of a netlist. */
export function solveDc(netlist: Netlist, lookup: DefinitionLookup): DcResult {
  const checked = checkCircuit(netlist, lookup);
  if (!canSimulate(checked)) return { ok: false, issues: checked };

  // Devices, with branches and state slots handed out in netlist order.
  const devices: { id: string; designator: string; type: string; device: Device }[] = [];
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
  if (unknowns > MAX_DENSE_UNKNOWNS) {
    return { ok: false, issues: [solverIssues.tooLarge(unknowns, MAX_DENSE_UNKNOWNS)] };
  }

  let x: Float64Array;
  try {
    const mna = createDenseMna(nodeCount, branchOwner.length);
    for (const { device } of devices) device.stamp(mna.context);
    x = factorLu(mna.matrix, mna.size).solve(mna.rhs);
  } catch (error) {
    if (error instanceof SingularMatrixError) {
      const parts = partsOfUnknown(netlist, error.unknown, branchOwner);
      const names = parts.map((id) => devices.find((d) => d.id === id)?.designator ?? id);
      const issue = solverIssues.singularMatrix(parts);
      return {
        ok: false,
        issues: [
          names.length
            ? {
                ...issue,
                message: `The circuit around ${listNames(names)} cannot be solved as drawn.`,
              }
            : issue,
        ],
      };
    }
    if (error instanceof MnaStampError) {
      return { ok: false, issues: [solverIssues.modelError(error.message)] };
    }
    throw error;
  }

  const solution = createSolution(x, nodeCount, branchOwner.length);
  const nets: DcNet[] = netlist.nets.map((net) => ({
    node: net.node,
    name: net.name,
    voltage: solution.voltage(net.node) + 0, // + 0 turns −0 into 0
    pins: net.pins,
  }));
  const parts: DcPart[] = devices.map(({ id, designator, type, device }) => ({
    id,
    designator,
    type,
    readouts: device.report(solution).map((r) => ({ ...r, value: r.value + 0 })),
  }));
  for (const part of parts) {
    if (part.readouts.some((r) => !Number.isFinite(r.value))) {
      return { ok: false, issues: [solverIssues.singularMatrix([part.id])] };
    }
  }

  // Ratings: a part reporting power above its "powerRating" property gets a warning.
  const ratings: CircuitIssue[] = [];
  for (const part of parts) {
    const component = netlist.components.find((c) => c.id === part.id);
    const definition = lookup(part.type);
    if (!component || !definition?.properties.some((p) => p.key === "powerRating")) continue;
    const resolved = resolveProps(definition, component.props);
    if (!resolved.ok) continue;
    const rating = numberProp(resolved.props, "powerRating");
    const power = Math.abs(part.readouts.find((r) => r.key === "power")?.value ?? 0);
    if (power > rating) {
      ratings.push(
        solverIssues.overLimit(
          part.designator,
          `${formatQuantity(power, "power")} of ${formatQuantity(rating, "power")}`,
          part.id,
        ),
      );
    }
  }

  return { ok: true, nets, parts, issues: sortIssues([...checked, ...ratings]) };
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
