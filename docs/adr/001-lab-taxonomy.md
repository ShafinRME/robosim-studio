# ADR 001 — The 10 labs

- **Status:** Accepted
- **Date:** 2026-11-20 (Day 02). Amended 2026-11-21: Gesture Control Lab added as lab 10.

## Context
The original plan promised "9 labs", but its phase table listed 8 lab phases, and the README counted
the Learning Platform as the ninth. On Day 02 the owner also asked for gesture control: moving
simulated and real robots in real time with hand and body gestures from a webcam. We need one fixed
list of labs to use in the PRD, the UI navigation, the code packages and the lessons.

## Decision
A lab is a **subject area with its own simulation engine and its own workspace**. Which board you use
does not make a new lab, and neither does the learning layer.

1. Circuit Lab
2. Microcontroller Lab (Arduino, Raspberry Pi Pico)
3. IoT Lab (ESP32)
4. Sensors & Actuators Lab
5. 2D Robotics Lab
6. Control Systems Lab
7. Power Electronics Lab
8. 3D Robotics Lab
9. ROS Lab
10. Gesture Control Lab

The order follows the build order in `PLAN.md`.

- **Control and Power Electronics are separate labs.** Universities teach them as separate courses.
  They also use different engines (block diagrams with ODE solvers versus switched circuits) and
  different workspaces. They still ship together in phase P6 (v0.6).
- **Gesture Control is its own lab.** It has its own subject (human–robot interaction and
  teleoperation), its own engine (camera → landmark tracking → gesture/pose mapping → safety layer)
  and its own workspace (live video next to the robot). It drives robots from the 2D, 3D and ROS labs
  and real robots, so it comes after all simulation labs: phase P9 (v0.9, Days 146–155).
- **The Learning Platform is not a lab.** Lessons, tasks and classrooms embed every lab, so it is a
  layer across all of them (phase P10).
- **ESP32 has its own lab, named IoT Lab.** The subject is networking and connected systems. ESP32
  is simply the board used.

## Consequences
- The README lab table lists 10 labs. The Learning Platform is shown as the layer below them.
- `PLAN.md` gains phase P9 Gesture Control Lab (10 Days). Later phases move by 10 Days. The plan grows
  from 180 to 190 Days and 13 phases. v1.0 moves from about 2027-07-13 to about 2027-07-27.
- The Learning Platform beta becomes v0.10.
- Later package and route names follow this list (for example `labs/control`, `labs/power`,
  `labs/gesture`).
