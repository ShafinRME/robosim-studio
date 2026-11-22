# ADR 003 — Studio workspace shell (Dockview)

- **Status:** Accepted
- **Date:** 2026-11-22 (Day 06)

## Context
Every lab (circuits, code, plots, 3D, ROS, gestures) runs inside one studio window. Users need an
IDE-style workspace: panels they can drag, dock, split, put in tabs and float, and a layout that
survives a reload. It must look like Signal (ADR 002), stay smooth on an 8 GB laptop with integrated
graphics, and use only MIT / Apache-2.0 / BSD code with zero known vulnerabilities.

## Options considered
| Option | Licence | Notes |
|---|---|---|
| **Dockview 8.9.1** | MIT | No third-party runtime dependencies; React bindings; tabs, groups, splits, floating groups, popout windows; `toJSON()` / `fromJSON()` for layouts; theming through CSS variables; actively released. |
| FlexLayout | ISC | Capable, but its own model format and heavier theme overrides. |
| rc-dock | Apache-2.0 | Fewer releases; older React patterns. |
| Golden Layout 2 | MIT | Not React-first; components mounted outside the React tree. |
| react-resizable-panels / allotment | MIT | Split panes only — no docking or tabs. |
| Build our own | — | Weeks of work on drag-and-drop and accessibility; no benefit. |

## Decision
Use **Dockview** (`dockview-react` 8.9.1, exact version pinned; it brings `dockview` and `dockview-core` from the same project) for the studio workspace.

- **Security check (2026-11-22):** MIT licence; no third-party runtime dependencies (only `dockview` and `dockview-core`, same
  project); React is a peer; 0 advisories in the GitHub Advisory Database for `dockview`,
  `dockview-core` or `dockview-react`; 8.9.1 published 2026-11-17, so it passes our 3-day
  release-age guard. `pnpm audit` must stay at 0 after install. Popout windows (`window.open`) stay
  off until a later review.
- **Look:** Dockview's default theme is not used. A Signal theme maps Dockview's CSS variables to our
  tokens in `packages/ui` (tabs as an instrument strip, teal focus/drop target, graphite surfaces), in
  both dark and light.
- **Group actions:** each group header has Float / Dock back and Maximize / Restore buttons; the tab
  right-click menu offers Close, Close others, Close all, Float and Maximize (no Popout).
- **Panels are React components registered by id** (`explorer`, `canvas`, `inspector`, `console`, …).
  Labs add their panels to the registry; the shell does not know lab internals.
- **Saving layouts:**
  - The layout is serialised with Dockview's `toJSON()` and stored in `localStorage` under
    `robosim-layout` as `{ version: 1, layout }`, written with a short debounce after each change.
  - On load the stored value is **validated before use** (shape, known panel ids, size limit). Invalid,
    unknown-version or corrupt data is discarded and the default layout is used — a broken save can
    never break the studio. Validation lives in `@robosim/core` with unit tests.
  - A **Reset layout** command restores the default.
  - Layout is a per-browser preference, separate from project data (projects get their own storage on
    Days 07–08).
- **Shell chrome around Dockview:** top bar (logo, menus, run controls, theme), project tabs, status
  bar, a command palette (Ctrl+K) and a keyboard-shortcut registry. Commands live in one registry in
  `@robosim/core` so menus, palette and shortcuts all run the same actions.
- The studio lives at the route `/studio`.

## Consequences
- Docking, splitting, tabs and floating panels come ready-made and keyboard accessible; we spend our
  time on the labs.
- Layout JSON follows Dockview's format; if Dockview's format changes, we bump `version` and add a
  migration (or fall back to the default layout).
- One more dependency to watch; Dependabot and `pnpm audit` cover it.
