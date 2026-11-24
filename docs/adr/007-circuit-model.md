# ADR 007 — Circuit model: netlist, component interface (MNA stamps), units, beginner errors

- **Status:** Accepted (owner, 2026-11-24)
- **Date:** 2026-11-24 (Day 11)
- **Note:** `docs/PLAN.md` calls this "ADR-002"; 002 was already taken (design language), so it is 007.

## Context
Phase 1 builds the Circuit Lab (Days 11–32): schematic canvas (12), wiring (13), parts library (14),
DC solver (15), robustness and friendly errors (16), non-linear parts (17), transient analysis (18),
instruments (19–20), interactive parts (21), semiconductors (22), output and power parts (23–24),
breadboard view and view sync (25–26), ngspice cross-check (28) and exports (29).
All of these depend on one shared model. It must:
- work the same in the schematic **and** the breadboard view (one netlist, Day 26);
- run in the simulation worker (ADR 006): pure TypeScript in `@robosim/core`, no DOM, deterministic;
- let a new part be added in **one file** (Day 14), including its physics;
- give results within 0.1 % of hand calculation and **never** show NaN to a learner (PRD §5.1);
- explain beginner mistakes in plain words ("Pin 2 of R1 is not connected").

The old RoboSim has no circuit simulator, so nothing is ported; this is a new design.

## Decisions

### 1. Two layers: circuit document → netlist
- **Circuit document** (saved in the project): parts with position/rotation/properties (the
  existing `Part` of ADR 004) plus **connections**: wires (pin ↔ pin, with route points), net labels
  and ground symbols. It describes what the learner drew. Wires and labels are added to the project
  format on Day 13 with a format-version bump and a migration (ADR 004 rules).
- **Netlist** (derived, never saved): the electrical meaning only — components, their pins and which
  **net** each pin belongs to. It is built by a pure function `buildNetlist(document, registry)`
  (union-find over wires, labels with the same name, and breadboard strips later). Schematic and
  breadboard both produce connections; the netlist is the single source the solver sees.
- **Pin reference:** `{ part: "<part id>", pin: "<pin id>" }`. Pin ids come from the part
  definition (`"1"`, `"2"`, `"anode"`, `"cathode"`, `"+"`, `"-"`), never from screen positions.
- **Ground:** the ground symbol (part type `ground`) joins its net to **node 0**. All ground
  symbols are the same node. Named nets (`VCC`, `5V`) connect everywhere they appear.
- **Deterministic numbering:** node 0 = ground; other nodes are numbered in order of the smallest
  pin reference (part id, then pin id) they contain. Same drawing → same matrix → same results and
  golden tests that do not depend on drawing order.
- **Validated at the boundary:** the netlist has a Zod schema (ids, counts, finite values) with
  limits: ≤ 2 000 parts (as projects), ≤ 8 000 nodes, ≤ 2 000 extra branch unknowns. Anything coming
  from a file or a share link is checked before a solver sees it.

### 2. Component interface: definition + device with MNA stamps
Circuits are solved with **Modified Nodal Analysis** (MNA), the method SPICE uses: unknowns are node
voltages plus one current per voltage source / inductor ("branch"). Each part adds its share to the
matrix — its **stamp**. Alternatives: ngspice for everything (several MB of WebAssembly, batch-style,
not step-by-step real time — kept as a cross-check on Day 28); hand-written per-circuit formulas
(cannot scale). A part has two halves:

- **Definition** (static data, used by the UI and the solver): `type`, display name, category, pins
  (id, name, ERC electrical type — §5), reference-designator prefix, properties (key, label, **quantity/unit**, default, min, max), and
  later the SVG symbol and breadboard footprint (Day 14). Validated by a Zod schema.
- **Device** (created per part instance by `definition.create(props)`; pure, no I/O):
  - `branches`: how many extra current unknowns it needs (V source = 1, inductor = 1, resistor = 0);
  - `stateSize`: how many numbers of history it keeps (capacitor voltage, inductor current…);
  - `stamp(ctx)` — the linear, time-independent part (resistor, sources);
  - `stampNonlinear?(ctx, x)` — re-stamped each Newton–Raphson iteration from the present guess `x`
    (diode, LED, BJT, MOSFET; Day 17) — the device also gets a hook to limit voltage steps;
  - `stampTransient?(ctx, state, dt, method)` — companion model for one time step
    (`"be"` backward Euler or `"trap"` trapezoidal; Day 18);
  - `accept?(x, state)` — called once a step is accepted, updates its state slots;
  - `report(x)` → readouts (pin voltages, current, power) and **warnings** (LED over-current,
    resistor power above rating) for instruments and the inspector.
  AC analysis (`stampAC`, complex values) is left for Day 28 and may stay ngspice-only.
