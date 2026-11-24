# ADR 009 — Wires and connectivity: geometric, EDA-style

- **Status:** Proposed (owner review, Day 13)
- **Date:** 2026-11-25 (Day 13)

## Context
Day 13 turns placed parts into circuits. The schematic must connect parts the way professional EDA
tools (KiCad, Altium, OrCAD, LTspice) do, so learners build habits that transfer, and the result
must feed the netlist of ADR 007 (`buildNetlist`) exactly. Later the breadboard view (Day 25) adds
its own connections to the same netlist, and the simulator (Day 15+) trusts it completely: a wrong
net is a wrong answer. Requirements: orthogonal wires, T-junctions with dots, crossing wires that
do **not** connect, net labels, wires that stay attached when parts move, copy/paste, undo, fast
with hundreds of wires.

## Options
- **A. Connection graph (wire = "pin A ↔ pin B")** — the React-Flow model. Simple, but wires can
  only run pin to pin: no T-junction on a wire, no free wire ends, no labels on a wire.
- **B. Geometric connectivity (proposed)** — wires are drawn lines; what touches connects. This is
  what KiCad, Altium and LTspice do. Needs a geometry pass to find nets, which is easy to test.

## Decision: B — geometric connectivity

### Data (project format v3)
- **Wire** `{ id, points: [[x, y], …] }`: a polyline of 2–64 points in mils, **every segment
  horizontal or vertical**, consecutive points different, points on the 50-mil fine grid. A wire
  with corners is one object (easy to select, move, delete); routing never produces diagonals.
- **Net label** `{ id, x, y, name, rotation }`: a name attached at one grid point (`VCC`, `SDA`,
  `GND`…), same rules as ADR 007 net names.
- Limits: 4 000 wires, 64 points each, 2 000 labels. Migration v2 → v3 adds empty `wires` and
  `labels`. All checked by Zod on load (orthogonality, grid, ranges, unique ids).

### Connection rules (the only ones)
1. A **wire end** connects to anything at the same point: a **pin end**, another **wire end**, or
   the **inside of another wire's segment** (a T-junction).
2. **Two pins** at the same point connect (part dropped pin-on-pin).
3. Wires that merely **cross** do not connect — and no dot is drawn. To join crossing wires the
   learner ends one wire on the other (as in every EDA tool).
4. A **net label** joins whatever wire or pin passes through its point; labels with the same name
   are one net wherever they are; `GND` / `0` is ground (ADR 007).
5. A ground symbol's pin is ground (ADR 007).
- A **junction dot** is drawn wherever three or more wire ends / segments meet at one point
  (including a wire end on a segment's inside). A pin end shows its small open circle only while
  nothing is connected to it.

### From drawing to netlist
`connectivityOf(project, pinsOf)` in core turns the drawing into `CircuitInput` (ADR 007):
part pins at their placed positions, union of rule 1–2 contacts as `connections`, labels as
`labels`. Spatial lookup by grid point (hash map), segments indexed per row / column, so it is
O(n) for typical drawings. `buildNetlist` then numbers the nets. Every rule has unit tests
("nets computed correctly").

### Editing behaviour (EDA conventions)
- **Wire tool** (**W**): click to start (on a pin, a wire or empty grid), the preview is an
  L-shape (horizontal first; **/** switches to vertical first), each click fixes a corner, the
  wire ends by itself when it reaches a pin or another wire, or on double-click / **Enter**;
  **Backspace** removes the last corner, **Esc** cancels the current wire, a second **Esc** leaves
  the tool. Zero-length and back-tracking segments are removed automatically.
- **Rubber-banding:** moving parts drags the ends of wires attached to their pins; the segment next
  to a moved end is adjusted (or an extra corner added) so the wire stays orthogonal. Wires that
  are entirely selected move with the parts.
- **Labels** (**L**): click a wire or pin to attach a name; editing the name re-connects nets.
- **Copy / paste** (**Ctrl+C / Ctrl+X / Ctrl+V**, **Ctrl+D** duplicate): parts, wires and labels
  between them; pasted parts get new designators (R3, R4…), pasted labels keep their names (so
  they join the same nets — the EDA convention). The clipboard holds a small validated JSON
  document (format `robosim-clipboard`, version 1, size-limited), so pasting into another project
  tab works and pasted text is never trusted.
- Every action is one undo step ("Draw wire", "Delete 3 items", "Paste 4 items").

### Looks
Wires use a new token `--schematic-wire` (both themes, distinct from symbol ink), stroke 8 mil
(≥ 1.4 px); junction dots 40 mil diameter; selected wires in the brand colour; net labels in the
mono font with a small flag shape pointing at their point.

## Consequences
- The netlist depends only on geometry, so the schematic, export (Day 29) and the breadboard view
  (Day 25, which adds strip connections) share one well-tested path to `buildNetlist`.
- Learners must end wires on pins (pin circles disappear when connected; unconnected pins are
  already reported by the checks of ADR 007) — the same discipline as real EDA tools.
- Geometry must stay on the grid; the validator refuses anything else, so files cannot create
  ambiguous connections.
