import { describe, expect, it } from "vitest";
import { componentFor, requireComponent } from "../parts/registry";
import { solveCircuitDc, type DcResult } from "./dc";
import type { CircuitInput, CircuitPart, PinRef } from "./netlist";

/**
 * Day 15 "done when": 20 textbook DC circuits match the hand-calculated answer within 0.1 %.
 * Circuits are written as parts plus nets; "0" in a net means ground.
 */
type PartSpec = readonly [
  designator: string,
  type: string,
  props?: Record<string, number | boolean>,
];

function circuit(parts: readonly PartSpec[], nets: readonly (readonly string[])[]): CircuitInput {
  const circuitParts: CircuitPart[] = parts.map(([designator, type, props = {}]) => ({
    id: designator.toLowerCase(),
    type,
    designator,
    pins: requireComponent(type).pins.map((p) => p.id),
    props,
  }));
  circuitParts.push({ id: "gnd", type: "ground", designator: "GND1", pins: ["1"], props: {} });
  const ref = (text: string): PinRef => {
    if (text === "0") return { part: "gnd", pin: "1" };
    const [designator = "", pin = ""] = text.split(".");
    return { part: designator.toLowerCase(), pin };
  };
  const connections: [PinRef, PinRef][] = [];
  for (const net of nets) {
    const [first, ...rest] = net.map(ref);
    for (const other of rest) connections.push([first as PinRef, other]);
  }
  return { parts: circuitParts, connections, labels: [] };
}

function solved(parts: readonly PartSpec[], nets: readonly (readonly string[])[]) {
  const result = solveCircuitDc(circuit(parts, nets), componentFor);
  if (!result.ok) throw new Error(result.issues.map((i) => i.message).join("; "));
  const readout = (designator: string, key: string) => {
    const value = result.parts
      .find((p) => p.designator === designator)
      ?.readouts.find((r) => r.key === key)?.value;
    if (value === undefined) throw new Error(`no ${key} for ${designator}`);
    return value;
  };
  /** Voltage of the net a pin is on ("R1.2"). */
  const at = (pin: string) => {
    const [designator = "", id = ""] = pin.split(".");
    const net = result.nets.find((n) =>
      n.pins.some((p) => p.part === designator.toLowerCase() && p.pin === id),
    );
    if (!net) throw new Error(`no net at ${pin}`);
    return net.voltage;
  };
  return { result, readout, at };
}

