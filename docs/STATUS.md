# Status

**Current:** Day 13 · Step 2/8 done — Wiring (Phase 1 · Circuit Lab)
**Branch:** `feat/day-13-wiring` (from `develop` after Day 12 merge `39f2d82`)
**Session:** Days 11–15 – Circuit Lab foundations
**Updated:** 2026-11-25

## Day 13 steps
| Step | Task | State |
|---|---|---|
| 1/8 | Day branch; ADR 009 — wires and connectivity | ✅ done (Proposed, owner review) |
| 2/8 | Project format v3 (wires, net labels) + migration; wire / label / group edits + tests | ✅ done |
| 3/8 | Connectivity in core: drawing → `CircuitInput` → netlist; junction dots; "nets computed correctly" tests | ⏳ next |
| 4/8 | Wire tool (W): L-preview, corners, auto-finish on pins / wires, Backspace, Esc; connected pins lose their circle | ⬜ |
| 5/8 | Rubber-band wires when parts move; select / move / delete wires; Inspector shows the net | ⬜ |
| 6/8 | Net labels (L) and copy / cut / paste / duplicate (validated clipboard JSON) | ⬜ |
| 7/8 | e2e + 50 parts with wires performance test; User Manual 8.6–8.8, screenshots, `pnpm manual` | ⬜ |
| 8/8 | Owner review → DEVLOG, squash-merge into `develop` | ⬜ |

## Decisions (Day 13)
- **ADR 009** (`docs/adr/009-wires-and-connectivity.md`, **Proposed**): geometric connectivity like KiCad / Altium /
  LTspice — a wire end connects to a pin end, a wire end or the inside of another wire (T-junction, dot); two pins at
  one point connect; crossing wires do not; labels with the same name join; `GND` / `0` = ground. Wire tool W
  (L-preview, `/` switches posture), labels L, rubber-banding, copy/paste through a validated `robosim-clipboard` JSON.
- **Project format v3:** `wires: [{ id, points }]` (2–64 points, orthogonal, 50-mil grid, no repeats) and
  `labels: [{ id, x, y, name, rotation }]`; ids unique across parts, wires and labels; migration v2 → v3 adds empty
  lists. Limits 4 000 wires, 2 000 labels. `core/schematic/wires.ts`: `simplifyWire` (repeats, straight runs,
  back-tracking), `routeL`, `isOrthogonal`, `onSegment`, `segmentAt`. Edits: `addWire` (cleaned + validated),
  `setWirePoints`, `addLabel`, `renameLabel`, `removeItems` / `moveItems` (parts + wires + labels, one undo step,
  moves in whole 50-mil steps); `addPart` now checks ids across all three. 667 unit, 85 e2e.

