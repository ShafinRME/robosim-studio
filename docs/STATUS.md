# Status

**Current:** Day 11 · Step 2/7 done — Circuit model ADR (Phase 1 · Circuit Lab)
**Branch:** `feat/day-11-circuit-model` (from `develop`)
**Session:** Days 11–15 – Circuit Lab foundations
**Updated:** 2026-11-24

## Day 11 steps
| Step | Task | State |
|---|---|---|
| 1/7 | Day branch; study old RoboSim (read-only) and scope the model | ✅ done |
| 2/7 | Draft ADR 007 — Circuit model | ✅ done (Proposed, owner review) |
| 3/7 | Netlist types + Zod schema in `packages/core/src/circuit/` + tests | ⏳ next |
| 4/7 | Component interface (`MnaContext`, `stamp()`, state) + reference R/V/I stamps as fixtures | ⬜ |
| 5/7 | Units: RKM code ("4k7"), quantity-aware `parseQuantity` with range checks + tests | ⬜ |
| 6/7 | Beginner error model: issue codes, messages, netlist graph checks + tests | ⬜ |
| 7/7 | Lint/typecheck/tests; owner review → DEVLOG, squash-merge into `develop` | ⬜ |

## Decisions (Day 11)
- Old RoboSim has **no circuit simulator** (no MNA/netlist code) — nothing to port; new design.
- **ADR 007** (`docs/adr/007-circuit-model.md`, Proposed): circuit document (saved: parts + wires/labels/ground;
  wires added Day 13 with a format bump) → derived **netlist** (`buildNetlist`, union-find, deterministic node
  numbering, ground = node 0); part = **definition** (pins, typed properties) + **device** (`branches`, `stateSize`,
  `stamp`, `stampNonlinear?`, `stampTransient?`, `accept?`, `report`) writing only via `MnaContext`; state in one
  `Float64Array`; SI numbers inside and in files, text only at input/display (RKM "4k7" added); `CircuitIssue`
  with 11 codes, graph checks before solving, results never NaN. PLAN's "ADR-002" name → 007 (002 was taken).

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
**Day 11 · Steps 3–4** (after the owner's review of ADR 007): netlist types + Zod schema; component interface
(`MnaContext`, stamps, state) with reference R/V/I stamps as test fixtures.
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
