import { describe, expect, it } from "vitest";
import type { CircuitPart, PinRef } from "../circuit/netlist";
import { simulate } from "../circuit/testing";
import { requireComponent } from "./registry";

const pin = (part: string, id: string): PinRef => ({ part, pin: id });
const part = (type: string, id: string, designator: string, props = {}): CircuitPart => ({
  id,
  type,
  designator,
  pins: requireComponent(type).pins.map((p) => p.id),
  props,
});
const ground: CircuitPart = { id: "g", type: "ground", designator: "GND1", pins: ["1"], props: {} };

describe("SPST switch", () => {
  /** 9 V → SW1 → R1 (1 kΩ) → ground. */
  const loop = (closed: boolean) =>
    simulate({
      parts: [
        part("source.dc-voltage", "v1", "V1", { voltage: 9 }),
        part("switch.spst", "sw1", "SW1", { closed }),
        part("resistor", "r1", "R1", { resistance: 1_000 }),
        ground,
      ],
      connections: [
        [pin("v1", "+"), pin("sw1", "1")],
        [pin("sw1", "2"), pin("r1", "1")],
        [pin("r1", "2"), pin("g", "1")],
        [pin("v1", "-"), pin("g", "1")],
      ],
      labels: [],
    });

  it("closed: R1 gets the full 9 V and 9 mA flows", () => {
    const { report } = loop(true);
    expect(report("R1").voltage).toBeCloseTo(9, 4);
    expect(report("R1").current).toBeCloseTo(0.009, 6);
    expect(report("SW1").voltage).toBeCloseTo(0, 4);
  });

  it("open: (almost) no current, the whole 9 V across the switch", () => {
    const { report } = loop(false);
    expect(Math.abs(report("R1").current ?? 1)).toBeLessThan(1e-8);
    expect(report("SW1").voltage).toBeCloseTo(9, 4);
  });

  it("is open by default", () => {
    expect(requireComponent("switch.spst").properties[0]).toMatchObject({
      key: "closed",
      default: false,
    });
  });
});

describe("potentiometer", () => {
  /** 10 V across a 10 kΩ pot; the wiper voltage follows the position. */
  const divider = (position: number) =>
    simulate({
      parts: [
        part("source.dc-voltage", "v1", "V1", { voltage: 10 }),
        part("resistor.potentiometer", "rv1", "RV1", { resistance: 10_000, position }),
        ground,
      ],
      connections: [
        [pin("v1", "+"), pin("rv1", "1")],
        [pin("rv1", "2"), pin("g", "1")],
        [pin("v1", "-"), pin("g", "1")],
      ],
      labels: [],
    });

  it.each([
    [0, 10],
    [0.25, 7.5],
    [0.5, 5],
    [1, 0],
  ])("wiper at %s of the way from pin 1 gives %s V", (position, volts) => {
    const { report } = divider(position);
    expect(report("RV1").wiper).toBeCloseTo(volts, 3);
    expect(report("RV1").current).toBeCloseTo(0.001, 6);
  });

  it("refuses a wiper position outside 0–100 %", () => {
    expect(() => divider(1.2)).toThrow(/too-large/);
  });
});
