# Phase 0 review — Foundation (Days 01–10)

- **Date:** 2026-11-24 · **Released:** v0.0.1 (tag `v0.0.1`, `main` @ `d799331`), live at
  https://robosim-studio-lemon.vercel.app
- **Plan:** Days 01–10 of `docs/PLAN.md` (P0 · Foundation) — all 10 Days done.

## Delivered
| Area | Result |
|---|---|
| Spec & decisions | PRD, migration map from RoboSim, ADRs 001–006 (labs, design language, workspace, project model, persistence, simulation kernel) |
| Engineering base | pnpm + Turborepo monorepo, strict TypeScript, CI (format, lint, typecheck, unit, build, e2e), Conventional Commits, Vercel previews + production |
| Security | 0 known vulnerabilities (`pnpm audit`, 0 open CodeQL alerts), strict CSP (no eval), SHA-pinned actions, Dependabot, release-age guard, validated + size-limited input everywhere |
| Studio | Docking workspace with saved layout, menus, project tabs, status bar, Console, command palette, shortcuts, error screens |
| Projects | Versioned Zod schema + migrations, undo/redo (100-random-edit test), autosave + restore, `.rsim` files, share links, recent projects |
| Simulation | Fixed 1 ms steps in a Web Worker, Signal Bus, Run/Pause/Step/Stop/speed; page keeps 120 of 122 frames at 1 kHz |
| Low-end | Capability detection, automatic Low-end mode with reasons, one performance profile, System information |
| Docs | User Manual (PDF) for every feature, DEVLOG, STATUS |
| Tests | 464 unit tests, 77 browser tests (timing tests isolated) |

## Done-when checks
- Lighthouse ≥ 90: home **100/100/100/100**; studio **85–88**/100/100/100 — Performance accepted by the owner for
  v0.0.1 with a mandatory follow-up (STATUS open issues).
- Deployed v0.0.1: ✅ verified live (pages, security headers, simulation worker at ~1000 steps/s, no console errors).

## What went well
- Security-first habits caught real problems early (old RoboSim advisories, ZIP64 loop, CSP violation from Zod).
- Tests on behaviour, not implementation: they found real bugs (lost edits on reload, a new project lost during
  restore, jank from status-bar updates).
- Small steps with a manual test per step kept the owner in control.

## What to improve in Phase 1
- **Check open CodeQL alerts before every merge** (a high alert sat open on `develop` from Day 04 to Day 10 because
  PR checks only report *new* alerts). Now part of the end-of-Day checklist.
- **Measure performance A/B on a quiet machine**; avoid parallel browsers for timing tests (done: `isolated` project).
- **Releases:** `develop` → `main` with a merge commit (ruleset changed on Day 10), tag, GitHub release, live check.
- Keep the studio start-up budget in view as the Circuit Lab adds panels (re-run Lighthouse each Day that adds UI).

## Ready for Phase 1 — Circuit Lab (Days 11–32)
Netlist model and ADR (Day 11), schematic canvas (Day 12, React Flow — licence/security check first), wiring,
parts library, then the MNA solver in the worker (Day 15) on top of the Day 09 kernel and Signal Bus.
