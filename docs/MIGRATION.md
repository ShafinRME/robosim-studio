# Migration from RoboSim

Audit of the original RoboSim (`E:\My Projects\robosim`, commit `392b140`, read-only) and what moves
into RoboSim Studio. Decisions: **Reuse** (copy with light cleanup) · **Refactor** (keep the idea and
most code, change interfaces/units) · **Rewrite** (keep behaviour, new implementation) ·
**Defer** (reuse later, on the Day noted, e.g. optional accounts) · **Drop**.

Written on Day 01 (2026-11-20). **Rule: nothing is copied from RoboSim before the Day listed in the
port schedule below**, and every copied file must follow the porting rules in A.3 and B.3.

---

## Summary

### Coverage
All **236 files** of RoboSim (excluding `node_modules`, `.git`, `.next`) are covered:

| Part | Scope | Files | Reuse | Refactor | Rewrite | Defer | Drop | Other |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| A | Math library, types, robot config | 31 | 11 | 10 | 10 | 0 | 0 | 0 |
| B | Components and hooks | 121 | 8 | 75 | 5 | 9 | 24 | 0 |
| C | Routes, server code, database, scripts | 56 | 0 | 10 | 1 | 33 | 12 | 0 |
| D | Content, config, assets | 26 | 6 | 9 | 0 | 1 | 5 | 5 |
| — | `.env.local` (secrets, not read, never copied) · `pnpm-lock.yaml` (regenerated) | 2 | | | | | | 2 |
| **Total** | | **236** | **25** | **104** | **16** | **43** | **41** | **7** |

**In one sentence:** almost all teaching and simulation work survives (25 reused + 104 refactored +
16 rewritten), accounts come back later as an option (43 deferred), and only payments, session limits
and admin tooling are dropped (41).

### What RoboSim does well (keep doing it)
- Clean, framework-free TypeScript robot math (FK, IK, DH, Jacobian, trajectories, URDF).
- Rich, research-oriented features: benchmarks, data export, Python and ROS 2 code generation.
- Tutorials that embed the real simulator, interactive tours, theory cards with KaTeX.
- Professional-grade authentication and database workflow.

### What must change (top findings across all parts)
| # | Finding | Fixed on |
|---|---|---|
| F1 | IK mixes radians and degrees → steps ~57× too small; low IK success rate | Day 114 |
| F2 | Prismatic joints scaled by π/180 (SCARA Z-lift barely moves) | Day 113 |
| C1 | Quiz answer key sent by the browser → certificates can be forged | Days 159–163 |
| U1 | 1,179-line simulation page wiring 22 hooks | Day 06 |
| U2 | Many independent animation loops and timers, no shared simulation time | Day 09 |
| F5 | Robots stored at 3× real size → non-SI physics | Day 113 |
| — | No automated tests anywhere in the math or UI | From Day 04 (CI) onward |

### Port schedule
| Day | What moves from RoboSim | Into |
|---|---|---|
| 03 | `package.json` deps, `tsconfig`, ESLint, PostCSS, `next.config`, `pnpm-workspace`, `AGENTS.md`, `cn()` | repo root, `packages/ui` |
| 05 | shadcn UI kit (6 components), `components.json`, logo as a starting point | `packages/ui` |
| 06 | Panel registry; sidebar/panel manager → Dockview; simulation page → Studio workspace | `apps/web`, `packages/core` |
| 08 | Save design → `.rsim` files + IndexedDB | `packages/core` |
| 09 | Ring buffer (`graphBuffer`); hook timers replaced by the kernel clock | `packages/core` |
| 10 | Landing components and pages, icon, Open Graph image, robots.txt, sitemap | `apps/web` |
| 20 | `DynamicsGraph` → shared uPlot scope | `packages/ui` |
| 71 | Sensor simulator → sensor-model framework | `packages/devices` |
| 91 | Challenge definitions (2D) | `packages/sim2d` |
| 111–128 | Kinematics, IK, Jacobian, trajectories, URDF, dynamics (RNEA), workspace, benchmarks, pick-and-place, performance; robot configs in SI units; all 3D rendering; 23 panels and 19 hooks; exporters | `packages/kinematics`, `math`, `robots`, `sim3d`, `export` |
| 141 | ROS 2 code generator | `packages/ros-lite` |
| 146–150 | 10 tutorials → MDX, tutorial viewers, quiz, theory cards, spotlight tours | `packages/lessons` |
| 151–153 | Auth, database, email, migrations/scripts (new schema), learner dashboard, cloud save, server-graded quizzes, certificate | `apps/web` (server) |

