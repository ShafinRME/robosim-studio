# Devlog

One short entry per finished Day: what was built, what was learned, what's next.

<!-- Newest entries on top. Template:
## Day NN — <topic> (YYYY-MM-DD)
- Built:
- Learned:
- Next:
-->

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
