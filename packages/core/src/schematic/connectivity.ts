/**
 * From drawing to netlist (ADR 009): geometric connectivity like KiCad / Altium / LTspice.
 *
 * Rules (the only ones):
 *  1. A wire END connects to anything at that point: a pin end, another wire's end, or the inside
 *     of another wire's segment (T-junction).
 *  2. Two pins at the same point connect.
 *  3. Wires that only cross do not connect.
 *  4. A net label joins what passes through its point (pin end, wire end or wire segment); labels
 *     with the same name are one net; GND / 0 is ground (handled by `buildNetlist`).
 *  5. A ground symbol's pin is ground (handled by `buildNetlist`).
 *
 * The result is a `CircuitInput` for `buildNetlist` (ADR 007) plus what the canvas needs: junction
 * dots and which pins are connected (their open circles are hidden).
 */
import { REFERENCE_PARTS } from "../circuit/reference-parts";
import type { CircuitInput, CircuitPart, PinRef } from "../circuit/netlist";
import type { NetLabel, Part, Project, Wire, WirePoint } from "../project";
import { placedPins, symbolFor } from "./symbols";

const DEFINITION_PINS = new Map(REFERENCE_PARTS.map((d) => [d.type, d.pins.map((p) => p.id)]));
const DESIGNATOR = /^[A-Za-z][A-Za-z0-9_]{0,15}$/;

const key = (x: number, y: number) => `${x},${y}`;
export const pinKey = (part: string, pin: string) => `${part}\u0000${pin}`;

export interface PlacedPin {
  readonly part: string;
  readonly pin: string;
  readonly x: number;
  readonly y: number;
}

/** World positions of every pin of every part that has a symbol (unknown types have no pins). */
export function placedPinsOf(parts: readonly Part[]): PlacedPin[] {
  const out: PlacedPin[] = [];
  for (const part of parts) {
    const symbol = symbolFor(part.type);
    if (!symbol) continue;
    for (const pin of placedPins(part, symbol))
      out.push({ part: part.id, pin: pin.id, x: pin.x, y: pin.y });
  }
  return out;
}

export interface Connectivity {
  /** Ready for `buildNetlist`. */
  readonly input: CircuitInput;
  /** Points that get a junction dot (three or more connections, at least one wire). */
  readonly junctions: readonly WirePoint[];
  /** `pinKey(part, pin)` of every pin touched by a wire, another pin or a label. */
  readonly connectedPins: ReadonlySet<string>;
  /** Conductor group of each wire and label id (same number = same net in the drawing). */
  readonly groupOf: ReadonlyMap<string, number>;
  /** First pin of each group that has pins (to name a wire's net after `buildNetlist`). */
  readonly groupPin: ReadonlyMap<number, PinRef>;
}

/** Horizontal and vertical segments indexed by their row / column, for fast point lookups. */
function indexSegments(wires: readonly Wire[]) {
  const rows = new Map<number, { from: number; to: number; wire: number }[]>();
  const cols = new Map<number, { from: number; to: number; wire: number }[]>();
  wires.forEach((wire, w) => {
    for (let i = 1; i < wire.points.length; i++) {
      const [x1, y1] = wire.points[i - 1] as WirePoint;
      const [x2, y2] = wire.points[i] as WirePoint;
      const [map, line, a, b] = y1 === y2 ? [rows, y1, x1, x2] : [cols, x1, y1, y2];
      const list = map.get(line) ?? [];
      list.push({ from: Math.min(a, b), to: Math.max(a, b), wire: w });
      map.set(line, list);
    }
  });
  /** Wires (indices) with a segment containing the point. */
  return (x: number, y: number): number[] => {
    const hits = new Set<number>();
    for (const s of rows.get(y) ?? []) if (x >= s.from && x <= s.to) hits.add(s.wire);
    for (const s of cols.get(x) ?? []) if (y >= s.from && y <= s.to) hits.add(s.wire);
    return [...hits];
  };
}

