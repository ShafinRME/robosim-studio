/**
 * Netlist (ADR 007 §1): the electrical meaning of a drawing — which pin is on which net.
 *
 * The circuit document (parts + wires + labels + ground symbols) is what the learner drew; the
 * netlist is derived from it by `buildNetlist` and is what the solver sees. Schematic and
 * breadboard both produce `connections`, so one netlist serves both views.
 *
 * Numbering is deterministic: node 0 is ground; every other net gets the next number in order of
 * the smallest pin it contains (part id, then pin id, compared by code unit — never by locale).
 * The same drawing therefore always gives the same matrix and the same results.
 */
import { z } from "zod";
import { propValueSchema } from "../project";

export const GROUND_NODE = 0;
/** Name of the ground net; also SPICE node 0. */
export const GROUND_NET_NAME = "GND";
/** Part type of the ground symbol: all its pins are node 0 and it is not a component. */
export const GROUND_PART_TYPE = "ground";

export const MAX_NETLIST_PARTS = 2_000;
export const MAX_PART_PINS = 256;
export const MAX_NETLIST_NODES = 8_000;
export const MAX_CONNECTIONS = 20_000;
export const MAX_NET_LABELS = 4_000;

/** Part ids follow the project format (ADR 004). */
const idSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, "must be 1–64 letters, digits, '-' or '_'");
/** Pin ids from the part definition: "1", "2", "anode", "+", "-", "VCC", "GPIO2"… */
const pinIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9+_-]{1,32}$/, "must be a pin id like '1' or 'anode'");
/** Reference designators (ADR 007 §5): "R1", "U12", "SW3"; renamed ones like "R_load" too. */
export const designatorSchema = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_]{0,15}$/, "must start with a letter, then letters, digits or '_'");
/** Net label names: "VCC", "5V", "SDA", "LED+", "motor.left"… (bounded, no spaces). */
export const netNameSchema = z
  .string()
  .regex(/^[A-Za-z0-9_+.-]{1,32}$/, "must be 1–32 letters, digits or '_+.-'");
const partTypeSchema = z
  .string()
  .max(64)
  .regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, "must be a part type like 'resistor'");
const propsSchema = z
  .record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/), propValueSchema)
  .refine((props) => Object.keys(props).length <= 64, "must have at most 64 properties");

export const pinRefSchema = z.strictObject({ part: idSchema, pin: pinIdSchema });
export type PinRef = z.infer<typeof pinRefSchema>;

// ─── Input: what a view (schematic, breadboard) hands over ─────────────────────────────────────────

export const circuitPartSchema = z.strictObject({
  id: idSchema,
  type: partTypeSchema,
  designator: designatorSchema,
  /** Pin ids in definition order (the order a device's stamp expects). */
  pins: z.array(pinIdSchema).min(1).max(MAX_PART_PINS),
  props: propsSchema,
});
export type CircuitPart = z.infer<typeof circuitPartSchema>;

export const circuitInputSchema = z.strictObject({
  parts: z.array(circuitPartSchema).max(MAX_NETLIST_PARTS),
  /** Electrical joins: a wire, a breadboard strip, a pin dropped on a pin. */
  connections: z.array(z.tuple([pinRefSchema, pinRefSchema])).max(MAX_CONNECTIONS),
  /** Net labels: pins with the same label name are one net, wherever they are drawn. */
  labels: z.array(z.strictObject({ pin: pinRefSchema, name: netNameSchema })).max(MAX_NET_LABELS),
});
export type CircuitInput = z.infer<typeof circuitInputSchema>;

// ─── Output: the netlist ─────────────────────────────────────────────────────────────────────────

export const netSchema = z.strictObject({
  node: z
    .number()
    .int()
    .min(0)
    .max(MAX_NETLIST_NODES - 1),
  name: netNameSchema,
  /** True when the name came from a label or ground, false when it was generated. */
  labelled: z.boolean(),
  /** Pins on this net, sorted (part id, then pin id). Ground symbols' pins are included. */
  pins: z.array(pinRefSchema),
});
export type Net = z.infer<typeof netSchema>;

