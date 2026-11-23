# Status

**Current:** Day 09 — Simulation kernel · Step 8/8 (owner review, then merge)
**Branch:** `feat/day-09-simulation-kernel` (from `develop`)
**Session:** Days 06–10 – Studio core
**Updated:** 2026-11-24

## Day 09 steps
| Step | Task | State |
|---|---|---|
| 1/8 | Day branch; ADR 006 simulation kernel (scheduler, worker host + Comlink, Signal Bus) | ✅ done |
| 2/8 | Fixed-step scheduler in core (run / pause / step / reset / rate, step budget) + tests | ✅ done |
| 3/8 | Signal Bus in core (typed, double-buffered) + tests | ✅ done |
| 4/8 | Web Worker host with Comlink; CSP `worker-src 'self'` | ✅ done |
| 5/8 | 1 kHz dummy model; jank check (main thread stays smooth) | ✅ done |
| 6/8 | Studio: Run / Pause / Step / Stop, rate, status bar time | ✅ done |
| 7/8 | e2e tests; User Manual; `pnpm manual` | ✅ done |
| 8/8 | Owner review → DEVLOG, merge; note for Day 10 | 🔄 DEVLOG done, waiting for owner approval |

## Decisions (Day 09)
- ADR 006: fixed steps (default 1 ms), simulated time = steps × dt; scheduler pure with injected real time;
  per-frame step budget, drops time and reports "behind" instead of freezing; one module Web Worker per
  simulation, **Comlink 4.4.2** (Apache-2.0, no deps, 0 advisories; installed in Step 4), snapshots at ~30 Hz;
  Signal Bus = typed named signals (number with unit / boolean), double-buffered (writes visible next step →
  deterministic), checked names, values and counts. (PLAN.md calls this "ADR-001"; ours is ADR 006.)
- Scheduler (`packages/core/src/sim/scheduler.ts`): run / pause (drops leftover time) / step(n ≤ 100 000, only when
  not running) / reset / setRate (0.1–10×, presets 0.1…10); `advance(realSeconds)` caps one frame at 0.25 s (no
  catch-up after a hidden tab), budget 200 steps/frame by default, tracks `behind` and `droppedTime`; integer
  step count → exact time over 900 000 steps. 31 tests. 376 unit tests.
- Signal Bus (`packages/core/src/sim/signal-bus.ts`): declare number (unit, min/max clamp, initial) / boolean signals;
  names `a-z0-9` words joined by `. _ -` (≤ 64), ≤ 10 000 signals; writes go to a pending buffer, `commit()` makes
  them visible (order of models never matters — tested); one write per signal per step; finite numbers only;
  typed reads; reset; snapshot. 35 tests.
- Simulation (`sim/simulation.ts`): `SimModel { id, signals, reset(bus), step(t, dt, bus) }`; models + bus + scheduler,
  bus committed after every step; watched signals in snapshots; duplicate models/signals refused. 6 tests.
- Worker host (`apps/web/src/sim/`): `sim-host.ts` (injected clock; ticks every 4 ms, snapshots every 33 ms to one
  listener, steps-per-second meter; every argument from the main thread checked; models only by id from
  `models.ts` — the page never sends code), `sim-worker.ts` (Comlink `expose`), `sim-client.ts` (module worker +
  `wrap`, `proxy` listener, terminate). **Comlink 4.4.2** added (audit 0). CSP already had `worker-src 'self' blob:`.
  14 host tests. Worker not started in the browser yet (no model until Step 5). 431 unit tests.
- Demo model (`packages/core/src/sim/demo-models.ts`): `demo.driver` switches `demo.drive` every 1 s; `demo.spring`
  (m 0.5 kg, k 20 N/m, c 1 N·s/m, F 2 N, semi-implicit Euler) writes `demo.position` / `demo.velocity`. Tests: settles
  at F/k, drive timing, bounded over 60 s, deterministic + reset, 10 000 steps fast. Worker registry `demo`.
- Studio (`studio-simulation.tsx`, `sim-controls.tsx`): worker starts on first Run/Step (opening the studio costs
  nothing), snapshots go to an external store so only sim widgets re-render; top bar Run/Pause, Step (1 ms),
  Stop (back to 0 s), speed 0.1×–10×; status bar Idle/Running/Paused, `t … s`, steps/s, "Behind" warning; live
  signal readout on the canvas; commands + shortcuts Ctrl+Enter (run/pause), Alt+. (step), Ctrl+Shift+Enter (stop);
  worker terminated when the studio closes; errors go to the status bar.
- **Jank check ✅ ("done when" met):** `e2e/simulation.isolated.spec.ts` — 1005 steps/s; main thread 122 frames idle →
  121 running in 2 s; worst frame gap 17 ms; no long tasks. **Found:** with 4 parallel browsers on the dev server the
  numbers collapse (17 frames) from CPU contention, so timing tests run in a separate Playwright project
  `isolated` (after all others, one at a time) and compare against an idle baseline. 436 unit, 70 e2e.
- **Jank fix (found by repeating the test):** running sometimes dropped to 41–88 of 122 frames. Cause: status-bar
  text changing ~30×/s forced page-wide layout/paint. Fix: `[contain:strict]` on the status bar, contained
  readout, fixed-width numbers, text readouts at most 10 updates/s (`VIEW_UPDATE_MS`; run/pause/stop instant).
  Now 120–121 of 122 frames in 4/4 runs. **Race fix:** New project / open during the restore after a reload was
  overwritten by the restored tabs → disabled until restored (+ button greyed out). 70 e2e passed twice in a row.
- Step 7: User Manual §7.6 "Running a simulation" (controls, speed, live values, Behind, worker note) + screenshot
  `simulation-running.png`; 7.1 / status-bar rows updated; 7.7–7.9 renumbered; simulation shortcuts; PDF rebuilt.
- Day 08 merged into `develop` as `ad828f6` (PR #9).

## Next action
Day 09 · Step 8/8 — owner approves the whole-Day test; then PR #10 ready, squash-merge into `develop`, note for Day 10.

## Open issues
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
