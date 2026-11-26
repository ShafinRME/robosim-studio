/**
 * Sparse MNA matrix and sparse LU (ADR 012 §1), the solver behind every analysis.
 *
 * KLU-style, as in modern circuit simulators:
 * 1. `analyzeSparse` — a fill-reducing column order (minimum degree on the pattern of A + Aᵀ). Done
 *    once per circuit pattern and reused for every re-solve (Newton steps, time steps).
 * 2. `factorSparse` — left-looking Gilbert–Peierls LU: column by column, a sparse triangular solve
 *    whose cost is proportional to the real floating-point work. **Threshold partial pivoting** with
 *    row scaling (as the dense solver, ADR 011): the ordering's diagonal is kept when it is at least
 *    `DIAGONAL_PREFERENCE` × the largest scaled entry of the column, else the largest is taken
 *    (voltage-source rows have zero diagonals and always pivot off-diagonal).
 * 3. `solve(b)` for any number of right-hand sides.
 *
 * A column with no usable pivot throws `SingularMatrixError` naming the **original** unknown, so the
 * caller can say which node or branch is undetermined. Never returns NaN.
 */
import { PIVOT_TOLERANCE, SingularMatrixError, type LuFactors } from "./lu";
import { createStampContext, type MnaContext, type Unknown } from "./mna";

/** Keep the ordering's diagonal pivot when it is at least this × the column's best (scaled). */
export const DIAGONAL_PREFERENCE = 0.1;

/** Square matrix in compressed-column form; row indices sorted and unique within a column. */
export interface SparseMatrix {
  readonly size: number;
  /** `size + 1` offsets into `rowIndex` / `values`. */
  readonly columnStart: Int32Array;
  readonly rowIndex: Int32Array;
  readonly values: Float64Array;
}

/** Throws `RangeError` for a malformed matrix (wrong offsets, rows out of range, non-finite). */
export function checkSparse(matrix: SparseMatrix): void {
  const { size, columnStart, rowIndex, values } = matrix;
  if (!Number.isInteger(size) || size < 0) throw new RangeError("invalid size");
  if (columnStart.length !== size + 1 || columnStart[0] !== 0)
    throw new RangeError("invalid column offsets");
  const nnz = columnStart[size] as number;
  if (rowIndex.length !== nnz || values.length !== nnz)
    throw new RangeError("row indices / values do not match the offsets");
  for (let j = 0; j < size; j++) {
    const from = columnStart[j] as number;
    const to = columnStart[j + 1] as number;
    if (to < from) throw new RangeError("invalid column offsets");
    let previous = -1;
    for (let p = from; p < to; p++) {
      const i = rowIndex[p] as number;
      if (!Number.isInteger(i) || i <= previous || i >= size)
        throw new RangeError("row indices must be sorted, unique and in range");
      if (!Number.isFinite(values[p] as number))
        throw new RangeError("matrix has a non-finite entry");
      previous = i;
    }
  }
}

/** Compressed-column matrix from (row, col, value) entries; duplicates are added. */
export function sparseFromEntries(
  size: number,
  entries: Iterable<readonly [row: number, col: number, value: number]>,
): SparseMatrix {
  const columns: Map<number, number>[] = Array.from({ length: size }, () => new Map());
  for (const [row, col, value] of entries) {
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0)
      throw new RangeError("entry outside the matrix");
    if (row >= size || col >= size) throw new RangeError("entry outside the matrix");
    const column = columns[col] as Map<number, number>;
    column.set(row, (column.get(row) ?? 0) + value);
  }
  return compress(size, columns);
}

function compress(size: number, columns: readonly Map<number, number>[]): SparseMatrix {
  let nnz = 0;
  for (const column of columns) nnz += column.size;
  const columnStart = new Int32Array(size + 1);
  const rowIndex = new Int32Array(nnz);
  const values = new Float64Array(nnz);
  let p = 0;
  for (let j = 0; j < size; j++) {
    columnStart[j] = p;
    const column = columns[j] as Map<number, number>;
    for (const row of [...column.keys()].sort((a, b) => a - b)) {
      rowIndex[p] = row;
      values[p] = column.get(row) as number;
      p++;
    }
  }
  columnStart[size] = p;
  return { size, columnStart, rowIndex, values };
}