export const netlistComponentSchema = z.strictObject({
  id: idSchema,
  type: partTypeSchema,
  designator: designatorSchema,
  props: propsSchema,
  /** One entry per pin, in definition order. */
  pins: z
    .array(
      z.strictObject({
        id: pinIdSchema,
        node: z
          .number()
          .int()
          .min(0)
          .max(MAX_NETLIST_NODES - 1),
      }),
    )
    .min(1)
    .max(MAX_PART_PINS),
});
export type NetlistComponent = z.infer<typeof netlistComponentSchema>;

export const netlistSchema = z
  .strictObject({
    /** `nets[i].node === i`; `nets[0]` is ground (it may have no pins). */
    nets: z.array(netSchema).min(1).max(MAX_NETLIST_NODES),
    /** Every part except ground symbols, sorted by id. */
    components: z.array(netlistComponentSchema).max(MAX_NETLIST_PARTS),
  })
  .superRefine((netlist, ctx) => {
    netlist.nets.forEach((net, index) => {
      if (net.node !== index) {
        ctx.addIssue({
          code: "custom",
          path: ["nets", index, "node"],
          message: `must be ${index}`,
        });
      }
    });
    if (netlist.nets[0]?.name !== GROUND_NET_NAME) {
      ctx.addIssue({ code: "custom", path: ["nets", 0, "name"], message: "net 0 must be ground" });
    }
    const names = new Set<string>();
    netlist.nets.forEach((net, index) => {
      if (names.has(net.name)) {
        ctx.addIssue({
          code: "custom",
          path: ["nets", index, "name"],
          message: `duplicate net "${net.name}"`,
        });
      }
      names.add(net.name);
    });
    const ids = new Set<string>();
    netlist.components.forEach((component, index) => {
      if (ids.has(component.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["components", index, "id"],
          message: "duplicate part id",
        });
      }
      ids.add(component.id);
      component.pins.forEach((pin, p) => {
        if (pin.node >= netlist.nets.length) {
          ctx.addIssue({
            code: "custom",
            path: ["components", index, "pins", p, "node"],
            message: `no net ${pin.node}`,
          });
        }
      });
    });
  });
export type Netlist = z.infer<typeof netlistSchema>;

/** A connection or label that points at a part or pin that does not exist (a document bug). */
export class NetlistError extends Error {
  override name = "NetlistError";
}

const keyOf = (ref: PinRef) => `${ref.part}\u0000${ref.pin}`;
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const comparePins = (a: PinRef, b: PinRef) =>
  compareText(a.part, b.part) || compareText(a.pin, b.pin);
const isGroundLabel = (name: string) => name === "0" || name.toUpperCase() === GROUND_NET_NAME;

/**
 * Builds the netlist (union-find over pins). Input is validated first; a reference to a missing
 * part or pin, or more nets than allowed, throws `NetlistError` — the document is broken, not the
 * circuit. Beginner mistakes (no ground, open pins…) are not errors here: they are found later by
 * the circuit checks, which need this netlist to name the parts involved.
 */
