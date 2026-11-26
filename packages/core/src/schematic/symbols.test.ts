import { describe, expect, it } from "vitest";
import { COMPONENTS as REFERENCE_PARTS, requirePart } from "../parts/registry";
import {
  SYMBOLS,
  designatorPrefix,
  nextDesignator,
  placeLabel,
  placeLabels,
  placePoint,
  placedBounds,
  placedPins,
  placementTransform,
  symbolFor,
  type Placement,
} from "./symbols";

const RESISTOR_SYMBOL = requirePart("resistor").symbol;
const DC_VOLTAGE_SYMBOL = requirePart("source.dc-voltage").symbol;
const GROUND_SYMBOL = requirePart("ground").symbol;

const at = (x = 0, y = 0, rotation = 0, flip = false): Placement => ({ x, y, rotation, flip });

describe("symbols", () => {
  it("has a symbol for every reference part, with the same pins", () => {
    for (const part of REFERENCE_PARTS) {
      const symbol = symbolFor(part.type);
      expect(symbol, part.type).toBeDefined();
      expect(symbol?.pins.map((p) => p.id).sort()).toEqual(part.pins.map((p) => p.id).sort());
    }
  });

  it("puts every pin on the 100-mil grid", () => {
    for (const symbol of SYMBOLS) {
      for (const pin of symbol.pins) {
        expect(Math.abs(pin.x % 100), `${symbol.type} ${pin.id}`).toBe(0);
        expect(Math.abs(pin.y % 100), `${symbol.type} ${pin.id}`).toBe(0);
      }
    }
  });

  it("keeps every pin and primitive inside the symbol bounds, in both styles", () => {
    for (const symbol of SYMBOLS) {
      const { minX, minY, maxX, maxY } = symbol.bounds;
      const inside = (x: number, y: number) => x >= minX && x <= maxX && y >= minY && y <= maxY;
      for (const pin of symbol.pins) expect(inside(pin.x, pin.y)).toBe(true);
      for (const style of ["iec", "ansi"] as const) {
        for (const p of symbol.body[style]) {
          if (p.kind === "line") expect(inside(p.x1, p.y1) && inside(p.x2, p.y2)).toBe(true);
          if (p.kind === "circle")
            expect(inside(p.cx - p.r, p.cy - p.r) && inside(p.cx + p.r, p.cy + p.r)).toBe(true);
          if (p.kind === "rect")
            expect(inside(p.x, p.y) && inside(p.x + p.width, p.y + p.height)).toBe(true);
        }
      }
    }
  });

  it("draws IEC and ANSI resistors differently (box vs zig-zag)", () => {
    expect(RESISTOR_SYMBOL.body.iec.some((p) => p.kind === "rect")).toBe(true);
    expect(RESISTOR_SYMBOL.body.ansi.some((p) => p.kind === "polyline")).toBe(true);
    expect(GROUND_SYMBOL.body.iec).toBe(GROUND_SYMBOL.body.ansi);
  });

  it("returns undefined for unknown types", () => {
    expect(symbolFor("flux-capacitor")).toBeUndefined();
  });
});

