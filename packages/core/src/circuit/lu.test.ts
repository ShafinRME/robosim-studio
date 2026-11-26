import { describe, expect, it } from "vitest";
import { SingularMatrixError, factorLu } from "./lu";
import { createDenseMna } from "./mna";

const solve = (rows: number[][], b: number[]) => [...factorLu(rows.flat(), b.length).solve(b)];

/** Small seeded random numbers (tests must be repeatable). */
function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 2 ** 32;
  };
}

function residual(matrix: Float64Array, x: Float64Array, b: Float64Array, n: number): number {
  let worst = 0;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) sum += (matrix[i * n + j] as number) * (x[j] as number);
    worst = Math.max(worst, Math.abs(sum - (b[i] as number)));
  }
  return worst;
}

describe("factorLu", () => {
  it("solves small systems exactly", () => {
    expect(
      solve(
        [
          [2, 1],
          [1, 3],
        ],
        [3, 5],
      ),
    ).toEqual([0.8, 1.4]);
    const x = solve(
      [
        [4, -2, 1],
        [-2, 4, -2],
        [1, -2, 4],
      ],
      [11, -16, 17],
    );
    [1, -2, 3].forEach((v, i) => expect(x[i]).toBeCloseTo(v, 12));
    expect(solve([], [])).toEqual([]);
  });

  it("pivots past the zero diagonal every voltage source makes", () => {
    // 9 V source on node 1 with 1 kΩ to ground: [[g, 1], [1, 0]] · [v, i] = [0, 9].
    const x = solve(
      [
        [1e-3, 1],
        [1, 0],
      ],
      [0, 9],
    );
    expect(x[0]).toBeCloseTo(9, 12);
    expect(x[1]).toBeCloseTo(-0.009, 15);
  });

  it("stays exact with badly scaled values (1 mΩ next to 1 GΩ)", () => {
    // 10 V across 1 GΩ then 1 mΩ to ground, built with the real MNA stamps.
    const mna = createDenseMna(3, 1);
    mna.context.voltageSource(0, 1, 0, 10);
    mna.context.conductance(1, 2, 1e-9);
    mna.context.conductance(2, 0, 1e3);
    const x = factorLu(mna.matrix, mna.size).solve(mna.rhs);
    const current = 10 / (1e9 + 1e-3);
    expect(x[1]).toBeCloseTo(current * 1e-3, 22); // node 2 = I · 1 mΩ ≈ 1e-11 V
    expect(Math.abs(((x[2] as number) + current) / current)).toBeLessThan(1e-12);
  });

  it("reuses one factorisation for many right-hand sides and leaves its input alone", () => {
    const matrix = new Float64Array([3, 1, 1, 2]);
    const lu = factorLu(matrix, 2);
    expect([...lu.solve([5, 5])]).toEqual([1, 2]);
    expect([...lu.solve([4, 3])]).toEqual([1, 1]);
    expect([...matrix]).toEqual([3, 1, 1, 2]);
  });

  it("reports which unknown is undetermined in a singular matrix", () => {
    // Two equal rows: the second unknown has no pivot.
    expect(() =>
      solve(
        [
          [1, 1],
          [2, 2],
        ],
        [1, 2],
      ),
    ).toThrow(SingularMatrixError);
    try {
      solve(
        [
          [1, 0, 0],
          [0, 0, 0],
          [0, 0, 1],
        ],
        [1, 1, 1],
      );
    } catch (error) {
      expect(error).toBeInstanceOf(SingularMatrixError);
      expect((error as SingularMatrixError).unknown).toBe(1);
    }
  });

  it("treats a nearly singular matrix as singular instead of returning huge numbers", () => {
    expect(() =>
      solve(
        [
          [1, 1],
          [1, 1 + 1e-15],
        ],
        [1, 2],
      ),
    ).toThrow(SingularMatrixError);
  });

  it("refuses non-finite entries and wrong sizes", () => {
    expect(() => factorLu([1, Number.NaN, 0, 1], 2)).toThrow(RangeError);
    expect(() => factorLu([1, 2, 3], 2)).toThrow(RangeError);
    expect(() => factorLu([1, 0, 0, 1], 2).solve([1])).toThrow(RangeError);
  });

  it("solves random systems accurately (A·x − b ≈ 0)", () => {
    const next = random(42);
    for (const n of [5, 40, 120]) {
      const matrix = new Float64Array(n * n);
      const b = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        b[i] = next() * 2 - 1;
        for (let j = 0; j < n; j++) matrix[i * n + j] = next() * 2 - 1;
      }
      const x = factorLu(matrix, n).solve(b);
      expect(residual(matrix, x, b, n), `n = ${n}`).toBeLessThan(1e-9);
    }
  });

  it("factors 500 unknowns quickly", () => {
    const n = 500;
    const next = random(7);
    const matrix = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) matrix[i * n + j] = next() - 0.5;
      matrix[i * n + i] = (matrix[i * n + i] as number) + n; // well-conditioned, like a circuit
    }
    const b = new Float64Array(n).fill(1);
    const start = Date.now();
    const x = factorLu(matrix, n).solve(b);
    expect(Date.now() - start).toBeLessThan(1_000);
    expect(residual(matrix, x, b, n)).toBeLessThan(1e-9);
  });
});