## Day 12 steps
| Step | Task | State |
|---|---|---|
| 1/8 | Day branch; evaluate React Flow vs own SVG canvas → ADR 008 | ✅ done (Accepted by owner) |
| 2/8 | Project format v2 (`flip`) + migration; group move / rotate / flip / delete edits + tests | ✅ done |
| 3/8 | Canvas panel: grid, pan/zoom (wheel, middle/Space drag, F fit, zoom %), cursor position, Low-end | ✅ done |
| 4/8 | Own part symbols R / V / I / ground (IEC + ANSI), pins, designator + value labels, auto designators | ✅ done |
| 5/8 | Place parts from a temporary list: ghost preview, grid snap, Esc cancels | ✅ done |
| 6/8 | Selection (click, Shift/Ctrl, box) and editing (drag, arrows, R, X/Y, Delete), undoable; Inspector | ✅ done |
| 7/8 | 50-part performance test, e2e tests, User Manual section + screenshots, `pnpm manual` | ✅ done |
| 8/8 | Owner review → DEVLOG, squash-merge into `develop` | ✅ done (owner approved; PR #16) |

## Decisions (Day 12)
- **ADR 008** (`docs/adr/008-schematic-canvas.md`, **Accepted by the owner 2026-11-24**): our own SVG schematic engine instead of React Flow
  (PLAN names React Flow). React Flow 13.0.3 is MIT but a node graph (no wire-to-wire T-junctions, HTML nodes awkward to
  rotate/flip), pulls `d3-zoom/drag/selection/interpolate` (**ISC** — outside our MIT/Apache/BSD rule) and is a new major
  from 2026-11-16. Conventions: 1 unit = 1 mil, grid 100 mil (2.54 mm) / fine 50; y down; transform = rotate(cw 90° steps)
  ∘ mirror-X; group rotate/flip about the grid-snapped centre; wheel zoom about the cursor, middle / Space drag pan, F fit,
  box select (L→R inside, R→L touching), R, X/Y, Delete, arrows; one undo step per action.
- **Project format v2:** parts have `flip: boolean`; migration v1 → v2 adds `flip: false` (old files and saved
  projects open unchanged). Edits: `setPartFlip`, `moveParts`, `removeParts`, `rotateParts(ids, quarterTurns)`,
  `flipParts(ids, "x" | "y")` — one undo step each, labels "Rotate R1" / "Rotate 3 parts". Group centre is snapped to the
  grid with half-to-even rounding, so flipping twice is an exact undo; four rotations of an odd-sized group can end one
  grid step away (same as other EDA tools), always on the grid. 600 unit tests.
- Step 3 — `core/schematic/viewport.ts`: 1 mil units, 100 % = real size at 96 dpi, zoom 10–3 200 % about the cursor,
  wheel step limited per event, zoom steps, fit (max 400 %), grid level (×5/×2 when dots < 8 px; 16 px in Low-end),
  grid snap, mm/inch formatting. Web `schematic-canvas.tsx`: one `<svg>`, one viewport matrix, memoised parts layer,
  dot grid + major lines as screen-space patterns, origin cross, wheel zoom (Shift+wheel pans), middle / Space + drag
  pan, F / Home fit, + / − keys, floating zoom toolbar (−, %, 100 %, +, fit), header "SCHEMATIC · IEC · n parts".
  Status bar: grid-snapped cursor in mm or inch. Tokens `--schematic-*` in both themes.
- Step 4 — `core/schematic/symbols.ts`: our own artwork as primitives for resistor, DC V source, DC I source, ground in
  IEC 60617 and ANSI/IEEE 315; pins on the 100-mil grid; `placePoint` (mirror → rotate cw → move), SVG transform,
  placed pins / bounds; upright labels, stacked when on one side ("V1" over "9 V"); designator prefixes and lowest free
  number (R1, R2…). Lines have a real 6-mil width, ≥ 1.4 px when zoomed out; labels hidden when too small.
  View → Schematic: IEC / ANSI symbols, units mm / inch (remembered, `lib/schematic-prefs.ts`). Symbol gallery on
  `/ui-kit#schematic-symbols`. 632 unit, 83 e2e (new `schematic.spec.ts`: zoom, fit, pan, style, units).
- Step 5 — `core/schematic/selection.ts`: `PLACEABLE_PARTS` (resistor, DC V, DC I, ground — temporary until the Day 14
  library), `createPart` (lowest free designator, definition defaults stored explicitly), `partBounds`, `hitTest`
  (topmost part, tolerance), box select (`boxModeOf`: L→R inside, R→L touching; `partsInRect`). Canvas: vertical tool
  palette with our own symbol icons; place tool with ghost on the grid, R / Shift+R turns and X / Y mirrors the ghost,
  click places (stays in the tool, like EDA), Esc or right-click ends it. One undo step per part ("Add R2").
- Step 6 — select tool: click, Shift-click (add), Ctrl-click (toggle), click inside a group narrows to that part, box
  select (solid = inside, dashed = touching), drag by whole grid steps (one "Move" step), arrows nudge 100 mil (Shift ×10),
  R / Shift+R rotate, X / Y mirror, Delete, Ctrl+A, Esc; palette buttons Rotate / Mirror / Delete; hover highlight;
  selected parts in brand colour with a soft box. Selection = shared view state (`schematic-selection.ts`, never saved
  or undone). Inspector: Part section (name, type, value typed like "4k7" with plain-word range errors, position,
  orientation) or Selection (count, names). Fixed in the UI kit: toolbar toggle items inside tooltips now show their
  "on" state (`aria-checked`). 645 unit, 89 e2e.
- Step 7 — **50-part performance test** (`e2e/schematic.isolated.spec.ts`, runs alone): place 50 resistors with the
  tool, select all, drag 2 s, pan 2 s — normal and Low-end. First run found real jank (drag 68, pan 67 of 122 frames);
  fixed: (1) the selection is its own SVG layer whose `transform` is set directly during a drag (no React render; one
  `moveParts` edit on release, offset cleared in a layout effect so nothing jumps); (2) panning moves the already-drawn
  picture with a CSS transform (picture drawn with a half-screen margin, redrawn only when the margin runs out or on
  release); (3) the canvas uses a setter-only cursor context and reports the pointer only when its grid position
  changes (the full context re-rendered the canvas on every move). Now: drag 121 / 122, pan 121 / 122 frames, worst gap
  17–33 ms, no long tasks (also in Low-end). User Manual: new chapter 8 *Drawing a schematic* (8.1–8.5, 4 new
  screenshots), chapter 7 updated, *If something goes wrong* → chapter 9; PDF rebuilt. Manual screenshot of the UI-kit
  tooltip now retries the hover (was flaky). 645 unit, 91 e2e.

## Day 11 steps
| Step | Task | State |
|---|---|---|
| 1/7 | Day branch; study old RoboSim (read-only) and scope the model | ✅ done |
| 2/7 | Draft ADR 007 — Circuit model | ✅ done (Accepted by owner) |
| 3/7 | Netlist types + Zod schema in `packages/core/src/circuit/` + tests | ✅ done |
| 4/7 | Component interface (`MnaContext`, `stamp()`, state) + reference R/V/I stamps as fixtures | ✅ done |
| 5/7 | Units: RKM code ("4k7"), quantity-aware `parseQuantity` with range checks + tests | ✅ done |
| 6/7 | Beginner error model: issue codes, messages, netlist graph checks + tests | ✅ done |
| 7/7 | Lint/typecheck/tests; owner review → DEVLOG, squash-merge into `develop` | ✅ done (owner test 5 files / 119 tests; PR #15) |

## Decisions (Day 11)
- Old RoboSim has **no circuit simulator** (no MNA/netlist code) — nothing to port; new design.
- **ADR 007** (`docs/adr/007-circuit-model.md`): circuit document (saved: parts + wires/labels/ground;
  wires added Day 13 with a format bump) → derived **netlist** (`buildNetlist`, union-find, deterministic node
  numbering, ground = node 0); part = **definition** (pins, typed properties) + **device** (`branches`, `stateSize`,
  `stamp`, `stampNonlinear?`, `stampTransient?`, `accept?`, `report`) writing only via `MnaContext`; state in one
  `Float64Array`; SI numbers inside and in files, text only at input/display (RKM "4k7" added); `CircuitIssue`
  with 13 codes, graph checks before solving, results never NaN. PLAN's "ADR-002" name → 007 (002 was taken).
- Owner rule (2026-11-24): design everything to world-class industry standard. ADR 007 §5 adds: reference
  designators (R1, C1, U1…), stable net names, SPICE sign conventions + default tolerances (RELTOL/ABSTOL/VNTOL/GMIN,
  27 °C), gmin/source stepping, SPICE `.model` parameter names, ratings/tolerance/E-series, ERC pin types,
  IEC 60617 + ANSI symbol styles, ISO 80000 unit display. **Accepted by the owner 2026-11-24.**
- Step 3 — `packages/core/src/circuit/netlist.ts`: `buildNetlist(input)` (input = parts with pin ids in definition
  order + connections + labels; Zod-validated); union-find; ground symbols (`type: "ground"`) and labels `GND`/`0`
  → node 0; same label = same net; names = smallest label or `N_<designator>_<pin>` (never clashes with a label);
  numbering independent of drawing order; broken references throw `NetlistError` (document bug, not a learner
  mistake). `parseNetlist` validates netlists crossing a boundary. Limits: 2 000 parts, 256 pins/part, 8 000 nodes.
- Step 4 — `mna.ts`: `MnaContext` (`conductance`, `current`, `voltageSource`, `vccs`, `vcvs`, raw `matrix`/`rhs`;
  ground dropped; non-finite values or unknown nodes throw `MnaStampError`), dense implementation (≤ 1 024 unknowns,
  tests/small circuits), `createSolution`. `component.ts`: definition (pins with ERC types, typed number/choice/boolean
  properties, designator prefix, branches, stateSize) + device (`stamp`, optional non-linear/transient/accept hooks,
  `report` readouts); `resolveProps` (defaults, per-property problems), `createDevice`, `checkDefinition`.
  `reference-parts.ts`: resistor, DC voltage source, DC current source. End-to-end test: 9 V divider 1 k/2 k →
  6 V, 3 mA, battery −27 mW (SPICE sign). 500 unit tests.
- Step 5 — `units.ts`: `parseRKM` (IEC 60062: "4k7", "1M5", "4n7", "R47"; R only for Ω, F only for F) and `parseSI`
  falls back to it ("4k7" otherwise reads as 4 with unit "k7"). `circuit/quantities.ts`: unit spellings per quantity
  (Ω/Ω-sign/ohm/R, µ/u, Hz/hz, °C/C, %), `parseQuantity(text, quantity, range)` → value or plain-word message
  ("Resistance must be more than 0 Ω.", "\"abc\" is not a resistance. Try 4.7k, 4k7 or 220 Ω."), wrong units refused
  ("4.7 kF" for a resistor); `formatQuantity` (ISO 80000: "4.7 kΩ", "5 %", "27 °C"); round-trip tested.
- Step 6 — `circuit/issues.ts`: `checkCircuit(netlist, lookup)` → `CircuitIssue` (code, severity, message, hint, parts,
  pins, nets), errors first, deterministic, ≤ 100. Checks: empty circuit, no ground, open pin ("Pin 2 of R2 is not
  connected to anything." / "The Positive (+) pin of V1 …"), floating group (DC paths, incl. capacitor-only nodes),
  shorted / parallel / looped voltage sources, current source with nowhere to send its current, invalid values,
  duplicate designators, unknown part types. Messages for solver issues (singular, no convergence, over-limit,
  model error) ready. Definitions gained `dcPaths` / `voltagePairs` (noted in ADR 007 §4). 583 unit tests.

## Day 10 steps
| Step | Task | State |
|---|---|---|
| 1/8 | Day branch; capability detection in core (memory, cores, WebGL2, software graphics) + tests | ✅ done |
| 2/8 | Improved Low-end mode (performance profile, auto notice + reasons) + Help → System information | ✅ done |
| 3/8 | Global error boundary (studio + app), friendly error screen | ✅ done |
| 4/8 | Landing page v0 | ✅ done |
| 5/8 | Lighthouse check (≥ 90) and fixes | ✅ done (studio performance 85–88 accepted by owner) |
| 6/8 | e2e tests; User Manual; `pnpm manual` | ✅ done |
| 7/8 | Owner review → DEVLOG, merge into `develop` | ✅ done (PR #11) |
| 8/8 | Release v0.0.1 to `main` (owner's OK), Vercel check, phase review; next-session instructions | ✅ done |

## Decisions (Day 10)
- `packages/core/src/capabilities.ts`: `assessCapabilities(hints)` → memory, cores, WebGL2, renderer (≤ 200 chars),
  software graphics (SwiftShader / llvmpipe / softpipe / Microsoft Basic Render …), Low-end reasons (memory ≤ 4 GB,
  ≤ 2 cores, no WebGL2, software graphics); unknown hints never count as weak. `performanceProfile(lowEnd)`: animations,
  readout 100 / 250 ms, worker snapshots 33 / 66 ms, max pixel ratio 2 / 1, antialias, shadows — one switch for every
  heavy feature. `detectLowEnd` / `resolveLowEnd` in status.ts now use it. 30 tests.
- Web: `lib/device-capabilities.ts` probes once (WebGL2 context, renderer name, then `loseContext`); hints stay on the
  computer. Low-end auto-on posts once *why* ("graphics drawn without a graphics card") and shows "· auto" + reasons in
  the status-bar button; switching it is remembered as the user's choice. Simulation follows the profile (readout rate,
  new host `setSnapshotInterval` 16–1000 ms, tested). **Help → System information** window (memory, cores, WebGL2,
  graphics, drawn by GPU/CPU, recommendation, Low-end on/off + source, toggle). On the owner's laptop: 8 GB+, 8 cores,
  Intel UHD 620, GPU → no Low-end.
- Test browsers render WebGL in software → they auto-enable Low-end. e2e and manual screenshots now start from
  `e2e/fixtures/low-end-off.json` (normal computer); `system-info.spec.ts` clears it to test the automatic path.
  456 unit, 72 e2e.
- Masked graphics names (Brave "Brave", Safari "Apple GPU", "WebKit WebGL"…): `isMaskedRenderer`; System information
  says "Hidden by the browser (privacy protection)" and "Drawn by: Unknown" instead of showing the browser name.
  (Owner's test in Brave showed "Graphics: Brave", "7 cores" — Brave changes both for privacy.)
- Error screens: shared `components/error-screen.tsx` (no stack traces, only the Next.js error code); `app/error.tsx`
  (any page: Try again / Home / Report a problem), `app/global-error.tsx` (own html/body, full reload), `app/not-found.tsx`
  (404 with links), `app/studio/error.tsx` ("Your projects are safe", Reload the studio), and a **per-panel**
  `PanelErrorBoundary` (one broken panel shows "Try again", the rest keeps working). Dev-only `?crash=studio|inspector`
  switch (`useDevCrash`, compiled out of production) for the e2e tests, which skip in CI's production build.
  Links moved to `lib/links.ts`.
- Landing page v0 (`app/page.tsx`): header (logo, GitHub, Open the studio, theme), hero with a **real chart of the demo
  simulation computed at build time** (`kernel-preview.tsx`, no client JS), "Ready today" (6 built features), the 10 labs
  with one-line descriptions marked "Phase N · planned", principles (MIT, private by default, ordinary laptops), CTA,
  footer (version, MIT licence, source, UI kit). Static page. 464 unit, 76 e2e; production build OK.
- **Lighthouse 13.6.0** (run once via `npx`, not added to the repo; production build on port 3101, desktop preset):
  home **100 / 100 / 100 / 100** (Performance / Accessibility / Best Practices / SEO; mobile Performance 87–88 — phones
  are not a target); studio **85–88 / 100 / 100 / 100** (was 89 / 82 / 96 / 100). Fixes: faint text colour token
  raised to ≥ 4.5:1 contrast in both themes; project tabs — tablist holds only tabs (× hidden from assistive tech,
  **Delete** closes the focused tab, 24 px target); Console `role=log` on a wrapper (list semantics); sr-only Inspector
  h2 (heading order); **Zod `jitless`** (its `new Function` probe was a CSP violation); WebGL probe moved to idle
  time; status messages in their own context (no full-studio re-render per message); memoised workspace. Tried a
  lazy "studio loader" (dynamic import + transition): A/B showed it **worse** (74–77) → removed.
  Remaining studio TBT ≈ 260–320 ms = React + Dockview building the studio at start-up → open issue.
- Step 6: User Manual — chapter 3 rewritten for the new home page; 7.3 Delete closes a tab; 7.7 automatic Low-end mode
  + System information (screenshot); shortcut table; new chapter 8 "If something goes wrong" (screenshot); PDF rebuilt.
  464 unit, 77 e2e.
- **Release v0.0.1 (owner's OK, 2026-11-24):** `release/v0.0.1` (version 0.0.1 everywhere, CHANGELOG.md, manual, ignore
  `apps/web/AGENTS.md`) → squash into `develop` (PR #12) → **merge commit** `develop` → `main` (PR #13, `d799331`) → tag
  + GitHub release `v0.0.1`. Owner changed GitHub settings: `protect-main` allows Merge (linear history off) and the
  repo allows merge commits. Live check on robosim-studio-lemon.vercel.app: v0.0.1, /studio, 404, headers, simulation
  worker 1002 steps/s, no console errors.
- **Security catch:** CodeQL alert #2 (high, js/incomplete-multi-character-sanitization in `scripts/build-manual.mjs`)
  had been open on `develop` since Day 04 — fixed in PR #12 (heading ids via marked's TextRenderer, HTML-escaped).
  Open alerts now 0. New rule: check open CodeQL alerts before every merge/release.
- Phase review: `docs/reviews/phase-0-review.md`.
- Day 09 merged into `develop` as `8dec085` (PR #10).

## Next action
**Day 13 · Steps 3–4** (after the owner reviews ADR 009): connectivity in core (drawing → netlist, junction dots,
"nets computed correctly" tests); wire tool on the canvas.
Release flow from now on: Day branches squash into `develop`; releases = PR `develop` → `main` with a merge commit + tag.

## Open issues
- **Studio start-up performance (owner: accepted 85–88 for v0.0.1, 2026-11-24 — "optimize in future when needed").**
  Lighthouse desktop Performance 85–88 (target 90): start-up TBT ~300 ms from React + Dockview building the workspace
  in one go. Home page is 100. **Must be revisited:** re-run Lighthouse whenever a lab adds panels (first in Phase 1)
  and optimize (profile, split the first render) as soon as it drops further or blocks a release; at the latest Day 173.
- `apps/web/AGENTS.md` is generated by `next dev` (Next.js agent notes) and left uncommitted — owner to decide:
  commit it or add it to `.gitignore`.
- CSP still allows `script-src 'unsafe-inline'` (Next.js inline bootstrap on static pages). Move to
  nonce/hash-based CSP on Day 173 (security hardening) — or earlier if Next.js static hashing lands.
- The old RoboSim (robosim-bd.vercel.app) runs Next.js 16.2.6 with the same critical advisories. It is
  read-only for us; the owner decides whether to upgrade it.
- Math findings F1–F13 in `docs/MIGRATION.md` are fixed during porting (Days 113–115), not in the old RoboSim.
- Old RoboSim stays unchanged, including its premium flow (owner decision 2026-11-20). Its issues are
  listed in the local `E:\My Projects\robosim\IMPROVEMENTS.md`.
- PRD open questions Q1–Q7 (§11), each with its decision Day.
- `docs/PLAN.md` is generated from the owner's private plan source — never edit it by hand.
- Dev note: Turbopack can miss CSS edits in `packages/ui`; restart `pnpm dev` after editing them.
