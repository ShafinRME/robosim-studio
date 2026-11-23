# Devlog

One short entry per finished Day: what was built, what was learned, what's next.

<!-- Newest entries on top. Template:
## Day NN — <topic> (YYYY-MM-DD)
- Built:
- Learned:
- Next:
-->

## Day 09 — Simulation kernel (2026-11-24)
- Built: ADR 006. In `@robosim/core`: fixed-step scheduler (1 ms steps, integer step count, real-time factor
  0.1–10×, per-frame step budget with a "behind" signal instead of freezing), typed double-buffered **Signal Bus**
  (model order never changes results), `createSimulation` (models + bus + scheduler) and a spring/driver demo.
  In the web app: Web Worker host with **Comlink 4.4.2** (snapshots at ~30/s, every argument checked, models only
  by id), studio Run/Pause, Step, Stop, speed, status-bar time and steps/s, live values on the canvas, shortcuts.
  User Manual §7.6. 436 unit tests, 70 e2e.
- Learned: the "done when" check works — 1005 steps/s with 121 of 122 frames kept on the main thread; but timing
  tests are meaningless with 4 parallel browsers on one CPU (17 frames), so they run in their own Playwright
  project, alone and after the rest, against an idle baseline; send display-rate snapshots, never per-step
  messages; keep fast-changing state out of React's main tree (external store). Repeating the jank test found
  real jank (41–88 of 122 frames): 30 text updates per second in the status bar made the browser lay out the
  whole page — fixed with CSS containment and 10 Hz text readouts (state changes still instant): now 120–121.
  Also fixed: "New project" clicked while saved projects were still opening was lost (now waits).
- Next: Day 10 — Low-end mode & v0.0.1 (capability detection, error boundary, landing page, Vercel deploy,
  phase review); last Day of this session block.

## Day 08 — Persistence & sharing (2026-11-23)
- Built: ADR 005; **Dexie 4.4.7**, **fflate 0.8.3**, fake-indexeddb (dev) — audit 0. Browser project database
  (validated reads, recent list, open tabs); autosave 1 s after an edit, same tabs back after a reload;
  `.rsim` files (zip: manifest + project) with File → Export / Import; share links with the project packed in
  the URL fragment; Recent projects window (open, delete with confirm, Alt+O). Imports and shared links always
  open as a copy with a new id. User Manual §7.5. 345 unit tests, 66 e2e.
- Learned: an IndexedDB write started while the page closes never finishes — unsaved edits are also written
  synchronously to localStorage on `pagehide` and put back on load; never trust sizes written inside a zip —
  count the real inflated bytes (tested with 30 MB and 5 MB bombs); fflate < 0.8.3 could loop forever on a crafted
  ZIP64; lists built from the database must save pending edits first; a modal dialog hides the page from
  assistive tech (and from role-based tests).
- Next: Day 09 — Simulation kernel (fixed-step scheduler, Web Worker host, signal bus).

## Day 07 — Project model & undo/redo (2026-11-23)
- Built: ADR 004; **Zod 4.6.7**, **Zustand 5.1.0**, **Immer 11.2.10** in `@robosim/core` (MIT, audit 0). Versioned
  project format v1 with a strict schema (size, count, range and key limits) and a migration runner that refuses
  newer versions. Patch-based undo/redo (`history.ts`, 200 steps, no snapshots) and a vanilla Zustand project store
  with validated, named edits. Acceptance test: 100 random edits undo back to the initial project (5 seeds). Studio:
  one store per project tab, project name in the Inspector, Edit → Undo/Redo, Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z.
  User Manual §7.4. 281 unit tests, 56 e2e.
- Learned: Zod 4 silently drops `__proto__` keys from records (safe, now tested); random-edit tests must count
  recorded edits, not attempts (no-op edits are not history); in a text box Ctrl+Z belongs to the text box;
  `next dev` writes an `apps/web/AGENTS.md` file (left uncommitted).
- Next: Day 08 — saving and opening projects.

## Day 06 — Studio workspace shell (2026-11-23)
- Built: `/studio` workspace (ADR 003) on **Dockview 8.9.1** (MIT) in our own Signal style — dock, split,
  tab, float, maximize; popout off. Layout saved in `localStorage`, validated in `@robosim/core` before
  restore (default layout + a status-bar warning on any problem), Reset layout. Top bar with File / Edit /
  View / Help menus, disabled run controls and theme switch; project tabs (max 12); status bar (state,
  messages, canvas X/Y, Low-end mode, version) and a Console log. Command registry + fuzzy search and our
  own Ctrl+K palette; shortcut registry with a conflict / browser-reserved check and a Keyboard shortcuts
  window. User Manual chapter 7 with 6 screenshots. 191 unit tests, 50 e2e, audit 0.
- Learned: `dockview` has no React bindings (`dockview-react` does); Dockview's `initialWidth` is only a
  hint — set sizes explicitly, and again after the first layout pass; subscriptions belong in effects, not
  `onReady`, to survive Strict Mode; many Ctrl shortcuts belong to the browser, so the studio uses Alt;
  Turbopack can miss CSS edits in `packages/ui` — restart the dev server.