/** Row-major dense → sparse (zeros dropped). For tests and small helpers. */
export function sparseFromDense(matrix: ArrayLike<number>, size: number): SparseMatrix {
  if (matrix.length !== size * size) throw new RangeError("matrix does not match its size");
  const entries: [number, number, number][] = [];
  for (let i = 0; i < size; i++)
    for (let j = 0; j < size; j++) {
      const value = matrix[i * size + j] as number;
      if (value !== 0) entries.push([i, j, value]);
    }
  return sparseFromEntries(size, entries);
}

/** y = A·x. */
export function multiplySparse(matrix: SparseMatrix, x: ArrayLike<number>): Float64Array {
  const { size, columnStart, rowIndex, values } = matrix;
  const y = new Float64Array(size);
  for (let j = 0; j < size; j++) {
    const xj = x[j] as number;
    if (xj === 0) continue;
    for (let p = columnStart[j] as number; p < (columnStart[j + 1] as number); p++) {
      const i = rowIndex[p] as number;
      y[i] = (y[i] as number) + (values[p] as number) * xj;
    }
  }
  return y;
}

/** ‖A‖∞ (largest absolute row sum). */
export function normInfSparse(matrix: SparseMatrix): number {
  const sums = new Float64Array(matrix.size);
  for (let p = 0; p < matrix.values.length; p++) {
    const i = matrix.rowIndex[p] as number;
    sums[i] = (sums[i] as number) + Math.abs(matrix.values[p] as number);
  }
  let max = 0;
  for (const s of sums) max = Math.max(max, s);
  return max;
}

// ─── Sparse MNA ──────────────────────────────────────────────────────────────────────────────────

export interface SparseMna {
  /** Number of unknowns = (nodes − 1) + branches. */
  readonly size: number;
  readonly rhs: Float64Array;
  readonly context: MnaContext;
  /** The stamped matrix in compressed-column form (a new snapshot on each call). */
  matrix(): SparseMatrix;
  at(row: Unknown, col: Unknown): number;
  /** Zeroes values and right-hand side; the pattern so far is kept. */
  clear(): void;
}

/** Sparse MNA system for `nodeCount` nodes (including ground) and `branchCount` branches. */
export function createSparseMna(nodeCount: number, branchCount: number): SparseMna {
  const columns: Map<number, number>[] = [];
  const rhs = new Float64Array(Math.max(0, nodeCount - 1 + branchCount));
  const context = createStampContext(
    nodeCount,
    branchCount,
    (row, col, value) => {
      const column = columns[col] as Map<number, number>;
      column.set(row, (column.get(row) ?? 0) + value);
    },
    (row, value) => {
      rhs[row] = (rhs[row] as number) + value;
    },
  );
  const size = rhs.length;
  for (let j = 0; j < size; j++) columns.push(new Map());
  return {
    size,
    rhs,
    context,
    matrix: () => compress(size, columns),
    at: (row, col) => (row < 0 || col < 0 ? 0 : (columns[col]?.get(row) ?? 0)),
    clear() {
      for (const column of columns) for (const key of column.keys()) column.set(key, 0);
      rhs.fill(0);
    },
  };
}

// ─── Ordering ────────────────────────────────────────────────────────────────────────────────────

export interface SparseSymbolic {
  readonly size: number;
  /** order[k] = original column eliminated at step k. */
  readonly order: Int32Array;
}

/** Binary min-heap of (degree, node), ties by node index (deterministic). */
function createHeap() {
  const keys: number[] = [];
  const nodes: number[] = [];
  const less = (a: number, b: number) =>
    (keys[a] as number) < (keys[b] as number) ||
    (keys[a] === keys[b] && (nodes[a] as number) < (nodes[b] as number));
  const swap = (a: number, b: number) => {
    [keys[a], keys[b]] = [keys[b] as number, keys[a] as number];
    [nodes[a], nodes[b]] = [nodes[b] as number, nodes[a] as number];
  };
  return {
    get size() {
      return keys.length;
    },
    push(key: number, node: number) {
      keys.push(key);
      nodes.push(node);
      for (let i = keys.length - 1; i > 0;) {
        const parent = (i - 1) >> 1;
        if (!less(i, parent)) break;
        swap(i, parent);
        i = parent;
      }
    },
    pop(): [number, number] {
      const top: [number, number] = [keys[0] as number, nodes[0] as number];
      const lastKey = keys.pop() as number;
      const lastNode = nodes.pop() as number;
      if (keys.length > 0) {
        keys[0] = lastKey;
        nodes[0] = lastNode;
        for (let i = 0; ;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < keys.length && less(l, m)) m = l;
          if (r < keys.length && less(r, m)) m = r;
          if (m === i) break;
          swap(i, m);
          i = m;
        }
      }
      return top;
    },
  };
}

