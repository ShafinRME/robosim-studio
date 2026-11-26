# Devlog

One short entry per finished Day: what was built, what was learned, what's next.

<!-- Newest entries on top. Template:
## Day NN — <topic> (YYYY-MM-DD)
- Built:
- Learned:
- Next:
-->

## Day 14 — Parts library & inspector (2026-11-26)
- Built: ADR 010 (accepted) — one TypeScript file per part (`packages/core/src/parts/library/`): catalogue entry,
  IEC / ANSI symbol (with artwork per state) and electrical model in one `definePart`, checked by `checkPart`;
  generated index (`pnpm parts`) guarded by a test; registry (`PARTS`, `partFor`, `componentFor`, `symbolFor`…).
  The four existing parts moved unchanged (projects open as before); two new parts prove "1 file": SPST switch and
  potentiometer, with solver tests. Search over names, keywords, categories and typed values ("10k", "4k7", "220R",
  "9V", "2mA" → part with that value). Studio: Parts panel beside Explorer (groups, symbol previews, keyboard,
  recently used, Alt+5), click / Enter / drag-and-drop placing with a live ghost (drop data validated), Add part (A)
  replaces the four temporary buttons; Inspector rows generated from the part's properties (numbers with ranges,
  choices, on/off), several parts of one type edited at once (one undo step); the switch is drawn closed when
  closed. User Manual 8.2 and 8.4 rewritten. 737 unit, 110 e2e.
- Learned: making "1 file" true needed a generated index plus a test, because bundler globbing is not available
  everywhere core runs. Browsers hide drag data until the drop, so the canvas preview needs a side channel while
  the drop itself is still validated as untrusted. Owner review caught two things tests could not: a narrow
  screenshot stretched to page width came out black in the PDF, and the search hint was cut off. CodeQL caught an
  ambiguous regex (`/ohm|r$/`) in the value search.
- Next: Day 15 — DC solver (MNA with LU in a Web Worker for R, V, I and the new switch / potentiometer; 20 textbook
  circuits within 0.1 %). Last Day of this session block.

## Day 13 — Wiring (2026-11-26)
- Built: ADR 009 (accepted) — geometric connectivity like KiCad / Altium / LTspice: a wire END connects to a pin,
  a wire end or the inside of a wire (T-junction, dot); pin-on-pin connects; crossings and a wire merely passing over
  a pin do not; same-name labels join; GND = ground. Project format v3 (`wires`, `labels`, migration). In core:
  wire geometry (`simplifyWire`, `routeL`), `connectivityOf` (union-find, row / column segment index, junction
  dots, connected pins, wire groups → net names; 500 parts + 1 000 wires well under 1 s), rubber-banding inside the
  move / rotate / mirror edits, wire / label hit-testing and box selection, validated `robosim-clipboard`
  (size-limited, strict schemas, new ids, free designators), `addItems`, `rotateLabels`. In the studio: wire tool W
  (L-preview, `/`, corners, ends by itself on pins / wires, Backspace, Enter, Esc), connected pins lose their circle,
  live rubber-band preview while dragging, selectable / movable / deletable wires and labels, Inspector wire net with
  its pins, net label tool L (inline name box, D0 → D1), Ctrl+C / X / V / D through browser copy / paste events (no
  clipboard permission). User Manual 8.6–8.8. 706 unit, 100 e2e (new: 50 parts + 45 wires drag test).
- Learned: e2e caught that Backspace must undo a *click*, not the last stored corner (corners merge when simplified),
  so the tool keeps its own click history. Rubber-banding is simplest as part of the edit itself (one undo step), and
  the drag preview can just run that same edit on a copy once per grid step — no second algorithm. Using the
  browser's copy / paste events instead of the Clipboard API avoids a permission prompt and keeps clipboard reads
  tied to a real user action. Looking at the screenshots moved the name box off the drawing.
- Next: Day 14 — parts library & inspector (component registry: symbol + model + properties; searchable parts
  drawer replacing the temporary palette list; property inspector; adding a part = 1 file).