## Part A — Math library (`src/lib`, `src/types`, `src/config/robots.ts`)

31 files (29 in `src/lib` + types + robot config), ~6,550 lines. All pure TypeScript with **no React imports**; 11 files import Three.js
(8 of them are rendering code). **No unit tests exist** for any of it.

### A.1 Findings (must fix while porting)

| # | Severity | Finding | Where | Fix in Studio |
|---|---|---|---|---|
| F1 | 🔴 High | **IK unit mismatch.** The position rows of the Jacobian are per *radian*, but joint angles are stored in *degrees*, and `dTheta` is added directly to degree angles. Every IK step is ~57× smaller than intended, and the orientation rows (deg/deg) are on a different scale from the position rows. This likely explains the low stock-UR5 IK success rate (48–58% noted in commit `d3ef83f`). | `ikSolver.ts` `runIKFromStart` | Radians everywhere internally; consistent Jacobian; re-benchmark |
| F2 | 🔴 High | **Prismatic joints are scaled by π/180.** For DH prismatic joints, FK does `d + value·π/180`, so the SCARA "Z Lift" (limits ±0.5) only moves about ±0.009. URDF prismatic joints use the raw value, so the two paths disagree. | `forwardKinematics.ts` `computeFK` | Prismatic values in metres, no conversion |
| F3 | 🟠 Medium | **FK rounds its output** (`toFixed(4)` / `toFixed(2)`). IK, finite-difference Jacobians and benchmarks are fed rounded numbers, which limits precision. | `computeFK` | Full precision in math; round only in the UI |
| F4 | 🟠 Medium | **Orientation error uses Euler-angle differences**, which are wrong near gimbal lock and not a true rotation distance. | `ikSolver.ts` `orientationError` | Axis-angle / quaternion error, geometric Jacobian |
| F5 | 🟠 Medium | **Robot sizes are 3× real** (`0.425 * 3`, …) to look bigger on screen. Physics, sensors and tolerances then use non-SI units (an IK tolerance of 0.05 = 1.7 cm real). | `config/robots.ts` | SI metres in data; scaling belongs to the renderer |
| F6 | 🟠 Medium | **"Dynamics" is an approximation**: velocities and accelerations are `abs()` finite differences (sign lost), and gravity torque is the sum of m·g·lever arm. There is no inertia, Coriolis or friction. | `dynamicsCalculator.ts` | Rewrite with RNEA (Recursive Newton–Euler), plan Day 115 |
| F7 | 🟡 Low | **Two different gimbal-lock fallbacks** for Euler extraction (FK uses `atan2(-r22, r11)`, which is incorrect; the orientation converter uses `atan2(-R12, R11)`). | `forwardKinematics.ts`, `orientationConverter.ts` | One shared, tested `rotationToEulerZYX` |
| F8 | 🟡 Low | **Duplicated code**: Jacobian building, `cross3`, `det3x3` and matrix helpers are copied in 3–4 files. | `ikSolver`, `jacobianAnalyzer`, `singularityDetector`, `urdfParser` | One `linalg` module + one `jacobian()` |
| F9 | 🟡 Low | **Not reproducible**: `Math.random()` in IK stall escape, encoder noise and workspace sampling. Benchmarks can't be repeated exactly. | several | Seeded RNG passed in (needed for research results) |
| F10 | 🟡 Low | **IK seeds are UR5-shaped** (`[0,-90,90,…].slice(0,n)`); for SCARA they push the prismatic joint to −90. | `ikSolver.ts` `solveIK` | Seeds generated from each robot's joint limits |
| F11 | 🟡 Low | **Workspace volume = bounding box × 0.4** (a fudge factor). | `workspaceAnalyzer.ts` | Voxel-count estimate |
| F12 | 🟡 Low | **Segment–segment distance by sampling** points. | `collisionDetector.ts` | Closed-form segment distance (or the physics engine) |
| F13 | 🟡 Low | **The math API depends on Three.js types** (`THREE.Vector3/Euler` in the IK target; `THREE.Vector3` in collisions). | `ikSolver`, `collisionDetector` | Plain `Vec3`/`Quat` types; Three.js only in rendering |

