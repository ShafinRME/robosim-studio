# ADR 008 — Schematic canvas: our own SVG editor engine (not React Flow)

- **Status:** Accepted (owner, 2026-11-24)
- **Date:** 2026-11-24 (Day 12)
- **Note:** `docs/PLAN.md` names React Flow for Day 12. This ADR evaluates it and proposes our own
  engine instead; PLAN.md is generated and is not edited — this ADR is the record of the change.

## Context
The Circuit Lab needs an editor that feels like professional EDA software (KiCad, Altium, LTspice),
not a flow-chart tool. Requirements over the next weeks:
- **Day 12:** grid, pan/zoom, place / rotate / flip / delete parts, multi-select; 50 parts smoothly,
  also in Low-end mode (8 GB laptop, integrated graphics).
- **Day 13:** orthogonal wires that are their own objects (polylines with corners), wires that start
  or end **on another wire** (T-junctions with junction dots), net labels, copy/paste, dragging a
  part drags its wires along ("rubber-banding").
- **Days 19–21:** probes, live values and current-flow dots drawn on top of the schematic; switches
  and potentiometers operated on the canvas.
- **Days 25–26:** a breadboard view (holes, strips, parts on a board) sharing the same netlist.
- Keyboard-first and accessible; geometry unit-tested; only MIT / Apache-2.0 / BSD dependencies.

## Options

### A. React Flow (`@xyflow/react` 13.0.3, MIT)
- **Good:** pan/zoom, selection, mini-map and node dragging out of the box; popular.
- **Model mismatch:** it is a node graph — edges connect handle to handle. A schematic wire is a
  free polyline that can end on another wire (T-junction); in React Flow that needs fake "junction
  nodes", and orthogonal routing, corners and rubber-banding are custom code anyway. Wire labels,
  net labels and a breadboard view do not fit the node/edge model either.
- **Rotation/flip:** nodes are HTML boxes; rotating a symbol and moving its pin handles with it is
  workaround territory, while it is the core of a schematic editor.
- **Dependencies:** pulls `d3-zoom`, `d3-drag`, `d3-selection`, `d3-interpolate` (**ISC licence** —
  outside our MIT / Apache / BSD rule), `react-compiler-runtime`, `classcat`, its own `zustand`.
  ~1.3 MB unpacked.
- **Maturity:** 13.0.0 is a new major released 2026-11-16 (8 days ago), already four patch releases.
- **Look:** its default look is the well-known flow-chart style; we want our own.

### B. Own SVG schematic engine (proposed)
- Geometry in `@robosim/core` (pure, unit-tested): grid units, part transforms, pin positions,
  hit-testing, box selection, snapping, viewport math (zoom about the cursor, zoom to fit).
- One `<svg>` in the Canvas panel with **one** viewport transform; parts are memoised components;
  one pointer handler with pointer capture; drags update a transient overlay each animation frame
  and commit **one** undoable edit on release.
- Wires, junctions, labels (Day 13), probes (Day 19) and the breadboard (Day 25) are just more
  layers in the same engine.
- **Cost:** more code on Days 12–13 (pan/zoom/selection are ~ a few hundred lines). Mitigated by
  keeping the maths in core with tests and the React layer thin.

### C. Canvas 2D / WebGL (Konva MIT, PixiJS MIT)
- Fastest for tens of thousands of shapes, but text, hit-testing, crisp zoom and accessibility are
  harder, and schematics stay well under 2 000 parts. Kept as an option for dense views (e.g. a
  large breadboard) if profiling ever shows SVG is too slow.

## Decision
**Option B — our own SVG schematic engine, no new runtime dependency.** Conventions, chosen to
match professional EDA tools:

- **Units:** world unit = **1 mil** (0.001 inch). Default grid **100 mil (2.54 mm)** — the standard
  pin pitch; fine grid 50 mil. Pins of every symbol sit on the 100 mil grid, so wires always meet
  pins exactly. Positions are integers in the project file (existing `x`, `y`; range ±1 000 000 mil).
- **Axes and transforms:** y points down (screen convention). Part transform = rotate(rotation) ∘
  mirror-X(flip): mirror first, then rotate **clockwise** in 90° steps (0 / 90 / 180 / 270) — the
  KiCad convention. Rotating or flipping a multi-selection turns the group about its centre
  (snapped to the grid), so the parts keep their relative layout.
- **Project format v2:** parts gain `flip: boolean` (mirror about the symbol's vertical axis).
  Migration v1 → v2 adds `flip: false`. `rotation` stays 0 ≤ r < 360 in the format (other labs use
  any angle); the schematic only uses multiples of 90°.
- **Controls (EDA defaults):** mouse wheel = zoom about the cursor (10 %–3 200 %); middle-drag or
  Space + drag = pan; **F** = zoom to fit; left-drag on empty canvas = box select (left-to-right =
  fully inside, right-to-left = touching, as in KiCad/AutoCAD); Shift / Ctrl + click = add / toggle;
  **R** rotate, **X** / **Y** flip, **Delete**, arrow keys nudge one grid step; **Esc** cancels the
  current tool. Every change is one undo step ("Rotate 3 parts").
- **Rendering:** grid drawn with an SVG `<pattern>` (dots, major lines every 10), lines with a
  real width (6 mil, like a printed schematic) that never get thinner than ~1.4 px when zoomed out
  (Day 12 implementation; replaces the first idea of constant-width strokes), labels hidden when
  too small to read, colours from the design tokens (both themes). Low-end mode: no hover
  animations, coarser grid, no major lines.
- **Accessibility:** the canvas is focusable with a description; selection and actions are
  announced (aria-live); every action has a keyboard path; the Inspector edits the selection.
- **Status bar:** cursor position in mm or inch (setting), grid size and zoom level.

## Consequences
- No new dependency, no licence exception, nothing new for `pnpm audit`.
- One engine for schematic and breadboard; wires/junctions (Day 13) fit naturally.
- More own code to maintain; geometry is pure and covered by unit tests, interaction by e2e tests.
- Positions in mils make SPICE/KiCad-style export and printing (Day 29) straightforward.
- If a future view needs thousands of shapes, a Canvas 2D layer can be added under the same
  viewport without changing the document model.
