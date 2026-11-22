# Status

**Current:** Day 07 — Project model & undo/redo · Steps 5–6/8 done
**Branch:** `feat/day-07-project-model` (from `develop`) · draft PR #8
**Session:** Days 06–10 – Studio core
**Updated:** 2026-11-23

## Day 07 steps
| Step | Task | State |
|---|---|---|
| 1/8 | Day branch; ADR 004 project model (Zod, Zustand, Immer, command-pattern undo; security check) | ✅ done |
| 2/8 | Versioned project schema (Zod) + migration runner in core, with tests | ✅ done |
| 3/8 | Project store (vanilla Zustand + Immer) in core | ✅ done |
| 4/8 | Undo/redo engine (Immer patches, history cap, labels) | ✅ done |
| 5/8 | Acceptance test: 100 random edits undo back to the initial state | ✅ done |
| 6/8 | Studio: Edit → Undo/Redo, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, status messages | ✅ done |
| 7/8 | e2e tests; User Manual update; `pnpm manual` | ⏳ next |
| 8/8 | Owner review → DEVLOG, merge; note for Day 08 | ⏳ |

## Decisions (Day 07)
- ADR 004: **Zod 4.6.7**, **Zustand 5.1.0**, **Immer 11.2.10** (all MIT, no runtime deps; advisories only affect
  older versions; pass the 3-day guard). Undo/redo = named commands on Immer patches (no snapshots).
- Project format v1 (`packages/core/src/project.ts`): `{ format: "robosim-project", version: 1, id, name, lab,
  createdAt, updatedAt, parts[] }`; part = `{ id, type, name, x, y, rotation, props }`. Strict schema: unknown
  keys rejected, ids/types by bounded regex, ≤ 2 000 parts, ≤ 64 flat props (number / text ≤ 1 000 / boolean),
  coordinates ±1e6, rotation 0–360, unique part ids, `constructor`/`prototype` keys refused (Zod drops
  `__proto__`; tested). Files > 5 MB refused before parsing. Migration runner: one pure step per version,
  newer versions refused, failures reported; chain empty for v1 (tested with test migrations). 44 tests.
- Zod, Zustand and Immer added to `@robosim/core` only; audit 0.
- Undo/redo (`packages/core/src/history.ts`): `applyEdit` / `undo` / `redo` on Immer patches + inverse patches;
  no-change edits not recorded; a new edit clears redo; history capped at 200 (oldest dropped). 10 tests.
- Store (`packages/core/src/project-store.ts`): vanilla Zustand `createProjectStore(project)` with `apply`, `undo`,
  `redo`, `replace` (clears history); frozen state. Validated edits in `projectEdits`: rename project, add / remove /
  move / rotate / rename part, set / remove property (throw `ProjectEditError` on bad input, no-op on a missing
  part). Labels name the part ("Move R1"). `updatedAt` is set on save (Day 08), not per edit, so undo restores
  the exact project. 29 tests; 274 unit tests in total.
- Acceptance (`packages/core/src/undo-acceptance.test.ts`): 5 fixed seeds × exactly 100 recorded random edits (add /
  remove / move / rotate / rename part, set / remove property, rename project); every undo step matches the state
  recorded on the way, undo all = initial, redo all = final. ✅ Day 07 "done when" met.
- Studio: one project store per tab (`studio-project.tsx`, own history per tab; tab name follows the project name,
  also on Undo). Inspector shows **Project**: Name (edit; Enter/blur = one undoable rename, Esc reverts, empty name
  refused with a warning), Lab, Parts. Edit menu "Undo Rename project" / "Redo …"; commands `edit.undo` /
  `edit.redo` (off when nothing to undo); shortcuts Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y — inside a text box they undo the
  typing, not the project. Status: "Undo: Rename project.". `renameProjectTab` in core. 281 unit, 56 e2e (6 new).
- Day 06 merged into `develop` as `ec55cf5` (PR #7).

## Next action
Day 07 · Step 7/8 — User Manual (project name, Undo/Redo, shortcuts), screenshots, `pnpm manual`; then Step 8 owner review.

## Open issues
- CSP still allows `script-src 'unsafe-inline'` (Next.js inline bootstrap on static pages). Move to
  nonce/hash-based CSP on Day 173 (security hardening) — or earlier if Next.js static hashing lands.
- The old RoboSim (robosim-bd.vercel.app) runs Next.js 16.2.6 with the same critical advisories. It is
  read-only for us; the owner decides whether to upgrade it.
- Math findings F1–F13 in `docs/MIGRATION.md` are fixed during porting (Days 113–115), not in the old RoboSim.
- Old RoboSim stays unchanged, including its premium flow (owner decision 2026-11-20). Its issues are
  listed in the local `E:\My Projects\robosim\IMPROVEMENTS.md`.
- PRD open questions Q1–Q7 (§11), each with its decision Day.
- `docs/PLAN.md` is generated from the owner's private plan source — never edit it by hand.
- Dev note: Turbopack can miss CSS edits in `packages/ui`; restart `pnpm dev` after editing them.
