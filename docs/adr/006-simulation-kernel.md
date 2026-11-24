# ADR 006 — Simulation kernel: fixed-step scheduler, worker host, signal bus

- **Status:** Accepted
- **Date:** 2026-11-23 (Day 09)

## Context
Every lab simulates something over time: circuits, microcontroller code, sensors, motors, controllers,
2D/3D physics, ROS nodes. They must run the same way on every computer (reproducible results, tests
that do not depend on timing), keep the UI smooth on an 8 GB laptop with integrated graphics, and be
able to talk to each other — a pin drives an LED, a sensor feeds a controller, a controller drives a
motor. The PRD calls the shared connection the **Signal Bus**.

## Decisions

### 1. Fixed-step scheduler (in `@robosim/core`, pure)
- Models advance in **fixed steps** `dt` (default 1 ms = 1 kHz). Simulated time is `steps × dt`
  (integer step count — no floating-point drift), never wall-clock time.
- The scheduler gets real elapsed time from its host and runs as many whole steps as the
  **real-time factor** asks for (0.1× … 10×; leftover time carries to the next frame).
- **Step budget:** at most N steps per frame (default 200). If the model cannot keep up, the extra
  time is dropped and the scheduler reports **behind** — the simulation slows down instead of
  freezing the page ("spiral of death").
- Controls: run, pause, step (one or N steps while paused), reset, set rate.
- The scheduler has no timers of its own and no DOM: time is injected, so it is fully unit-tested.

### 2. Worker host (Web Worker + Comlink)
- Each running simulation lives in a **dedicated module Web Worker**; the main thread only renders.
- **Comlink 4.4.2** (Apache-2.0, no dependencies, 0 advisories, stable since 2024) wraps
  `postMessage` as typed async calls (`run()`, `pause()`, `step()`, `setRate()`…). Alternatives: raw
  `postMessage` (hand-written message protocol, more code to test); threads.js / workerpool (pools
  we do not need).
- The worker ticks itself with a timer and sends **snapshots** (time, steps, rate, state, selected
  signals) at display rate (~30 Hz), never per step — 1 000 messages a second would cause the jank
  we want to avoid.
- Workers come from our own origin only (`new Worker(new URL(…), { type: "module" })`); CSP gets
  `worker-src 'self'`. No `eval`, no `importScripts` of other origins.

### 3. Signal Bus (in `@robosim/core`, pure)
- A typed store of named **signals**: number (with unit) or boolean, e.g. `led1.on`,
  `motor.left.voltage` (V), `sonar.distance` (m). Names are checked (`a-z0-9._-`, ≤ 64 chars); the
  number of signals is capped.
- **Double-buffered:** writes during a step become visible at the next step. So the order in which
  models run inside one step never changes the result — results are deterministic.
- Values are checked on write (finite numbers, optional min/max clamp from the declaration);
  writing an undeclared signal or the wrong type is an error.
- Labs connect through the bus only; they never call each other directly. Later: wires map pins to
  signals, ROS topics map to signals, real-robot bridges read/write signals.

## Consequences
- Every model implements one small interface (`reset()`, `step(t, dt, bus)`), so labs can be combined.
- Determinism makes golden tests possible ("this circuit gives these values after 1 000 steps").
- One-step delay between models is a deliberate trade-off for determinism; at 1 kHz it is 1 ms.
- Heavier engines (circuit solver, Rapier physics) run inside the same worker host later.
