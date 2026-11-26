# ADR 010 — Part registry: one file per part

- **Status:** Accepted (owner, 2026-11-26)
- **Date:** 2026-11-26 (Day 14)

## Context
Day 14's "done when" is **adding a new part = 1 file**. Today one part is spread over three places:

| Where | What |
|---|---|
| `circuit/reference-parts.ts` | electrical model: pins with ERC types, properties, MNA device (ADR 007) |
| `schematic/symbols.ts` | IEC / ANSI artwork, pin positions, label places, designator prefixes (ADR 008) |
| `schematic/selection.ts` | `PLACEABLE_PARTS`, the temporary list behind the four palette buttons |

Ground is special everywhere (no device; `buildNetlist` treats its pin as node 0). The library will
grow to hundreds of parts (Arduino boards, sensors, motors, ICs), and the parts drawer, search,
Inspector, ERC, netlist, simulator, breadboard view (Day 25) and exports must all see the same part.
Professional tools keep one library entry per part (KiCad symbol + footprint + SPICE model fields,
Altium integrated libraries, LTspice `.asy` + model): one place to review, test and version.

## Options
- **A. Keep three lists, cross-check them in tests.** Least work; still 3 edits per part and easy to
  forget one.
- **B. One TypeScript file per part, collected by a generated index (proposed).** Type-checked, can
  hold code (the MNA device), tree-shakeable, reviewable as one diff.
- **C. One JSON/YAML file per part + generic device "templates".** Good for user-made parts later,
  but every new electrical behaviour still needs code; JSON can't type-check artwork or models.

## Decision: B — `packages/core/src/parts/library/<part>.ts`

### The part file
Each file default-exports `definePart({...})` with everything about one part:

| Field | Meaning |
|---|---|
| `type` | Stable id stored in projects (`resistor`, `source.dc-voltage`) — never changes once released |
| `name`, `description` | Shown in the parts drawer and tooltips (plain words for beginners) |
| `category` | One of ADR 007's categories (passive, source, …) — groups in the drawer |
| `keywords` | Extra search words (`res`, `ohm`, `pot`, `battery`) |
| `designatorPrefix` | R, V, I, SW, RV, GND… |
| `symbol` | IEC + ANSI artwork, pins (on the 100-mil grid), label places, value property (ADR 008) |
| `model` | Electrical model: pins with ERC types, properties (units, ranges, defaults), branches, state, DC paths, `create()` → MNA device (ADR 007). Omitted for parts with a fixed netlist role |
| `role` | `"ground"` for ground symbols (their pin is node 0); none for normal parts |

`definePart` only joins the pieces; **`checkPart`** (unit-tested over every part) finds mistakes:
everything `checkDefinition` checks (ADR 007), plus symbol pins = model pins (same ids), pins on
the 100-mil grid and inside the bounds, the value label naming a number property of the same
quantity, a valid prefix, lowercase keywords, unique types across the library.

### Collecting the files
`parts/library/index.ts` is **generated** by `pnpm parts` (a small Node script that lists the
folder, sorted, no other input). A unit test fails with "run pnpm parts" when a file in the folder is
missing from the index, so a forgotten step is caught in CI. A generated barrel works in Vitest,
Turbopack and Web Workers alike; bundler-only globbing (`import.meta.glob`, `require.context`) does
not work everywhere we run core.

### The registry (`parts/registry.ts`)
`PARTS` (checked once at load), `partFor(type)`, `componentFor(type)` (the ADR 007
`DefinitionLookup`), and the existing entry points rebuilt on it: `symbolFor`, `SYMBOLS`,
`designatorPrefix`, `createPart`, the catalogue for the drawer. The search (Step 4) is a pure
function over `PARTS`: name, type, keywords, description and category, ranked (prefix match before
substring), so "res", "10k" → resistor hints and "pot" work without a server.

### Migration
Resistor, DC voltage source and DC current source move from `reference-parts.ts` and ground from
`symbols.ts` into one file each, **unchanged** (same types, pins, properties, artwork), so saved
projects and share links open exactly as before. `reference-parts.ts`, the symbol constants and
`PLACEABLE_PARTS` are removed; their users read the registry. The palette's four part buttons stay
until the parts drawer replaces them (Step 5).

### Parts added today (Step 3)
SPST switch (`switch.spst`, SW, property `closed`: closed = 1 mΩ, open = 1 GΩ — the usual SPICE
way, so the matrix never becomes singular) and potentiometer (`resistor.potentiometer`, RV, 3 pins,
total resistance + wiper position 0–100 %), both solvable by the Day 15 DC solver.

## Consequences
- A new part is one reviewed file plus `pnpm parts`; tests check it automatically against every
  rule and walk it through symbol → placement → netlist → ERC.
- `type` ids are a public format now: renaming one needs a project-format migration.
- User-defined parts (a later Day) can reuse `checkPart` with a JSON front-end (option C) on top.
- The generated index is committed; the test keeps it honest.
