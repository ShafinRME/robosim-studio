/**
 * Dense LU factorisation with scaled partial pivoting (ADR 011 §1).
 *
 * `factorLu` copies the row-major matrix and factors it once (P·A = L·U, L unit lower, both kept in
 * one array); `solve` then handles any number of right-hand sides. Pivots are chosen by the largest
 * |entry| relative to its row's largest entry ("scaled" or "implicit" pivoting), so a circuit with
 * 1 mΩ and 1 GΩ in it does not pick a pivot that only looks big. A pivot that is (relatively) zero
 * means the matrix is singular: `SingularMatrixError` names the unknown that has no usable pivot,
 * so the caller can tell the user which node or branch is undetermined. Never returns NaN.
 */

/** A pivot smaller than this × its row's largest entry counts as zero. */
export const PIVOT_TOLERANCE = 1e-13;

export class SingularMatrixError extends Error {
  override name = "SingularMatrixError";
  /** Index of the unknown (column) without a usable pivot. */
  readonly unknown: number;
  constructor(unknown: number) {
    super(`singular matrix: unknown ${unknown} is not determined`);
    this.unknown = unknown;
  }
}

export interface LuFactors {
  readonly size: number;
  /** Solves A·x = b for one right-hand side (b is not changed). */
  solve(rhs: ArrayLike<number>): Float64Array;
}

/** Factors the `size × size` row-major `matrix` (left unchanged). Throws `SingularMatrixError`. */
export function factorLu(matrix: ArrayLike<number>, size: number): LuFactors {
  if (!Number.isInteger(size) || size < 0) throw new RangeError("invalid size");
  if (matrix.length !== size * size) throw new RangeError("matrix does not match its size");
  const a = Float64Array.from(matrix);
  for (const value of a) {
    if (!Number.isFinite(value)) throw new RangeError("matrix has a non-finite entry");
  }
  // perm[i] = original row now at position i.
  const perm = new Int32Array(size);
  const scale = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    perm[i] = i;
    let max = 0;
    for (let j = 0; j < size; j++) max = Math.max(max, Math.abs(a[i * size + j] as number));
    // A row of zeros: the equation says nothing, so the unknown of that row is undetermined.
    if (max === 0) throw new SingularMatrixError(i);
    scale[i] = max;
  }

  for (let k = 0; k < size; k++) {
    // Choose the pivot row: largest |a[r][k]| relative to its row scale.
    let pivot = -1;
    let best = 0;
    for (let r = k; r < size; r++) {
      const relative = Math.abs(a[r * size + k] as number) / (scale[r] as number);
      if (relative > best) {
        best = relative;
        pivot = r;
      }
    }
    if (pivot < 0 || best <= PIVOT_TOLERANCE) throw new SingularMatrixError(k);
    if (pivot !== k) {
      for (let c = 0; c < size; c++) {
        const t = a[k * size + c] as number;
        a[k * size + c] = a[pivot * size + c] as number;
        a[pivot * size + c] = t;
      }
      [perm[k], perm[pivot]] = [perm[pivot] as number, perm[k] as number];
      [scale[k], scale[pivot]] = [scale[pivot] as number, scale[k] as number];
    }
    const diagonal = a[k * size + k] as number;
    for (let r = k + 1; r < size; r++) {
      const factor = (a[r * size + k] as number) / diagonal;
      if (factor === 0) continue;
      a[r * size + k] = factor; // L below the diagonal
      for (let c = k + 1; c < size; c++) {
        a[r * size + c] = (a[r * size + c] as number) - factor * (a[k * size + c] as number);
      }
    }
  }

  return {
    size,
    solve(rhs) {
      if (rhs.length !== size) throw new RangeError("right-hand side does not match the size");
      const x = new Float64Array(size);
      // Forward: L·y = P·b.
      for (let i = 0; i < size; i++) {
        let sum = rhs[perm[i] as number] as number;
        for (let j = 0; j < i; j++) sum -= (a[i * size + j] as number) * (x[j] as number);
        x[i] = sum;
      }
      // Back: U·x = y.
      for (let i = size - 1; i >= 0; i--) {
        let sum = x[i] as number;
        for (let j = i + 1; j < size; j++) sum -= (a[i * size + j] as number) * (x[j] as number);
        x[i] = sum / (a[i * size + i] as number);
      }
      for (let i = 0; i < size; i++) {
        if (!Number.isFinite(x[i] as number)) throw new SingularMatrixError(i);
      }
      return x;
    },
  };
}
