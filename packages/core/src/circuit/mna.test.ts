import { describe, expect, it } from "vitest";
import { MAX_DENSE_UNKNOWNS, MnaStampError, createDenseMna, createSolution } from "./mna";

/** Rows of the dense matrix as plain arrays (easy to compare with textbook stamps). */
const rows = (mna: ReturnType<typeof createDenseMna>) =>
  Array.from({ length: mna.size }, (_, r) =>
    Array.from(mna.matrix.slice(r * mna.size, (r + 1) * mna.size)),
  );

describe("createDenseMna", () => {
  it("lays out node unknowns first, then branches; ground is dropped", () => {
    const mna = createDenseMna(3, 2);
    expect(mna.size).toBe(4);
    expect(mna.context.node(0)).toBe(-1);
    expect(mna.context.node(1)).toBe(0);
    expect(mna.context.node(2)).toBe(1);
    expect(mna.context.branch(0)).toBe(2);
    expect(mna.context.branch(1)).toBe(3);
  });

  it("stamps a conductance between two nodes and to ground", () => {
    const mna = createDenseMna(3, 0);
    mna.context.conductance(1, 2, 0.5);
    mna.context.conductance(2, 0, 0.25);
    expect(rows(mna)).toEqual([
      [0.5, -0.5],
      [-0.5, 0.75],
    ]);
  });

  it("stamps a current source with SPICE direction (a → through → b)", () => {
    const mna = createDenseMna(3, 0);
    mna.context.current(1, 2, 0.002);
    expect(Array.from(mna.rhs)).toEqual([-0.002, 0.002]);
  });

  it("stamps an ideal voltage source with its branch current", () => {
    const mna = createDenseMna(3, 1);
    mna.context.voltageSource(0, 1, 2, 9);
    expect(rows(mna)).toEqual([
      [0, 0, 1],
      [0, 0, -1],
      [1, -1, 0],
    ]);
    expect(Array.from(mna.rhs)).toEqual([0, 0, 9]);
  });

  it("stamps a VCCS and a VCVS like SPICE G and E elements", () => {
    const g = createDenseMna(5, 0);
    g.context.vccs(1, 2, 3, 4, 0.1);
    expect(g.at(0, 2)).toBe(0.1);
    expect(g.at(0, 3)).toBe(-0.1);
    expect(g.at(1, 2)).toBe(-0.1);
    expect(g.at(1, 3)).toBe(0.1);

    const e = createDenseMna(4, 1);
    e.context.vcvs(0, 1, 0, 2, 3, 10);
    const j = e.context.branch(0);
    expect(e.at(0, j)).toBe(1);
    expect(e.at(j, 0)).toBe(1);
    expect(e.at(j, 1)).toBe(-10);
    expect(e.at(j, 2)).toBe(10);
  });

  it("accumulates stamps and clears them", () => {
    const mna = createDenseMna(2, 0);
    mna.context.conductance(1, 0, 1);
    mna.context.conductance(1, 0, 2);
    mna.context.matrix(0, 0, 0.5);
    mna.context.rhs(0, 1);
    expect(mna.at(0, 0)).toBe(3.5);
    mna.clear();
    expect(mna.at(0, 0)).toBe(0);
    expect(mna.rhs[0]).toBe(0);
  });

  it("refuses NaN, Infinity and nodes/branches that do not exist", () => {
    const mna = createDenseMna(2, 1);
    expect(() => mna.context.conductance(1, 0, Number.NaN)).toThrow(MnaStampError);
    expect(() => mna.context.current(1, 0, Infinity)).toThrow(/not a finite number/);
    expect(() => mna.context.conductance(1, 5, 1)).toThrow(/no node 5/);
    expect(() => mna.context.voltageSource(1, 1, 0, 1)).toThrow(/no branch 1/);
    expect(() => mna.context.matrix(9, 0, 1)).toThrow(/no unknown 9/);
    expect(() => mna.context.node(1.5)).toThrow(MnaStampError);
  });

  it("refuses systems too big for a dense matrix", () => {
    expect(() => createDenseMna(MAX_DENSE_UNKNOWNS + 2, 0)).toThrow(/unknowns/);
    expect(() => createDenseMna(0, 0)).toThrow(/ground/);
  });
});

describe("createSolution", () => {
  it("reads node voltages (ground = 0) and branch currents", () => {
    const solution = createSolution([6, 3, -0.003], 3, 1);
    expect(solution.voltage(0)).toBe(0);
    expect(solution.voltage(2)).toBe(3);
    expect(solution.branchCurrent(0)).toBe(-0.003);
    expect(() => solution.voltage(3)).toThrow(MnaStampError);
    expect(() => solution.branchCurrent(1)).toThrow(MnaStampError);
  });
});
