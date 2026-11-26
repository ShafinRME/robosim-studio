/**
 * The MNA stamp context (ADR 007 §2) — the only way a device touches the circuit equations.
 *
 * Modified Nodal Analysis: unknowns are the node voltages (ground, node 0, is not an unknown) plus
 * one current per "branch" (voltage sources, inductors, VCVS). Row/column layout:
 *   node n (1 … N-1)  → unknown n - 1
 *   branch k (0 … B-1) → unknown (N - 1) + k
 * Sign conventions are SPICE's (ADR 007 §5): rows are KCL "current leaving the node = 0"; a branch
 * current flows from the + node through the element to the − node.
 *
 * This file has a dense implementation for tests and small circuits; the solver (Day 15) and the
 * sparse matrix (Day 16) implement the same interface, so devices never change.
 */

/** Index of an unknown in the matrix; `-1` stands for ground and is dropped. */
export type Unknown = number;
export const GROUND_UNKNOWN: Unknown = -1;

export interface MnaContext {
  /** Unknown index of node `n` (−1 for ground). */
  node(n: number): Unknown;
  /** Unknown index of branch `k`. */
  branch(k: number): Unknown;
  /** Conductance `g` (S) between nodes `a` and `b` (a resistor is g = 1/R). */
  conductance(a: number, b: number, g: number): void;
  /** Independent current `i` (A) flowing from node `a` through the element to node `b`. */
  current(a: number, b: number, i: number): void;
  /** Ideal voltage source: V(plus) − V(minus) = `v`; its current is branch `k` (+ → through → −). */
  voltageSource(k: number, plus: number, minus: number, v: number): void;
  /** Voltage-controlled current source (SPICE G): gm·(V(c+) − V(c−)) flows out+ → through → out−. */
  vccs(outPlus: number, outMinus: number, ctrlPlus: number, ctrlMinus: number, gm: number): void;
  /** Voltage-controlled voltage source (SPICE E) on branch `k`: V(out) = gain·V(ctrl). */
  vcvs(
    k: number,
    outPlus: number,
    outMinus: number,
    ctrlPlus: number,
    ctrlMinus: number,
    gain: number,
  ): void;
  /** Raw access for unusual parts. Ground rows/columns (−1) are ignored. */
  matrix(row: Unknown, col: Unknown, value: number): void;
  rhs(row: Unknown, value: number): void;
}

/** A device wrote NaN/Infinity or used a node/branch that does not exist — a bug, never shown as NaN. */
export class MnaStampError extends Error {
  override name = "MnaStampError";
}

/** Read access to a solved (or guessed) solution vector. */
export interface Solution {
  /** Voltage of node `n` against ground (V); 0 for ground. */
  voltage(n: number): number;
  /** Current of branch `k` (A), + → through the element → −. */
  branchCurrent(k: number): number;
}

export function createSolution(
  x: ArrayLike<number>,
  nodeCount: number,
  branchCount: number,
): Solution {
  return {
    voltage(n) {
      if (n === 0) return 0;
      if (!Number.isInteger(n) || n < 0 || n >= nodeCount) throw new MnaStampError(`no node ${n}`);
      return x[n - 1] ?? 0;
    },
    branchCurrent(k) {
      if (!Number.isInteger(k) || k < 0 || k >= branchCount)
        throw new MnaStampError(`no branch ${k}`);
      return x[nodeCount - 1 + k] ?? 0;
    },
  };
}

/** Largest dense system (unknowns). 1 024² doubles = 8 MB; the solver itself uses the sparse MNA (`sparse.ts`). */
export const MAX_DENSE_UNKNOWNS = 1_024;

export interface DenseMna {
  /** Number of unknowns = (nodes − 1) + branches. */
  readonly size: number;
  /** Row-major `size × size` matrix. */
  readonly matrix: Float64Array;
  readonly rhs: Float64Array;
  readonly context: MnaContext;
  at(row: Unknown, col: Unknown): number;
  /** Zeroes matrix and right-hand side (before re-stamping). */
  clear(): void;
}

/**
 * The stamping rules of `MnaContext`, written once for every matrix storage (dense here, sparse in
 * `sparse.ts`): node / branch mapping, finite checks and the SPICE stamps. `add` / `addRhs` only
 * receive real unknowns (ground rows and columns are dropped here).
 */
