import { describe, expect, it } from "vitest";
import {
  GROUND_NET_NAME,
  GROUND_NODE,
  NetlistError,
  buildNetlist,
  parseNetlist,
  type CircuitInput,
  type CircuitPart,
  type PinRef,
} from "./netlist";

const pin = (part: string, id: string): PinRef => ({ part, pin: id });
const resistor = (id: string, designator: string, ohms = 1000): CircuitPart => ({
  id,
  type: "resistor",
  designator,
  pins: ["1", "2"],
  props: { resistance: ohms },
});
const battery = (id = "v1"): CircuitPart => ({
  id,
  type: "source.dc-voltage",
  designator: "V1",
  pins: ["+", "-"],
  props: { voltage: 9 },
});
const ground = (id = "g1"): CircuitPart => ({
  id,
  type: "ground",
  designator: "GND1",
  pins: ["1"],
  props: {},
});

/** Battery + two resistors in series (voltage divider), "-" grounded. */
const divider = (): CircuitInput => ({
  parts: [battery(), resistor("r1", "R1"), resistor("r2", "R2"), ground()],
  connections: [
    [pin("v1", "+"), pin("r1", "1")],
    [pin("r1", "2"), pin("r2", "1")],
    [pin("r2", "2"), pin("v1", "-")],
    [pin("v1", "-"), pin("g1", "1")],
  ],
  labels: [],
});

const nodeOf = (input: CircuitInput, part: string, id: string) => {
  const component = buildNetlist(input).components.find((c) => c.id === part);
  return component?.pins.find((p) => p.id === id)?.node;
};

