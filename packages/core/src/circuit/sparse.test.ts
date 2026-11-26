import { describe, expect, it } from "vitest";
import { SingularMatrixError, factorLu } from "./lu";
import { createDenseMna } from "./mna";
import {
  analyzeSparse,
  checkSparse,
  createSparseMna,
  factorSparse,
  multiplySparse,
  normInfSparse,
  relativeResidual,
  solveChecked,
  RESIDUAL_TOLERANCE,
  sparseFromDense,
  sparseFromEntries,
  type SparseMatrix,
} from "./sparse";

/** Small seeded random numbers (tests must be repeatable). */
function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 2 ** 32;
  };
}

const solveRows = (rows: number[][], b: number[]) => [
  ...factorSparse(sparseFromDense(rows.flat(), b.length)).solve(b),
];

function residual(matrix: SparseMatrix, x: Float64Array, b: ArrayLike<number>): number {
  const ax = multiplySparse(matrix, x);
  let worst = 0;
  for (let i = 0; i < matrix.size; i++)
    worst = Math.max(worst, Math.abs((ax[i] as number) - (b[i] as number)));
  return worst;
}

/** Random sparse "circuit-like" matrix: a resistor network plus some voltage-source branches. */
function randomCircuit(seed: number, nodes: number, sources: number) {
  const mna = createSparseMna(nodes, sources);
  const dense = createDenseMna(nodes, sources);
  for (const target of [mna.context, dense.context]) {
    const pick = random(seed + 1);
    // A spanning chain to ground keeps it connected, then random extra resistors.
    for (let n = 1; n < nodes; n++) target.conductance(n, n - 1, 1 / (1 + pick() * 1e4));
    for (let e = 0; e < nodes * 2; e++) {
      const a = Math.floor(pick() * nodes);
      const b = Math.floor(pick() * nodes);
      if (a !== b) target.conductance(a, b, 1 / (10 ** (pick() * 6) + 1));
    }
    for (let k = 0; k < sources; k++) {
      // Each source from a distinct node to ground (no source loops).
      target.voltageSource(k, k + 1, 0, pick() * 20 - 10);
    }
    for (let n = 1; n < nodes; n++) if (pick() < 0.2) target.current(0, n, pick() * 1e-3);
  }
  return { mna, dense };
}

describe("sparse matrix", () => {
  it("adds duplicate entries, sorts rows and drops nothing", () => {
    const m = sparseFromEntries(3, [
      [2, 0, 1],
      [0, 0, 2],
      [2, 0, 3],
      [1, 2, -1],
    ]);
    expect([...m.columnStart]).toEqual([0, 2, 2, 3]);
    expect([...m.rowIndex]).toEqual([0, 2, 1]);
    expect([...m.values]).toEqual([2, 4, -1]);
    expect([...multiplySparse(m, [1, 1, 1])]).toEqual([2, -1, 4]);
    expect(normInfSparse(m)).toBe(4);
  });

  it("rejects malformed matrices and entries", () => {
    expect(() => sparseFromEntries(2, [[2, 0, 1]])).toThrow(RangeError);
    expect(() => sparseFromEntries(2, [[0, -1, 1]])).toThrow(RangeError);
    const bad = (m: Partial<SparseMatrix>) => () =>
      checkSparse({
        size: 2,
        columnStart: Int32Array.from([0, 1, 2]),
        rowIndex: Int32Array.from([0, 1]),
        values: Float64Array.from([1, 1]),
        ...m,
      });
    expect(bad({})).not.toThrow();
    expect(bad({ values: Float64Array.from([1, Number.NaN]) })).toThrow(RangeError);
    expect(bad({ rowIndex: Int32Array.from([0, 2]) })).toThrow(RangeError);
    expect(bad({ columnStart: Int32Array.from([0, 2, 1]) })).toThrow(RangeError);
    expect(bad({ columnStart: Int32Array.from([0, 1]) })).toThrow(RangeError);
  });

  it("stamps exactly what the dense MNA stamps", () => {
    const sparse = createSparseMna(4, 2);
    const dense = createDenseMna(4, 2);
    for (const { context } of [sparse, dense]) {
      context.conductance(1, 2, 1e-3);
      context.conductance(2, 0, 2e-3);
      context.current(0, 3, 1e-3);
      context.voltageSource(0, 1, 0, 9);
      context.vccs(3, 0, 1, 2, 0.01);
      context.vcvs(1, 3, 0, 2, 0, 5);
      context.matrix(0, 4, 0.5);
      context.rhs(2, 1);
    }
    const m = sparse.matrix();
    for (let i = 0; i < sparse.size; i++) {
      for (let j = 0; j < sparse.size; j++) expect(sparse.at(i, j)).toBe(dense.at(i, j));
      expect(sparse.rhs[i]).toBe(dense.rhs[i]);
    }
    expect(sparseFromDense(dense.matrix, dense.size)).toEqual(
      sparseFromEntries(
        m.size,
        [...m.rowIndex].map((r, p) => {
          let col = 0;
          while ((m.columnStart[col + 1] as number) <= p) col++;
          return [r, col, m.values[p] as number] as const;
        }),
      ),
    );
    sparse.clear();
    expect(sparse.at(0, 0)).toBe(0);
    expect(sparse.rhs.every((v) => v === 0)).toBe(true);
  });
});

