# Status

**Current:** Day 04 — CI/CD & quality gates · Step 5/6 in progress — waiting for owner to connect Vercel
**Branch:** `feat/day-04-ci-quality-gates` — pushed; draft PR #4 into `develop` (CI green)
**Session:** Days 02–05 in one session (one session per 5 Days; next new session = Day 06)
**Updated:** 2026-11-21

## Day 04 steps
| Step | Task | State |
|---|---|---|
| 1/6 | Day branch; Vitest + first unit tests (`@robosim/core` labs, `@robosim/ui` `cn`); `pnpm test` | ✅ done |
| 2/6 | Playwright smoke test of the home page; `pnpm test:e2e` | ✅ done |
| 3/6 | GitHub Actions CI: format, lint, typecheck, unit tests, build, e2e on every PR | ✅ done (green on PR #4) |
| 4/6 | Versioning & PR hygiene: Changesets, PR title check (Conventional Commits), PR template | ✅ done |
| 5/6 | Vercel: owner connects the repo (step-by-step guide); preview deploy per PR | ⏳ next |
| 6/6 | Day PR = test PR: CI green + preview URL; branch protection (owner); DEVLOG; squash-merge | ⬜ |

## Decisions (Day 04)
- Vitest 5.1 at the root (`vitest.config.mts`); tests live next to the code as `*.test.ts`.
- Playwright 1.65 (Chromium only) in `apps/web/e2e`; locally reuses the dev server on 3100, in CI runs
  the production build (`pnpm start`). Smoke test: title, heading, no console errors, 10 labs.
- CI (`.github/workflows/ci.yml`): two jobs on every PR/push to develop/main — quality (format, lint,
  typecheck, unit tests, build) and e2e (Playwright on the production build). Node 22 (latest 22.x),
  pnpm from `packageManager`, actions checkout/setup-node v7, pnpm/action-setup v6.
- Changesets 3.0 (`pnpm changeset`, `pnpm version-packages`): base `develop`, all `@robosim/*` versioned
  together (fixed), private (never published). Only user-visible changes need a changeset.
- PR titles must follow Conventional Commits (`.github/workflows/pr-title.yml`) — they become the
  squash commit message. PR template with test checklist and User Manual / changeset reminders.
- Owner (2026-11-21): Claude may push the day branch and update a draft PR anytime to run CI.
- Installing packages crashes a running dev server → stop it before installs, restart after (CLAUDE.md).

## Next action
Owner follows `docs/guides/vercel.md` (import repo, root `apps/web`, Node 22.x, production branch `main`), then says "done" → Claude checks the Vercel preview on PR #4.

## Open issues
- Math findings F1–F13 in `docs/MIGRATION.md` are fixed during porting (Days 113–115), not in the old RoboSim.
- Old RoboSim stays unchanged, including its premium flow (owner decision 2026-11-20). Its issues are
  listed in the local `E:\My Projects\robosim\IMPROVEMENTS.md`.
- PRD open questions Q1–Q7 (§11), each with its decision Day.
- `docs/PLAN.md` is generated from the owner's private plan source — never edit it by hand.
- Node: shadcn's dependency prefers Node ≥ 22.22; CI should pin a current Node 22 LTS.
