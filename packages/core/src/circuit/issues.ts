/**
 * Beginner error model (ADR 007 §4).
 *
 * A learner never sees NaN or a "singular matrix": cheap graph checks run on the netlist before
 * solving and explain the usual mistakes in plain words, naming the parts by their designators
 * ("Pin 2 of R1 is not connected to anything."). Each issue also carries the parts, pins and nets
 * involved, so the canvas can highlight them. All wording lives in this file (one place to review
 * and, later, translate).
 */
import {
  dcPathsOf,
  resolveProps,
  type ComponentDefinition,
  type PinDefinition,
  type PropProblem,
} from "./component";
import { GROUND_NODE, type Netlist, type NetlistComponent, type PinRef } from "./netlist";
import { QUANTITIES, formatQuantity } from "./quantities";

export const ISSUE_CODES = [
  "no-ground",
  "voltage-source-loop",
  "current-source-cutset",
  "floating-node",
  "invalid-value",
  "singular-matrix",
  "no-convergence",
  "model-error",
  "unconnected-pin",
  "duplicate-designator",
  "over-limit",
  "erc-conflict",
  "empty-circuit",
  "too-large",
] as const;
export type IssueCode = (typeof ISSUE_CODES)[number];
export type IssueSeverity = "error" | "warning" | "info";

/** `error` stops the simulation, `warning` simulates but flags, `info` is a tip. */
export const ISSUE_SEVERITY: Readonly<Record<IssueCode, IssueSeverity>> = {
  "no-ground": "error",
  "voltage-source-loop": "error",
  "current-source-cutset": "error",
  "floating-node": "error",
  "invalid-value": "error",
  "singular-matrix": "error",
  "no-convergence": "error",
  "model-error": "error",
  "unconnected-pin": "warning",
  "duplicate-designator": "warning",
  "over-limit": "warning",
  "erc-conflict": "warning",
  "empty-circuit": "info",
  "too-large": "error",
};

export interface CircuitIssue {
  readonly code: IssueCode;
  readonly severity: IssueSeverity;
  /** Plain words, one sentence, names parts by designator. */
  readonly message: string;
  /** What to do about it. */
  readonly hint?: string;
  /** Part ids involved (for highlighting). */
  readonly parts: readonly string[];
  readonly pins: readonly PinRef[];
  readonly nets: readonly number[];
}

export const MAX_REPORTED_ISSUES = 100;

/** Finds the definition of a part type (the parts registry from Day 14). */
export type DefinitionLookup = (type: string) => ComponentDefinition | undefined;

function issue(
  code: IssueCode,
  message: string,
  hint: string | undefined,
  involved: { parts?: readonly string[]; pins?: readonly PinRef[]; nets?: readonly number[] } = {},
): CircuitIssue {
  return {
    code,
    severity: ISSUE_SEVERITY[code],
    message,
    ...(hint === undefined ? {} : { hint }),
    parts: involved.parts ?? [],
    pins: involved.pins ?? [],
    nets: involved.nets ?? [],
  };
}

/** "R1", "R1 and R2", "R1, R2 and R3", "R1, R2, R3 and 4 more". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length <= 3)
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1] ?? ""}`;
  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
}

/** "Pin 2 of R1" or "The Positive (+) pin of V1". */
function pinPhrase(pin: PinDefinition | undefined, pinId: string, designator: string): string {
  if (!pin) return `Pin ${pinId} of ${designator}`;
  return /^pin\b/i.test(pin.name)
    ? `${pin.name} of ${designator}`
    : `The ${pin.name} pin of ${designator}`;
}

function describeProblem(
  definition: ComponentDefinition,
  designator: string,
  problem: PropProblem,
): string {
  const property = definition.properties.find((p) => p.key === problem.key);
  const label = property?.label ?? problem.key;
  const subject = `${label} of ${designator}`;
  if (property?.kind === "choice")
    return `${subject} must be one of: ${property.options.join(", ")}.`;
  if (property?.kind === "boolean") return `${subject} must be on or off.`;
  if (property?.kind === "number") {
    const unit = QUANTITIES[property.quantity].unit;
    if (problem.reason === "too-small" && property.min !== undefined) {
      const limit = formatQuantity(property.min, property.quantity);
      return `${subject} must be ${property.exclusiveMin ? "more than" : "at least"} ${limit}.`;
    }
    if (problem.reason === "too-large" && property.max !== undefined) {
      return `${subject} must be at most ${formatQuantity(property.max, property.quantity)}.`;
    }
    return `${subject} is not a valid number${unit ? ` of ${unit}` : ""}.`;
  }
  return `${subject} is not valid.`;
}

