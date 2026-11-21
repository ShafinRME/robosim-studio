# Status

**Current:** Day 03 — Monorepo scaffold · ✅ complete (7/7)
**Branch:** `feat/day-03-monorepo-scaffold` → squash-merged into `develop`
**Session:** Days 02–05 in one session (one session per 5 Days; next new session = Day 06)
**Updated:** 2026-11-21

## Day 03 steps
| Step | Task | State |
|---|---|---|
| 1/7 | Day branch; root workspace (pnpm, Turborepo, strict base tsconfig); new session rule in CLAUDE.md | ✅ done |
| 2/7 | `apps/web`: Next.js 16 + React 19 + TS strict, placeholder home page | ✅ done |
| 3/7 | Tailwind 4 + shadcn/ui | ✅ done |
| 4/7 | `packages/core` and `packages/ui`, used by the web app | ✅ done |
| 5/7 | ESLint 9 + Prettier, `lint` / `typecheck` / `format` scripts, Commands section in CLAUDE.md | ✅ done |
| 6/7 | User Manual: `docs/manual/` source, screenshot, `pnpm manual` → PDF | ✅ done |
| 7/7 | Owner review → DEVLOG, commit, push, PR into `develop`, squash-merge | ✅ done |

## Decisions (Day 03)
- Versions follow RoboSim so code ports cleanly: Node ≥ 22.14, pnpm 10.33.1, TypeScript 5.9.3,
  Next.js 16.2.6, React 19.2.4, Tailwind 4.3, shadcn 4.7, ESLint 9.39. Turborepo 2.11.13.
- Dev server on **port 3100** (owner uses 3000 elsewhere); Claude starts it in a Terminal tab.
- Packages ship TypeScript source; Next.js compiles them (`transpilePackages`). `@robosim/core` has no
  React/DOM (enforced by ESLint). `@robosim/ui` holds shadcn components, `cn` and the theme CSS.
- No `.nvmrc` / `engine-strict` (owner's shell prompts on `.nvmrc`; a shadcn dependency wants Node ≥ 22.22).
- User Manual PDF grows with every tested feature (`pnpm manual`).
- UI must be original and professional — never copy the old RoboSim look (real design from Day 05).

## Next action
Day 04 — CI/CD & quality gates, **in this same session** (Days 02–05). Owner says "Day 04" or "next".
Prep: the owner will connect the GitHub repo to Vercel (Claude gives step-by-step instructions during Day 04).

## Open issues
- Math findings F1–F13 in `docs/MIGRATION.md` are fixed during porting (Days 113–115), not in the old RoboSim.
- Old RoboSim stays unchanged, including its premium flow (owner decision 2026-11-20). Its issues are
  listed in the local `E:\My Projects\robosim\IMPROVEMENTS.md`.
- PRD open questions Q1–Q7 (§11), each with its decision Day.
- `docs/PLAN.md` is generated from the owner's private plan source — never edit it by hand.
- Node: shadcn's dependency prefers Node ≥ 22.22; CI (Day 04) should pin a current Node 22 LTS.
