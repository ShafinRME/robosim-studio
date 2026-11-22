# Devlog

One short entry per finished Day: what was built, what was learned, what's next.

<!-- Newest entries on top. Template:
## Day NN — <topic> (YYYY-MM-DD)
- Built:
- Learned:
- Next:
-->

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
