# Status

**Current:** Day 02 — Product spec · ✅ complete (5/5)
**Branch:** `feat/day-02-product-spec` → squash-merged into `develop`
**Updated:** 2026-11-21

## Day 02 steps
| Step | Task | State |
|---|---|---|
| 1/5 | Day branch; `docs/PRD.md` outline; ADR 001 (the labs); README lab table; CLAUDE.md docs map | ✅ done |
| 2/5 | PRD: vision, problem, principles, target users (school, university, self-learners, teachers) | ✅ done |
| 3/5 | PRD: the 10 labs in detail + supported boards & platforms | ✅ done |
| 4/5 | PRD: non-goals, success metrics, constraints, risks, open questions | ✅ done |
| 5/5 | Owner review → DEVLOG, commit, push, PR into `develop`, squash-merge, Day 03 card | ✅ done |

## Decisions (Day 02)
- 10 labs (ADR 001). Control Systems and Power Electronics are separate; Learning Platform is a layer.
- Gesture Control Lab added: phase P9, Days 146–155, v0.9. Plan = 190 Days / 13 phases; v1.0 ≈ 2027-07-27.
- Target devices: desktops and laptops only, minimum 8 GB RAM.
- Budget: free tiers while developing; up to ~3,000 BDT (≈ US$25)/month if truly needed, owner approves.
- Primary users for v1.0: university students.

## Next action
Day 03 — Monorepo scaffold. Owner opens a new session in `E:\My Projects\robosim-studio` named
**Day 03 – Monorepo scaffold** and types:
`Day 03. Read CLAUDE.md and docs/STATUS.md, then show me today's steps.`

## Open issues
- Math findings F1–F13 in `docs/MIGRATION.md` are fixed during porting (Days 113–115), not in the old RoboSim.
- Old RoboSim stays unchanged, including its premium flow (owner decision 2026-11-20). Its issues are
  listed in the local `E:\My Projects\robosim\IMPROVEMENTS.md`.
- PRD open questions Q1–Q7 (§11), each with its decision Day.
- `docs/PLAN.md` is generated from the owner's private plan source — never edit it by hand.
