import { describe, expect, it } from "vitest";
import { buildNetlist, GROUND_NODE } from "../circuit/netlist";
import type { NetLabel, Part, Wire, WirePoint } from "../project";
import { connectivityOf, netNameOf, pinKey, placedPinsOf } from "./connectivity";

/**
 * "Nets computed correctly" (Day 13): every connection rule of ADR 009, checked through the real
 * `buildNetlist`. Pin positions (mils): a horizontal resistor at (x, y) has pin 1 at x − 200 and
 * pin 2 at x + 200; a voltage source has + at y − 200 and − at y + 200; ground has its pin at (x, y).
 */
const resistor = (id: string, x: number, y: number, rotation = 0): Part => ({
  id,
  type: "resistor",
  name: id.toUpperCase(),
  x,
  y,
  rotation,
  flip: false,
  props: { resistance: 1000 },
});
const source = (id: string, x: number, y: number): Part => ({
  id,
  type: "source.dc-voltage",
  name: id.toUpperCase(),
  x,
  y,
  rotation: 0,
  flip: false,
  props: { voltage: 9 },
});
const ground = (id: string, x: number, y: number): Part => ({
  id,
  type: "ground",
  name: id.toUpperCase(),
  x,
  y,
  rotation: 0,
  flip: false,
  props: {},
});
const wire = (id: string, ...points: WirePoint[]): Wire => ({ id, points });
const label = (id: string, x: number, y: number, name: string): NetLabel => ({
  id,
  x,
  y,
  name,
  rotation: 0,
});

function nets(parts: Part[], wires: Wire[] = [], labels: NetLabel[] = []) {
  const c = connectivityOf({ parts, wires, labels });
  const netlist = buildNetlist(c.input);
  const nodeOf = (part: string, pin: string) =>
    netlist.components.find((x) => x.id === part)?.pins.find((p) => p.id === pin)?.node;
  return { c, netlist, nodeOf };
}

