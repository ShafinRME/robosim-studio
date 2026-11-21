---
title: RoboSim Studio — User Manual
version: 0.0.0
updated: 2026-11-21
---

# About this manual

This manual explains **what every screen, button and tool in RoboSim Studio does and how to use it**.
It grows together with the software: each feature is added here on the Day it is built and tested.

- **Software version covered:** v0.0.0 (Phase 0 — Foundation)
- **Last updated:** 2026-11-21 (Day 03)
- Features that are not built yet are listed under *Coming soon* and are not described in detail.

# 1. What is RoboSim Studio?

RoboSim Studio is a free, open-source robotics lab that runs in your web browser. When it is complete,
you will be able to design circuits, program Arduino, ESP32 and Raspberry Pi Pico boards, model sensors
and motors, tune controllers, simulate power electronics, drive robots in 2D and 3D, learn ROS 2, and
move simulated or real robots with your own hand gestures — with no installation and no licence fees.

It is organised into **10 labs** plus a learning platform:

| # | Lab | What it is for | Available from |
|---|---|---|---|
| 1 | Circuit Lab | Build and measure electronic circuits | v0.1 |
| 2 | Microcontroller Lab | Program Arduino and Raspberry Pi Pico boards | v0.2 |
| 3 | IoT Lab | ESP32 with Wi-Fi, MQTT and Bluetooth | v0.3 |
| 4 | Sensors & Actuators Lab | Realistic sensors, motors and drivers | v0.4 |
| 5 | 2D Robotics Lab | Mobile robots in 2D worlds | v0.5 |
| 6 | Control Systems Lab | PID, Bode plots, state-space control | v0.6 |
| 7 | Power Electronics Lab | Converters, solar MPPT, batteries | v0.6 |
| 8 | 3D Robotics Lab | Robot arms, rovers and drones in 3D | v0.7 |
| 9 | ROS Lab | ROS 2 concepts, navigation and SLAM | v0.8 |
| 10 | Gesture Control Lab | Move robots with hand and body gestures from a webcam | v0.9 |

# 2. Getting started

## 2.1 What you need

| Item | Requirement |
|---|---|
| Computer | Desktop or laptop (phones and tablets are not supported) |
| Memory | 8 GB RAM or more |
| Browser | Latest Chrome or Edge (recommended), Firefox or Safari |
| Screen | 1366 × 768 or larger, with keyboard and mouse or touchpad |
| Internet | Needed for the first load; loaded labs keep working offline |

## 2.2 Opening RoboSim Studio

The public website address will be added here when the first version is online (v0.0.1).

**During development (on the developer's computer):** open your browser and go to
`http://localhost:3100`.

# 3. Home page

![The home page in v0.0.0](images/home-page.png)

The home page is the first screen you see. In v0.0.0 it is a **preview page** that confirms the
software is installed and running correctly. It will be replaced by the full studio workspace on
Day 06.

| Part of the screen | What it does |
|---|---|
| Chip icon and **RoboSim Studio** title | Shows the name of the software. |
| **Primary button**, **Outline button** | Style preview only — they do not perform any action yet. |
| Grid of 10 labs | Lists the labs in the order they will be released (P1 = phase 1, and so on). The entries are not clickable yet. |
| Footer line | Shows the software version (v0.0.0) and the current development phase. |

# Coming soon

These parts of the manual will be written as each feature is finished:

- Studio workspace: panels, tabs, toolbar, command palette and keyboard shortcuts (Day 06)
- Saving, opening, exporting and sharing projects (Days 07–08)
- Simulation controls: play, pause, step and speed (Day 09)
- Low-end mode for slower computers (Day 10)
- One chapter for each of the 10 labs

# Version history of this manual

| Version | Date | Changes |
|---|---|---|
| 0.0.0 | 2026-11-21 | First edition: about RoboSim Studio, requirements, home page preview. |
