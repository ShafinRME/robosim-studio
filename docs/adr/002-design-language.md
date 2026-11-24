# ADR 002 — Design language ("Signal")

- **Status:** Accepted
- **Date:** 2026-11-21 (Day 05)

## Context
RoboSim Studio is professional simulation software used for hours at a time: circuits, oscilloscope
traces, code, 3D scenes. The owner asked for an original, polished, beautiful UI that makes simulation
smooth and enjoyable — and explicitly **not** a copy of the old RoboSim look or any other product.

## Decision
A design language called **Signal**: a calm, precise instrument-panel workspace where the user's work
(circuits, plots, robots) is the brightest thing on screen.

- **Dark-first, light available.** Long sessions and bright simulation content read best on a dark,
  cool graphite workspace. A full light theme exists for classrooms, projectors and printing.
- **Neutrals:** cool graphite with a slight blue tint (OKLCH hue ≈ 255), in layered surfaces
  (canvas → panel → raised → hover) so depth comes from tone, not heavy shadows.
- **Brand colour — Signal teal** (OKLCH ≈ 0.78 0.13 200): the "live signal" colour for primary actions,
  focus, selection and running simulations.
- **Highlight — Copper** (OKLCH ≈ 0.75 0.14 60): a nod to PCB copper; used sparingly for emphasis,
  the logo's end-effector and "attention" states.
- **Status colours:** success green, warning amber, danger red, info blue — tuned for both themes.
- **Instrument channel colours:** CH1 yellow, CH2 cyan, CH3 magenta, CH4 green — the familiar
  oscilloscope convention, reused for plots, probes and multi-series data across all labs.
- **Typography:** IBM Plex Sans for UI and IBM Plex Mono for numbers, units and code — engineered,
  highly legible typefaces (SIL Open Font License, self-hosted by `next/font`; no requests to Google
  at runtime). Tabular numbers everywhere values change.
- **Density:** compact desktop controls (28 px default height, 24 px small) — a workspace, not a
  marketing page. Radius 6 px: precise, not bubbly.
- **Motion:** short and purposeful (120–240 ms, ease-out); honours `prefers-reduced-motion`.
- **Icons:** Lucide (ISC licence) for UI, plus our own robotics/electronics icons drawn on the same
  24 px grid and stroke width.
- **Logo — "Kinematic Frame":** a wireframe simulation cube (the virtual world) with joint nodes,
  and at its centre a robot coordinate frame (X coral, Y green, Z teal) driven by a copper servo gear with
  a revolute-joint arrow. Robotics + simulation + digital in one mark, and deliberately different from
  the old RoboSim robot-arm logo. Source: `packages/ui/src/components/logo.tsx`; favicon `apps/web/src/app/icon.svg`.
- **Accessibility:** text and controls meet WCAG 2.1 AA contrast in both themes; visible focus ring.

All values live as CSS custom properties (tokens) in `packages/ui/src/styles/globals.css` and are
exposed to Tailwind via `@theme`. Components use tokens only — never raw colour values.

## Consequences
- Every lab inherits the same look automatically; changing a token restyles the whole studio.
- Fonts are OFL-1.1 (standard for open fonts; compatible with our MIT project). This is the one
  non-MIT/Apache/BSD exception, accepted for fonts only.
- shadcn components are restyled through the tokens, so their default look is replaced by Signal.