export function buildNetlist(input: CircuitInput): Netlist {
  const parsed = circuitInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new NetlistError(
      `invalid circuit: ${issue?.path.join(".") ?? ""} ${issue?.message ?? ""}`.trim(),
    );
  }
  const { parts, connections, labels } = parsed.data;

  // Every pin gets an index; parent[] is the union-find forest.
  const index = new Map<string, number>();
  const refs: PinRef[] = [];
  const partById = new Map<string, CircuitPart>();
  for (const part of parts) {
    if (partById.has(part.id)) throw new NetlistError(`duplicate part id "${part.id}"`);
    partById.set(part.id, part);
    for (const pin of part.pins) {
      const ref = { part: part.id, pin };
      if (index.has(keyOf(ref)))
        throw new NetlistError(`part "${part.id}" lists pin "${pin}" twice`);
      index.set(keyOf(ref), refs.length);
      refs.push(ref);
    }
  }
  // One extra element stands for ground.
  const groundRoot = refs.length;
  const parent = Array.from({ length: refs.length + 1 }, (_, i) => i);
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
  const lookup = (ref: PinRef, where: string): number => {
    const i = index.get(keyOf(ref));
    if (i === undefined) {
      const reason = partById.has(ref.part) ? `has no pin "${ref.pin}"` : "does not exist";
      throw new NetlistError(`${where}: part "${ref.part}" ${reason}`);
    }
    return i;
  };

  for (const part of parts) {
    if (part.type !== GROUND_PART_TYPE) continue;
    for (const pin of part.pins) union(groundRoot, lookup({ part: part.id, pin }, "ground"));
  }
  connections.forEach(([a, b], i) =>
    union(lookup(a, `connection ${i}`), lookup(b, `connection ${i}`)),
  );
  const labelByPin: { pin: number; name: string }[] = [];
  const firstPinOfLabel = new Map<string, number>();
  labels.forEach((label, i) => {
    const pin = lookup(label.pin, `label ${i}`);
    if (isGroundLabel(label.name)) {
      union(groundRoot, pin);
      return;
    }
    const first = firstPinOfLabel.get(label.name);
    if (first === undefined) firstPinOfLabel.set(label.name, pin);
    else union(first, pin);
    labelByPin.push({ pin, name: label.name });
  });

  // Group pins by root (ground first), sorted so numbering never depends on drawing order.
  const groups = new Map<number, PinRef[]>();
  groups.set(find(groundRoot), []);
  refs.forEach((ref, i) => {
    const root = find(i);
    const group = groups.get(root);
    if (group) group.push(ref);
    else groups.set(root, [ref]);
  });
  const groundGroup = groups.get(find(groundRoot)) ?? [];
  const others = [...groups.entries()]
    .filter(([root]) => root !== find(groundRoot))
    .map(([root, pins]) => ({ root, pins: pins.sort(comparePins) }))
    .sort((a, b) => comparePins(a.pins[0] as PinRef, b.pins[0] as PinRef));
  if (others.length + 1 > MAX_NETLIST_NODES) {
    throw new NetlistError(`more than ${MAX_NETLIST_NODES} nets`);
  }

  // Names: smallest label on the net, else generated from the net's first pin ("N_R1_2").
  const labelOfRoot = new Map<number, string>();
  for (const { pin, name } of labelByPin) {
    const root = find(pin);
    const current = labelOfRoot.get(root);
    if (current === undefined || compareText(name, current) < 0) labelOfRoot.set(root, name);
  }
  const nodeOfRoot = new Map<number, number>([[find(groundRoot), GROUND_NODE]]);
  const used = new Set<string>([GROUND_NET_NAME]);
  const nets: Net[] = [
    {
      node: GROUND_NODE,
      name: GROUND_NET_NAME,
      labelled: true,
      pins: groundGroup.sort(comparePins),
    },
  ];
  for (const { root } of others) {
    if (labelOfRoot.has(root)) used.add(labelOfRoot.get(root) as string);
  }
  others.forEach(({ root, pins }, i) => {
    const node = i + 1;
    nodeOfRoot.set(root, node);
    const label = labelOfRoot.get(root);
    let name = label;
    if (name === undefined) {
      const first = pins[0] as PinRef;
      const designator = partById.get(first.part)?.designator ?? first.part;
      const base = `N_${designator}_${first.pin}`.slice(0, 28);
      name = base;
      for (let n = 2; used.has(name); n++) name = `${base}_${n}`;
      used.add(name);
    }
    nets.push({ node, name, labelled: label !== undefined, pins });
  });

  const components: NetlistComponent[] = parts
    .filter((part) => part.type !== GROUND_PART_TYPE)
    .sort((a, b) => compareText(a.id, b.id))
    .map((part) => ({
      id: part.id,
      type: part.type,
      designator: part.designator,
      props: part.props,
      pins: part.pins.map((pin) => ({
        id: pin,
        node: nodeOfRoot.get(find(lookup({ part: part.id, pin }, "pin"))) ?? GROUND_NODE,
      })),
    }));

  return { nets, components };
}

/** Validates a netlist that crossed a boundary (worker message, test fixture, import). */
export function parseNetlist(
  data: unknown,
): { ok: true; netlist: Netlist } | { ok: false; issues: string[] } {
  const parsed = netlistSchema.safeParse(data);
  if (parsed.success) return { ok: true, netlist: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues
      .slice(0, 10)
      .map((issue) => `${issue.path.join(".") || "(netlist)"}: ${issue.message}`),
  };
}