/** Within 0.1 % of the hand result (absolute 1e-12 near zero). */
function near(actual: number, expected: number) {
  const tolerance = Math.max(Math.abs(expected) * 1e-3, 1e-12);
  expect(Math.abs(actual - expected), `${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);
}

const V = "source.dc-voltage";
const I = "source.dc-current";
const R = "resistor";
const POT = "resistor.potentiometer";
const SW = "switch.spst";

describe("DC operating point — 20 textbook circuits (< 0.1 %)", () => {
  it("1. Ohm's law: 12 V across 4 kΩ → 3 mA", () => {
    const { readout } = solved(
      [
        ["V1", V, { voltage: 12 }],
        ["R1", R, { resistance: 4_000 }],
      ],
      [
        ["V1.+", "R1.1"],
        ["R1.2", "0"],
        ["V1.-", "0"],
      ],
    );
    near(readout("R1", "current"), 0.003);
    near(readout("R1", "voltage"), 12);
  });

  it("2. Voltage divider: 9 V, 1 kΩ over 2 kΩ → 6 V", () => {
    const { at } = solved(
      [
        ["V1", V, { voltage: 9 }],
        ["R1", R, { resistance: 1_000 }],
        ["R2", R, { resistance: 2_000 }],
      ],
      [
        ["V1.+", "R1.1"],
        ["R1.2", "R2.1"],
        ["R2.2", "0"],
        ["V1.-", "0"],
      ],
    );
    near(at("R1.2"), 6);
  });

  it("3. Series resistors: 10 V, 1 k + 2 k + 7 k → 1 mA, drops 1 / 2 / 7 V", () => {
    const { readout } = solved(
      [
        ["V1", V, { voltage: 10 }],
        ["R1", R, { resistance: 1_000 }],
        ["R2", R, { resistance: 2_000 }],
        ["R3", R, { resistance: 7_000 }],
      ],
      [
        ["V1.+", "R1.1"],
        ["R1.2", "R2.1"],
        ["R2.2", "R3.1"],
        ["R3.2", "0"],
        ["V1.-", "0"],
      ],
    );
    near(readout("R1", "current"), 0.001);
    near(readout("R1", "voltage"), 1);
    near(readout("R2", "voltage"), 2);
    near(readout("R3", "voltage"), 7);
  });

  it("4. Parallel resistors: 6 V on 3 kΩ ∥ 6 kΩ → 2 mA + 1 mA, source gives 3 mA", () => {
    const { readout } = solved(
      [
        ["V1", V, { voltage: 6 }],
        ["R1", R, { resistance: 3_000 }],
        ["R2", R, { resistance: 6_000 }],
      ],
      [
        ["V1.+", "R1.1", "R2.1"],
        ["R1.2", "R2.2", "V1.-", "0"],
      ],
    );
    near(readout("R1", "current"), 0.002);
    near(readout("R2", "current"), 0.001);
    near(readout("V1", "current"), -0.003); // SPICE sign: a source delivering power has I < 0
  });

  it("5. Series–parallel: 12 V, 4 kΩ then 6 kΩ ∥ 3 kΩ → 2 mA, 4 V", () => {
    const { at, readout } = solved(
      [
        ["V1", V, { voltage: 12 }],
        ["R1", R, { resistance: 4_000 }],
        ["R2", R, { resistance: 6_000 }],
        ["R3", R, { resistance: 3_000 }],
      ],
      [
        ["V1.+", "R1.1"],
        ["R1.2", "R2.1", "R3.1"],
        ["R2.2", "R3.2", "V1.-", "0"],
      ],
    );
    near(readout("R1", "current"), 0.002);
    near(at("R1.2"), 4);
  });

  it("6. Balanced Wheatstone bridge: no current in the middle", () => {
    const { readout, at } = solved(
      [
        ["V1", V, { voltage: 10 }],
        ["R1", R, { resistance: 1_000 }],
        ["R2", R, { resistance: 2_000 }],
        ["R3", R, { resistance: 1_000 }],
        ["R4", R, { resistance: 2_000 }],
        ["RG", R, { resistance: 500 }],
      ],
      [
        ["V1.+", "R1.1", "R3.1"],
        ["R1.2", "R2.1", "RG.1"],
        ["R3.2", "R4.1", "RG.2"],
        ["R2.2", "R4.2", "V1.-", "0"],
      ],
    );
    near(readout("RG", "current"), 0);
    near(at("R1.2"), 20 / 3);
  });

  it("7. Unbalanced Wheatstone bridge: 1.4286 mA through the galvanometer", () => {
    // Nodal by hand: 10 = 2.5 a − b and 10 = 5 b − 2 a → a = 60 / 10.5 V, b = a·2.5 − 10.
    const a = 60 / 10.5;
    const b = 2.5 * a - 10;
    const { readout, at } = solved(
      [
        ["V1", V, { voltage: 10 }],
        ["R1", R, { resistance: 1_000 }],
        ["R2", R, { resistance: 2_000 }],
        ["R3", R, { resistance: 2_000 }],
        ["R4", R, { resistance: 1_000 }],
        ["RG", R, { resistance: 1_000 }],
      ],
      [
        ["V1.+", "R1.1", "R3.1"],
        ["R1.2", "R2.1", "RG.1"],
        ["R3.2", "R4.1", "RG.2"],
        ["R2.2", "R4.2", "V1.-", "0"],
      ],
    );
    near(at("R1.2"), a);
    near(at("R3.2"), b);
    near(readout("RG", "current"), (a - b) / 1_000);
  });

  it("8. Current source into a resistor: 2 mA through 3 kΩ → 6 V", () => {
    const { at } = solved(
      [
        ["I1", I, { current: 0.002 }],
        ["R1", R, { resistance: 3_000 }],
      ],
      [
        ["I1.out", "R1.1"],
        ["R1.2", "I1.in", "0"],
      ],
    );
    near(at("R1.1"), 6);
  });

  it("9. Current divider: 3 mA into 1 kΩ ∥ 2 kΩ → 2 mA and 1 mA, 2 V", () => {
    const { at, readout } = solved(
      [
        ["I1", I, { current: 0.003 }],
        ["R1", R, { resistance: 1_000 }],
        ["R2", R, { resistance: 2_000 }],
      ],
      [
        ["I1.out", "R1.1", "R2.1"],
        ["R1.2", "R2.2", "I1.in", "0"],
      ],
    );
    near(at("R1.1"), 2);
    near(readout("R1", "current"), 0.002);
    near(readout("R2", "current"), 0.001);
  });

  it("10. Superposition: 10 V via 1 kΩ plus 1 mA into the node, 1 kΩ to ground → 5.5 V", () => {
    const { at } = solved(
      [
        ["V1", V, { voltage: 10 }],
        ["R1", R, { resistance: 1_000 }],
        ["R2", R, { resistance: 1_000 }],
        ["I1", I, { current: 0.001 }],
      ],
      [
        ["V1.+", "R1.1"],
        ["R1.2", "R2.1", "I1.out"],
        ["R2.2", "I1.in", "V1.-", "0"],
      ],
    );
    near(at("R1.2"), 5.5);
  });

  it("11. Two sources (nodal analysis): 12 V and 6 V through 2 kΩ each, 1 kΩ load → 4.5 V", () => {
    const { at } = solved(
      [
        ["V1", V, { voltage: 12 }],
        ["V2", V, { voltage: 6 }],
        ["R1", R, { resistance: 2_000 }],
        ["R2", R, { resistance: 2_000 }],
        ["R3", R, { resistance: 1_000 }],
      ],
      [
        ["V1.+", "R1.1"],
        ["V2.+", "R2.1"],
        ["R1.2", "R2.2", "R3.1"],
        ["R3.2", "V1.-", "V2.-", "0"],
      ],
    );
    near(at("R3.1"), 4.5);
  });

  it("12. Thévenin: 12 V, 2 kΩ / 2 kΩ divider (6 V, 1 kΩ) with a 1 kΩ load → 3 V", () => {
    const { at, readout } = solved(
      [
        ["V1", V, { voltage: 12 }],
        ["R1", R, { resistance: 2_000 }],
        ["R2", R, { resistance: 2_000 }],
        ["RL", R, { resistance: 1_000 }],
      ],
      [
        ["V1.+", "R1.1"],
        ["R1.2", "R2.1", "RL.1"],
        ["R2.2", "RL.2", "V1.-", "0"],
      ],
    );
    near(at("RL.1"), 3);
    near(readout("RL", "current"), 0.003);
  });

  it("13. Norton: 2 mA with 3 kΩ in parallel feeding 1 kΩ → 1.5 V", () => {
    const { at } = solved(
      [
        ["I1", I, { current: 0.002 }],
        ["RN", R, { resistance: 3_000 }],
        ["RL", R, { resistance: 1_000 }],
      ],
      [
        ["I1.out", "RN.1", "RL.1"],
        ["I1.in", "RN.2", "RL.2", "0"],
      ],
    );
    near(at("RL.1"), 1.5);
  });

  it("14. Ladder network: 10 V, four 1 kΩ → 4 V and 2 V", () => {
    const { at } = solved(
      [
        ["V1", V, { voltage: 10 }],
        ["R1", R, { resistance: 1_000 }],
        ["R2", R, { resistance: 1_000 }],
        ["R3", R, { resistance: 1_000 }],
        ["R4", R, { resistance: 1_000 }],
      ],
      [
        ["V1.+", "R1.1"],
        ["R1.2", "R2.1", "R3.1"],
        ["R3.2", "R4.1"],
        ["R2.2", "R4.2", "V1.-", "0"],
      ],
    );
    near(at("R1.2"), 4);
    near(at("R3.2"), 2);
  });

  it("15. Two-source mesh: 10 V and 5 V, a 5 V source absorbing 1 mA (charging)", () => {
    const { at, readout } = solved(
      [
        ["V1", V, { voltage: 10 }],
        ["V2", V, { voltage: 5 }],
        ["R1", R, { resistance: 1_000 }],
        ["R2", R, { resistance: 2_000 }],
        ["R3", R, { resistance: 1_000 }],
      ],
      [
        ["V1.+", "R1.1"],
        ["R1.2", "R2.1", "R3.1"],
        ["R3.2", "V2.+"],
        ["R2.2", "V1.-", "V2.-", "0"],
      ],
    );
    near(at("R1.2"), 6);
    near(readout("V2", "current"), 0.001);
    near(readout("V2", "power"), 0.005);
  });

  it("16. Power in a resistor: 9 V on 100 Ω → 0.81 W (and a rating warning at 0.25 W)", () => {
    const { readout, result } = solved(
      [
        ["V1", V, { voltage: 9 }],
        ["R1", R, { resistance: 100 }],
      ],
      [
        ["V1.+", "R1.1"],
        ["R1.2", "V1.-", "0"],
      ],
    );
    near(readout("R1", "power"), 0.81);
    expect(result.ok && result.issues.map((i) => i.code)).toContain("over-limit");
    expect(result.ok && result.issues.find((i) => i.code === "over-limit")?.message).toBe(
      "R1 is beyond its rating: 810 mW of 250 mW.",
    );
  });

  it("17. Source power sign (SPICE): 5 V into 1 kΩ → I = −5 mA, absorbed −25 mW", () => {
    const { readout } = solved(
      [
        ["V1", V, { voltage: 5 }],
        ["R1", R, { resistance: 1_000 }],
      ],
      [
        ["V1.+", "R1.1"],
        ["R1.2", "V1.-", "0"],
      ],
    );
    near(readout("V1", "current"), -0.005);
    near(readout("V1", "power"), -0.025);
    near(readout("R1", "power"), 0.025);
  });

  it("18. Switch: closed passes 9 mA, open blocks it", () => {
    const loop = (closed: boolean) =>
      solved(
        [
          ["V1", V, { voltage: 9 }],
          ["SW1", SW, { closed }],
          ["R1", R, { resistance: 1_000 }],
        ],
        [
          ["V1.+", "SW1.1"],
          ["SW1.2", "R1.1"],
          ["R1.2", "V1.-", "0"],
        ],
      );
    near(loop(true).readout("R1", "current"), 0.009);
    expect(Math.abs(loop(false).readout("R1", "current"))).toBeLessThan(1e-8);
    near(loop(false).readout("SW1", "voltage"), 9);
  });

  it("19. Potentiometer divider: 10 V across 10 kΩ at 30 % → 7 V at the wiper", () => {
    const { at } = solved(
      [
        ["V1", V, { voltage: 10 }],
        ["RV1", POT, { resistance: 10_000, position: 0.3 }],
      ],
      [["V1.+", "RV1.1"], ["RV1.2", "V1.-", "0"], ["RV1.w"]],
    );
    near(at("RV1.w"), 7);
  });

  it("20. Loaded potentiometer: 10 V, 10 kΩ at 50 %, 5 kΩ load → 3.333 V", () => {
    const { at } = solved(
      [
        ["V1", V, { voltage: 10 }],
        ["RV1", POT, { resistance: 10_000, position: 0.5 }],
        ["RL", R, { resistance: 5_000 }],
      ],
      [
        ["V1.+", "RV1.1"],
        ["RV1.w", "RL.1"],
        ["RV1.2", "RL.2", "V1.-", "0"],
      ],
    );
    near(at("RV1.w"), 10 / 3);
  });

  it("21. Negative supply: −5 V through 1 kΩ → node at −5 V, −5 mA", () => {
    const { at, readout } = solved(
      [
        ["V1", V, { voltage: -5 }],
        ["R1", R, { resistance: 1_000 }],
      ],
      [
        ["V1.+", "R1.1"],
        ["R1.2", "V1.-", "0"],
      ],
    );
    near(at("R1.1"), -5);
    near(readout("R1", "current"), -0.005);
  });

  it("22. Extreme ratio: 1 V on 1 MΩ + 1 Ω → 0.999999 µV across 1 Ω", () => {
    const { readout } = solved(
      [
        ["V1", V, { voltage: 1 }],
        ["R1", R, { resistance: 1e6 }],
        ["R2", R, { resistance: 1 }],
      ],
      [
        ["V1.+", "R1.1"],
        ["R1.2", "R2.1"],
        ["R2.2", "V1.-", "0"],
      ],
    );
    near(readout("R2", "voltage"), 1 / (1e6 + 1));
  });
});

describe("DC operating point — circuits that cannot be solved say why", () => {
  const codes = (result: DcResult) => result.issues.map((i) => i.code);

  it("no ground", () => {
    const input = circuit(
      [
        ["V1", V, { voltage: 5 }],
        ["R1", R],
      ],
      [
        ["V1.+", "R1.1"],
        ["R1.2", "V1.-"],
      ],
    );
    const result = solveCircuitDc(
      { ...input, parts: input.parts.filter((p) => p.type !== "ground") },
      componentFor,
    );
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("no-ground");
  });

  it("two voltage sources in parallel (a loop of sources)", () => {
    const result = solveCircuitDc(
      circuit(
        [
          ["V1", V, { voltage: 5 }],
          ["V2", V, { voltage: 3 }],
        ],
        [
          ["V1.+", "V2.+"],
          ["V1.-", "V2.-", "0"],
        ],
      ),
      componentFor,
    );
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("voltage-source-loop");
  });

  it("a current source with nowhere to go", () => {
    const result = solveCircuitDc(
      circuit([["I1", I, { current: 0.001 }]], [["I1.in", "0"], ["I1.out"]]),
      componentFor,
    );
    expect(result.ok).toBe(false);
  });

  it("an invalid value", () => {
    const result = solveCircuitDc(
      circuit(
        [
          ["V1", V, { voltage: 5 }],
          ["R1", R, { resistance: -10 }],
        ],
        [
          ["V1.+", "R1.1"],
          ["R1.2", "V1.-", "0"],
        ],
      ),
      componentFor,
    );
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("invalid-value");
  });

  it("a broken drawing becomes an issue, not a crash", () => {
    const result = solveCircuitDc(
      {
        parts: [],
        connections: [
          [
            { part: "x", pin: "1" },
            { part: "y", pin: "1" },
          ],
        ],
        labels: [],
      },
      componentFor,
    );
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("model-error");
  });

  it("a matrix the checks cannot predict is singular → a plain message naming the parts", () => {
    // A test-only part that claims a DC path but stamps nothing: the node behind it is undetermined.
    const resistor = requireComponent(R);
    const broken = {
      ...resistor,
      type: "test.broken",
      create: () => ({ stamp: () => undefined, report: () => [] }),
    };
    const lookup = (type: string) => (type === "test.broken" ? broken : componentFor(type));
    const input = circuit(
      [
        ["V1", V, { voltage: 5 }],
        ["R1", R, { resistance: 1_000 }],
      ],
      [
        ["V1.+", "R1.1"],
        ["R1.2", "V1.-", "0"],
      ],
    );
    input.parts.push({
      id: "x1",
      type: "test.broken",
      designator: "X1",
      pins: ["1", "2"],
      props: {},
    });
    input.parts.push({ id: "r2", type: R, designator: "R2", pins: ["1", "2"], props: {} });
    input.connections.push([
      { part: "x1", pin: "1" },
      { part: "v1", pin: "+" },
    ]);
    input.connections.push([
      { part: "x1", pin: "2" },
      { part: "r2", pin: "1" },
    ]);
    input.connections.push([
      { part: "r2", pin: "2" },
      { part: "r2", pin: "1" },
    ]);
    const result = solveCircuitDc(input, lookup);
    expect(result.ok).toBe(false);
    expect(codes(result)).toEqual(["singular-matrix"]);
    expect(result.issues[0]?.message).toMatch(/around .*X1/);
  });

  it("an empty circuit is not an error", () => {
    const result = solveCircuitDc(circuit([], []), componentFor);
    expect(codes(result)).toContain("empty-circuit");
  });

  it("solves 300 resistors quickly", () => {
    const parts: PartSpec[] = [["V1", V, { voltage: 10 }]];
    const nets: string[][] = [
      ["V1.+", "R1.1"],
      ["V1.-", "0"],
    ];
    for (let i = 1; i <= 300; i++) {
      parts.push([`R${i}`, R, { resistance: 100 }]);
      nets.push([`R${i}.2`, i === 300 ? "0" : `R${i + 1}.1`]);
    }
    const start = Date.now();
    const { readout } = solved(parts, nets);
    expect(Date.now() - start).toBeLessThan(1_000);
    near(readout("R1", "current"), 10 / 30_000);
  });
});