export function connectivityOf(project: Pick<Project, "parts" | "wires" | "labels">): Connectivity {
  const { parts, wires, labels } = project;
  const pins = placedPinsOf(parts);

  // Union-find over: pins [0, P), wires [P, P+W), labels [P+W, P+W+L).
  const P = pins.length;
  const W = wires.length;
  const parent = Array.from({ length: P + W + labels.length }, (_, i) => i);
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

  const pinsAt = new Map<string, number[]>();
  pins.forEach((pin, i) => {
    const k = key(pin.x, pin.y);
    const list = pinsAt.get(k) ?? [];
    list.push(i);
    pinsAt.set(k, list);
  });
  const wiresThrough = indexSegments(wires);
  const touched = new Set<number>(); // pins with any contact

  // Rule 2: pins at one point.
  for (const list of pinsAt.values()) {
    if (list.length < 2) continue;
    for (const i of list) {
      union(list[0] as number, i);
      touched.add(i);
    }
  }

  // Rule 1: wire ends.
  const arms = new Map<string, { count: number; wires: boolean }>(); // for junction dots
  const addArms = (x: number, y: number, n: number, wire: boolean) => {
    const k = key(x, y);
    const a = arms.get(k) ?? { count: 0, wires: false };
    a.count += n;
    a.wires ||= wire;
    arms.set(k, a);
  };
  wires.forEach((wire, w) => {
    const ends = [wire.points[0], wire.points[wire.points.length - 1]] as WirePoint[];
    for (const [x, y] of ends) {
      for (const i of pinsAt.get(key(x, y)) ?? []) {
        union(P + w, i);
        touched.add(i);
      }
      for (const other of wiresThrough(x, y)) if (other !== w) union(P + w, P + other);
    }
  });

  // Junction dots: count the arms meeting at every wire end — each wire end 1, each wire passing
  // through (or turning) 2, each pin 1.
  const endsAt = new Map<string, number>(); // wire ends per point (a closed loop counts twice)
  const wireEndKeys = wires.map((wire) => {
    const first = wire.points[0] as WirePoint;
    const last = wire.points[wire.points.length - 1] as WirePoint;
    const ends = [key(first[0], first[1]), key(last[0], last[1])] as const;
    for (const k of ends) endsAt.set(k, (endsAt.get(k) ?? 0) + 1);
    return ends;
  });
  for (const [k, ends] of endsAt) {
    const [x, y] = k.split(",").map(Number) as [number, number];
    addArms(x, y, ends, true);
    // Wires passing through (or turning at) this point without ending there: two arms each.
    for (const w of wiresThrough(x, y)) {
      const own = wireEndKeys[w] as readonly [string, string];
      if (own[0] !== k && own[1] !== k) addArms(x, y, 2, true);
    }
    addArms(x, y, pinsAt.get(k)?.length ?? 0, false);
  }
  const junctions: WirePoint[] = [];
  for (const [k, a] of arms) {
    if (a.count >= 3 && a.wires) junctions.push(k.split(",").map(Number) as unknown as WirePoint);
  }
  junctions.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  // Rule 4: labels attach to pins and wires at their point.
  labels.forEach((label, l) => {
    const index = P + W + l;
    for (const i of pinsAt.get(key(label.x, label.y)) ?? []) {
      union(index, i);
      touched.add(i);
    }
    for (const w of wiresThrough(label.x, label.y)) union(index, P + w);
  });

  // A pin touched by a wire end is connected even when nothing else is on that wire.
  // Groups → CircuitInput: chain the pins of each group; attach labels to the group's first pin.
  const firstPinOfRoot = new Map<number, number>();
  const connections: [PinRef, PinRef][] = [];
  const ref = (i: number): PinRef => ({
    part: (pins[i] as PlacedPin).part,
    pin: (pins[i] as PlacedPin).pin,
  });
  pins.forEach((_, i) => {
    const root = find(i);
    const first = firstPinOfRoot.get(root);
    if (first === undefined) firstPinOfRoot.set(root, i);
    else connections.push([ref(first), ref(i)]);
  });
  const inputLabels: { pin: PinRef; name: string }[] = [];
  labels.forEach((label: NetLabel, l) => {
    const first = firstPinOfRoot.get(find(P + W + l));
    if (first !== undefined) inputLabels.push({ pin: ref(first), name: label.name });
  });

  // Groups numbered in a stable order (roots ascending) for wires and labels.
  const groupNumber = new Map<number, number>();
  const numberOf = (root: number) => {
    let n = groupNumber.get(root);
    if (n === undefined) {
      n = groupNumber.size;
      groupNumber.set(root, n);
    }
    return n;
  };
  const groupOf = new Map<string, number>();
  const groupPin = new Map<number, PinRef>();
  wires.forEach((wire, w) => groupOf.set(wire.id, numberOf(find(P + w))));
  labels.forEach((label, l) => groupOf.set(label.id, numberOf(find(P + W + l))));
  for (const [root, first] of firstPinOfRoot) {
    if (groupNumber.has(root)) groupPin.set(groupNumber.get(root) as number, ref(first));
  }

  const connectedPins = new Set<string>();
  for (const i of touched)
    connectedPins.add(pinKey((pins[i] as PlacedPin).part, (pins[i] as PlacedPin).pin));
  // Wire ends that touch a pin were recorded above; labels too.

  const circuitParts: CircuitPart[] = [];
  parts.forEach((part, index) => {
    const symbol = symbolFor(part.type);
    if (!symbol) return;
    circuitParts.push({
      id: part.id,
      type: part.type,
      designator: DESIGNATOR.test(part.name) ? part.name : `X${index + 1}`,
      pins: DEFINITION_PINS.get(part.type) ?? symbol.pins.map((p) => p.id),
      props: part.props,
    });
  });

  return {
    input: { parts: circuitParts, connections, labels: inputLabels },
    junctions,
    connectedPins,
    groupOf,
    groupPin,
  };
}
