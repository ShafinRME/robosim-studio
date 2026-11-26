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
  "invalid-value",
  "singular-matrix",
  "no-convergence",
  "model-error",
  "too-large",
  "timeout",
  "short-circuit",
  "floating-node",
  "shorted-part",
  "over-limit",
  "unconnected-pin",
  "duplicate-designator",
  "low-accuracy",
  "erc-conflict",
  "empty-circuit",
] as const;
export type IssueCode = (typeof ISSUE_CODES)[number];
export type IssueSeverity = "error" | "warning" | "info";

/** `error` stops the simulation, `warning` simulates but flags, `info` is a tip. */
export const ISSUE_SEVERITY: Readonly<Record<IssueCode, IssueSeverity>> = {
  "no-ground": "error",
  "voltage-source-loop": "error",
  "current-source-cutset": "error",
  "invalid-value": "error",
  "singular-matrix": "error",
  "no-convergence": "error",
  "model-error": "error",
  "too-large": "error",
  timeout: "error",
  "short-circuit": "warning",
  "floating-node": "warning",
  "shorted-part": "warning",
  "over-limit": "warning",
  "unconnected-pin": "warning",
  "duplicate-designator": "warning",
  "low-accuracy": "warning",
  "erc-conflict": "warning",
  "empty-circuit": "info",
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
  /**
   * The matrix is singular. `what` says which unknown could not be worked out: the voltage of a
   * net (named by the parts that meet there) or the current through a part.
   */
  singularMatrix: (
    parts: readonly string[] = [],
    what?: { kind: "voltage" | "current"; names: readonly string[]; nets?: readonly number[] },
  ) =>
    issue(
      "singular-matrix",
      !what || what.names.length === 0
        ? "The circuit cannot be solved as drawn."
        : what.kind === "current"
          ? `The current through ${listNames(what.names)} cannot be worked out.`
          : what.names.length === 1
            ? `The voltage at ${what.names[0] ?? ""} cannot be worked out.`
            : `The voltage where ${listNames(what.names)} meet cannot be worked out.`,
      "Check for parts that are connected only to each other, or ideal parts joined directly.",
      { parts, nets: what?.nets ?? [] },
    ),
  /** A source (or any part) carrying more current than a real supply could deliver. */
  shortCircuit: (
    sources: readonly { name: string; id: string }[],
    through: readonly { name: string; id: string }[],
    current: number,
  ) => {
    const amount = formatQuantity(current, "current");
    const parts = [...new Set([...sources, ...through].map((p) => p.id))].sort();
    if (sources.length > 0) {
      const names = sources.map((s) => s.name);
      const path = through.length ? ` through ${listNames(through.map((t) => t.name))}` : "";
      return issue(
        "short-circuit",
        `${listNames(names)} ${names.length === 1 ? "is" : "are"} short-circuited${path}: ${amount} would flow.`,
        "No real supply can deliver this: add a resistor or a load so the current is limited.",
        { parts },
      );
    }
    const names = through.map((t) => t.name);
    return issue(
      "short-circuit",
      `${listNames(names)} ${names.length === 1 ? "carries" : "carry"} ${amount}, far more than a real circuit could.`,
      "Look for a short circuit: add a resistor or a load so the current is limited.",
      { parts },
    );
  },
  lowAccuracy: () =>
    issue(
      "low-accuracy",
      "The results may be inaccurate: some part values are too extreme for exact numbers.",
      "Bring very large and very small values closer together (for example 1 mΩ next to 1 TΩ).",
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
  timedOut: (seconds: number) =>
    issue(
      "timeout",
      `The calculation took longer than ${seconds} s and was stopped.`,
      "Try a smaller circuit or fewer extreme values; your drawing is not changed.",
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

  // Pins alone on their net; a part with no wire at all gets one message, not one per pin.
  const byId = new Map(known.map((k) => [k.component.id, k]));
  const loose = new Map<string, { ref: PinRef; pin: PinDefinition | undefined; node: number }[]>();
  for (const net of nets) {
    if (net.node === GROUND_NODE || net.pins.length !== 1) continue;
    const [ref] = net.pins as [PinRef];
    const entry = byId.get(ref.part);
    if (!entry) continue;
    const pin = entry.definition?.pins.find((p) => p.id === ref.pin);
    if (pin?.type === "not-connected") continue;
    const list = loose.get(ref.part) ?? [];
    list.push({ ref, pin, node: net.node });
    loose.set(ref.part, list);
  }
  const unwired = new Set<string>();
  for (const [partId, pins] of loose) {
    const entry = byId.get(partId) as Known;
    const { designator } = entry.component;
    const wirable = entry.definition
      ? entry.definition.pins.filter((p) => p.type !== "not-connected").length
      : entry.component.pins.length;
    if (pins.length >= 2 && pins.length === wirable) {
      unwired.add(partId);
      issues.push(
        issue(
          "unconnected-pin",
          `${designator} is not connected to anything yet.`,
          `Draw wires from its pins to the circuit, or delete ${designator} if you do not need it.`,
          {
            parts: [partId],
            pins: pins.map((p) => p.ref),
            nets: pins.map((p) => p.node),
          },
        ),
      );
      continue;
    }
    for (const { ref, pin, node } of pins) {
      issues.push(
        issue(
          "unconnected-pin",
          `${pinPhrase(pin, ref.pin, designator)} is not connected to anything.`,
          "Draw a wire from it, or delete the part if you do not need it.",
          { parts: [partId], pins: [ref], nets: [node] },
        ),
      );
    }
  }

  issues.push(...checkShortedParts(known));

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

  issues.push(
    ...checkVoltageLoops(known),
    ...(hasGround ? checkFloating(known, nets.length, unwired) : []),
  );
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

/** Union of nodes joined by DC paths through parts, plus the nodes at least one such path reaches. */
function dcGroups(known: readonly Known[], nodeCount: number) {
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
  /** Groups of used nodes with no DC path to ground, each sorted, in order of their first node. */
  const groups = new Map<number, number[]>();
  for (const node of [...used].sort((a, b) => a - b)) {
    if (node === GROUND_NODE || uf.find(node) === uf.find(GROUND_NODE)) continue;
    const root = uf.find(node);
    const group = groups.get(root) ?? [];
    group.push(node);
    groups.set(root, group);
  }
  return { groups: [...groups.values()], fed };
}

/**
 * Nodes with no DC path to ground (ADR 012 §3): the solver ties them to ground through a tiny
 * conductance and reports no values for them. Empty when the circuit has no ground at all.
 */
export function floatingNodes(netlist: Netlist, lookup: DefinitionLookup): number[] {
  if ((netlist.nets[GROUND_NODE]?.pins.length ?? 0) === 0) return [];
  const known = netlist.components.map((component) => ({
    component,
    definition: lookup(component.type),
  }));
  return dcGroups(known, netlist.nets.length)
    .groups.flat()
    .sort((a, b) => a - b);
}

/** Two-pin parts (or parts with all pins) on one net: a wire joins their pins (ADR 012 §3). */
function checkShortedParts(known: readonly Known[]): CircuitIssue[] {
  const issues: CircuitIssue[] = [];
  for (const { component, definition } of known) {
    if (!definition || component.pins.length < 2) continue;
    const node = component.pins[0]?.node;
    if (component.pins.some((p) => p.node !== node) || node === undefined) continue;
    // Voltage sources joined to themselves are the error "short-circuited" (checkVoltageLoops).
    if ((definition.voltagePairs ?? []).length > 0) continue;
    const name = component.designator;
    const two = component.pins.length === 2;
    const current = definition.category === "source" && dcPathsOf(definition).length === 0;
    issues.push(
      issue(
        "shorted-part",
        current
          ? `${name} is short-circuited: a wire joins its two pins, so its current only flows around that wire.`
          : `${name} is short-circuited: a wire joins ${two ? "its two pins" : "all its pins"}, so no current flows through it.`,
        `Remove that wire if ${name} should do something in the circuit.`,
        {
          parts: [component.id],
          pins: component.pins.map((p) => ({ part: component.id, pin: p.id })),
          nets: [node],
        },
      ),
    );
  }
  return issues;
}

/**
 * Parts with no DC path to ground (a warning: they are left out of the results), and current
 * sources with nowhere to send their current (an error). Parts already reported as "not connected
 * to anything" (`unwired`) are not reported again.
 */
function checkFloating(
  known: readonly Known[],
  nodeCount: number,
  unwired: ReadonlySet<string>,
): CircuitIssue[] {
  const { groups, fed } = dcGroups(known, nodeCount);
  const partsAt = new Map<number, Known[]>();
  for (const entry of known) {
    for (const node of new Set(entry.component.pins.map((p) => p.node))) {
      const list = partsAt.get(node) ?? [];
      list.push(entry);
      partsAt.set(node, list);
    }
  }

  const issues: CircuitIssue[] = [];
  for (const nodes of groups) {
    const parts = [...new Set(nodes.flatMap((node) => partsAt.get(node) ?? []))];
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
    if (parts.every((p) => unwired.has(p.component.id))) continue;
    const names = [...new Set(parts.map((p) => p.component.designator))].sort();
    const one = names.length === 1;
    issues.push(
      issue(
        "floating-node",
        `${listNames(names)} ${one ? "is" : "are"} not connected to ground, so ${one ? "it is" : "they are"} left out of the results.`,
        `Connect ${one ? "it" : "them"} to the rest of the circuit, or to ground (GND).`,
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