- **Stamp context** (`MnaContext`), the only way a device touches the matrix:
  `conductance(a, b, g)`, `current(a, b, i)` (from a to b through the part), `voltageSource(branch,
  a, b, v)`, `vccs`/`vcvs` helpers for controlled sources, plus raw `matrix(row, col, value)` and
  `rhs(row, value)` for unusual parts. Node 0 (ground) is dropped automatically, so stamps never
  special-case ground. Every value must be finite; a non-finite stamp is a bug and becomes the
  internal error `model-error`, never NaN in the results.
- **State lives outside the device:** one `Float64Array` per circuit; each device gets its slice.
  Copying the array is a full snapshot → cheap rollback for the adaptive time step (Day 18) and easy
  transfer between worker and UI. Devices hold no hidden mutable state.
- The circuit as a whole becomes one **`SimModel`** (ADR 006): `step()` runs one transient step;
  interactive parts and microcontroller pins read/write the Signal Bus (Days 21, P2).

### 3. Units and SI prefixes
- **Inside the solver everything is plain SI base units:** V, A, Ω, S, F, H, s, Hz, W. No prefixes,
  no unit objects in hot loops.
- **Saved as numbers in SI units** (`resistance: 4700`), never as text, so files are unambiguous.
- **Typed by people as text:** every property declares a quantity (resistance, capacitance,
  inductance, voltage, current, frequency, time, power, ratio) with its unit symbol and accepted
  spellings ("Ω", "ohm", "R"; "F"; "Hz"). The existing `parseSI` / `formatSI` (`units.ts`) do the
  work; it gains the **RKM code** printed on parts ("4k7" = 4.7 kΩ, "2R2" = 2.2 Ω, "4n7" = 4.7 nF)
  and a quantity-aware `parseQuantity(text, quantity)` that also checks the property's min/max
  ("Resistance must be more than 0 Ω"). Shown values use `formatSI` with the unit (e.g. "4.7 kΩ").
- Prefix case matters (m = milli, M = mega); "meg" is accepted as in SPICE. Unknown or wrong units
  ("4.7kF" for a resistor) are refused with a message, never guessed.

### 4. Error model for beginners
- Results are a union: `{ ok: true, solution, issues }` or `{ ok: false, issues }`. The UI shows
  issues; it never receives NaN or Infinity.