## Day 12 — Schematic canvas (2026-11-25)
- Built: ADR 008 (accepted) — our own SVG schematic engine instead of React Flow (node-graph model, ISC-licensed d3
  dependencies, brand-new major). Project format v2 (`flip`, migration) and group edits (move / rotate / flip / delete,
  one undo step). In core: viewport maths (mils, 100-mil grid, zoom about the cursor, fit, grid levels), our own
  IEC 60617 and ANSI symbols for R, DC V, DC I and ground with upright, stacked labels, designators (R1, R2…),
  hit-testing, box selection, part factory. In the studio: schematic canvas with dot grid, wheel / middle / Space
  pan, F fit, zoom bar; place tool with ghost (R / X / Y while placing); click, Shift/Ctrl and box select (inside /
  touching), drag by grid steps, arrows, R, X/Y, Delete, Ctrl+A; Inspector part section (value typed like "4k7");
  View → Schematic (IEC / ANSI, mm / inch); symbol gallery in the UI kit. User Manual chapter 8. 645 unit, 91 e2e.
- Learned: a measured "done when" pays off again — the 50-part test showed 68 / 122 frames while dragging and 67 while
  panning; fixed with editor techniques (move a selection layer directly, pan the already-drawn picture with a CSS
  transform and a margin, never re-render the canvas for the status-bar cursor) → 121 / 122 in both, also in Low-end.
  Visual checks in the browser caught what tests did not: labels sharing one line on a rotated source, a selection
  that would not narrow on click, and a tooltip hiding the toolbar's "on" state. React Flow looked like a shortcut
  but would have fought T-junctions, rotation and the breadboard view.
- Next: Day 13 — wiring (orthogonal wires, junction dots, net labels, copy/paste, rubber-band dragging; nets computed
  correctly in tests).

## Day 11 — Circuit model (2026-11-24)
- Built: ADR 007 (accepted) — circuit document → derived netlist; part = definition (pins with ERC types, typed
  properties, designator prefix) + device writing MNA stamps only through `MnaContext`; SI numbers inside, text only
  at input/display; beginner error model; industry conventions (designators, SPICE signs and tolerances, `.model`
  names, E-series, ERC, IEC/ANSI symbols, ISO 80000 display). In `packages/core/src/circuit`: `buildNetlist`
  (union-find, ground = node 0, labels, numbering independent of drawing order), dense `MnaContext`, component
  contract with reference resistor / V / I sources (9 V divider exact, SPICE signs), `parseQuantity` with RKM codes
  ("4k7", "2R2", "4n7") and plain-word range messages, `checkCircuit` (no ground, open pins, floating groups,
  shorted / parallel / looped sources, current-source cutsets, invalid values, duplicate designators). No UI yet.
  583 unit tests (+119).
- Learned: the old RoboSim had no circuit simulator, so the model is new; "4k7" also matches "4 with unit k7", so RKM
  must be tried whenever plain parsing fails; graph checks need two facts per part (`dcPaths`, `voltagePairs`) —
  "all pins joined" is the safe default so a new part never raises a false alarm; a test-only Gaussian solve is
  enough to pin down stamp signs before the real solver exists.
- Next: Day 12 — schematic canvas (React Flow: grid, pan/zoom, place / rotate / flip / delete, multi-select; 50
  parts smoothly).

## Day 10 — Low-end mode & landing page (2026-11-24)
- Built: capability detection in core (memory, cores, WebGL2, software / privacy-hidden graphics) and one
  `performanceProfile` for Low-end mode; Low-end switches itself on with a stated reason; Help → System information.
  Error screens for any page, the studio (projects are safe), each panel (one broken panel stays inside its panel)
  and 404. Landing page v0 with a chart computed by the real kernel at build time. Lighthouse: home 100 / 100 / 100 /
  100; studio 85–88 / 100 / 100 / 100 (owner accepted; performance follow-up in STATUS). User Manual chapters 3, 7.7, 8.
  464 unit tests, 77 e2e.