describe("factorSparse", () => {
  it("solves small systems exactly", () => {
    expect(
      solveRows(
        [
          [2, 1],
          [1, 3],
        ],
        [3, 5],
      ),
    ).toEqual([0.8, 1.4]);
    const x = solveRows(
      [
        [4, -2, 1],
        [-2, 4, -2],
        [1, -2, 4],
      ],
      [11, -16, 17],
    );
    [1, -2, 3].forEach((v, i) => expect(x[i]).toBeCloseTo(v, 12));
    expect(solveRows([], [])).toEqual([]);
  });

  it("pivots past the zero diagonal every voltage source makes", () => {
    const x = solveRows(
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
    const mna = createSparseMna(3, 1);
    mna.context.voltageSource(0, 1, 0, 10);
    mna.context.conductance(1, 2, 1e-9);
    mna.context.conductance(2, 0, 1e3);
    const x = factorSparse(mna.matrix()).solve(mna.rhs);
    const current = 10 / (1e9 + 1e-3);
    expect(x[1]).toBeCloseTo(current * 1e-3, 22);
    expect(Math.abs(((x[2] as number) + current) / current)).toBeLessThan(1e-12);
  });

  it("matches the dense solver on random circuit matrices", () => {
    for (const [seed, nodes, sources] of [
      [1, 5, 1],
      [2, 30, 3],
      [3, 120, 10],
      [4, 300, 25],
    ] as const) {
      const { mna, dense } = randomCircuit(seed, nodes, sources);
      const matrix = mna.matrix();
      const xs = factorSparse(matrix).solve(mna.rhs);
      const xd = factorLu(dense.matrix, dense.size).solve(dense.rhs);
      expect(residual(matrix, xs, mna.rhs), `seed ${seed}`).toBeLessThan(1e-9);
      for (let i = 0; i < xs.length; i++) {
        const scale = Math.max(1e-6, Math.abs(xd[i] as number));
        expect(Math.abs((xs[i] as number) - (xd[i] as number)) / scale).toBeLessThan(1e-8);
      }
    }
  });

  it("solves random unsymmetric sparse systems (A·x − b ≈ 0)", () => {
    const next = random(99);
    for (const n of [10, 200, 400]) {
      const entries: [number, number, number][] = [];
      for (let i = 0; i < n; i++) {
        entries.push([i, i, 4 + next()]);
        for (let e = 0; e < 3; e++) entries.push([i, Math.floor(next() * n), next() * 2 - 1]);
      }
      const matrix = sparseFromEntries(n, entries);
      const b = Float64Array.from({ length: n }, () => next() - 0.5);
      expect(residual(matrix, factorSparse(matrix).solve(b), b), `n = ${n}`).toBeLessThan(1e-10);
    }
  });

  it("reuses one ordering for new values with the same pattern, and many right-hand sides", () => {
    const first = sparseFromDense([3, 1, 0, 1, 2, 1, 0, 1, 4], 3);
    const symbolic = analyzeSparse(first);
    const lu = factorSparse(first, symbolic);
    for (const b of [
      [4, 4, 5],
      [1, 0, 0],
    ]) {
      expect(residual(first, lu.solve(b), b)).toBeLessThan(1e-14);
    }
    const second = { ...first, values: Float64Array.from([10, 1, 1, 7, 2, 2, 9]) };
    const b = [1, 2, 3];
    expect(residual(second, factorSparse(second, symbolic).solve(b), b)).toBeLessThan(1e-14);
    expect(() => factorSparse(sparseFromDense([1], 1), symbolic)).toThrow(RangeError);
  });

  it("reports the original unknown that is undetermined", () => {
    const catchUnknown = (rows: number[][]) => {
      try {
        solveRows(
          rows,
          rows.map(() => 1),
        );
      } catch (error) {
        expect(error).toBeInstanceOf(SingularMatrixError);
        return (error as SingularMatrixError).unknown;
      }
      throw new Error("not singular");
    };
    // A zero row: unknown 1.
    expect(
      catchUnknown([
        [1, 0, 0],
        [0, 0, 0],
        [0, 0, 1],
      ]),
    ).toBe(1);
    // Unknown 2 appears in no equation (zero column).
    expect(
      catchUnknown([
        [2, 1, 0],
        [1, 2, 0],
        [0, 1, 0],
      ]),
    ).toBe(2);
    // Two equal rows.
    expect(() =>
      solveRows(
        [
          [1, 1],
          [2, 2],
        ],
        [1, 2],
      ),
    ).toThrow(SingularMatrixError);
  });

  it("finds a floating node in a real MNA matrix (resistor between two otherwise empty nodes)", () => {
    // Node 1–2 joined only to each other: their difference is fixed, their level is not.
    const mna = createSparseMna(4, 1);
    mna.context.voltageSource(0, 3, 0, 5);
    mna.context.conductance(3, 0, 1e-3);
    mna.context.conductance(1, 2, 1e-3);
    try {
      factorSparse(mna.matrix()).solve(mna.rhs);
      throw new Error("not singular");
    } catch (error) {
      expect(error).toBeInstanceOf(SingularMatrixError);
      expect([0, 1]).toContain((error as SingularMatrixError).unknown); // node 1 or node 2
    }
  });

  it("treats a nearly singular matrix as singular instead of returning huge numbers", () => {
    expect(() =>
      solveRows(
        [
          [1, 1],
          [1, 1 + 1e-15],
        ],
        [1, 2],
      ),
    ).toThrow(SingularMatrixError);
  });

  it("refuses non-finite right-hand sides and wrong sizes", () => {
    const lu = factorSparse(sparseFromDense([1, 0, 0, 1], 2));
    expect(() => lu.solve([1])).toThrow(RangeError);
    expect(() => lu.solve([1, Number.POSITIVE_INFINITY])).toThrow(RangeError);
  });

  it("keeps fill linear on a long ladder and factors 20 000 unknowns fast", () => {
    // R–2R ladder: 10 000 rungs → 20 000 nodes, one source.
    const rungs = 10_000;
    const nodes = 2 * rungs + 1;
    const mna = createSparseMna(nodes + 1, 1);
    mna.context.voltageSource(0, 1, 0, 10);
    for (let r = 0; r < rungs; r++) {
      const top = 2 * r + 1;
      mna.context.conductance(top, top + 2 > nodes ? 0 : top + 2, 1 / 1_000);
      mna.context.conductance(top + 1, 0, 1 / 2_000);
      mna.context.conductance(top, top + 1, 1 / 500);
    }
    const start = Date.now();
    const matrix = mna.matrix();
    const lu = factorSparse(matrix);
    const x = lu.solve(mna.rhs);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1_500);
    expect(lu.nonZeros).toBeLessThan(12 * matrix.size);
    expect(residual(matrix, x, mna.rhs)).toBeLessThan(1e-9);
    expect(x[0]).toBeCloseTo(10, 12);
  });

  it("orders a 60 × 60 resistor mesh with modest fill", () => {
    const side = 60;
    const id = (r: number, c: number) => r * side + c + 1;
    const mna = createSparseMna(side * side + 1, 1);
    for (let r = 0; r < side; r++)
      for (let c = 0; c < side; c++) {
        if (c + 1 < side) mna.context.conductance(id(r, c), id(r, c + 1), 1e-3);
        if (r + 1 < side) mna.context.conductance(id(r, c), id(r + 1, c), 1e-3);
      }
    mna.context.conductance(id(side - 1, side - 1), 0, 1e-3);
    mna.context.voltageSource(0, id(0, 0), 0, 1);
    const matrix = mna.matrix();
    const start = Date.now();
    const lu = factorSparse(matrix);
    const x = lu.solve(mna.rhs);
    expect(Date.now() - start).toBeLessThan(1_500);
    expect(lu.nonZeros).toBeLessThan(60 * matrix.size);
    expect(residual(matrix, x, mna.rhs)).toBeLessThan(1e-9);
  });
});

describe("solveChecked", () => {
  const matrix = sparseFromDense([4, 1, 1, 3], 2);
  const exact = factorSparse(matrix);
  const b = [1, 2];

  it("passes a good answer through untouched", () => {
    const result = solveChecked(matrix, exact, b);
    expect(result.accurate).toBe(true);
    expect(result.residual).toBeLessThan(1e-15);
    expect(result.x).toEqual(exact.solve(b));
  });

  it("refines a slightly wrong answer back to full accuracy", () => {
    // A solver with a 1e-6 relative error: one refinement step brings it to ~1e-12.
    const sloppy = {
      size: 2,
      solve: (v: ArrayLike<number>) => exact.solve(v).map((x) => x * (1 + 1e-6)),
    };
    const result = solveChecked(matrix, sloppy, b);
    expect(result.accurate).toBe(true);
    expect(relativeResidual(matrix, result.x, b)).toBeLessThan(RESIDUAL_TOLERANCE);
  });

  it("flags an answer it cannot repair instead of hiding it", () => {
    const broken = { size: 2, solve: () => Float64Array.from([1, 1]) };
    const result = solveChecked(matrix, broken, b);
    expect(result.accurate).toBe(false);
    expect(result.x.every(Number.isFinite)).toBe(true);
  });
});