- **`CircuitIssue`**: `code` (stable id), `severity` (`error` blocks solving, `warning` solves but
  flags, `info`), `message` (plain words, names parts by their visible name: "Pin 2 of R1 is not
  connected to anything."), optional `hint` ("Draw a wire from it, or delete the part."), and the
  `parts`, `pins` and `nets` involved so the canvas can highlight them.
- Messages are built in one place in core from the code + details (one table, ready for
  translation later). Codes for Phase 1:

  | Code | Severity | When | Found by |
  |---|---|---|---|
  | `empty-circuit` | info | nothing to simulate | netlist check |
  | `no-ground` | error | parts but no ground symbol | netlist check |
  | `unconnected-pin` | warning | a pin is on a net with nothing else | netlist check |
  | `floating-node` | error | a group of nodes has no DC path to ground | netlist check (graph) |
  | `voltage-source-loop` | error | loop of only voltage sources / wires (incl. a shorted source) | netlist check (graph) |
  | `current-source-cutset` | error | current source with no other path (would force ∞ V) | netlist check (graph) |
  | `invalid-value` | error | a property is missing, not a number or out of range | definition check |
  | `singular-matrix` | error | matrix cannot be solved (fallback) | solver |
  | `no-convergence` | error | Newton–Raphson did not converge | solver (Day 17) |
  | `over-limit` | warning | part beyond its rating (LED current, resistor power) | device `report` |
  | `model-error` | error | internal bug (non-finite stamp) — "please report" | solver |
  | `duplicate-designator` | warning | two parts share a reference designator (e.g. two "R1") | netlist check |
  | `erc-conflict` | warning | pin types clash (two outputs on one net, unpowered power-in) — Phase 2 | ERC |

- **Check before solving:** the cheap graph checks run on the netlist first, so the common beginner
  mistakes get a precise message (which part, which pin) instead of the generic `singular-matrix`.
  The checks are deterministic and unit-tested per code. A fully ideal short (wire across a battery)
  is a `voltage-source-loop`; a near-short through a tiny resistor solves and is flagged by
  `over-limit`.

### 5. Industry conventions (so results and files feel like professional EDA / SPICE tools)
- **Reference designators** are assigned automatically by part kind, as on real schematics and BOMs
  (IEEE 315 / IEC 81346 style): R resistor, C capacitor, L inductor, D diode/LED, Q transistor,
  U IC/op-amp/regulator, V voltage source, I current source, SW switch, J connector, M motor,
  BZ buzzer, K relay, F fuse, BT battery. Next free number per prefix (R1, R2…); renaming is
  allowed, duplicates are an issue. The same designators go into SPICE netlists and the BOM (Day 29).
- **Net names:** a net takes its label (`VCC`, `SDA`) or, unlabelled, an automatic name from its
  lowest pin (`N_R1_2`), stable across edits — like EDA tools — so probes and scope traces keep
  their names. `0`/`GND` is reserved for ground (SPICE node 0).
- **Sign conventions as in SPICE:** passive sign convention (current into the "+"/first pin is
  positive, power > 0 = absorbed); a voltage source's branch current flows from + through the source
  to −, so a battery delivering power reads negative current in raw results — the UI shows
  "delivering 12 mW" instead of a confusing minus sign.
- **Solver tolerances with SPICE defaults:** RELTOL 1e-3, ABSTOL 1 pA, VNTOL 1 µV, GMIN 1e-12 S,
  nominal temperature 27 °C (TNOM). Convergence aids **gmin stepping** and **source stepping**
  (Days 16–17). Advanced users can change them in simulation settings; beginners never see them.
- **Model parameters named like SPICE `.model` cards** (diode IS, N, RS, BV; BJT BF, IS, VAF; MOSFET
  VTO, KP, LAMBDA), so the ngspice cross-check (Day 28), SPICE export (Day 29) and datasheet values
  map 1:1. A part may carry a vendor SPICE model later.
- **Real-part properties:** resistors have tolerance and power rating, capacitors a voltage rating,
  LEDs colour/forward voltage/max current; value entry offers the **E-series** (E12/E24/E96) like a
  parts catalogue. Ratings feed `over-limit` warnings ("R2 dissipates 0.6 W, rated 0.25 W").
- **Electrical rules check (ERC)** as in KiCad/Altium: every pin has an electrical type (passive,
  input, output, bidirectional, power-in, power-out, open-collector, not-connected). Beyond the
  analog checks above, ERC flags "two outputs driving one net" and "power-in pin not powered" —
  needed once microcontrollers and logic arrive (Phase 2). Pins marked not-connected never warn.
- **Symbols:** both **IEC 60617** (zig-zag-free box resistor) and **ANSI/IEEE 315** (zig-zag) styles,
  chosen in settings, drawn as our own artwork (Day 14).
- **Units displayed per ISO 80000 / SI brochure:** a space between number and unit ("4.7 kΩ"),
  "µ" (not "u") on screen, unit symbols never pluralised; input accepts the common shortcuts.

## Consequences
- One file per part = definition + device; the registry, inspector, solver and exports all read it.
- Solver code (Day 15+) only builds the matrix via `MnaContext` and solves it; it has no part-specific
  code, so new parts never touch the solver.
- Plain-number SI inside the solver keeps it fast and comparable with SPICE; units exist only at the
  edges (input, display, files).
- Deterministic node numbering and pure devices make golden tests and the "20 DC circuits within
  0.1 %" target (Day 15) straightforward.
- Ideal components (0 Ω wire, ideal sources) are kept; the graph checks are what protects
  learners from the singular cases they create.
- Today (Day 11) only adds types, schemas, units, the issue model and checks in core with tests —
  no UI and no solver yet.
