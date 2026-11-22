# Status

**Current:** Day 06 — Studio workspace shell · Step 6/9 done
**Branch:** `feat/day-06-workspace-shell` (from `develop`)
**Session:** Days 06–10 – Studio core
**Updated:** 2026-11-22

## Day 06 steps
| Step | Task | State |
|---|---|---|
| 1/9 | Day branch; ADR 003 workspace shell (Dockview, licence, security check, layout saving); empty `/studio` page + e2e test | ✅ done |
| 2/9 | Dockview in Signal style; default layout (Explorer, Canvas, Inspector, Console); dock/split/tabs/float | ✅ done |
| 3/9 | Layout saving: localStorage, validated restore (core + tests), Reset layout | ✅ done |
| 4/9 | Top bar (logo, menus, run controls slot, theme) + project tabs | ✅ done |
| 5/9 | Status bar (sim state, messages, Low-end indicator, cursor/zoom) | ✅ done |
| 6/9 | Command palette (Ctrl+K) + command registry in core | ✅ done |
| 7/9 | Keyboard shortcuts registry (conflict check) + shortcuts help | ⏳ next |
| 8/9 | e2e tests; User Manual "Studio workspace" chapter + screenshots; `pnpm manual` | ☐ |
| 9/9 | Owner review → DEVLOG, merge; note for Day 07 | ☐ |

## Decisions (Day 06)
- ADR 003: **Dockview 8.9.1** (MIT, no runtime deps, 0 GitHub advisories, passes the 3-day release-age
  guard) for the workspace. Own Signal theme over Dockview's CSS variables. Layout saved as
  `{ version: 1, layout }` in `localStorage` (`robosim-layout`), validated in `@robosim/core` before use,
  default layout on any failure; Reset layout command. Popout windows off until reviewed. Route `/studio`.
- Package is **`dockview-react` 8.9.1** (React bindings; pulls `dockview` + `dockview-core`, all MIT).
  Audit still 0. `Dock` component in `@robosim/ui/components/dock` with the Signal theme
  (`styles/dock.css`, 4 px gaps, rounded modules, teal active-tab bar), group buttons Float / Dock back
  and Maximize / Restore, tab right-click menu without Popout. Studio panels are placeholders with
  honest empty states. 5 e2e tests incl. real drag-and-drop (tab join + edge split).
- Layout saving: `packages/core/src/layout.ts` (`parseSavedLayout`, `checkLayout`, `serializeLayout`; 44 unit
  tests with a real saved layout as fixture). Rejects: missing, > 100 000 chars, corrupt JSON, other version,
  unknown panel component, custom tab components, panels missing or placed twice, bad sizes, grids deeper than
  32, popout/edge groups. Saved 300 ms after a change and on page close; restore falls back to the default layout
  (and clears the bad save) on any problem, with a console warning. **Reset layout** is a temporary button in
  the studio header until the View menu arrives in Step 4. 10 studio e2e tests.
- Top bar: Logo · Menubar (new `@robosim/ui/components/menubar`, Radix) — File (New / Close project), Edit
  (Undo / Redo disabled until Day 07), View (panel show/hide checkboxes + Reset layout, header button removed),
  Help (GitHub source + Report a problem, new tab, `noopener noreferrer`) · Run / Pause / Step / Stop (disabled,
  "No simulation loaded") · theme switch. Project tabs: pure logic in `packages/core/src/project-tabs.ts`
  (17 tests; max 12 tabs, "Untitled N" naming, browser-like close); tab strip with ←/→/Home/End; empty state
  with New project when all are closed. Tabs are not saved yet (Day 08). 29 e2e tests.
- Status bar: Idle state · latest message (`role=status`) · canvas pointer X/Y (px) · **Low-end mode** toggle
  (stored `robosim-low-end`; default from `navigator.deviceMemory` ≤ 4 GB or ≤ 2 cores; sets `data-low-end` on
  `<html>` → no animations/transitions/glow) · version. Message log + Low-end detection in
  `packages/core/src/status.ts` (16 tests); Console panel now lists messages. Landmarks: top bar = banner,
  workspace = main, status bar = contentinfo. Zoom readout waits for a zoomable canvas. 35 e2e tests.
- Commands: `packages/core/src/commands.ts` — registry (register/unregister, duplicate-id check, cached list,
  subscribe), `fuzzyMatch` + `searchCommands` (title first, then each word within one title/category/keyword),
  `rememberRecent` (18 tests). Palette is our own (`@robosim/ui/components/command-palette`, Radix Dialog,
  accessible combobox; no new dependency): Ctrl/⌘+K or the top-bar "Search commands" button; ↑/↓, Enter, Esc;
  highlights matches; disabled commands shown dimmed; recent first. 17 studio commands in
  `apps/web/src/app/studio/studio-commands.ts`; menus run the same command ids. `useSetTheme` added to
  theme-provider. 43 e2e tests.
- Dev note: Turbopack did not pick up an edit to `packages/ui/src/styles/globals.css`; restart `pnpm dev` after
  editing CSS in `packages/ui`.
- Earlier decisions: ADR 001 (labs), ADR 002 (Signal design language); Day 05 details in `docs/DEVLOG.md`.

## Next action
Day 06 · Step 7/9 — keyboard-shortcut registry in core (conflict check), shortcuts on commands, a "Keyboard shortcuts" help window.

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
