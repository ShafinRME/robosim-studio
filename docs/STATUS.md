# Status

**Current:** Day 05 — Design system · Step 5/8 done, waiting for owner check
**Branch:** `feat/day-05-design-system` — draft PR into `develop` (CI runs on every push)
**Session:** Days 02–05 in one session; Day 05 ends the block → Day 06 starts a new session
**Updated:** 2026-11-21

## Day 05 steps
| Step | Task | State |
|---|---|---|
| 1/8 | Day branch; ADR 002 "Signal" design language; design tokens (colour, type, density, motion); IBM Plex fonts; `/ui-kit` page | ✅ done |
| 2/8 | **Security baseline** (owner request): 34 → 0 vulnerabilities (Next.js 16.4.6, overrides), SHA-pinned actions, CodeQL, Dependabot, audit in CI, security headers + e2e test, 3-day release-age guard, SECURITY.md | ✅ done |
| 3/8 | Dark / light / system theme with a theme switcher (very digital look) | ✅ done |
| 4/8 | Logo (mark + wordmark) and icon set (Lucide + our robotics icons) | ✅ done |
| 5/8 | Primitives restyled to Signal: buttons, icon buttons, inputs, number field with units, switch, slider, select, tabs, tooltip, badge, kbd | ✅ done |
| 6/8 | Workspace components: Panel, Toolbar, Inspector (property grid) | ⏳ next |
| 7/8 | UI kit page shows everything; e2e test; User Manual chapter on themes & look | ⬜ |
| 8/8 | Owner review → DEVLOG, merge; end-of-block card for the Days 06–10 session | ⬜ |

## Decisions (Day 05)
- ADR 002: design language **Signal** — dark-first cool graphite surfaces, Signal teal brand, copper
  highlight, oscilloscope channel colours (CH1–CH4), IBM Plex Sans/Mono, compact 28 px controls,
  6 px radius, short ease-out motion. Original design; nothing copied from old RoboSim or other products.
- Tokens are CSS custom properties in `packages/ui/src/styles/globals.css`, exposed to Tailwind
  (`bg-surface-1`, `text-brand`, `bg-ch1`, …). Components use tokens only.
- Security (owner rule): zero known vulnerabilities. Next.js 16.2.6 → **16.4.6** (25 advisories incl. 5 critical
  in 16.2.6); eslint-config-next 16.4.6; shadcn 4.23.0; overrides for zod (lint plugin) and minimatch
  (shadcn CLI). Audit now: **0 known vulnerabilities**; CI fails on any new one.
- Themes via next-themes 0.4.6 (MIT): dark default, light, system; stored as `robosim-theme`; no flash.
  Digital look: blueprint dot/line grid canvas (`bg-blueprint`), signal glow (`shadow-glow`), mono labels.
- Logo **"Kinematic Frame"** (final, owner-approved after 4 rounds; deliberately unlike the old RoboSim arm):
  wireframe simulation cube with joint nodes + robot XYZ coordinate frame driven by a copper servo gear and a
  revolute-joint arrow, on an ink tile with blueprint dots; wordmark `RoboSim` + mono `STUDIO`; SVG favicon.
- Icons: Lucide (ISC) for UI + 12 own electronics/robotics icons on the same 24 px grid (`@robosim/ui/icons/robotics`).
- Controls rebuilt in Signal style on Radix primitives (shadcn generated, then rewritten; no 0.x `cn` package):
  Button (6 variants, 3 sizes) + IconButton (label required), Input, Select, Switch, Slider, Tabs
  (instrument strip), Tooltip (+ provider in layout), Badge (status LED), Kbd, Separator, and
  **NumberField** with engineering units (`parseSI`/`formatSI`/`clampStep` in `@robosim/core`, 38 tests).
- Fonts (OFL-1.1) are the one licence exception, self-hosted by `next/font`.

## Next action
Owner tries the Controls section on http://localhost:3100/ui-kit, then says "next" → Day 05 · Step 6/8.

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