describe("placement", () => {
  it("rotates clockwise on screen (y down)", () => {
    expect(placePoint(at(0, 0, 90), { x: 100, y: 0 })).toEqual({ x: 0, y: 100 });
    expect(placePoint(at(0, 0, 180), { x: 100, y: 0 })).toEqual({ x: -100, y: 0 });
    expect(placePoint(at(0, 0, 270), { x: 100, y: 0 })).toEqual({ x: 0, y: -100 });
  });

  it("mirrors first, then rotates, then moves", () => {
    expect(placePoint(at(1000, 500, 0, true), { x: 100, y: 20 })).toEqual({ x: 900, y: 520 });
    // mirror (100, 20) → (−100, 20); rotate 90° cw → (−20, −100); move.
    expect(placePoint(at(1000, 500, 90, true), { x: 100, y: 20 })).toEqual({ x: 980, y: 400 });
  });

  it("matches the SVG transform it produces", () => {
    expect(placementTransform(at(100, 200))).toBe("translate(100 200)");
    expect(placementTransform(at(100, 200, 90, true))).toBe(
      "translate(100 200) rotate(90) scale(-1 1)",
    );
  });

  it("places pins in world coordinates, still on the grid", () => {
    expect(placedPins(at(1000, 1000, 90), RESISTOR_SYMBOL)).toEqual([
      { id: "1", x: 1000, y: 800 },
      { id: "2", x: 1000, y: 1200 },
    ]);
    expect(placedPins(at(500, 0, 0, true), DC_VOLTAGE_SYMBOL)).toEqual([
      { id: "+", x: 500, y: -200 },
      { id: "-", x: 500, y: 200 },
    ]);
  });

  it("computes world bounds after rotation", () => {
    expect(placedBounds(at(0, 0, 90), RESISTOR_SYMBOL)).toEqual({
      minX: -40,
      minY: -200,
      maxX: 40,
      maxY: 200,
    });
  });

  it("keeps labels upright and aligned away from the body", () => {
    // Horizontal resistor: designator centred above, value centred below.
    expect(placeLabel(at(), { x: 0, y: -90 })).toEqual({
      x: 0,
      y: -90,
      anchor: "middle",
      baseline: "auto",
    });
    expect(placeLabel(at(), { x: 0, y: 90 })).toMatchObject({
      anchor: "middle",
      baseline: "hanging",
    });
    // Rotated 90°: the labels move beside the body and read left-to-right.
    expect(placeLabel(at(0, 0, 90), { x: 0, y: -90 })).toMatchObject({
      x: 90,
      anchor: "start",
      baseline: "middle",
    });
    expect(placeLabel(at(0, 0, 90), { x: 0, y: 90 })).toMatchObject({ x: -90, anchor: "end" });
    // Flipped source: label goes to the other side.
    expect(placeLabel(at(0, 0, 0, true), { x: 150, y: -40 })).toMatchObject({
      x: -150,
      anchor: "end",
    });
  });
});

describe("designators", () => {
  it("uses standard prefixes", () => {
    expect(designatorPrefix("resistor")).toBe("R");
    expect(designatorPrefix("source.dc-voltage")).toBe("V");
    expect(designatorPrefix("source.dc-current")).toBe("I");
    expect(designatorPrefix("ground")).toBe("GND");
    expect(designatorPrefix("unknown")).toBe("X");
  });

  it("gives the lowest free number, reusing gaps", () => {
    expect(nextDesignator("R", [])).toBe("R1");
    expect(nextDesignator("R", ["R1", "R2", "R4"])).toBe("R3");
    expect(nextDesignator("R", ["R1", "RV1", "R01", "R_load", "V1"])).toBe("R2");
    expect(nextDesignator("GND", ["GND1"])).toBe("GND2");
  });
});

describe("placeLabels", () => {
  it("keeps designator and value on opposite sides when the symbol says so (resistor)", () => {
    const labels = placeLabels(at(), RESISTOR_SYMBOL);
    expect(labels?.designator).toMatchObject({ x: 0, y: -90, anchor: "middle" });
    expect(labels?.value).toMatchObject({ x: 0, y: 90, anchor: "middle" });
  });

  it("stacks labels that share a side: designator on top, value under it", () => {
    const upright = placeLabels(at(), DC_VOLTAGE_SYMBOL);
    expect(upright?.designator).toMatchObject({ x: 150, anchor: "start" });
    expect(upright?.value.x).toBe(150);
    expect(upright!.designator.y).toBeLessThan(upright!.value.y);

    // Rotated 90°: both labels fall below the body → centred, stacked, never on one line.
    const turned = placeLabels(at(0, 0, 90), DC_VOLTAGE_SYMBOL);
    expect(turned?.designator).toMatchObject({
      x: 0,
      y: 150,
      anchor: "middle",
      baseline: "hanging",
    });
    expect(turned?.value).toMatchObject({ x: 0, y: 220, anchor: "middle" });

    // Rotated 180°: labels on the left, designator still on top.
    const flipped = placeLabels(at(0, 0, 180), DC_VOLTAGE_SYMBOL);
    expect(flipped?.designator).toMatchObject({ x: -150, anchor: "end" });
    expect(flipped!.designator.y).toBeLessThan(flipped!.value.y);

    // Rotated 270°: both above → designator line above the value line.
    const up = placeLabels(at(0, 0, 270), DC_VOLTAGE_SYMBOL);
    expect(up!.designator.y).toBeLessThan(up!.value.y);
    expect(up!.value.y).toBe(-150);
  });

  it("returns null for symbols without labels", () => {
    expect(placeLabels(at(), GROUND_SYMBOL)).toBeNull();
  });
});
