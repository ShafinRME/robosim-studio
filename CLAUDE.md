# RoboSim Studio — instructions for Claude Code

Free, open-source (MIT), browser-based robotics lab: circuits, Arduino / ESP32 / Pico emulation,
sensors, control, power electronics, 2D/3D physics simulation, ROS 2 and real-time gesture control
of simulated and real robots, beginner to advanced.
Runs on any desktop or laptop in a browser; built with free tools; deployed on free tiers (Vercel, Render).
Budget: up to ~3,000 BDT (≈ US$25) per month if a free tier is not enough — mainly after development is
complete; always ask the owner before suggesting any paid service.

## Start of every session
1. Read `docs/STATUS.md` (where we are) and the current Day in `docs/PLAN.md`.
2. Show the owner today's step list (`Day NN · Step 1/N … N/N`) before doing anything.

## Working rules (agreed with the owner — follow strictly)
- **One Day = one conversation.** A new Day always starts in a new session in this folder.
- **One step per prompt.** Label every step `Day NN · Step X/N`. Do exactly one step, then stop and
  give clear **manual test instructions** (what to run, what to click, what the owner should see).
  Wait for the owner to say "next" (or report a problem — fix it first) before the next step.
- After each step, update `docs/STATUS.md` (current Day/step, done, next, open issues).
- **Git flow:**
  - `main` = production releases only. **Never commit to, push to, or merge into `main`**
    unless the owner explicitly asks for a release.
  - `develop` = integration branch.
  - Each Day works on `feat/day-NN-short-topic`, created from the latest `develop`.
  - End of Day (only after the owner approves the final test): add a `docs/DEVLOG.md` entry,
    commit (Conventional Commits), push the day branch, open a PR into `develop`, squash-merge.
- **End of Day card:** after the merge, always give the owner complete instructions to start the
  next Day: New session → choose folder `E:\My Projects\robosim-studio` → rename the session
  `Day NN – <topic>` → the exact first message to type → anything to prepare (accounts, installs),
  expected time and number of steps.
- **Accounts** (GitHub settings, Vercel, Neon, Supabase, Render, Google): never operate them yourself.
  Give the owner step-by-step manual instructions instead.
- **`E:\My Projects\robosim` (the original RoboSim) is read-only.** Read it for knowledge only;
  never modify anything there. Code is copied into this repo only when the owner approves.
- Ask the owner whenever something is unclear. Prefer small, reviewable changes.

## Quality bar
- TypeScript strict, no `any`; lint + typecheck + tests green before any merge.
- Unit tests for all logic (solvers, emulators, kinematics); every example gets an automated test.
- Heavy simulation runs in Web Workers; must stay usable on an 8 GB RAM laptop with
  integrated graphics (Low-end mode). Target devices: desktops and laptops only — no phone/tablet UI.
- Only MIT / Apache-2.0 / BSD dependencies. Our own visual design — never copy other products' assets.
- Significant decisions are recorded as ADRs in `docs/adr/NNN-title.md`.

## Docs map
| File | Purpose |
|---|---|
| `docs/PRD.md` | Product spec: vision, users, the 10 labs, boards, non-goals, metrics |
| `docs/PLAN.md` | 190-day plan (13 phases), source of truth for each Day's scope. Generated from the owner's plan source: never edit by hand |
| `docs/STATUS.md` | Handoff note: current Day/step, next action, open issues |
| `docs/DEVLOG.md` | One short entry per finished Day |
| `docs/MIGRATION.md` | What we reuse / refactor / drop from the original RoboSim (Day 01) |
| `docs/adr/` | Architecture Decision Records |

## Commands
_Filled in on Day 03 when the monorepo is scaffolded (pnpm + Turborepo + Next.js 16)._