/**
 * Minimum-degree order on the graph of A + Aᵀ (exact elimination graph). Circuits are very sparse
 * (2–5 parts per node), so the explicit graph stays small.
 */
export function analyzeSparse(matrix: SparseMatrix): SparseSymbolic {
  checkSparse(matrix);
  const { size, columnStart, rowIndex } = matrix;
  const adjacency: Set<number>[] = Array.from({ length: size }, () => new Set());
  for (let j = 0; j < size; j++) {
    for (let p = columnStart[j] as number; p < (columnStart[j + 1] as number); p++) {
      const i = rowIndex[p] as number;
      if (i === j) continue;
      (adjacency[i] as Set<number>).add(j);
      (adjacency[j] as Set<number>).add(i);
    }
  }
  const heap = createHeap();
  for (let v = 0; v < size; v++) heap.push((adjacency[v] as Set<number>).size, v);
  const eliminated = new Uint8Array(size);
  const order = new Int32Array(size);
  let k = 0;
  while (heap.size > 0) {
    const [degree, v] = heap.pop();
    const neighbours = adjacency[v] as Set<number>;
    if (eliminated[v] || degree !== neighbours.size) continue; // stale heap entry
    eliminated[v] = 1;
    order[k++] = v;
    const list = [...neighbours];
    for (const u of list) (adjacency[u] as Set<number>).delete(v);
    // The neighbours of v become a clique (the fill of eliminating v).
    for (const u of list) {
      const set = adjacency[u] as Set<number>;
      for (const w of list) if (w !== u) set.add(w);
      heap.push(set.size, u);
    }
    neighbours.clear();
  }
  return { size, order };
}

// ─── Numeric LU ──────────────────────────────────────────────────────────────────────────────────

export interface SparseLuFactors extends LuFactors {
  /** Non-zeros in L and U (fill included), for tests and diagnostics. */
  readonly nonZeros: number;
}

/** Growable typed arrays for the factors. */
function growable<T extends Int32Array | Float64Array>(make: (n: number) => T, initial: number) {
  let data = make(Math.max(16, initial));
  let length = 0;
  return {
    push(value: number) {
      if (length === data.length) {
        const bigger = make(data.length * 2);
        bigger.set(data);
        data = bigger;
      }
      data[length++] = value;
    },
    get length() {
      return length;
    },
    get data() {
      return data;
    },
  };
}

/**
 * Factors A (P·A·Q = L·U). `symbolic` from `analyzeSparse` may be reused for any matrix with the
 * same size (and, for best fill, the same pattern). Throws `SingularMatrixError`.
 */
