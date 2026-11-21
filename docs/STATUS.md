# Status

**Current:** Day 05 — Design system · Step 1/7 done, waiting for owner check
**Branch:** `feat/day-05-design-system` — draft PR into `develop` (CI runs on every push)
**Session:** Days 02–05 in one session; Day 05 ends the block → Day 06 starts a new session
**Updated:** 2026-11-21

## Day 05 steps
| Step | Task | State |
|---|---|---|
| 1/7 | Day branch; ADR 002 "Signal" design language; design tokens (colour, type, density, motion); IBM Plex fonts; `/ui-kit` page | ✅ done |
| 2/7 | Dark / light / system theme with a theme switcher | ⏳ next |
| 3/7 | Logo (mark + wordmark) and icon set (Lucide + our robotics icons) | ⬜ |
| 4/7 | Primitives restyled to Signal: buttons, icon buttons, inputs, number field with units, switch, slider, select, tabs, tooltip, badge, kbd | ⬜ |
| 5/7 | Workspace components: Panel, Toolbar, Inspector (property grid) | ⬜ |
| 6/7 | UI kit page shows everything; e2e test; User Manual chapter on themes & look | ⬜ |
| 7/7 | Owner review → DEVLOG, merge; end-of-block card for the Days 06–10 session | ⬜ |

## Decisions (Day 05)
- ADR 002: design language **Signal** — dark-first cool graphite surfaces, Signal teal brand, copper
  highlight, oscilloscope channel colours (CH1–CH4), IBM Plex Sans/Mono, compact 28 px controls,
  6 px radius, short ease-out motion. Original design; nothing copied from old RoboSim or other products.
- Tokens are CSS custom properties in `packages/ui/src/styles/globals.css`, exposed to Tailwind
  (`bg-surface-1`, `text-brand`, `bg-ch1`, …). Components use tokens only.
- Fonts (OFL-1.1) are the one licence exception, self-hosted by `next/font`.

## Next action
Owner checks http://localhost:3100/ui-kit, then says "next" → Day 05 · Step 2/7.

## Open issues
- Math findings F1–F13 in `docs/MIGRATION.md` are fixed during porting (Days 113–115), not in the old RoboSim.
- Old RoboSim stays unchanged, including its premium flow (owner decision 2026-11-20). Its issues are
  listed in the local `E:\My Projects\robosim\IMPROVEMENTS.md`.
- PRD open questions Q1–Q7 (§11), each with its decision Day.
- `docs/PLAN.md` is generated from the owner's private plan source — never edit it by hand.