- Next: Day 07 — Project model & undo/redo (Zod schema with migrations, Zustand + Immer store,
  command-pattern undo/redo).

## Day 05 — Design system (2026-11-22)
- Built: "Signal" design language (ADR 002) — tokens, IBM Plex fonts, dark/light/system themes with a
  switcher, blueprint grid and glow; final "Kinematic Frame" logo + favicon (4 design rounds); 12 own
  robotics icons; controls (buttons, inputs, select, switch, slider, tabs, tooltip, badge, kbd) and an
  engineering NumberField (`parseSI`/`formatSI` in core); Panel, Toolbar, Inspector; live UI kit at
  `/ui-kit`; User Manual chapters with auto-captured screenshots. **Security baseline:** 34 known
  vulnerabilities (5 critical, mostly Next.js 16.2.6) → 0; SHA-pinned actions, CodeQL, Dependabot,
  audit gate, security headers with an e2e guard, 3-day release-age guard, SECURITY.md, GitHub
  security settings.
- Learned: copying RoboSim's versions brought its vulnerabilities — audit first, security beats parity;
  a logo must be unmistakable at a glance and different from RoboSim's arm; shadcn 4.7 output needs
  restyling and import fixes; shell-escaped regexes lose backslashes — edit files directly; CodeQL caught a
  ReDoS in our own SI-unit regex (ambiguous `s*`/digit groups) — fixed with an unambiguous pattern, a
  64-character cap and a regression test.
- Next: Day 06 — Studio workspace shell (Dockview docking, top bar, tabs, status bar, command palette),
  in a **new session** (Days 06–10).

## Day 04 — CI/CD & quality gates (2026-11-21)
- Built: Vitest unit tests; Playwright browser smoke tests; GitHub Actions CI (format, lint, typecheck,
  unit tests, build + e2e on the production build); Conventional Commits PR-title check; PR template;
  Changesets (fixed `@robosim/*` versions); Vercel project with a preview URL on every PR and
  production = `main` only (robosim-studio-lemon.vercel.app); branch protection on `develop` and `main`.
- Learned: pushing workflow files needs the `workflow` scope on the GitHub CLI token; things installed
  outside the repo (Playwright browsers) must be installed from the owner's own terminal; `pnpm add`
  crashes a running dev server, so stop it first; the new title check immediately caught our own PR title.
- Next: Day 05 — Design system (our own tokens, theme, icons, logo, panel/toolbar components).

## Day 03 — Monorepo scaffold (2026-11-21)
- Built: pnpm + Turborepo monorepo; `apps/web` (Next.js 16.2, React 19.2, strict TS, port 3100);
  `packages/core` (framework-free, lists the 10 labs) and `packages/ui` (shadcn Button, `cn`, theme CSS);
  Tailwind 4 + shadcn/ui (monorepo setup); one ESLint 9 config (no `any`, core can't import React) +
  Prettier with Tailwind class sorting; User Manual source + `pnpm manual` → PDF with screenshots.
- Learned: background installs on a slow connection can crash a running dev server (restart it after);
  shadcn 4.7 suggests a 0.x `cn` package — we kept clsx + tailwind-merge; a fixed-height flex cover
  breaks Chrome PDF printing — normal flow + `break-after: page` is reliable.
- Next: Day 04 — CI/CD & quality gates (GitHub Actions, Vitest, Playwright smoke, Vercel previews).

## Day 02 — Product spec (2026-11-21)
- Built: `docs/PRD.md` (vision, problem, principles, 4 personas, the 10 labs, boards and platforms,
  non-goals, success metrics, constraints, risks, open questions); ADR 001 fixing the 10 labs.
- Changed the plan (owner requests): new **Gesture Control Lab** (P9, Days 146–155): webcam hand/body
  tracking moves simulated and real robots in real time. Plan is now 190 Days / 13 phases, v1.0 ≈
  2027-07-27. Target = desktops/laptops only, 8 GB RAM. Budget: free tiers while developing, up to
  ~3,000 BDT/month if truly needed.
- Learned: decide what counts as a "lab" by subject + engine + workspace, not by board; that settled
  Control vs Power and made Gesture Control a lab of its own.
- Next: Day 03 — Monorepo scaffold (pnpm + Turborepo + Next.js 16).

## Day 01 — RoboSim audit (2026-11-20)
- Built: repo bootstrap (`main`, `develop`, MIT license, CLAUDE.md, docs); `docs/MIGRATION.md` with a
  Reuse / Refactor / Drop decision for every RoboSim file (math, UI, routes, auth/database, tutorials,
  config) plus a port schedule.
- Learned: the RoboSim math has real bugs (IK mixes radians and degrees, SCARA prismatic joints scaled
  by π/180, quiz answer key comes from the browser). These get fixed while porting (Days 113–128), with
  tests. Paid tiers are dropped: Studio is free. The old RoboSim stays unchanged (owner decision);
  its issues are listed in RoboSim's local `IMPROVEMENTS.md`.
- Next: Day 02 — Product spec (`docs/PRD.md`).
