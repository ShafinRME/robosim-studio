# ADR 012 — Sparse solver and beginner diagnostics

- **Status:** Accepted (owner delegated the choice, 2026-11-26: "you choose the best option")
- **Date:** 2026-11-26 (Day 16)

## Context
Day 15 (ADR 011) solves the DC operating point with a dense LU: exact, but O(n²) memory and
O(n³) time, capped at 1 024 unknowns. Real circuits (later: microcontroller boards, power stages,
transient steps, Newton iterations) need many solves of large, very sparse MNA matrices: a node
touches 2–5 parts, so a 10 000-unknown circuit has ~50 000 non-zeros, not 10⁸.

Day 16 also has to make the beginner promise of ADR 007 complete: **every** mistake is explained in
plain words that name the parts and pins, and the studio **never** shows NaN, Infinity or a silently
wrong number. Day 15 still has three weak spots: (1) one stray part that is not wired yet makes the
whole circuit "cannot be solved"; (2) a part whose pins are joined by a wire, or a supply shorted
through a closed switch, solves without a word (9 kA through a switch); (3) a singular matrix that
slips past the graph checks gets one generic sentence.

## Options
- **Sparse solver:** (A) a library (e.g. a WebAssembly build of KLU / SuiteSparse: LGPL, large);
  (B) SPICE-style Markowitz pivoting on the active submatrix (Sparse 1.3; search cost grows quickly);
  (C) **KLU-style: fill-reducing ordering + left-looking Gilbert–Peierls LU with threshold partial
  pivoting** (proposed). C is what modern circuit simulators use (KLU in Xyce / ngspice), its cost is
  proportional to the floating-point work, and it splits into a symbolic step (ordering) that is
  reused for every re-solve with the same pattern and a cheap numeric step.
- **Floating parts:** (A) keep "cannot solve" for any part without a path to ground (SPICE);
  (B) **solve the connected circuit and leave the floating parts out, with a warning** (proposed),
  the way interactive teaching simulators keep working while you are still drawing.
- **Shorts:** warn only through power ratings (Day 15), or **explicit short-circuit checks**
  (proposed).

## Decision

### 1. Sparse matrix and LU (`packages/core/src/circuit/sparse.ts`)
- `createSparseMna(nodes, branches)` implements the same `MnaContext` as the dense MNA (ADR 007);
  both share one stamping implementation, so devices never change. Entries are accumulated per row
  (duplicates added) and compressed to compressed-column form (CSC) for factoring.
- **Ordering:** minimum degree on the pattern of A + Aᵀ (exact elimination graph, degree buckets).
  MNA matrices are structurally symmetric apart from the zero diagonal of voltage-source rows.
- **Numeric LU:** left-looking Gilbert–Peierls (sparse triangular solve per column, DFS for the
  reach). **Threshold partial pivoting** with row scaling as in ADR 011: the diagonal of the ordering
  is kept when its scaled size is ≥ 0.1 × the largest scaled entry of the column, otherwise the
  largest is taken (voltage-source rows have zero diagonals and always pivot off-diagonal).
- **Singular:** no entry above `1e-13` × its row scale in a column → `SingularMatrixError` with the
  **original** unknown index (node or branch), like the dense solver.
- `analyze(pattern)` once, `factor(values)` for each new set of values with the same pattern
  (Newton steps of Day 17, time steps of Day 18), `solve(b)` many times; never returns NaN.
- The dense `factorLu` stays as the reference implementation in tests (every sparse test compares).

### 2. DC solve
- `solveDc` stamps into the sparse MNA. The limit becomes `MAX_UNKNOWNS = 50 000` (the `too-large`
  message stays above it).
- **Residual check and refinement:** after solving, r = b − A·x. If
  ‖r‖∞ > 1e-9 × (‖A‖∞·‖x‖∞ + ‖b‖∞), one step of iterative refinement; if still too large, the
  results are kept with a `low-accuracy` warning ("values are extreme …") — never silently wrong.
- Every number is checked finite before it leaves the solver (as Day 15).

### 3. Beginner diagnostics (`issues.ts`, all wording in one place)
- **Floating parts are left out, not fatal:** a group of parts with no DC path to ground gets the
  `floating-node` **warning** "R3 and R4 are not connected to ground, so they are left out of the
  results." The rest of the circuit is solved. Their nets are tied to ground through `1e-12 S`
  (SPICE's GMIN) only so the matrix stays regular; those nets and parts get **no** values (the
  result lists them as floating; the studio shows "Not connected to ground").
- **A part with no wire at all** gets one warning, "R3 is not connected to anything yet." instead of
  one per pin plus a floating warning.
- **Shorted part** (`shorted-part`, warning): a passive part whose two pins sit on the same net —
  "R1 is short-circuited: a wire joins its two pins, so no current flows through it." For parts with
  more pins the pins are named ("Pin 1 and Pin 3 of RV1 are joined by a wire.").
- **Short circuit** (`short-circuit`, warning, after the solve): any part carrying more than
  `SHORT_CIRCUIT_CURRENT` (10 A, more than a bench supply or battery gives) — "V1 is short-circuited
  through SW1: 9 kA would flow." naming the source and the parts on that path.
- Unchanged errors: no ground, voltage sources shorted or in a loop, a current source with nowhere
  to send its current, invalid values.
- **Singular matrix** (should now be rare): the message names what could not be worked out — "The
  voltage where R1 and R2 meet cannot be worked out." or "The current through V1 cannot be worked
  out." — with the parts highlighted.

## Consequences
- Ladder-like circuits of 20 000 unknowns factor in ~0.1 s; the largest drawing (2 000 parts,
  ADR 007) solves in well under the 2 s worker limit. The symbolic step is reused by the non-linear
  (Day 17) and transient (Day 18) solvers.
- The ordering is exact minimum degree on an explicit graph: fine for circuits, slow for dense 2-D
  meshes (~0.6 s for 100 × 100). If mesh-sized circuits become possible, switch to approximate
  minimum degree (AMD) behind the same `analyzeSparse`.
- A half-drawn circuit keeps showing results for everything already connected.
- Two new warning codes (`shorted-part`, `short-circuit`) and one (`low-accuracy`); `floating-node`
  becomes a warning. The studio highlights the pins and nets an issue names (Day 16 Step 5).
- A "never NaN" fuzz test (thousands of random broken circuits) guards all of this (Step 6).