export function factorSparse(
  matrix: SparseMatrix,
  symbolic: SparseSymbolic = analyzeSparse(matrix),
): SparseLuFactors {
  checkSparse(matrix);
  const { size, columnStart, rowIndex, values } = matrix;
  if (symbolic.size !== size || symbolic.order.length !== size)
    throw new RangeError("ordering does not match the matrix");

  // Row scales (largest |entry| of each row); a zero row leaves its unknown undetermined.
  const scale = new Float64Array(size);
  for (let p = 0; p < values.length; p++) {
    const i = rowIndex[p] as number;
    scale[i] = Math.max(scale[i] as number, Math.abs(values[p] as number));
  }
  for (let i = 0; i < size; i++) if (scale[i] === 0) throw new SingularMatrixError(i);

  const nnz = values.length;
  const lStart = new Int32Array(size + 1);
  const uStart = new Int32Array(size + 1);
  const lRow = growable((n) => new Int32Array(n), 2 * nnz);
  const lVal = growable((n) => new Float64Array(n), 2 * nnz);
  const uRow = growable((n) => new Int32Array(n), 2 * nnz);
  const uVal = growable((n) => new Float64Array(n), 2 * nnz);

  /** pinv[i] = step at which original row i became a pivot, −1 while not yet. */
  const pinv = new Int32Array(size).fill(-1);
  const x = new Float64Array(size);
  const reach = new Int32Array(size);
  const stack = new Int32Array(size);
  const position = new Int32Array(size);
  const mark = new Int32Array(size).fill(-1);

  for (let k = 0; k < size; k++) {
    lStart[k] = lRow.length;
    uStart[k] = uRow.length;
    const col = symbolic.order[k] as number;
    // No push to L happens until the pivot is chosen, so its arrays can be held for this column.
    const lRows = lRow.data;
    const lVals = lVal.data;

    // Reach: rows of x = L \ A(:, col) that can be non-zero (DFS through finished L columns).
    let top = size;
    for (let p = columnStart[col] as number; p < (columnStart[col + 1] as number); p++) {
      const start = rowIndex[p] as number;
      if (mark[start] === k) continue;
      let head = 0;
      stack[0] = start;
      while (head >= 0) {
        const j = stack[head] as number;
        const J = pinv[j] as number;
        if (mark[j] !== k) {
          mark[j] = k;
          position[head] = J < 0 ? 0 : (lStart[J] as number);
        }
        let done = true;
        const end = J < 0 ? 0 : J < k ? (lStart[J + 1] as number) : lRow.length;
        for (let q = position[head] as number; q < end; q++) {
          const i = lRows[q] as number;
          if (mark[i] === k) continue;
          position[head] = q + 1;
          stack[++head] = i;
          done = false;
          break;
        }
        if (done) {
          head--;
          reach[--top] = j;
        }
      }
    }

    // Numeric: scatter A(:, col), then eliminate with the finished columns in topological order.
    for (let p = top; p < size; p++) x[reach[p] as number] = 0;
    for (let p = columnStart[col] as number; p < (columnStart[col + 1] as number); p++) {
      x[rowIndex[p] as number] = values[p] as number;
    }
    for (let p = top; p < size; p++) {
      const j = reach[p] as number;
      const J = pinv[j] as number;
      if (J < 0) continue;
      const xj = x[j] as number;
      if (xj === 0) continue;
      // L(:, J) has the pivot row first (value 1), then the multipliers.
      for (let q = (lStart[J] as number) + 1; q < (lStart[J + 1] as number); q++) {
        const i = lRows[q] as number;
        x[i] = (x[i] as number) - (lVals[q] as number) * xj;
      }
    }

    // Pivot: largest scaled entry among rows that are not pivots yet; prefer the diagonal.
    let pivotRow = -1;
    let best = 0;
    for (let p = top; p < size; p++) {
      const i = reach[p] as number;
      if ((pinv[i] as number) >= 0) {
        uRow.push(pinv[i] as number);
        uVal.push(x[i] as number);
        continue;
      }
      const scaled = Math.abs(x[i] as number) / (scale[i] as number);
      if (scaled > best) {
        best = scaled;
        pivotRow = i;
      }
    }
    if (pivotRow < 0 || best <= PIVOT_TOLERANCE) throw new SingularMatrixError(col);
    if (
      pivotRow !== col &&
      (pinv[col] as number) < 0 &&
      mark[col] === k &&
      Math.abs(x[col] as number) / (scale[col] as number) >= DIAGONAL_PREFERENCE * best
    ) {
      pivotRow = col;
    }
    const pivot = x[pivotRow] as number;
    uRow.push(k);
    uVal.push(pivot);
    pinv[pivotRow] = k;
    lRow.push(pivotRow);
    lVal.push(1);
    for (let p = top; p < size; p++) {
      const i = reach[p] as number;
      if ((pinv[i] as number) < 0) {
        const value = (x[i] as number) / pivot;
        if (value !== 0) {
          lRow.push(i);
          lVal.push(value);
        }
      }
      x[i] = 0;
    }
  }
  lStart[size] = lRow.length;
  uStart[size] = uRow.length;

  // L row indices from original rows to pivot steps.
  const lIndex = lRow.data.subarray(0, lRow.length);
  for (let q = 0; q < lIndex.length; q++) lIndex[q] = pinv[lIndex[q] as number] as number;
  const lValues = lVal.data.subarray(0, lVal.length);
  const uIndex = uRow.data.subarray(0, uRow.length);
  const uValues = uVal.data.subarray(0, uVal.length);
  const order = Int32Array.from(symbolic.order);

  return {
    size,
    nonZeros: lIndex.length + uIndex.length,
    solve(rhs) {
      if (rhs.length !== size) throw new RangeError("right-hand side does not match the size");
      const y = new Float64Array(size);
      for (let i = 0; i < size; i++) {
        const value = rhs[i] as number;
        if (!Number.isFinite(value)) throw new RangeError("right-hand side is not finite");
        y[pinv[i] as number] = value;
      }
      // L·z = P·b (unit diagonal, stored first in each column).
      for (let j = 0; j < size; j++) {
        const yj = y[j] as number;
        if (yj === 0) continue;
        for (let q = (lStart[j] as number) + 1; q < (lStart[j + 1] as number); q++) {
          const i = lIndex[q] as number;
          y[i] = (y[i] as number) - (lValues[q] as number) * yj;
        }
      }
      // U·w = z (diagonal stored last in each column).
      for (let j = size - 1; j >= 0; j--) {
        const last = (uStart[j + 1] as number) - 1;
        const yj = (y[j] as number) / (uValues[last] as number);
        y[j] = yj;
        if (yj === 0) continue;
        for (let q = uStart[j] as number; q < last; q++) {
          const i = uIndex[q] as number;
          y[i] = (y[i] as number) - (uValues[q] as number) * yj;
        }
      }
      const result = new Float64Array(size);
      for (let k = 0; k < size; k++) {
        const value = y[k] as number;
        if (!Number.isFinite(value)) throw new SingularMatrixError(order[k] as number);
        result[order[k] as number] = value;
      }
      return result;
    },
  };
}