describe("buildNetlist", () => {
  it("builds the nets of a voltage divider with ground as node 0", () => {
    const netlist = buildNetlist(divider());
    expect(netlist.nets.map((n) => n.name)).toEqual([GROUND_NET_NAME, "N_R1_1", "N_R1_2"]);
    expect(netlist.nets[0]?.pins).toEqual([pin("g1", "1"), pin("r2", "2"), pin("v1", "-")]);
    expect(netlist.components.map((c) => c.id)).toEqual(["r1", "r2", "v1"]);
    expect(netlist.components.find((c) => c.id === "v1")?.pins).toEqual([
      { id: "+", node: 1 },
      { id: "-", node: GROUND_NODE },
    ]);
    expect(nodeOf(divider(), "r2", "1")).toBe(2);
  });

  it("leaves ground symbols out of the components", () => {
    expect(buildNetlist(divider()).components.some((c) => c.type === "ground")).toBe(false);
  });

  it("numbers nodes the same whatever order parts and wires were drawn in", () => {
    const base = divider();
    const shuffled: CircuitInput = {
      parts: [...base.parts].reverse(),
      connections: [...base.connections].reverse().map(([a, b]) => [b, a]),
      labels: [],
    };
    expect(buildNetlist(shuffled)).toEqual(buildNetlist(base));
  });

  it("keeps pins in definition order (the order stamps expect)", () => {
    const input = divider();
    const r1 = buildNetlist(input).components.find((c) => c.id === "r1");
    expect(r1?.pins.map((p) => p.id)).toEqual(["1", "2"]);
  });

  it("joins pins with the same label into one named net", () => {
    const input: CircuitInput = {
      parts: [battery(), resistor("r1", "R1"), ground()],
      connections: [[pin("v1", "-"), pin("g1", "1")]],
      labels: [
        { pin: pin("v1", "+"), name: "VCC" },
        { pin: pin("r1", "1"), name: "VCC" },
        { pin: pin("r1", "2"), name: "gnd" },
      ],
    };
    const netlist = buildNetlist(input);
    expect(netlist.nets.map((n) => [n.name, n.labelled])).toEqual([
      [GROUND_NET_NAME, true],
      ["VCC", true],
    ]);
    expect(nodeOf(input, "r1", "2")).toBe(GROUND_NODE);
  });

  it("treats labels '0' and 'GND' (any case) as ground", () => {
    for (const name of ["0", "GND", "Gnd"]) {
      const input: CircuitInput = {
        parts: [resistor("r1", "R1")],
        connections: [],
        labels: [{ pin: pin("r1", "2"), name }],
      };
      expect(nodeOf(input, "r1", "2")).toBe(GROUND_NODE);
    }
  });

  it("uses the alphabetically first label when a net has two", () => {
    const input: CircuitInput = {
      parts: [resistor("r1", "R1")],
      connections: [],
      labels: [
        { pin: pin("r1", "1"), name: "VIN" },
        { pin: pin("r1", "1"), name: "5V" },
      ],
    };
    expect(buildNetlist(input).nets[1]?.name).toBe("5V");
  });

  it("never gives a generated name that a label already uses", () => {
    const input: CircuitInput = {
      parts: [resistor("r1", "R1"), resistor("r2", "R2")],
      connections: [],
      labels: [{ pin: pin("r2", "1"), name: "N_R1_1" }],
    };
    const names = buildNetlist(input).nets.map((n) => n.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("N_R1_1_2");
  });

  it("keeps a net for an open pin (found later by the circuit checks)", () => {
    const input: CircuitInput = { parts: [resistor("r1", "R1")], connections: [], labels: [] };
    const netlist = buildNetlist(input);
    expect(netlist.nets).toHaveLength(3);
    expect(netlist.nets[0]?.pins).toEqual([]);
  });

  it("builds an empty netlist with only the ground net", () => {
    expect(buildNetlist({ parts: [], connections: [], labels: [] })).toEqual({
      nets: [{ node: 0, name: GROUND_NET_NAME, labelled: true, pins: [] }],
      components: [],
    });
  });

  it("refuses references to missing parts or pins with a clear message", () => {
    const missingPart = divider();
    missingPart.connections.push([pin("r9", "1"), pin("r1", "1")]);
    expect(() => buildNetlist(missingPart)).toThrow(/part "r9" does not exist/);
    const missingPin = divider();
    missingPin.labels.push({ pin: pin("r1", "3"), name: "X" });
    expect(() => buildNetlist(missingPin)).toThrow(/part "r1" has no pin "3"/);
  });

  it("refuses duplicate parts and pins", () => {
    const twice = divider();
    twice.parts.push(resistor("r1", "R7"));
    expect(() => buildNetlist(twice)).toThrow(NetlistError);
    const pinTwice = divider();
    pinTwice.parts.push({ ...resistor("r3", "R3"), pins: ["1", "1"] });
    expect(() => buildNetlist(pinTwice)).toThrow(/pin "1" twice/);
  });

  it("validates its input (ids, designators, label names, prototype keys)", () => {
    const bad = (input: unknown) => () => buildNetlist(input as CircuitInput);
    expect(bad({ parts: [{ ...resistor("r 1", "R1") }], connections: [], labels: [] })).toThrow(
      NetlistError,
    );
    expect(bad({ parts: [resistor("r1", "1R")], connections: [], labels: [] })).toThrow(
      /designators?|letter/,
    );
    expect(
      bad({
        parts: [resistor("r1", "R1")],
        connections: [],
        labels: [{ pin: pin("r1", "1"), name: "my net" }],
      }),
    ).toThrow(NetlistError);
    expect(bad({ parts: [], connections: [], labels: [], extra: 1 })).toThrow(NetlistError);
  });

  it("handles a large chain quickly", () => {
    const parts = Array.from({ length: 1_000 }, (_, i) =>
      resistor(`r${String(i).padStart(4, "0")}`, `R${i + 1}`),
    );
    const connections = parts
      .slice(1)
      .map((part, i) => [pin(parts[i]?.id ?? "", "2"), pin(part.id, "1")] as [PinRef, PinRef]);
    const start = Date.now();
    const netlist = buildNetlist({ parts, connections, labels: [] });
    expect(netlist.nets).toHaveLength(1 + 1_001);
    expect(Date.now() - start).toBeLessThan(500);
  });
});

describe("parseNetlist", () => {
  it("accepts what buildNetlist produces", () => {
    const netlist = buildNetlist(divider());
    expect(parseNetlist(JSON.parse(JSON.stringify(netlist)))).toEqual({ ok: true, netlist });
  });

  it("refuses inconsistent netlists", () => {
    const netlist = buildNetlist(divider());
    const wrongIndex = {
      ...netlist,
      nets: netlist.nets.map((n, i) => (i === 1 ? { ...n, node: 5 } : n)),
    };
    expect(parseNetlist(wrongIndex).ok).toBe(false);
    const noGround = {
      ...netlist,
      nets: netlist.nets.map((n, i) => (i === 0 ? { ...n, name: "X" } : n)),
    };
    expect(parseNetlist(noGround).ok).toBe(false);
    const danglingNode = {
      ...netlist,
      components: netlist.components.map((c) => ({
        ...c,
        pins: c.pins.map((p) => ({ ...p, node: 99 })),
      })),
    };
    const result = parseNetlist(danglingNode);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]).toMatch(/no net 99/);
    expect(parseNetlist({ nets: [], components: [] }).ok).toBe(false);
    expect(parseNetlist("not a netlist").ok).toBe(false);
  });
});