/** Messages for issues the solver finds (Days 15–17); kept here so all wording is in one place. */
export const solverIssues = {
  singularMatrix: (parts: readonly string[] = []) =>
    issue(
      "singular-matrix",
      "The circuit cannot be solved as drawn.",
      "Check for parts that are connected only to each other, or ideal parts joined directly.",
      { parts },
    ),
  noConvergence: (parts: readonly string[] = []) =>
    issue(
      "no-convergence",
      "The simulation could not settle on a stable answer.",
      "Check part values (very large or very small values make this harder), then try again.",
      { parts },
    ),
  modelError: (detail: string, parts: readonly string[] = []) =>
    issue(
      "model-error",
      `Something went wrong inside the simulator (${detail}).`,
      "Please report this problem.",
      {
        parts,
      },
    ),
  tooLarge: (unknowns: number, max: number) =>
    issue(
      "too-large",
      `This circuit is too big to solve yet (${unknowns} unknowns, at most ${max}).`,
      "Split it into smaller circuits; larger circuits are supported in a later version.",
    ),
  overLimit: (designator: string, what: string, partId: string) =>
    issue(
      "over-limit",
      `${designator} is beyond its rating: ${what}.`,
      "In a real circuit this part could overheat or burn out.",
      {
        parts: [partId],
      },
    ),
};

/**
 * Checks a netlist for beginner mistakes before it is solved. Errors mean "do not simulate";
 * warnings and info can be shown next to results. Deterministic: same netlist → same issues.
 */
export function checkCircuit(netlist: Netlist, lookup: DefinitionLookup): CircuitIssue[] {
  const issues: CircuitIssue[] = [];
  const { components, nets } = netlist;

  if (components.length === 0) {
    return [
      issue("empty-circuit", "The circuit is empty.", "Add parts from the parts library to start."),
    ];
  }

  const known: { component: NetlistComponent; definition: ComponentDefinition | undefined }[] = [];
  for (const component of components) {
    const definition = lookup(component.type);
    known.push({ component, definition });
    if (!definition) {
      issues.push(
        solverIssues.modelError(
          `${component.designator} is a part type this version does not know: "${component.type}"`,
          [component.id],
        ),
      );
      continue;
    }
    const resolved = resolveProps(definition, component.props);
    if (!resolved.ok) {
      for (const problem of resolved.problems) {
        issues.push(
          issue(
            "invalid-value",
            describeProblem(definition, component.designator, problem),
            "Change the value in the Inspector.",
            {
              parts: [component.id],
            },
          ),
        );
      }
    }
  }

  // Duplicate designators ("two R1").
  const byDesignator = new Map<string, string[]>();
  for (const { component } of known) {
    const ids = byDesignator.get(component.designator) ?? [];
    ids.push(component.id);
    byDesignator.set(component.designator, ids);
  }
  for (const [designator, ids] of byDesignator) {
    if (ids.length > 1) {
      issues.push(
        issue(
          "duplicate-designator",
          `${ids.length} parts are named ${designator}.`,
          "Give each part its own name, e.g. R1, R2…",
          {
            parts: ids,
          },
        ),
      );
    }
  }

  // Pins alone on their net.
  for (const net of nets) {
    if (net.node === GROUND_NODE || net.pins.length !== 1) continue;
    const [ref] = net.pins as [PinRef];
    const entry = known.find((k) => k.component.id === ref.part);
    if (!entry) continue;
    const pin = entry.definition?.pins.find((p) => p.id === ref.pin);
    if (pin?.type === "not-connected") continue;
    issues.push(
      issue(
        "unconnected-pin",
        `${pinPhrase(pin, ref.pin, entry.component.designator)} is not connected to anything.`,
        "Draw a wire from it, or delete the part if you do not need it.",
        { parts: [ref.part], pins: [ref], nets: [net.node] },
      ),
    );
  }

  const hasGround = (nets[GROUND_NODE]?.pins.length ?? 0) > 0;
  if (!hasGround) {
    issues.push(
      issue(
        "no-ground",
        "The circuit has no ground (GND), the 0 V point every voltage is measured from.",
        "Add a ground symbol and connect it to the negative (−) side of your supply.",
      ),
    );
  }

  issues.push(...checkVoltageLoops(known), ...(hasGround ? checkFloating(known, nets.length) : []));
  return sortIssues(issues).slice(0, MAX_REPORTED_ISSUES);
}

type Known = { component: NetlistComponent; definition: ComponentDefinition | undefined };

