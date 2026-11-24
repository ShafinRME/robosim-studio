import { describe, expect, it } from "vitest";
import {
  checkDefinition,
  createDevice,
  resolveProps,
  type ComponentDefinition,
  type Device,
} from "./component";
import { createDenseMna, createSolution } from "./mna";
import { buildNetlist, type CircuitInput, type CircuitPart, type PinRef } from "./netlist";
import {
  REFERENCE_PARTS,
  dcCurrentSourceDefinition,
  dcVoltageSourceDefinition,
  resistorDefinition,
} from "./reference-parts";

/** Test-only Gaussian elimination with partial pivoting (the real LU solver arrives on Day 15). */
function solveDense(matrix: Float64Array, rhs: Float64Array, n: number): Float64Array {
  const a = Float64Array.from(matrix);
  const x = Float64Array.from(rhs);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(a[r * n + col] ?? 0) > Math.abs(a[pivot * n + col] ?? 0)) pivot = r;
    if (Math.abs(a[pivot * n + col] ?? 0) < 1e-15) throw new Error("singular");
    for (let c = 0; c < n; c++)
      [a[col * n + c], a[pivot * n + c]] = [a[pivot * n + c] ?? 0, a[col * n + c] ?? 0];
    [x[col], x[pivot]] = [x[pivot] ?? 0, x[col] ?? 0];
    for (let r = col + 1; r < n; r++) {
      const f = (a[r * n + col] ?? 0) / (a[col * n + col] ?? 1);
      for (let c = col; c < n; c++) a[r * n + c] = (a[r * n + c] ?? 0) - f * (a[col * n + c] ?? 0);
      x[r] = (x[r] ?? 0) - f * (x[col] ?? 0);
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    let sum = x[r] ?? 0;
    for (let c = r + 1; c < n; c++) sum -= (a[r * n + c] ?? 0) * (x[c] ?? 0);
    x[r] = sum / (a[r * n + r] ?? 1);
  }
  return x;
}

const DEFINITIONS = new Map(REFERENCE_PARTS.map((d) => [d.type, d]));
const pin = (part: string, id: string): PinRef => ({ part, pin: id });
const part = (
  definition: ComponentDefinition,
  id: string,
  designator: string,
  props = {},
): CircuitPart => ({
  id,
  type: definition.type,
  designator,
  pins: definition.pins.map((p) => p.id),
  props,
});
const groundPart: CircuitPart = {
  id: "gnd",
  type: "ground",
  designator: "GND1",
  pins: ["1"],
  props: {},
};

/** Netlist → devices → stamps → solve → reports: the whole Day 11 contract end to end. */
function simulate(input: CircuitInput) {
  const netlist = buildNetlist(input);
  let branch = 0;
  const devices = new Map<string, Device>();
  for (const component of netlist.components) {
    const definition = DEFINITIONS.get(component.type);
    if (!definition) throw new Error(`unknown part ${component.type}`);
    const created = createDevice(definition, component, branch, 0);
    if (!created.ok) throw new Error(JSON.stringify(created.problems));
    devices.set(component.designator, created.device);
    branch += definition.branches;
  }
  const mna = createDenseMna(netlist.nets.length, branch);
  for (const device of devices.values()) device.stamp(mna.context);
  const solution = createSolution(
    solveDense(mna.matrix, mna.rhs, mna.size),
    netlist.nets.length,
    branch,
  );
  const report = (designator: string) =>
    Object.fromEntries(
      (devices.get(designator)?.report(solution) ?? []).map((r) => [r.key, r.value]),
    );
  return { netlist, solution, report };
}

describe("reference parts", () => {
  it("are valid definitions", () => {
    for (const definition of REFERENCE_PARTS) expect(checkDefinition(definition)).toEqual([]);
  });

  it("solve a 9 V divider (1 kΩ + 2 kΩ) exactly, with SPICE sign conventions", () => {
    const { report } = simulate({
      parts: [
        part(dcVoltageSourceDefinition, "v1", "V1", { voltage: 9 }),
        part(resistorDefinition, "r1", "R1", { resistance: 1_000 }),
        part(resistorDefinition, "r2", "R2", { resistance: 2_000 }),
        groundPart,
      ],
      connections: [
        [pin("v1", "+"), pin("r1", "1")],
        [pin("r1", "2"), pin("r2", "1")],
        [pin("r2", "2"), pin("v1", "-")],
        [pin("v1", "-"), pin("gnd", "1")],
      ],
      labels: [],
    });
    expect(report("R2").voltage).toBeCloseTo(6, 12);
    expect(report("R1").current).toBeCloseTo(0.003, 15);
    // The battery delivers 27 mW: its branch current (+ → through → −) is negative.
    expect(report("V1").current).toBeCloseTo(-0.003, 15);
    expect(report("V1").power).toBeCloseTo(-0.027, 15);
    expect((report("R1").power ?? 0) + (report("R2").power ?? 0)).toBeCloseTo(0.027, 15);
  });

  it("push a current source's current out at its arrow", () => {
    const { report } = simulate({
      parts: [
        part(dcCurrentSourceDefinition, "i1", "I1", { current: 0.002 }),
        part(resistorDefinition, "r1", "R1", { resistance: 1_000 }),
        groundPart,
      ],
      connections: [
        [pin("i1", "in"), pin("gnd", "1")],
        [pin("i1", "out"), pin("r1", "1")],
        [pin("r1", "2"), pin("gnd", "1")],
      ],
      labels: [],
    });
    expect(report("R1").voltage).toBeCloseTo(2, 12);
    expect(report("I1").power).toBeCloseTo(-0.004, 15);
  });

  it("use defaults for missing properties", () => {
    const { report } = simulate({
      parts: [
        part(dcVoltageSourceDefinition, "v1", "V1"),
        part(resistorDefinition, "r1", "R1"),
        groundPart,
      ],
      connections: [
        [pin("v1", "+"), pin("r1", "1")],
        [pin("r1", "2"), pin("gnd", "1")],
        [pin("v1", "-"), pin("gnd", "1")],
      ],
      labels: [],
    });
    expect(report("R1").current).toBeCloseTo(0.005, 15); // 5 V / 1 kΩ
  });
});