None of these break RoboSim for its current users. They matter for Studio because physics, sensors,
ROS and research results need correct SI units and reproducible numbers.

### A.2 Decision per file

Target packages: `kinematics` (robot math), `math` (linear algebra, rotations, RNG),
`robots` (robot definitions), `export` (code/file generators), `sim3d` (rendering, Phase 7).

| File | Lines | Decision | Target | Notes |
|---|---:|---|---|---|
| `types/robot.ts` | 43 | Refactor | `kinematics` | Radians/metres; add `inertia`, `mass`, `com` per link for RNEA |
| `config/robots.ts` | 145 | Refactor | `robots` | Real UR5/SCARA/planar dimensions in metres (fixes F5, F2) |
| `forwardKinematics.ts` | 221 | Refactor | `kinematics` | Keep DH + raw-transform (URDF) paths; Float64Array matrices; no rounding (F2, F3, F7) |
| `ikSolver.ts` | 429 | Refactor | `kinematics` | Keep DLS + multi-start + stall escape; fix units, orientation error, seeds, RNG (F1, F4, F9, F10, F13) |
| `ikSolutionFinder.ts` | 209 | Reuse | `kinematics` | Multiple-solution search on top of the new IK |
| `jacobianAnalyzer.ts` | 233 | Refactor | `kinematics` | Use shared `jacobian()`; SVD for condition number and rank |
| `singularityDetector.ts` | 223 | Refactor | `kinematics` | Shared Jacobian; keep wrist/elbow/shoulder classification |
| `orientationConverter.ts` | 221 | Reuse | `math` | Rotation matrix ↔ quaternion ↔ axis-angle ↔ Euler; becomes the single rotations module |
| `trajectoryPlanner.ts` | 231 | Reuse | `kinematics` | Minimum-jerk, trapezoidal, cubic, linear profiles are correct; add tests |
| `urdfParser.ts` | 314 | Refactor | `robots` | Keep DOMParser approach; add fixed joints in the chain, link inertials, mesh references, tree support (Day 115) |
| `dynamicsCalculator.ts` | 217 | Rewrite | `kinematics` | RNEA inverse dynamics with signed velocity/acceleration (F6) |
| `sensorSimulator.ts` | 271 | Refactor | `devices` | Becomes part of the shared sensor-model framework (Day 71); seeded noise |
| `workspaceAnalyzer.ts` | 134 | Refactor | `kinematics` | Seeded sampling, voxel volume (F11) |
| `collisionDetector.ts` | 164 | Rewrite | `sim3d` | Closed-form or physics-engine based (F12, F13) |
| `pickPlaceSequencer.ts` | 148 | Reuse | `kinematics` | 8-step state machine is clean; reuse in the 3D lab |
| `benchmarkRunner.ts` | 467 | Refactor | `kinematics` | Seeded; decouple from the download helper; re-baseline after F1 |
| `performanceMonitor.ts` | 218 | Reuse | `kinematics` | Cycle time, utilisation, smoothness trackers |
| `graphBuffer.ts` | 136 | Reuse | `core` | Ring buffer is generic; useful for scope/plots in every lab |
| `dataExporter.ts` | 153 | Reuse | `export` | CSV builders; move browser download to `ui` |
| `plyExporter.ts` | 109 | Reuse | `export` | PLY point-cloud export |
| `pythonBridgeGenerator.ts` | 434 | Reuse | `export` | Python script / notebook generation |
| `ros2BridgeGenerator.ts` | 385 | Reuse | `export` | ROS 2 node/launch/URDF generation (ROS Lab, Day 141) |
| `dhGeometry.ts` | 262 | Rewrite | `sim3d` | Imperative Three.js → React Three Fiber components |
| `robotGeometry.ts` | 148 | Rewrite | `sim3d` | Same |
| `dhFrameVisualizer.ts` | 237 | Rewrite | `sim3d` | Same; DH frame axes as an R3F component |
| `ghostArmRenderer.ts` | 178 | Rewrite | `sim3d` | Same; instanced ghost arms |
| `gripperGeometry.ts` | 154 | Rewrite | `sim3d` | Same; physical gripper in Phase 7 |
| `targetMarker.ts` | 139 | Rewrite | `sim3d` | Same; transform gizmo from drei |
| `workspaceVisualizer.ts` | 128 | Rewrite | `sim3d` | Same; instanced points |
| `multiRobotManager.ts` | 189 | Rewrite | `sim3d` | Becomes scene entities |
| `utils.ts` | 6 | Reuse | `ui` | `cn()` helper (shadcn) |