function createUnionFind(size: number) {
  const parent = Array.from({ length: size }, (_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root] ?? root;
    while (parent[i] !== root) {
      const next = parent[i] ?? root;
      parent[i] = root;
      i = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  return { find, union };
}

/** Ideal voltage sources (and parts acting like them) shorted or in a loop with each other. */
function checkVoltageLoops(known: readonly Known[]): CircuitIssue[] {
  const issues: CircuitIssue[] = [];
  const nodeCount = Math.max(1, ...known.flatMap((k) => k.component.pins.map((p) => p.node + 1)));
  const uf = createUnionFind(nodeCount);
  const adjacency = new Map<number, { to: number; part: NetlistComponent }[]>();
  const link = (a: number, b: number, part: NetlistComponent) => {
    for (const [from, to] of [
      [a, b],
      [b, a],
    ] as const) {
      const list = adjacency.get(from) ?? [];
      list.push({ to, part });
      adjacency.set(from, list);
    }
  };
  /** Parts on the path from a to b through voltage-fixing parts added so far (BFS). */
  const pathParts = (a: number, b: number): NetlistComponent[] => {
    const previous = new Map<number, { node: number; part: NetlistComponent }>();
    const queue = [a];
    const seen = new Set([a]);
    while (queue.length) {
      const node = queue.shift() as number;
      if (node === b) break;
      for (const edge of adjacency.get(node) ?? []) {
        if (seen.has(edge.to)) continue;
        seen.add(edge.to);
        previous.set(edge.to, { node, part: edge.part });
        queue.push(edge.to);
      }
    }
    const parts: NetlistComponent[] = [];
    for (let node = b; node !== a;) {
      const step = previous.get(node);
      if (!step) break;
      parts.push(step.part);
      node = step.node;
    }
    return parts;
  };

  for (const { component, definition } of known) {
    for (const [i, j] of definition?.voltagePairs ?? []) {
      const a = component.pins[i]?.node;
      const b = component.pins[j]?.node;
      if (a === undefined || b === undefined) continue;
      if (a === b) {
        issues.push(
          issue(
            "voltage-source-loop",
            `${component.designator} is short-circuited: a wire connects its two sides directly.`,
            "Remove the wire, or add a resistor in series to limit the current.",
            { parts: [component.id], nets: [a] },
          ),
        );
        continue;
      }
      if (uf.find(a) === uf.find(b)) {
        const loop = [component, ...pathParts(a, b)];
        const names = [...new Set(loop.map((p) => p.designator))].sort();
        issues.push(
          issue(
            "voltage-source-loop",
            `${listNames(names)} are joined directly (in parallel or in a loop) with nothing to limit the current.`,
            "Ideal supplies cannot be joined directly: put a resistor between them, or remove one.",
            { parts: [...new Set(loop.map((p) => p.id))].sort(), nets: [a, b] },
          ),
        );
        continue;
      }
      uf.union(a, b);
      link(a, b, component);
    }
  }
  return issues;
}

/** Parts with no DC path to ground, and current sources with nowhere to send their current. */
function checkFloating(known: readonly Known[], nodeCount: number): CircuitIssue[] {
  const uf = createUnionFind(nodeCount);
  /** Nodes where at least one pin has a DC path through its part. */
  const fed = new Set<number>();
  const used = new Set<number>();
  for (const { component, definition } of known) {
    const paths = definition
      ? dcPathsOf(definition)
      : component.pins.slice(1).map((_, i) => [0, i + 1] as const);
    for (const pin of component.pins) used.add(pin.node);
    for (const [i, j] of paths) {
      const a = component.pins[i]?.node;
      const b = component.pins[j]?.node;
      if (a === undefined || b === undefined) continue;
      uf.union(a, b);
      fed.add(a);
      fed.add(b);
    }
  }

  const groups = new Map<number, number[]>();
  for (const node of [...used].sort((a, b) => a - b)) {
    if (node === GROUND_NODE || uf.find(node) === uf.find(GROUND_NODE)) continue;
    const root = uf.find(node);
    const group = groups.get(root) ?? [];
    group.push(node);
    groups.set(root, group);
  }

  const issues: CircuitIssue[] = [];
  for (const nodes of groups.values()) {
    const inGroup = new Set(nodes);
    const parts = known.filter((k) => k.component.pins.some((p) => inGroup.has(p.node)));
    const starved = nodes.filter((node) => !fed.has(node));
    const sources = parts.filter(
      ({ component, definition }) =>
        definition?.category === "source" &&
        dcPathsOf(definition).length === 0 &&
        component.pins.some((p) => starved.includes(p.node)),
    );
    if (sources.length > 0) {
      const names = sources.map((s) => s.component.designator).sort();
      issues.push(
        issue(
          "current-source-cutset",
          `${listNames(names)} ${names.length === 1 ? "has" : "have"} nowhere to send ${names.length === 1 ? "its" : "their"} current.`,
          "Connect a resistor (or another path for the current) across the current source.",
          { parts: sources.map((s) => s.component.id).sort(), nets: starved },
        ),
      );
      continue;
    }
    const names = [...new Set(parts.map((p) => p.component.designator))].sort();
    issues.push(
      issue(
        "floating-node",
        `${listNames(names)} ${names.length === 1 ? "is" : "are"} not connected to ground, so ${names.length === 1 ? "its voltages" : "their voltages"} cannot be worked out.`,
        "Connect this part of the circuit to the rest of it, or to ground (GND).",
        { parts: parts.map((p) => p.component.id).sort(), nets: nodes },
      ),
    );
  }
  return issues;
}

const SEVERITY_ORDER: Readonly<Record<IssueSeverity, number>> = { error: 0, warning: 1, info: 2 };

/** Errors first, then warnings, then tips; stable within each code. */
export function sortIssues(issues: readonly CircuitIssue[]): CircuitIssue[] {
  return issues
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.item.severity] - SEVERITY_ORDER[b.item.severity] ||
        ISSUE_CODES.indexOf(a.item.code) - ISSUE_CODES.indexOf(b.item.code) ||
        a.index - b.index,
    )
    .map(({ item }) => item);
}

/** True when the circuit may be simulated (no errors). */
export function canSimulate(issues: readonly CircuitIssue[]): boolean {
  return !issues.some((i) => i.severity === "error");
}
