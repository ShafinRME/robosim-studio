# ADR 011 — DC solver: dense LU, operating point, analysis worker

- **Status:** Accepted (owner delegated the choice, 2026-11-26)
- **Date:** 2026-11-26 (Day 15)

## Context
Day 15 turns a drawn circuit into numbers: the DC operating point (every node voltage, every part's
voltage, current and power). ADR 007 fixed the model — netlist → devices → stamps through
`MnaContext` → solve — and already has the beginner checks (`checkCircuit`). What is missing is the
solver itself, the place it runs, and how results reach the studio. "Done when": 20 textbook DC
circuits match hand results within 0.1 %. Day 16 adds a sparse solver and finer error messages,
Day 17 Newton–Raphson, Day 18 transient analysis — all on top of what is decided here.

Requirements: exact enough for teaching (≪ 0.1 %), never NaN or a frozen page, clear words when a
circuit cannot be solved, fast enough to re-solve after every edit, small circuits (< 1 000
unknowns) on 8 GB laptops.

## Options
- **Solver:** (A) Gaussian elimination per solve; (B) **LU factorisation with partial pivoting**
  (proposed); (C) a sparse direct solver now (KLU-style).
  B is the textbook method SPICE uses (on sparse matrices); the factors can be reused for many
  right-hand sides (sources changing, Newton steps, transient steps). C is Day 16's job; doing it
  first would hide bugs in the harder code.
- **Where it runs:** (A) main thread; (B) the simulation worker of ADR 006; (C) **a separate
  analysis worker** (proposed). The ADR 006 worker ticks the transient kernel; a DC solve is a
  one-shot request/answer that must not wait behind a running simulation, and must be cancellable
  when a newer edit arrives.
- **Libraries:** none needed. Numeric libraries (ml-matrix, mathjs) are MIT but large; our LU is
  ~150 lines, fully tested, and has no dependency to audit.

## Decision

### 1. LU solver (`packages/core/src/circuit/lu.ts`)
- Dense, row-major `Float64Array`, in place; **partial pivoting** (largest absolute value in the
  column, row swaps recorded), **row scaling** for the pivot choice so 1 Ω and 1 GΩ in one circuit
  do not fool it (equilibration as in SPICE's scaled pivoting).
- **Singular check:** a pivot below `1e-13 × (largest scaled entry of its row)` means the matrix is
  singular; the solver reports *which unknown* had no usable pivot (a node or a branch), never NaN.
- `factor()` once, `solve(rhs)` many times; a final check that every result is finite.
- Limit: `MAX_DENSE_UNKNOWNS` (1 024, ADR 007); bigger circuits get a clear message until Day 16.

### 2. DC operating point (`packages/core/src/circuit/dc.ts`)
`solveDc(netlist, lookup)` →
1. `checkCircuit` (ADR 007). Errors (no ground, voltage-source loop, floating node, bad value…) are
   returned **without solving**, as plain-word issues pointing at the parts.
2. Devices from the part registry (ADR 010), branches and state slots handed out in netlist order.
3. Stamp into a dense MNA, factor, solve. A singular matrix becomes the `singular-matrix` issue,
   naming the parts on the unknown that failed (Day 16 refines the wording).
4. Result: node voltages by net name, branch currents, and each part's readouts (V, I, P from its
   device `report`), all SI numbers, all finite.

Pure and synchronous: the same function runs in tests, in the worker and later in CI examples.

### 3. Accuracy and tests
Every textbook circuit test compares against a hand-calculated value with a relative tolerance of
1e-3 (0.1 %); in practice the result is exact to ~1e-12. Solver unit tests: known systems, pivoting
needed (zero on the diagonal, as every voltage source gives), badly scaled values, singular and
nearly singular matrices, random systems checked by multiplying back (‖Ax − b‖ small), speed.

### 4. Analysis worker (`apps/web`)
- A dedicated module worker (`analysis-worker.ts`, same origin, CSP `worker-src 'self'`) with
  Comlink like ADR 006. The main thread sends `{ seq, input }` (the `CircuitInput` from the
  drawing); the worker validates it with the Zod schema (`circuitInputSchema`) — worker input is
  treated as untrusted like any message — runs `solveDc`, and answers `{ seq, result }`.
- **Latest wins:** the studio sends a new request after each edit (debounced ~60 ms) and ignores
  answers whose `seq` is older than the last request. A solve that takes too long (> 2 s) ends the
  worker and starts a new one, with a message.
- The canvas never waits: results arrive asynchronously and are drawn when they come.

### 5. In the studio
DC results are **live**: always computed while a circuit is open (cheap at this size), shown when
**View → Show DC results** is on (default on): voltages at nets on the schematic, the selected
part's V / I / P in the Inspector, problems in the Console with the parts they concern. The
transient Run / Pause controls (ADR 006) are separate and unchanged.

## Consequences
- One solver interface (`factor` / `solve`) that the sparse solver of Day 16 replaces without
  touching `solveDc`, devices or the studio.
- Live results make the schematic feel like a real simulator from Day 15 on.
- Dense storage caps circuits at 1 024 unknowns until Day 16.