// ─── Checked solve ───────────────────────────────────────────────────────────────────────────────

/** Relative residual above which a solution is refined (and, if it stays there, flagged). */
export const RESIDUAL_TOLERANCE = 1e-9;

/** ‖b − A·x‖∞ / (‖A‖∞·‖x‖∞ + ‖b‖∞): 0 for an exact answer, ~1e-16 for a good one. */
export function relativeResidual(
  matrix: SparseMatrix,
  x: ArrayLike<number>,
  b: ArrayLike<number>,
  normA = normInfSparse(matrix),
): number {
  const ax = multiplySparse(matrix, x);
  let r = 0;
  let nx = 0;
  let nb = 0;
  for (let i = 0; i < matrix.size; i++) {
    r = Math.max(r, Math.abs((b[i] as number) - (ax[i] as number)));
    nx = Math.max(nx, Math.abs(x[i] as number));
    nb = Math.max(nb, Math.abs(b[i] as number));
  }
  const scale = normA * nx + nb;
  return scale === 0 ? 0 : r / scale;
}

/**
 * Solves and checks the answer (ADR 012 §2): when the residual is too large, one step of iterative
 * refinement (x += A⁻¹·r); `accurate` is false when even that does not bring it below
 * `RESIDUAL_TOLERANCE`. Every value returned is finite.
 */
export function solveChecked(
  matrix: SparseMatrix,
  lu: LuFactors,
  b: ArrayLike<number>,
): { x: Float64Array; accurate: boolean; residual: number } {
  const normA = normInfSparse(matrix);
  const x = lu.solve(b);
  let residual = relativeResidual(matrix, x, b, normA);
  if (residual <= RESIDUAL_TOLERANCE) return { x, accurate: true, residual };
  const ax = multiplySparse(matrix, x);
  const r = new Float64Array(matrix.size);
  for (let i = 0; i < matrix.size; i++) r[i] = (b[i] as number) - (ax[i] as number);
  const dx = lu.solve(r);
  const refined = new Float64Array(matrix.size);
  for (let i = 0; i < matrix.size; i++) refined[i] = (x[i] as number) + (dx[i] as number);
  const after = relativeResidual(matrix, refined, b, normA);
  if (!refined.every(Number.isFinite) || after >= residual) {
    return { x, accurate: false, residual };
  }
  residual = after;
  return { x: refined, accurate: residual <= RESIDUAL_TOLERANCE, residual };
}