export function createStampContext(
  nodeCount: number,
  branchCount: number,
  add: (row: number, col: number, value: number) => void,
  addRhs: (row: number, value: number) => void,
): MnaContext {
  if (!Number.isInteger(nodeCount) || nodeCount < 1)
    throw new MnaStampError("need at least the ground node");
  if (!Number.isInteger(branchCount) || branchCount < 0)
    throw new MnaStampError("invalid branch count");
  const size = nodeCount - 1 + branchCount;

  const finite = (value: number, what: string) => {
    if (!Number.isFinite(value))
      throw new MnaStampError(`${what} is not a finite number (${value})`);
  };
  const node = (n: number): Unknown => {
    if (!Number.isInteger(n) || n < 0 || n >= nodeCount) throw new MnaStampError(`no node ${n}`);
    return n === 0 ? GROUND_UNKNOWN : n - 1;
  };
  const branch = (k: number): Unknown => {
    if (!Number.isInteger(k) || k < 0 || k >= branchCount)
      throw new MnaStampError(`no branch ${k}`);
    return nodeCount - 1 + k;
  };
  const put = (row: Unknown, col: Unknown, value: number) => {
    if (row >= 0 && col >= 0) add(row, col, value);
  };
  const putRhs = (row: Unknown, value: number) => {
    if (row >= 0) addRhs(row, value);
  };
  const checkUnknown = (u: Unknown) => {
    if (!Number.isInteger(u) || u < GROUND_UNKNOWN || u >= size)
      throw new MnaStampError(`no unknown ${u}`);
  };

  return {
    node,
    branch,
    conductance(a, b, g) {
      finite(g, "conductance");
      const ua = node(a);
      const ub = node(b);
      put(ua, ua, g);
      put(ub, ub, g);
      put(ua, ub, -g);
      put(ub, ua, -g);
    },
    current(a, b, i) {
      finite(i, "current");
      putRhs(node(a), -i);
      putRhs(node(b), i);
    },
    voltageSource(k, plus, minus, v) {
      finite(v, "voltage");
      const j = branch(k);
      const up = node(plus);
      const um = node(minus);
      put(up, j, 1);
      put(um, j, -1);
      put(j, up, 1);
      put(j, um, -1);
      putRhs(j, v);
    },
    vccs(outPlus, outMinus, ctrlPlus, ctrlMinus, gm) {
      finite(gm, "transconductance");
      const op = node(outPlus);
      const om = node(outMinus);
      const cp = node(ctrlPlus);
      const cm = node(ctrlMinus);
      put(op, cp, gm);
      put(op, cm, -gm);
      put(om, cp, -gm);
      put(om, cm, gm);
    },
    vcvs(k, outPlus, outMinus, ctrlPlus, ctrlMinus, gain) {
      finite(gain, "gain");
      const j = branch(k);
      const op = node(outPlus);
      const om = node(outMinus);
      put(op, j, 1);
      put(om, j, -1);
      put(j, op, 1);
      put(j, om, -1);
      put(j, node(ctrlPlus), -gain);
      put(j, node(ctrlMinus), gain);
    },
    matrix(row, col, value) {
      checkUnknown(row);
      checkUnknown(col);
      finite(value, "matrix entry");
      put(row, col, value);
    },
    rhs(row, value) {
      checkUnknown(row);
      finite(value, "right-hand side");
      putRhs(row, value);
    },
  };
}

/** Dense MNA system for `nodeCount` nodes (including ground) and `branchCount` branches. */
export function createDenseMna(nodeCount: number, branchCount: number): DenseMna {
  if (!Number.isInteger(nodeCount) || nodeCount < 1)
    throw new MnaStampError("need at least the ground node");
  if (!Number.isInteger(branchCount) || branchCount < 0)
    throw new MnaStampError("invalid branch count");
  const size = nodeCount - 1 + branchCount;
  if (size > MAX_DENSE_UNKNOWNS)
    throw new MnaStampError(`more than ${MAX_DENSE_UNKNOWNS} unknowns`);
  const matrix = new Float64Array(size * size);
  const rhs = new Float64Array(size);
  const context = createStampContext(
    nodeCount,
    branchCount,
    (row, col, value) => {
      matrix[row * size + col] = (matrix[row * size + col] ?? 0) + value;
    },
    (row, value) => {
      rhs[row] = (rhs[row] ?? 0) + value;
    },
  );

  return {
    size,
    matrix,
    rhs,
    context,
    at: (row, col) => (row < 0 || col < 0 ? 0 : (matrix[row * size + col] ?? 0)),
    clear() {
      matrix.fill(0);
      rhs.fill(0);
    },
  };
}
