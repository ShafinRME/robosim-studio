import { describe, expect, it } from "vitest";
import type { ComponentDefinition } from "./component";
import {
  ISSUE_CODES,
  ISSUE_SEVERITY,
  canSimulate,
  checkCircuit,
  listNames,
  solverIssues,
  sortIssues,
  type CircuitIssue,
} from "./issues";
import { buildNetlist, type CircuitPart, type PinRef } from "./netlist";
import { COMPONENTS, requireComponent } from "../parts/registry";

const REFERENCE_PARTS = COMPONENTS;
const resistorDefinition = requireComponent("resistor");
const dcVoltageSourceDefinition = requireComponent("source.dc-voltage");
const dcCurrentSourceDefinition = requireComponent("source.dc-current");

/** A capacitor-like part: no DC path, not a source (the real one arrives on Day 18). */
const capacitorLike: ComponentDefinition = {
  ...resistorDefinition,
  type: "capacitor",
  name: "Capacitor",
  designatorPrefix: "C",
  properties: [],
  dcPaths: [],
};
const DEFINITIONS = new Map([...REFERENCE_PARTS, capacitorLike].map((d) => [d.type, d]));
const lookup = (type: string) => DEFINITIONS.get(type);

const pin = (part: string, id: string): PinRef => ({ part, pin: id });
const make = (
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
const R = (id: string, designator = id.toUpperCase(), props = {}) =>
  make(resistorDefinition, id, designator, props);
const V = (id: string, designator = id.toUpperCase(), props = {}) =>
  make(dcVoltageSourceDefinition, id, designator, props);
const I = (id: string, designator = id.toUpperCase()) =>
  make(dcCurrentSourceDefinition, id, designator);
const G = (id = "gnd"): CircuitPart => ({
  id,
  type: "ground",
  designator: "GND1",
  pins: ["1"],
  props: {},
});

type Wire = [PinRef, PinRef];
const check = (parts: CircuitPart[], connections: Wire[]) =>
  checkCircuit(buildNetlist({ parts, connections, labels: [] }), lookup);
const codes = (issues: CircuitIssue[]) => issues.map((i) => i.code);

/** Battery V1 with R1 across it, "-" grounded: the smallest correct circuit. */
const BASIC_PARTS = () => [V("v1"), R("r1"), G()];
const BASIC_WIRES = (): Wire[] => [
  [pin("v1", "+"), pin("r1", "1")],
  [pin("r1", "2"), pin("v1", "-")],
  [pin("v1", "-"), pin("gnd", "1")],
];

describe("checkCircuit", () => {
  it("finds nothing wrong in a correct circuit", () => {
    const issues = check(BASIC_PARTS(), BASIC_WIRES());
    expect(issues).toEqual([]);
    expect(canSimulate(issues)).toBe(true);
  });

  it("says when the circuit is empty (a tip, not an error)", () => {
    const issues = check([G()], []);
    expect(issues).toMatchObject([
      { code: "empty-circuit", severity: "info", message: "The circuit is empty." },
    ]);
    expect(canSimulate(issues)).toBe(true);
  });

  it("asks for a ground when there is none", () => {
    const issues = check(
      [V("v1"), R("r1")],
      [
        [pin("v1", "+"), pin("r1", "1")],
        [pin("r1", "2"), pin("v1", "-")],
      ],
    );
    expect(codes(issues)).toEqual(["no-ground"]);
    expect(issues[0]?.message).toMatch(/no ground \(GND\)/);
    expect(issues[0]?.hint).toMatch(/negative \(−\) side/);
    expect(canSimulate(issues)).toBe(false);
  });

  it("names an open pin like an engineer would (Pin 2 of R2)", () => {
    const issues = check(
      [...BASIC_PARTS(), R("r2")],
      [...BASIC_WIRES(), [pin("r2", "1"), pin("r1", "1")]],
    );
    expect(issues).toEqual([
      {
        code: "unconnected-pin",
        severity: "warning",
        message: "Pin 2 of R2 is not connected to anything.",
        hint: "Draw a wire from it, or delete the part if you do not need it.",
        parts: ["r2"],
        pins: [pin("r2", "2")],
        nets: [expect.any(Number) as number],
      },
    ]);
    expect(canSimulate(issues)).toBe(true);
  });

  it("names a named pin by its name", () => {
    const issues = check([V("v1"), G()], [[pin("v1", "-"), pin("gnd", "1")]]);
    expect(issues.find((i) => i.code === "unconnected-pin")?.message).toBe(
      "The Positive (+) pin of V1 is not connected to anything.",
    );
  });

  it("says a part with no wire at all is not connected yet — once, not once per pin", () => {
    const issues = check([...BASIC_PARTS(), R("r3")], BASIC_WIRES());
    expect(issues).toEqual([
      {
        code: "unconnected-pin",
        severity: "warning",
        message: "R3 is not connected to anything yet.",
        hint: "Draw wires from its pins to the circuit, or delete R3 if you do not need it.",
        parts: ["r3"],
        pins: [pin("r3", "1"), pin("r3", "2")],
        nets: [expect.any(Number) as number, expect.any(Number) as number],
      },
    ]);
    expect(canSimulate(issues)).toBe(true);
  });

  it("warns when a wire joins the two pins of a part (shorted part)", () => {
    const issues = check(
      [...BASIC_PARTS(), R("r2")],
      [...BASIC_WIRES(), [pin("r2", "1"), pin("r1", "1")], [pin("r2", "2"), pin("r2", "1")]],
    );
    expect(issues).toEqual([
      {
        code: "shorted-part",
        severity: "warning",
        message:
          "R2 is short-circuited: a wire joins its two pins, so no current flows through it.",
        hint: "Remove that wire if R2 should do something in the circuit.",
        parts: ["r2"],
        pins: [pin("r2", "1"), pin("r2", "2")],
        nets: [expect.any(Number) as number],
      },
    ]);
    expect(canSimulate(issues)).toBe(true);
  });

  it("words a shorted current source and a fully shorted potentiometer, but not a rheostat", () => {
    const pot = requireComponent("resistor.potentiometer");
    const shortedSource = check(
      [...BASIC_PARTS(), I("i1")],
      [...BASIC_WIRES(), [pin("i1", "out"), pin("r1", "1")], [pin("i1", "in"), pin("r1", "1")]],
    );
    expect(shortedSource.map((i) => i.message)).toEqual([
      "I1 is short-circuited: a wire joins its two pins, so its current only flows around that wire.",
    ]);
    const allPins = check(
      [...BASIC_PARTS(), make(pot, "rv1", "RV1")],
      [
        ...BASIC_WIRES(),
        [pin("rv1", "1"), pin("r1", "1")],
        [pin("rv1", "2"), pin("r1", "1")],
        [pin("rv1", "w"), pin("r1", "1")],
      ],
    );
    expect(allPins.map((i) => i.message)).toEqual([
      "RV1 is short-circuited: a wire joins all its pins, so no current flows through it.",
    ]);
    // Wiper joined to one end is the usual variable-resistor connection: no warning.
    const rheostat = check(
      [...BASIC_PARTS(), make(pot, "rv1", "RV1")],
      [
        ...BASIC_WIRES(),
        [pin("rv1", "1"), pin("r1", "1")],
        [pin("rv1", "w"), pin("rv1", "2")],
        [pin("rv1", "2"), pin("gnd", "1")],
      ],
    );
    expect(rheostat).toEqual([]);
  });

  it("finds a group of parts that is not connected to ground", () => {
    const issues = check(
      [...BASIC_PARTS(), R("r3"), R("r4")],
      [...BASIC_WIRES(), [pin("r3", "1"), pin("r4", "1")], [pin("r3", "2"), pin("r4", "2")]],
    );
    expect(issues).toMatchObject([
      {
        code: "floating-node",
        severity: "warning",
        message: "R3 and R4 are not connected to ground, so they are left out of the results.",
        hint: "Connect them to the rest of the circuit, or to ground (GND).",
        parts: ["r3", "r4"],
      },
    ]);
  });

  it("treats a node between capacitors as floating (no DC path)", () => {
    const issues = check(
      [...BASIC_PARTS(), make(capacitorLike, "c1", "C1"), make(capacitorLike, "c2", "C2")],
      [
        ...BASIC_WIRES(),
        [pin("c1", "1"), pin("r1", "1")],
        [pin("c1", "2"), pin("c2", "1")],
        [pin("c2", "2"), pin("gnd", "1")],
      ],
    );
    expect(codes(issues)).toEqual(["floating-node"]);
    expect(issues[0]?.message).toMatch(/^C1 and C2 are not connected/);
  });

  it("explains a short-circuited battery", () => {
    const issues = check(BASIC_PARTS(), [...BASIC_WIRES(), [pin("v1", "+"), pin("v1", "-")]]);
    expect(issues).toMatchObject([
      {
        code: "voltage-source-loop",
        message: "V1 is short-circuited: a wire connects its two sides directly.",
        hint: "Remove the wire, or add a resistor in series to limit the current.",
        parts: ["v1"],
      },
      {
        code: "shorted-part",
        severity: "warning",
        message:
          "R1 is short-circuited: a wire joins its two pins, so no current flows through it.",
        parts: ["r1"],
      },
    ]);
  });

  it("explains two supplies joined directly", () => {
    const issues = check(
      [...BASIC_PARTS(), V("v2")],
      [...BASIC_WIRES(), [pin("v2", "+"), pin("v1", "+")], [pin("v2", "-"), pin("v1", "-")]],
    );
    expect(issues).toMatchObject([
      {
        code: "voltage-source-loop",
        message:
          "V1 and V2 are joined directly (in parallel or in a loop) with nothing to limit the current.",
        parts: ["v1", "v2"],
      },
    ]);
  });

  it("finds a loop through three sources", () => {
    const issues = check(
      [V("v1"), V("v2"), V("v3"), R("r1"), G()],
      [
        [pin("v1", "+"), pin("v2", "-")],
        [pin("v2", "+"), pin("v3", "-")],
        [pin("v3", "+"), pin("v1", "-")],
        [pin("v1", "-"), pin("gnd", "1")],
        [pin("r1", "1"), pin("v1", "+")],
        [pin("r1", "2"), pin("gnd", "1")],
      ],
    );
    expect(issues.filter((i) => i.code === "voltage-source-loop")).toMatchObject([
      { message: expect.stringMatching(/^V1, V2 and V3 are joined directly/) as string },
    ]);
  });

  it("allows sources in series (not a loop)", () => {
    const issues = check(
      [V("v1"), V("v2"), R("r1"), G()],
      [
        [pin("v1", "+"), pin("v2", "-")],
        [pin("v2", "+"), pin("r1", "1")],
        [pin("r1", "2"), pin("v1", "-")],
        [pin("v1", "-"), pin("gnd", "1")],
      ],
    );
    expect(issues).toEqual([]);
  });

  it("explains a current source with nowhere to send its current", () => {
    const issues = check(
      [...BASIC_PARTS(), I("i1")],
      [...BASIC_WIRES(), [pin("i1", "in"), pin("gnd", "1")]],
    );
    expect(codes(issues)).toEqual(["current-source-cutset", "unconnected-pin"]);
    expect(issues[0]?.message).toBe("I1 has nowhere to send its current.");
  });

  it("explains two current sources in series", () => {
    const issues = check(
      [...BASIC_PARTS(), I("i1"), I("i2")],
      [
        ...BASIC_WIRES(),
        [pin("i1", "in"), pin("gnd", "1")],
        [pin("i1", "out"), pin("i2", "in")],
        [pin("i2", "out"), pin("r1", "1")],
      ],
    );
    expect(issues).toMatchObject([
      {
        code: "current-source-cutset",
        message: "I1 and I2 have nowhere to send their current.",
        parts: ["i1", "i2"],
      },
    ]);
  });

  it("explains wrong property values in plain words", () => {
    const issues = check(
      [
        V("v1"),
        R("r1", "R1", { resistance: 0, tolerance: 2 }),
        R("r2", "R2", { resistance: "abc" }),
        G(),
      ],
      [
        [pin("v1", "+"), pin("r1", "1")],
        [pin("r1", "2"), pin("r2", "1")],
        [pin("r2", "2"), pin("v1", "-")],
        [pin("v1", "-"), pin("gnd", "1")],
      ],
    );
    expect(issues.map((i) => i.message)).toEqual([
      "Resistance of R1 must be more than 0 Ω.",
      "Tolerance of R1 must be at most 50 %.",
      "Resistance of R2 is not a valid number of Ω.",
    ]);
    expect(
      issues.every(
        (i) => i.code === "invalid-value" && i.hint === "Change the value in the Inspector.",
      ),
    ).toBe(true);
  });

  it("warns about two parts with the same designator", () => {
    const issues = check(
      [...BASIC_PARTS(), R("r2", "R1")],
      [...BASIC_WIRES(), [pin("r2", "1"), pin("r1", "1")], [pin("r2", "2"), pin("r1", "2")]],
    );
    expect(issues).toMatchObject([
      { code: "duplicate-designator", message: "2 parts are named R1.", parts: ["r1", "r2"] },
    ]);
  });

  it("reports parts this version does not know without crashing", () => {
    const unknown: CircuitPart = {
      id: "x1",
      type: "flux-capacitor",
      designator: "X1",
      pins: ["1", "2"],
      props: {},
    };
    const issues = check(
      [...BASIC_PARTS(), unknown],
      [...BASIC_WIRES(), [pin("x1", "1"), pin("r1", "1")], [pin("x1", "2"), pin("gnd", "1")]],
    );
    expect(issues).toMatchObject([
      { code: "model-error", message: expect.stringMatching(/X1 .* "flux-capacitor"/) as string },
    ]);
  });

  it("lists errors before warnings and gives the same result every time", () => {
    const parts = [V("v1"), R("r1"), R("r2"), G()];
    const wires: Wire[] = [
      [pin("v1", "+"), pin("v1", "-")],
      [pin("v1", "-"), pin("gnd", "1")],
      [pin("r1", "1"), pin("gnd", "1")],
    ];
    const issues = check(parts, wires);
    const severities = issues.map((i) => i.severity);
    expect(severities).toEqual(
      [...severities].sort((a, b) => (a === b ? 0 : a === "error" ? -1 : 1)),
    );
    expect(check([...parts].reverse(), [...wires].reverse())).toEqual(issues);
  });

  it("never uses developer words in messages", () => {
    const issues = [
      ...check([V("v1"), R("r1")], []),
      ...check(BASIC_PARTS(), [...BASIC_WIRES(), [pin("v1", "+"), pin("v1", "-")]]),
    ];
    for (const { message, hint } of issues) {
      expect(`${message} ${hint ?? ""}`).not.toMatch(/NaN|undefined|null|matrix|node \d|netlist/i);
    }
  });
});

describe("issue table", () => {
  it("gives every code a severity", () => {
    for (const code of ISSUE_CODES) expect(ISSUE_SEVERITY[code]).toMatch(/^(error|warning|info)$/);
  });

  it("has messages ready for the solver's own issues", () => {
    expect(solverIssues.singularMatrix().severity).toBe("error");
    expect(solverIssues.noConvergence().code).toBe("no-convergence");
    expect(solverIssues.modelError("non-finite stamp").hint).toBe("Please report this problem.");
    expect(solverIssues.overLimit("R2", "0.6 W, rated 0.25 W", "r2")).toMatchObject({
      severity: "warning",
      message: "R2 is beyond its rating: 0.6 W, rated 0.25 W.",
      parts: ["r2"],
    });
  });

  it("sorts by severity, then code", () => {
    const sorted = sortIssues([
      solverIssues.overLimit("R1", "x", "r1"),
      solverIssues.singularMatrix(),
    ]);
    expect(sorted.map((i) => i.code)).toEqual(["singular-matrix", "over-limit"]);
  });
});

describe("listNames", () => {
  it.each([
    [[], ""],
    [["R1"], "R1"],
    [["R1", "R2"], "R1 and R2"],
    [["R1", "R2", "R3"], "R1, R2 and R3"],
    [["R1", "R2", "R3", "R4", "R5"], "R1, R2, R3 and 2 more"],
  ])("lists %j as %s", (names, expected) => {
    expect(listNames(names)).toBe(expected);
  });
});