**Totals (Part A, 31 files):** Reuse 11 · Refactor 10 · Rewrite 10 · Drop 0. Every math idea survives; what
changes is units, precision, shared helpers and tests.

### A.3 Porting rules for the math library
1. SI units inside all math: **radians, metres, seconds, kilograms**. Degrees only at the UI edge.
2. No rounding inside math functions.
3. No Three.js, React or DOM imports in `math` / `kinematics` (except the URDF parser's `DOMParser`,
   which is injectable for Node tests).
4. Every function gets unit tests: FK against published UR5 poses, IK round-trip FK(IK(x)) ≈ x,
   Jacobian against finite differences, trajectory boundary conditions.
5. Randomness only through a seeded RNG argument.
6. Port on the Days the plan says (mostly Days 113–115). Nothing is copied before that.

---

## Part B — User interface (`src/components`, `src/hooks`)

121 files, ~32,900 lines: 99 components in 11 folders + 22 hooks. React 19 client components,
Tailwind 4 + shadcn/ui, imperative Three.js in one canvas component. **No component tests.**

### B.1 Findings (architecture)

| # | Type | Finding | Studio approach |
|---|---|---|---|
| U1 | 🔴 Problem | **One "god" page.** `app/simulation/page.tsx` (1,179 lines) wires 22 hooks together and passes ~24 props into `SimulatorCanvas`. Every new feature makes it bigger. | Panels read/write a shared **Zustand store**; the page only lays out the workspace |
| U2 | 🔴 Problem | **Many independent clocks.** 6 hooks/components run their own `requestAnimationFrame` loops and there are 23 `setInterval` calls. Nothing shares one simulation time, so IK, trajectories, gripper and collisions can drift apart. | One fixed-step **simulation kernel** (Day 09) drives everything; rendering just reads state |
| U3 | 🟠 Problem | **Heavy math on the UI thread.** IK animation and benchmarks run on the main thread (commit `e714cdf` added "yielding" to stop freezes). | Solvers and benchmarks run in **Web Workers** |
| U4 | 🟠 Problem | **Lessons are hard-coded TSX** (10 files, 490–680 lines each), mixing text, quizzes and layout. Hard to edit and impossible to translate to Bangla. | Lessons as **MDX** content with embedded live labs (Days 156–157) |
| U5 | 🟠 Problem | **Very large panels** (`SensorPanel` 965, `BenchmarkPanel` 872, `WaypointPanel` 837 lines) mix logic and UI. | Logic in packages, panels become thin views; split by tabs |
| U6 | 🟡 Problem | **Custom sidebar/panel system** (`SidebarStrip`, `usePanelManager`, `useDraggable`): fixed widths, no docking or splitting. | **Dockview** dockable panels + command palette (Day 06) |
| U7 | ✅ Keep | Tutorial viewers **reuse `SimulatorCanvas`** via `next/dynamic` instead of building new renderers. | Same pattern: lessons embed the real lab |
| U8 | ✅ Keep | **Panel registry** (`config/panelRegistry.ts`): id, icon, group, keyboard shortcut, default-open. | Becomes the Studio panel registry (plugin-friendly) |
| U9 | ✅ Keep | Interactive **spotlight tours** with step validation (`TutorialOverlay`). | Ported on Day 160 |
| U10 | ✅ Keep | Thoughtful UX details: per-panel shortcuts, colour-coded joint ranges, ghost arms, live metric badges. | Carried over into the new panels |

### B.2 Decision per file

**Simulator & workspace shell** (6 files)

