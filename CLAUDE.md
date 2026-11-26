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
- **One session = 5 Days.** Days 1–5, 6–10, 11–15, … share one conversation in this folder. A new
  session starts only after Day 5, 10, 15, … is complete (so Day 6, 11, 16, … open a new session).
  Each Day still has its own branch and PR.
- **Half a Day per prompt** (owner rule, 2026-11-26; replaces "two steps per prompt"). Label every
  step `Day NN · Step X/N`. The first prompt of a Day does Steps 1–4, the next prompt Steps 5–8. Each
  half ends with a short report and a **detailed manual test**: numbered sections, exact clicks and
  the exact values / messages the owner should see (run the flows first so the numbers are real).
  Wait for the owner to say "next" (or report a problem — fix it first). The merge still waits for
  the owner's approval of the final test.
- After each step, update `docs/STATUS.md` (current Day/step, done, next, open issues).
- **Git flow:**
  - `main` = production releases only. **Never commit to, push to, or merge into `main`**
    unless the owner explicitly asks for a release.
  - `develop` = integration branch.
  - Each Day works on `feat/day-NN-short-topic`, created from the latest `develop`.
  - During the Day, commit and push the day branch and open/update a draft PR into `develop` whenever
    CI needs to run — no need to ask (owner permission 2026-11-21); the owner checks CI.
  - End of Day (only after the owner approves the final test): add a `docs/DEVLOG.md` entry,
    commit (Conventional Commits), push, mark the PR ready, squash-merge into `develop`.
- **End of Day:** after the merge, give a short note for the next Day (topic, prep, steps) and continue
  in the same session. **End of block** (Day 5, 10, 15, …): give complete instructions to start the
  next session: New session → choose folder `E:\My Projects\robosim-studio` → rename the session
  `Days NN–MM – <topic>` → the exact first message to type → anything to prepare (accounts,
  installs), expected time.
- **User Manual, kept up to date.** When a feature passes the owner's test, add it to
  `docs/manual/user-manual.md` the same Day: what each button/control does, how to use it step by
  step, and a screenshot (take it yourself from the running app, or ask the owner). Then run
  `pnpm manual` and commit the PDF with the Day's PR. Never document features that are not built yet.
- **Short reports.** After each step give only the main points and the manual test, not long write-ups.
- **Accounts** (GitHub settings, Vercel, Neon, Supabase, Render, Google): never operate them yourself.
  Give the owner step-by-step manual instructions instead.
- **`E:\My Projects\robosim` (the original RoboSim) is read-only.** Read it for knowledge only;
  never modify anything there. Code is copied into this repo only when the owner approves.
- Ask the owner whenever something is unclear. Prefer small, reviewable changes.

## Quality bar
- **Security first — zero known vulnerabilities** (owner rule, 2026-11-21). Work like a senior
  application-security engineer: `pnpm audit` clean (CI blocks otherwise); GitHub Actions pinned to
  commit SHAs with least-privilege permissions and `persist-credentials: false`; CodeQL + Dependabot;
  strict security headers (`apps/web/next.config.ts`, guarded by an e2e test); no secrets in the repo;
  validate all input; enable powerful browser APIs (camera, serial…) only deliberately, with a review.
  Anything that cannot be fixed the same Day goes into `docs/STATUS.md` open issues with a fix Day.
- Security beats version parity: upgrade a vulnerable dependency even if RoboSim used the old version.
- TypeScript strict, no `any`; lint + typecheck + tests green before any merge.
- Unit tests for all logic (solvers, emulators, kinematics); every example gets an automated test.
- Heavy simulation runs in Web Workers; must stay usable on an 8 GB RAM laptop with
  integrated graphics (Low-end mode). Target devices: desktops and laptops only — no phone/tablet UI.
- Only MIT / Apache-2.0 / BSD dependencies. Our own visual design — never copy other products' assets,
  and never copy the old RoboSim look. The UI must feel like professional simulation software:
  original, polished, beautiful and smooth (design system on Day 05, workspace shell on Day 06).
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
| `docs/guides/` | Step-by-step guides for account tasks the owner does (e.g. `vercel.md`) |
| `docs/manual/` | User Manual source (`user-manual.md`), screenshots (`images/`) and the built PDF |

## Commands
Run from the repo root (pnpm 10 + Turborepo). Node ≥ 22.14.

| Command | What it does |
|---|---|
| `pnpm install` | Install all workspace dependencies |
| `pnpm dev` | Web app at http://localhost:3100 (port 3100; the owner uses 3000 for another project) |
| `pnpm build` | Production build of every package/app |
| `pnpm lint` | ESLint, zero warnings allowed |
| `pnpm typecheck` | TypeScript strict check of every package |
| `pnpm test` / `pnpm test:watch` | Vitest unit tests (`*.test.ts` next to the code they test) |
| `pnpm test:e2e` | Playwright browser smoke tests (`apps/web/e2e`); reuses the dev server on 3100 |
| `pnpm format` / `pnpm format:check` | Prettier write / check (Markdown is not formatted) |
| `pnpm manual:screenshots` | Re-capture the User Manual screenshots (`apps/web/e2e-manual`) into `docs/manual/images` |
| `pnpm manual` | Build `docs/manual/RoboSim-Studio-User-Manual.pdf` (needs Chrome or Edge) |
| `pnpm --filter @robosim/web <script>` | Run one package's script |

Layout: `apps/web` (Next.js 16 app) · `packages/core` (framework-free logic, no React/DOM) ·
`packages/ui` (shadcn components, `cn`, theme CSS). Add shadcn components from `packages/ui`.

Dev server: Claude starts `pnpm dev` in a Terminal tab and keeps it running; the owner only checks the page.
**Stop the dev server before `pnpm install` / `pnpm add`** and start it again afterwards — pnpm relinks
`node_modules` and the running Turbopack server crashes ("couldn't find next/package.json").