describe("connectivityOf — nets computed correctly", () => {
  it("places pins where the symbols draw them", () => {
    expect(placedPinsOf([resistor("r1", 1000, 500)])).toEqual([
      { part: "r1", pin: "1", x: 800, y: 500 },
      { part: "r1", pin: "2", x: 1200, y: 500 },
    ]);
  });

  it("wires a voltage divider: V1 → R1 → R2 → ground", () => {
    // V1 at (0, 0): + (0, −200), − (0, 200). R1 at (400, −200): pins (200, −200) and (600, −200).
    // R2 vertical at (800, 0): pins (800, −200) and (800, 200). Ground at (0, 400) and (800, 400).
    const { netlist, nodeOf } = nets(
      [
        source("v1", 0, 0),
        resistor("r1", 400, -200),
        resistor("r2", 800, 0, 90),
        ground("g1", 0, 400),
        ground("g2", 800, 400),
      ],
      [
        wire("w1", [0, -200], [200, -200]),
        wire("w2", [600, -200], [800, -200]),
        wire("w3", [0, 200], [0, 400]),
        wire("w4", [800, 200], [800, 400]),
      ],
    );
    expect(nodeOf("v1", "+")).toBe(nodeOf("r1", "1"));
    expect(nodeOf("r1", "2")).toBe(nodeOf("r2", "1"));
    expect(nodeOf("v1", "-")).toBe(GROUND_NODE);
    expect(nodeOf("r2", "2")).toBe(GROUND_NODE);
    expect(new Set([nodeOf("v1", "+"), nodeOf("r1", "2"), GROUND_NODE]).size).toBe(3);
    expect(netlist.nets).toHaveLength(3);
  });

  it("connects a wire ending on the inside of another wire (T-junction) and draws a dot", () => {
    // Three resistors' pin 2 joined by a bus: horizontal wire across, one wire ending on its middle.
    const { c, nodeOf } = nets(
      [resistor("r1", -200, 0), resistor("r2", 1200, 0), resistor("r3", 500, 400, 90)],
      [wire("bus", [0, 0], [1000, 0]), wire("tap", [500, 200], [500, 0])],
    );
    expect(nodeOf("r1", "2")).toBe(nodeOf("r2", "1"));
    expect(nodeOf("r3", "1")).toBe(nodeOf("r1", "2"));
    expect(c.junctions).toEqual([[500, 0]]);
  });

  it("does not connect wires that only cross, and draws no dot", () => {
    const { c, nodeOf } = nets(
      [
        resistor("a", -200, 0),
        resistor("b", 1200, 0),
        resistor("c", 500, -700, 90),
        resistor("d", 500, 700, 90),
      ],
      [wire("h", [0, 0], [1000, 0]), wire("v", [500, -500], [500, 500])],
    );
    expect(nodeOf("a", "2")).toBe(nodeOf("b", "1"));
    expect(nodeOf("c", "2")).toBe(nodeOf("d", "1"));
    expect(nodeOf("a", "2")).not.toBe(nodeOf("c", "2"));
    expect(c.junctions).toEqual([]);
  });

  it("does not connect a pin that a wire merely passes over", () => {
    // R1's pin 2 sits at (200, 0) in the middle of a wire from (0, 0) to (400, 0): no wire end there.
    const { c, nodeOf } = nets(
      [resistor("r1", 0, 300, 90), resistor("r2", -200, 0), resistor("r3", 600, 0)],
      [wire("w", [0, 0], [400, 0])],
    );
    expect(nodeOf("r2", "2")).toBe(nodeOf("r3", "1"));
    expect(c.connectedPins.has(pinKey("r1", "1"))).toBe(false);
  });

  it("follows wires end to end and around corners", () => {
    const { nodeOf } = nets(
      [resistor("r1", -200, 0), resistor("r2", 800, 800)],
      [wire("a", [0, 0], [300, 0], [300, 500]), wire("b", [300, 500], [300, 800], [600, 800])],
    );
    expect(nodeOf("r1", "2")).toBe(nodeOf("r2", "1"));
  });

  it("connects pins that touch directly", () => {
    const { c, nodeOf } = nets([resistor("r1", 0, 0), resistor("r2", 400, 0)]);
    expect(nodeOf("r1", "2")).toBe(nodeOf("r2", "1"));
    expect(c.connectedPins).toEqual(new Set([pinKey("r1", "2"), pinKey("r2", "1")]));
  });

  it("joins labels with the same name, wherever they are", () => {
    const { nodeOf, netlist } = nets(
      [resistor("r1", 0, 0), resistor("r2", 2000, 2000)],
      [wire("w1", [200, 0], [400, 0]), wire("w2", [1800, 2000], [1400, 2000])],
      [label("l1", 400, 0, "VCC"), label("l2", 1400, 2000, "VCC")],
    );
    expect(nodeOf("r1", "2")).toBe(nodeOf("r2", "1"));
    expect(netlist.nets.find((n) => n.node === nodeOf("r1", "2"))?.name).toBe("VCC");
  });

  it("attaches a label on the inside of a wire, and a GND label grounds the net", () => {
    const { nodeOf } = nets(
      [resistor("r1", 0, 0)],
      [wire("w", [200, 0], [800, 0])],
      [label("l", 500, 0, "GND")],
    );
    expect(nodeOf("r1", "2")).toBe(GROUND_NODE);
  });

  it("marks a pin with a dangling wire as connected (its circle hides)", () => {
    const { c } = nets([resistor("r1", 0, 0)], [wire("w", [200, 0], [500, 0])]);
    expect(c.connectedPins).toEqual(new Set([pinKey("r1", "2")]));
  });

  it("draws a dot where two wires end on one pin", () => {
    const { c } = nets(
      [resistor("r1", 0, 0)],
      [wire("a", [200, 0], [500, 0]), wire("b", [200, 0], [200, 400])],
    );
    expect(c.junctions).toEqual([[200, 0]]);
  });

  it("draws a dot where a wire ends on another wire's corner", () => {
    const { c } = nets(
      [],
      [wire("l", [0, 0], [500, 0], [500, 500]), wire("t", [500, 0], [900, 0])],
    );
    expect(c.junctions).toEqual([[500, 0]]);
  });

  it("numbers wire groups and names a wire's net after its first pin", () => {
    const { c } = nets(
      [resistor("r1", 0, 0)],
      [
        wire("a", [200, 0], [500, 0]),
        wire("b", [500, 0], [500, 300]),
        wire("lonely", [2000, 0], [2100, 0]),
      ],
    );
    expect(c.groupOf.get("a")).toBe(c.groupOf.get("b"));
    expect(c.groupOf.get("lonely")).not.toBe(c.groupOf.get("a"));
    expect(c.groupPin.get(c.groupOf.get("a") as number)).toEqual({ part: "r1", pin: "2" });
    expect(c.groupPin.has(c.groupOf.get("lonely") as number)).toBe(false);
  });

  it("leaves out part types it cannot draw, and fixes unusable names", () => {
    const odd: Part = { ...resistor("x", 0, 0), type: "mystery" };
    const named: Part = { ...resistor("r9", 1000, 0), name: "my resistor" };
    const { c } = nets([odd, named]);
    expect(c.input.parts.map((p) => [p.id, p.designator])).toEqual([["r9", "X2"]]);
  });

  it("computes 500 parts and 1 000 wires quickly", () => {
    const parts: Part[] = [];
    const wires: Wire[] = [];
    for (let i = 0; i < 500; i++) {
      const x = (i % 25) * 1000;
      const y = Math.floor(i / 25) * 600;
      parts.push(resistor(`r${i}`, x, y));
      wires.push(wire(`a${i}`, [x + 200, y], [x + 500, y]));
      wires.push(wire(`b${i}`, [x + 500, y], [x + 500, y + 300]));
    }
    const start = Date.now();
    const { netlist } = nets(parts, wires);
    expect(Date.now() - start).toBeLessThan(1_000);
    expect(netlist.components).toHaveLength(500);
  });

  it("names a wire's net for the Inspector", () => {
    const labels = [label("l", 2100, 0, "SENSE")];
    const { c, netlist } = nets(
      [resistor("r1", 0, 0), ground("g", 600, 0)],
      [
        wire("a", [200, 0], [600, 0]),
        wire("b", [2000, 0], [2100, 0]),
        wire("c", [3000, 0], [3100, 0]),
      ],
      labels,
    );
    expect(netNameOf(c, netlist, labels, "a")).toBe("GND");
    expect(netNameOf(c, netlist, labels, "b")).toBe("SENSE");
    expect(netNameOf(c, netlist, labels, "c")).toBeNull();
  });
});