- Learned: test browsers draw WebGL in software, so they rightly get Low-end mode — tests now start from a stored
  "off"; Brave hides the GPU name and changes the core count — show "hidden by the browser" instead of guessing;
  Lighthouse caught a CSP violation from Zod's `new Function` probe (`jitless`), dim "faint" text and a tablist with
  close buttons inside; measure performance changes A/B on a quiet machine — a "lazy loader" looked clever and made
  the studio slower (74–77 vs 85–88); one shared React context for messages re-rendered the whole studio per message.
- Next: release v0.0.1 to `main` (owner's OK), phase review; then the next session (Days 11–15).

## Day 09 — Simulation kernel (2026-11-24)
- Built: ADR 006. In `@robosim/core`: fixed-step scheduler (1 ms steps, integer step count, real-time factor
  0.1–10×, per-frame step budget with a "behind" signal instead of freezing), typed double-buffered **Signal Bus**
  (model order never changes results), `createSimulation` (models + bus + scheduler) and a spring/driver demo.
  In the web app: Web Worker host with **Comlink 4.4.2** (snapshots at ~30/s, every argument checked, models only
  by id), studio Run/Pause, Step, Stop, speed, status-bar time and steps/s, live values on the canvas, shortcuts.
  User Manual §7.6. 436 unit tests, 70 e2e.
- Learned: the "done when" check works — 1005 steps/s with 121 of 122 frames kept on the main thread; but timing
  tests are meaningless with 4 parallel browsers on one CPU (17 frames), so they run in their own Playwright
  project, alone and after the rest, against an idle baseline; send display-rate snapshots, never per-step
  messages; keep fast-changing state out of React's main tree (external store). Repeating the jank test found
  real jank (41–88 of 122 frames): 30 text updates per second in the status bar made the browser lay out the
  whole page — fixed with CSS containment and 10 Hz text readouts (state changes still instant): now 120–121.
  Also fixed: "New project" clicked while saved projects were still opening was lost (now waits).
- Next: Day 10 — Low-end mode & v0.0.1 (capability detection, error boundary, landing page, Vercel deploy,
  phase review); last Day of this session block.

## Day 08 — Persistence & sharing (2026-11-23)
- Built: ADR 005; **Dexie 4.4.7**, **fflate 0.8.3**, fake-indexeddb (dev) — audit 0. Browser project database
  (validated reads, recent list, open tabs); autosave 1 s after an edit, same tabs back after a reload;
  `.rsim` files (zip: manifest + project) with File → Export / Import; share links with the project packed in
  the URL fragment; Recent projects window (open, delete with confirm, Alt+O). Imports and shared links always
  open as a copy with a new id. User Manual §7.5. 345 unit tests, 66 e2e.
- Learned: an IndexedDB write started while the page closes never finishes — unsaved edits are also written
  synchronously to localStorage on `pagehide` and put back on load; never trust sizes written inside a zip —
  count the real inflated bytes (tested with 30 MB and 5 MB bombs); fflate < 0.8.3 could loop forever on a crafted
  ZIP64; lists built from the database must save pending edits first; a modal dialog hides the page from
  assistive tech (and from role-based tests).
- Next: Day 09 — Simulation kernel (fixed-step scheduler, Web Worker host, signal bus).

## Day 07 — Project model & undo/redo (2026-11-23)
- Built: ADR 004; **Zod 4.6.7**, **Zustand 5.1.0**, **Immer 11.2.10** in `@robosim/core` (MIT, audit 0). Versioned
  project format v1 with a strict schema (size, count, range and key limits) and a migration runner that refuses
  newer versions. Patch-based undo/redo (`history.ts`, 200 steps, no snapshots) and a vanilla Zustand project store
  with validated, named edits. Acceptance test: 100 random edits undo back to the initial project (5 seeds). Studio:
  one store per project tab, project name in the Inspector, Edit → Undo/Redo, Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z.
  User Manual §7.4. 281 unit tests, 56 e2e.
- Learned: Zod 4 silently drops `__proto__` keys from records (safe, now tested); random-edit tests must count
  recorded edits, not attempts (no-op edits are not history); in a text box Ctrl+Z belongs to the text box;
  `next dev` writes an `apps/web/AGENTS.md` file (left uncommitted).
- Next: Day 08 — saving and opening projects.

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
