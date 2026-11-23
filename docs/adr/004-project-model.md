# ADR 004 — Project model, store and undo/redo

- **Status:** Accepted
- **Date:** 2026-11-23 (Day 07)

## Context
Every lab edits a **project**: parts placed on the canvas, their properties, later wires, code and
simulation settings. Projects are saved to the browser (Day 08), exported as files and, later,
synced to the cloud, so they will be read back by newer versions of the studio and may be
hand-edited or corrupt. Users expect reliable **undo / redo** for every edit. All of this logic must
live in `@robosim/core` (no React, no DOM) and be fully unit-tested.

## Options considered
| Need | Option | Licence | Notes |
|---|---|---|---|
| Schema / validation | **Zod 4** | MIT | No runtime dependencies; TypeScript types inferred from the schema; clear error paths. |
| | Valibot | MIT | Smaller, but a second validation style next to Zod (already in our dev tree via ESLint). |
| | Hand-written checks (like `layout.ts`) | — | Fine for one small shape; does not scale to dozens of part types. |
| Store | **Zustand 5** | MIT | Tiny, no dependencies, framework-free vanilla store (`zustand/vanilla`) usable in core and Workers; React binding in the app. |
| | Redux Toolkit | MIT | Heavier, more ceremony; brings Immer anyway. |
| | Jotai / Valtio | MIT | Atom / proxy models fit undo/redo less naturally. |
| Immutable edits | **Immer 11** | MIT | Write edits as plain mutations; produces **patches and inverse patches** — exactly what undo/redo needs. |
| Undo/redo | **Command pattern on Immer patches** (our own) | — | Each edit is a named command; we keep its patches + inverse patches. |
| | Snapshot history | — | Simple, but memory grows with project size × steps; bad on 8 GB laptops. |
| | zundo (Zustand middleware) | MIT | Snapshot-based; no named commands for the Edit menu. |

## Decision
- **Zod 4.6.7**, **Zustand 5.1.0** and **Immer 11.2.10**, exact versions pinned, in `@robosim/core`.
- **Security check (2026-11-23):** all MIT; none has runtime dependencies. GitHub advisories: Zod has
  GHSA-mrhx-c7xc-m3w5 (high, `< 4.6.6`) and an old 3.x one — 4.6.7 is not affected; Immer's advisories
  only affect `< 9.0.6` — 11.2.10 is not affected; Zustand has none. All three releases are older than
  our 3-day release-age guard. `pnpm audit` must stay at 0.
- **Project file:** `{ format: "robosim-project", version, … }`, validated with a strict Zod schema
  (unknown keys rejected, string lengths and part counts capped, ids checked, numbers finite) before
  the studio uses it. Input larger than 5 MB is rejected before parsing.
- **Migrations:** each format version `n` has one pure function `n → n+1`. Loading runs the chain up to
  the current version, then validates. Files from a **newer** version are refused (never guessed).
  v1 is the first version, so the chain is empty today; the runner is tested with test migrations.
- **Undo/redo:** every edit is a command `{ label, recipe }` run through Immer's `produceWithPatches`.
  The history stores patches + inverse patches (capped, oldest dropped), never full snapshots.
  A new edit clears the redo stack. Edits that change nothing are not recorded.
- **Acceptance test:** 100 random edits, then undo all → the project equals the initial one; redo all
  → equals the final one.

## Consequences
- One validation style (Zod) for every stored or imported file from now on.
- Core stays framework-free: the store is a vanilla Zustand store; the web app subscribes to it.
- Changing the project format later means bumping `version` and adding a migration + tests.