| File | Lines | Decision | When / where | Notes |
|---|---:|---|---|---|
| `simulator/SimulatorCanvas.tsx` | 641 | Rewrite | Day 111 (`sim3d`) | React Three Fiber scene; render loop driven by the kernel |
| `simulator/SaveDesignButton.tsx` | 210 | Refactor | Day 08 | Save to IndexedDB / `.rsim` file instead of the database |
| `simulator/DashboardTimerBadge.tsx` | 216 | Drop | — | Session time limits are removed |
| `simulator/UnlimitedSessionTracker.tsx` | 54 | Drop | — | Same |
| `sidebar/SidebarStrip.tsx` | 465 | Rewrite | Day 06 | Dockview + command palette; keep groups and shortcuts |
| `sidebar/SidebarPanel.tsx` | 172 | Rewrite | Day 06 | Same |

**Panels** (24 files, 11,138 lines), all used by the 3D Robotics Lab in Phase 7

| Decision | Files |
|---|---|
| Refactor (Days 113–128) — 23 files | `JointControlPanel` 296 · `EndEffectorPanel` 220 · `IKPanel` 651 · `DHEditorPanel` 404 · `JacobianPanel` 381 · `SingularityPanel` 273 · `EulerQuaternionPanel` 426 · `DynamicsPanel` 273 · `WaypointPanel` 837 · `PickPlacePanel` 765 · `GripperPanel` 387 · `SensorPanel` 965 · `MultiRobotPanel` 516 · `RobotSelectorPanel` 367 · `URDFImportPanel` 553 · `WorkspaceComparePanel` 429 · `BenchmarkPanel` 872 · `PerformancePanel` 355 · `DataExportPanel` 315 · `PythonBridgePanel` 417 · `ROS2BridgePanel` 536 · `TheoryPanel` 229 · `ChallengePanel` 323 |
| Rewrite (Day 20) — 1 file | `DynamicsGraph` 348: custom canvas chart → shared **uPlot** scope/plot component used by every lab |

**Hooks** (22 files, 3,801 lines)

| Decision | Files | Notes |
|---|---|---|
| Refactor → store slices + kernel systems — 19 files | `useRobotArm` 88 · `useRobotSwitcher` 35 · `useIKSolver` 187 · `useDHEditor` 128 · `useSingularity` 149 · `useDynamics` 145 · `useTrajectory` 236 · `useWaypoints` 208 · `usePickPlace` 372 · `useGripper` 122 · `useCollision` 86 · `useSensors` 163 · `useMultiRobot` 212 · `usePerformance` 151 · `useBenchmark` 316 · `useChallenge` 228 · `useDataExport` 206 · `useGraphData` 107 · `useTutorial` 166 | Their logic is good; their private `requestAnimationFrame`/`setInterval` timing is replaced by the kernel (U2) |
| Rewrite — 1 file | `usePanelManager` 172 | Dockview layout state (Day 06) |
| Drop — 2 files | `useDraggable` 49 · `useSessionTimer` 275 | Dockview handles dragging; session limits removed |

**Tutorials & theory** (24 files)

| Decision | Files | When |
|---|---|---|
| Refactor → MDX lessons (text, quizzes and tasks reused) — 10 files | `lessons/Tutorial1` … `Tutorial10` (5,303 lines) | Day 157 |
| Refactor → embedded lab components — 9 files | `TutorialRobotViewer` · `TutorialFKViewer` · `TutorialDHViewer` · `TutorialIKViewer` · `TutorialSingularityViewer` · `TutorialWorkspaceViewer` · `TutorialTrajectoryViewer` · `TutorialDynamicsViewer` · `TutorialSensorViewer` | Days 156–157 |
| Refactor — 3 files | `TutorialOverlay` (spotlight tours) · `TutorialGrid` · `TutorialLauncher` | Days 158–160 |
| Reuse — 2 files | `QuizQuestion` · `theory/MathBlock` (KaTeX) | Day 156 |

**Landing site** (15 files)