describe("resolveProps", () => {
  it("fills defaults and ignores unknown keys", () => {
    const result = resolveProps(resistorDefinition, { resistance: 220, colour: "brown" });
    expect(result).toEqual({
      ok: true,
      props: { resistance: 220, tolerance: 0.05, powerRating: 0.25 },
    });
  });

  it("reports wrong types and out-of-range values per property", () => {
    expect(resolveProps(resistorDefinition, { resistance: 0 })).toEqual({
      ok: false,
      problems: [{ key: "resistance", reason: "too-small" }],
    });
    expect(resolveProps(resistorDefinition, { resistance: "4k7", tolerance: 2 })).toEqual({
      ok: false,
      problems: [
        { key: "resistance", reason: "wrong-type" },
        { key: "tolerance", reason: "too-large" },
      ],
    });
    expect(
      resolveProps(resistorDefinition, { resistance: Number.POSITIVE_INFINITY }),
    ).toMatchObject({
      ok: false,
      problems: [{ key: "resistance", reason: "not-finite" }],
    });
  });

  it("checks choice and boolean properties", () => {
    const definition: ComponentDefinition = {
      ...resistorDefinition,
      properties: [
        {
          kind: "choice",
          key: "colour",
          label: "Colour",
          options: ["red", "green"],
          default: "red",
        },
        { kind: "boolean", key: "on", label: "On", default: false },
      ],
    };
    expect(resolveProps(definition, { colour: "blue", on: 1 })).toEqual({
      ok: false,
      problems: [
        { key: "colour", reason: "not-an-option" },
        { key: "on", reason: "wrong-type" },
      ],
    });
  });

  it("never reads inherited keys", () => {
    const props = Object.create({ resistance: -5 }) as Record<string, number>;
    expect(resolveProps(resistorDefinition, props)).toMatchObject({
      ok: true,
      props: { resistance: 1_000 },
    });
  });
});

describe("createDevice", () => {
  const netlist = buildNetlist({
    parts: [part(resistorDefinition, "r1", "R1", { resistance: -1 })],
    connections: [],
    labels: [],
  });
  const component = netlist.components[0];

  it("returns property problems instead of a device", () => {
    if (!component) throw new Error("no component");
    expect(createDevice(resistorDefinition, component, 0, 0)).toEqual({
      ok: false,
      problems: [{ key: "resistance", reason: "too-small" }],
    });
  });

  it("refuses a definition that does not match the component (a bug)", () => {
    if (!component) throw new Error("no component");
    expect(() => createDevice(dcVoltageSourceDefinition, component, 0, 0)).toThrow(/not a source/);
    expect(() =>
      createDevice(
        resistorDefinition,
        {
          ...component,
          pins: [
            { id: "2", node: 1 },
            { id: "1", node: 2 },
          ],
        },
        0,
        0,
      ),
    ).toThrow(/pins/);
  });
});

describe("checkDefinition", () => {
  it("finds the common mistakes in a part file", () => {
    const broken: ComponentDefinition = {
      ...resistorDefinition,
      type: "Resistor!",
      designatorPrefix: "r",
      pins: [
        { id: "1", name: "A", type: "passive" },
        { id: "1", name: "B", type: "passive" },
      ],
      properties: [
        { kind: "number", key: "__proto__", label: "x", quantity: "resistance", default: 1 },
        {
          kind: "number",
          key: "r",
          label: "R",
          quantity: "resistance",
          default: 0,
          min: 0,
          exclusiveMin: true,
        },
        { kind: "number", key: "r", label: "R", quantity: "resistance", default: 1 },
      ],
      branches: -1,
    };
    const problems = checkDefinition(broken).join("\n");
    expect(problems).toMatch(/invalid type/);
    expect(problems).toMatch(/designator prefix/);
    expect(problems).toMatch(/duplicate pin "1"/);
    expect(problems).toMatch(/invalid property key "__proto__"/);
    expect(problems).toMatch(/default of "r" too-small/);
    expect(problems).toMatch(/duplicate property "r"/);
    expect(problems).toMatch(/invalid branches/);
  });
});
