# Status

**Current:** Day 07 — Project model & undo/redo · Steps 1–2/8 done
**Branch:** `feat/day-07-project-model` (from `develop`) · draft PR #8
**Session:** Days 06–10 – Studio core
**Updated:** 2026-11-23

## Day 07 steps
| Step | Task | State |
|---|---|---|
| 1/8 | Day branch; ADR 004 project model (Zod, Zustand, Immer, command-pattern undo; security check) | ✅ done |
| 2/8 | Versioned project schema (Zod) + migration runner in core, with tests | ✅ done |
| 3/8 | Project store (vanilla Zustand + Immer) in core | ⏳ next |
| 4/8 | Undo/redo engine (Immer patches, history cap, labels) | ⏳ |
| 5/8 | Acceptance test: 100 random edits undo back to the initial state | ⏳ |
| 6/8 | Studio: Edit → Undo/Redo, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, status messages | ⏳ |
| 7/8 | e2e tests; User Manual update; `pnpm manual` | ⏳ |
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
- Zod added to `@robosim/core` only; audit 0.
- Day 06 merged into `develop` as `ec55cf5` (PR #7).

## Next action
Day 07 · Steps 3–4/8 — project store (Zustand vanilla + Immer) and the undo/redo engine.

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