| Decision | Files | When |
|---|---|---|
| Refactor (new brand, all labs) — 10 files | `Hero` · `HeroCanvas` · `Features` · `BenchmarkShowcase` · `Navbar` · `NavLinks` · `MobileMenu` · `Footer` · `SmoothHashScroll` · `SimulatorButton` | Day 10 (v0), Day 176 (final) |
| Drop → GitHub Discussions / Issues — 4 files | `Reviews` · `ReviewForm` · `StarRating` · `FeedbackForm` | — |
| Defer — 1 file | `LogoutButton` | Day 161 (optional accounts) |

**Accounts, dashboards, admin, payment** (24 files)

| Decision | Files | When |
|---|---|---|
| Defer (optional accounts) — 3 files | `auth/AuthBackground` · `auth/PasswordField` · `auth/SubmitButton` | Day 161 |
| Defer (learner profile) — 5 files | `dashboard/ProfileCard` · `TutorialProgressCard` · `TutorialAchievementsCard` · `BenchmarkHistoryCard` · `ResearchExportCard` | Days 161–163 |
| Drop (paid tiers & session limits) — 6 files | `dashboard/PaymentHistoryCard` · `PremiumUsageCard` · `UpgradeCTA` · `SessionWidget` · `SessionHistoryCard` · `payment/PaymentForm` | — |
| Drop (admin for payments, sessions, reviews) — 10 files | `admin/PaymentManagementPanel` · `ActiveSessionsPanel` · `UserManagementTable` · `AnnouncementComposer` · `FeedbackInboxPanel` · `ReviewModerationPanel` · `OverviewCards` · `RoleDistributionChart` · `SessionsTrendChart` · `TutorialCompletionChart` | — (classroom mode on Day 162 is new) |

**UI kit** (6 files): `badge` · `button` · `separator` · `slider` · `tabs` · `tooltip`: **Reuse**
(regenerated with the shadcn CLI on Day 05 so they match the new design tokens).

**Totals (Part B, 121 files):** Reuse 8 · Refactor 75 · Rewrite 5 · Defer 9 · Drop 24.
Everything that teaches or simulates is kept. What is dropped is payments, session limits and admin
tooling that a free, open-source project does not need.

### B.3 UI rules for Studio
1. Panels are thin views over the store; no simulation logic inside components.
2. No component starts its own animation loop or timer: subscribe to the kernel clock.
3. Anything slower than ~4 ms runs in a Web Worker.
4. Lesson text lives in MDX, never inside TSX components.
5. Every panel is registered in the panel registry (id, icon, group, shortcut), so labs can add panels
   without touching the shell.

---

## Part C — App routes, server code and database

56 files, ~7,750 lines: 36 files in `src/app` (pages, server actions, API routes), 14 server
libraries (`lib/auth`, `lib/db`, `lib/email`, `lib/certificate`), `src/proxy.ts`, the SQL schema and
4 scripts. Neon Postgres + Resend email + a Vercel cron job.

### C.1 Findings

| # | Type | Finding | Studio approach |
|---|---|---|---|
| C1 | 🔴 Problem | **Quiz answers are graded with a key sent by the browser.** `submitTutorial()` receives `correctAnswers` from the lesson component, so anyone can send their own key and pass every lesson, which also unlocks the certificate. The code comment calls this safe because it only affects the user's own score, but it does make certificates untrustworthy. | Practice quizzes are graded locally (no account needed). Anything that counts (certificates, classroom grades) is graded on the server with keys that never reach the browser (Days 159–163) |
| C2 | 🟠 Problem | **Database on every page load.** `proxy.ts` looks up the session in Postgres for `/`, `/landing`, `/simulation`, `/tutorials` and more. A cold or slow database slows down the simulator itself. | Labs and lessons are static and work offline; the session check runs only on account routes |
| C3 | 🟠 Problem | **Login required to simulate** (sessions, 45-minute limit, cooldown). | Local-first: no login needed for any lab; accounts are optional for cloud save, classes and certificates |
| C4 | 🟡 Problem | **Paid membership + cron job on Vercel Hobby**, which is for non-commercial use only. | Removed: no payments, no cron |
| C5 | ✅ Keep | **Strong authentication code:** salted scrypt password hashes, `timingSafeEqual`, SHA-256-hashed session and reset tokens, httpOnly + secure + sameSite cookies, revocable sessions, database-backed rate limits, and a dummy hash so login timing does not reveal which emails exist. | Reused as-is for optional accounts (Day 161) |
| C6 | ✅ Keep | **Professional database workflow:** checksummed migrations that refuse to overwrite unknown tables, an idempotent seed, and DB/HTTP tests that clean up after themselves. | Same pattern for the Studio schema |
| C7 | ✅ Keep | **Server-only database access**, with queries scoped to the signed-in user (`lib/db/query.ts`) and fresh admin checks for privileged actions. | Same rules |

### C.2 Decision per file

**Pages and layouts** (17 files)

| Decision | Files | When |
|---|---|---|
| Rewrite — 1 file | `simulation/page.tsx` 1,179 (the god page, U1) | Day 06 (Studio workspace route) |
| Refactor — 10 files | `layout.tsx` · `globals.css` (→ design tokens) · `page.tsx` · `landing/page.tsx` · `tutorials/page.tsx` · `tutorials/[number]/page.tsx` · `icon.tsx` · `opengraph-image.tsx` · `robots.ts` · `sitemap.ts` | Days 03–10, lessons on Days 156–158 |
| Defer — 2 files | `dashboard/layout.tsx` · `dashboard/page.tsx` (learner profile) | Day 161 |
| Drop — 4 files | `dashboard/premium/page.tsx` · `dashboard/admin/page.tsx` · `payment/page.tsx` · `payment/success/page.tsx` | — |

**Authentication pages** (7 files): `auth/actions.ts` · `auth/layout.tsx` · `auth/login` ·
`auth/signup` · `auth/forgot-password` · `auth/reset-password` · `auth/verify/route.ts`: **Defer**
to Day 161 (optional accounts).

**Server actions & API routes** (12 files)

| Decision | Files | When |
|---|---|---|
| Defer — 4 files | `actions/tutorial.ts` (fix C1) · `actions/robotDesigns.ts` (→ cloud save of `.rsim` projects) · `actions/dashboard.ts` · `api/certificate/route.ts` | Days 161–163 |
| Drop — 8 files | `actions/admin.ts` · `actions/payment.ts` · `actions/premium.ts` · `actions/membership.ts` · `actions/session.ts` · `actions/reviews.ts` · `actions/feedback.ts` · `api/cron/expiry-warning/route.ts` | — |

**Server libraries, proxy, database, scripts** (20 files): all **Defer** to Day 161, when optional
accounts arrive. They are high quality (C5–C7) and come back almost unchanged.

| Group | Files | Notes for Day 161 |
|---|---|---|
| Auth | `lib/auth/core.ts` · `crypto.ts` · `session.ts` · `proxy.ts` · `admin-guard.ts` | Remove membership checks from `core.ts`; admin → teacher role |
| Database | `lib/db/query.ts` · `schema.ts` · `server.ts` · `service.ts` · `sql.ts` | Same Neon client |
| Email | `lib/email/resend.ts` · `send.ts` · `templates.ts` | Keep verify/reset templates; drop payment templates |
| Certificate | `lib/certificate/generateCertificate.tsx` | Day 163; only for server-graded completions |
| Route guard | `src/proxy.ts` | Matcher limited to account routes (C2) |
| Schema | `database/001_initial.sql` | New schema: keep users, profiles, auth sessions/tokens, rate limits, tutorial progress, designs (→ projects); add classes; drop payments, memberships, session limits, simulation sessions, reviews, feedback |
| Scripts | `scripts/migrate.ts` · `seed.ts` · `test-db.ts` · `test-http.ts` | Same workflow, new schema |

**Totals (Part C, 56 files):** Refactor 10 · Rewrite 1 · Defer 33 · Drop 12.

---

## Part D — Content, configuration and assets

### D.1 Content and app configuration (`src/config`, 5 files; `robots.ts` is in Part A)

| File | Lines | Decision | When | Notes |
|---|---:|---|---|---|
| `theoryContent.ts` | 300 | Reuse | Day 156 | KaTeX formula cards → theory reference for every lab |
| `challengeContent.ts` | 165 | Reuse | Days 91, 128 | Challenge definitions for the 2D/3D challenge system |
| `panelRegistry.ts` | 262 | Refactor | Day 06 | Studio panel registry (U8) |
| `tutorials.ts` | 187 | Refactor | Day 157 | Lesson metadata → MDX front-matter |
| `tutorialContent.ts` | 159 | Refactor | Day 157 | Same; quiz keys move server-side (C1) |

### D.2 Project configuration (root, 15 files)

| File | Decision | Notes |
|---|---|---|
| `package.json` | Refactor (Day 03) | Becomes the monorepo + per-package manifests. Keep: next, react, three, katex, mathjs, @monaco-editor/react, radix-ui, shadcn, lucide-react, tailwind. Defer: @neondatabase/serverless, resend, @react-pdf/renderer. Drop: recharts (→ uPlot). Framer Motion: landing page only |
| `tsconfig.json` | Refactor (Day 03) | Shared base config; target ES2017 → ES2022; keep `strict` |
| `eslint.config.mjs` · `postcss.config.mjs` | Reuse (Day 03) | Next + Tailwind 4 setup |
| `components.json` | Reuse (Day 05) | shadcn config (`radix-nova` style, lucide icons) |
| `next.config.ts` | Refactor (Day 03) | Add COOP/COEP headers for WebAssembly threads; Worker support |
| `pnpm-workspace.yaml` | Refactor (Day 03) | Add workspace packages; keep `allowBuilds` |
| `AGENTS.md` | Reuse (Day 03) | Important warning that Next.js 16 differs from older docs: read `node_modules/next/dist/docs/` first |
| `CLAUDE.md` | Merged | Its only line (`@AGENTS.md`) goes into the Studio `CLAUDE.md` |
| `.env.example` | Defer (Day 161) | Database and email variables, only when accounts arrive |
| `vercel.json` | Drop | Only held the expiry-warning cron |
| `README.md` · `LICENSE` · `.gitignore` | Replaced | Already written for Studio on Day 01 |
| `next-env.d.ts` | Generated | Created by Next.js |

### D.3 Public assets (`public/`, 6 files + 1 empty folder)

| File | Decision | Notes |
|---|---|---|
| `logo.svg` · `logo.png` | Refactor (Day 05) | Starting point for the Studio logo refresh |
| `bkash-qr.png` | Drop | Payments removed |
| `file.svg` · `globe.svg` · `window.svg` | Drop | Leftover Next.js starter icons |
| `models/` | Drop | Empty folder; 3D models arrive with the 3D lab (Day 112) |

**Totals (Part D, 26 files):** Reuse 6 · Refactor 9 · Defer 1 · Drop 5 · Replaced/Merged/Generated 5.

---

## Risks and open decisions

### Migration risks
| Risk | Impact | Mitigation |
|---|---|---|
| Fixing F1/F2/F5 changes IK and benchmark numbers, so old RoboSim results (README, landing page, commit notes) are not comparable | Medium | Re-baseline benchmarks with seeded runs on Day 128; label old numbers as "RoboSim v1" |
| Porting happens late (Days 111–128) and the old code may change before then | Low | Port from a fixed commit (`392b140`) unless the owner says otherwise; re-audit diffs if RoboSim changes |
| Lessons were written for the old UI; wording refers to old panels and controls | Low | Update text while converting to MDX (Day 157) |
| Optional accounts return on Day 161 with a new schema; old RoboSim users are not migrated | Low | Studio is a new product; RoboSim stays online as-is |

### Owner decisions for the old RoboSim (not part of the Studio plan)
These concern `E:\My Projects\robosim` and the live site robosim-bd.vercel.app. **Nothing here is done
without the owner's explicit permission.**

1. **Keep RoboSim online unchanged?** Recommended: yes. Freeze features and link it to Studio later.
2. **Paid tiers on Vercel Hobby (C4).** Vercel's Hobby plan is for non-commercial use. Consider
   turning off the bKash premium flow on the live site.
3. **Optional quick fixes** for current users (small patches): F2 (SCARA Z-lift), F1 (IK units),
   C1 (quiz key on the server). Each would be a separate task in the RoboSim repo, only if requested.

**Owner decision (2026-11-20):** RoboSim stays online and **unchanged**, including the premium flow
(items 1–3 are all deferred). The open issues are recorded in a local, untracked
`E:\My Projects\robosim\IMPROVEMENTS.md`, to be fixed if work on RoboSim ever resumes.
