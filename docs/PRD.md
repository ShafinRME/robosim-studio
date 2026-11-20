# RoboSim Studio — Product Requirements Document (PRD)

| | |
|---|---|
| **Status** | Complete draft — awaiting owner review (Day 02 · Step 4) |
| **Owner** | Md. Shafin Ahmed |
| **Last updated** | 2026-11-21 |
| **Related** | [`PLAN.md`](PLAN.md) (roadmap) · [`MIGRATION.md`](MIGRATION.md) (reuse from RoboSim) · [ADR 001](adr/001-lab-taxonomy.md) (why these 10 labs) |

## 1. Vision
**Anyone with a browser can learn and practise robotics, from a first LED circuit to a ROS 2
navigation stack. No hardware, no installation and no licence fees.**

RoboSim Studio is one connected lab, not a set of separate demos. A circuit drawn in the Circuit Lab
can be driven by firmware in the Microcontroller Lab, and a robot arm in the 3D Robotics Lab or on
the desk can be moved in real time by the learner's own hand gestures in front of a webcam. The same sensor model gives realistic readings
in 2D and in 3D. A controller tuned in the Control Systems Lab can run on a simulated board in the
loop. Learners move from beginner to advanced without changing tools.

**One-sentence pitch:** a free, open-source, browser-based robotics and mechatronics lab that covers
circuits, embedded systems, IoT, sensors, control, power electronics, 2D/3D robotics, ROS 2 and
real-time gesture control of robots, with lessons built in.

## 2. Problem
1. **Hardware is expensive and scarce.** Many schools and universities, especially in low- and
   middle-income countries such as Bangladesh, have few kits, oscilloscopes or robots to share
   between many students. Parts break, go missing, or take weeks to ship.
2. **Professional tools are paid and heavy.** Standard engineering tools (MATLAB/Simulink, Proteus,
   Multisim, commercial robot simulators) need licences and powerful computers. ROS 2 and Gazebo need
   Linux and a setup most beginners never finish.
3. **Free tools are fragmented.** Free online simulators usually cover only one area: a circuit
   simulator, an Arduino emulator, or a robot-arm demo. Learners lose the links between electronics,
   firmware, control and mechanics, which is the core of mechatronics.
4. **Learning materials are separate from practice.** Tutorials, videos and simulators live in
   different places. Teachers have no simple way to set, collect and check practical work.
5. **Language and device barriers.** Most material is in English only and assumes a fast laptop
   and a fast internet connection.

## 3. Product principles
These principles decide trade-offs. When two goals conflict, the higher principle wins.

1. **Free forever.** No paid tiers, no paywalled features, no adverts. MIT licence. Only MIT /
   Apache-2.0 / BSD dependencies. "Free" means free for users; hosting starts on free tiers (§9).
2. **Correct before pretty.** Every solver, emulator and model is tested against reference results
   (analytic formulas, SPICE, MATLAB, datasheets). A wrong answer in a teaching tool is worse than
   no answer.
3. **Runs on any desktop or laptop.** Works in a current desktop browser on an 8 GB RAM laptop with
   integrated graphics (Low-end mode). Phones and tablets are not targets: learning robotics needs a
   computer. Labs
   load on demand. Heavy simulation runs in Web Workers so the UI never freezes. Core labs work
   offline once loaded.
4. **No login needed to learn.** Every lab and lesson works without an account. Accounts are
   optional, only for cloud save, classrooms and sharing.
5. **One connected lab.** Labs share one component model, one sensor model and one project format.
   Work moves between labs. It is never copied by hand.
6. **Beginner to advanced on the same screen.** Simple defaults for first-time users. Deeper
   options (noise models, solver settings, register views) are revealed when needed, never removed.
7. **Real-world transfer.** Code written for a simulated board should run on the real board with
   no or minimal changes. Models use real part numbers and datasheet values.
8. **Open and inspectable.** Learners can see why a result happened: node voltages, register values,
   ODE states, ROS topics. Nothing is a black box.
9. **Accessible and multilingual.** WCAG 2.1 AA target. English and Bangla interface and lessons,
   built so other languages can be added.

## 4. Target users
RoboSim Studio serves four groups. University students are the primary group for v1.0: their
courses use the most labs, and they give the clearest feedback. The other three groups shape
defaults, lessons and classroom features.

| Group | Age / level | Main goal | Labs used most | Priority |
|---|---|---|---|---|
| School students | 12–18, beginner | Understand and build first projects | Circuit, Microcontroller, 2D Robotics | Secondary |
| University students | 18–25, intermediate to advanced | Pass courses, do labs and projects, prepare for research | All ten | **Primary** |
| Self-learners and makers | Any age, mixed | Learn a skill or prototype a project | Microcontroller, IoT, Sensors, 3D Robotics, ROS | Secondary |
| Teachers and instructors | Educators | Teach practicals without enough hardware | All ten + Learning Platform | Secondary (key for growth) |

### 4.1 School students
**Persona — Nusrat, 15, Class 10, Dhaka.** Her school has one Arduino kit for 40 students. She uses
a shared family laptop and a slow home internet connection.

- **Needs:** visual, guided first steps. Clear feedback when a wire is wrong. Block-based coding
  before C++. Lessons in Bangla.
- **Key tasks:** build an LED and resistor circuit and read it with a multimeter. Blink an LED and
  read a button on a simulated Arduino. Program a line-following robot in the 2D lab.
- **Success for her:** she finishes a guided project alone in one class period and can explain what
  each part does.
- **Design impact:** beginner mode, block coding, friendly error messages, Bangla, Low-end mode,
  works on a basic laptop and a slow connection.

### 4.2 University students
**Persona — Arif, 21, third-year Robotics & Mechatronics (or EEE / ME / CSE) student.** His courses
cover circuits, microcontrollers, control systems, power electronics and robotics. The department
lab is open only a few hours a week, and MATLAB licences are limited.

- **Needs:** accurate simulation he can trust for assignments. Real Arduino / ESP32 / Pico code.
  Control analysis (Bode, root locus, LQR). Robot kinematics and dynamics. A path to ROS 2.
- **Key tasks:** analyse an RC filter and compare with theory. Write ESP32 firmware that publishes
  sensor data over MQTT. Tune a PID motor controller, then run it on a simulated MCU. Solve IK for a
  6-DOF arm. Run navigation and SLAM in the ROS Lab.
- **Success for him:** he completes course labs and his final-year project in Studio and gets the
  same results as the textbook, MATLAB or the real hardware.
- **Design impact:** numerical accuracy with published validation, advanced views (registers, solver
  settings, raw data), export of data and plots, URDF import, real-board compatibility.

### 4.3 Self-learners and makers
**Persona — Tanvir, 27, software developer and hobbyist.** He wants to build a small robot and learn
embedded systems and ROS in his free time. He learns from online videos and wants to test ideas
before buying parts.

- **Needs:** fast start with no setup. Real part numbers he can buy later. Example projects to copy
  and change. Clear, searchable documentation.
- **Key tasks:** wire an HC-SR04 and a servo to an ESP32 and test the code. Build a Wi-Fi sensor
  dashboard. Prototype a differential-drive robot in 3D before building it.
- **Success for him:** the code and wiring from Studio work on his real hardware with no or minimal
  changes.
- **Design impact:** realistic part models, example gallery, shareable project links, code that
  transfers to real boards.

### 4.4 Teachers and instructors
**Persona — Ms. Rahman, lecturer, teaches microcontrollers and control systems to 60 students per
section.** Her lab has 10 working kits. She spends hours checking lab reports by hand.

- **Needs:** ready-made lessons and lab exercises she can adapt. Classrooms where students join with
  a code. Auto-graded tasks. A clear view of who is stuck. Works on the lab computers she already has.
- **Key tasks:** pick a lesson, set it as an assignment with a deadline, see each student's progress
  and grade, export results.
- **Success for her:** every student does the practical, even without a kit, and checking takes far
  less time.
- **Design impact:** Learning Platform (lessons, auto-graded tasks, classrooms), teacher dashboard,
  export, works without student accounts for simple use.

## 5. The 10 labs
The list and order are set in [ADR 001](adr/001-lab-taxonomy.md). Day-by-day scope is in
[`PLAN.md`](PLAN.md); this section says **what each lab must let a learner do**.

| # | Lab | Domain | Phase · Release |
|---|---|---|---|
| 1 | Circuit Lab | Analog and digital circuits | P1 · v0.1 |
| 2 | Microcontroller Lab | Embedded programming: Arduino and Raspberry Pi Pico | P2 · v0.2 |
| 3 | IoT Lab | Connected devices on ESP32: Wi-Fi, MQTT, BLE, RTOS | P3 · v0.3 |
| 4 | Sensors & Actuators Lab | Realistic sensor and actuator models | P4 · v0.4 |
| 5 | 2D Robotics Lab | Mobile robots in 2D physics worlds | P5 · v0.5 |
| 6 | Control Systems Lab | Classical and modern control design | P6 · v0.6 |
| 7 | Power Electronics Lab | Switching converters, solar, batteries | P6 · v0.6 |
| 8 | 3D Robotics Lab | Arms, mobile robots and drones in 3D | P7 · v0.7 |
| 9 | ROS Lab | ROS 2 concepts, navigation, SLAM | P8 · v0.8 |
| 10 | Gesture Control Lab | Move simulated and real robots with hand and body gestures from a live webcam | P9 · v0.9 |

The **Learning Platform** (lessons, auto-graded tasks, classrooms, English & Bangla — P10) is not a
lab. It is the layer that runs across all ten labs.

### How the labs connect
The labs share three things, so work moves between them instead of being rebuilt:

- **One project file** (`.rsim`): circuit, firmware, robot, world and lesson progress travel together.
- **One Signal Bus**: pins, wires, sensors, motors and ROS topics exchange values through the same
  typed channels, so the same firmware drives a circuit, a 2D robot or a 3D robot.
- **One model library**: a sensor or motor model is written once and used in the circuit, 2D and 3D
  labs.

```
Circuit ─▶ Microcontroller / IoT ─▶ Sensors & Actuators ─▶ 2D / 3D Robotics ─▶ ROS
                                   Control Systems · Power Electronics ─┘        ▲
                                                Gesture Control ─────────────────┘
                                         (drives 2D, 3D, ROS and real robots)
```

### 5.1 Circuit Lab — P1 · v0.1
- **Beginner:** place parts on a breadboard or schematic, wire them, read voltage and current with a
  multimeter, see current flow and LED brightness.
- **Advanced:** transient and AC analysis, semiconductors (BJT, MOSFET, op-amp), oscilloscope and
  function generator, SPICE engine (ngspice in WebAssembly), Bode plots, netlist/BOM export.
- **Must:** DC results match hand calculation within 0.1 %; RC/RL/RLC match analytic curves; beginner
  mistakes (floating node, short circuit) are explained in plain words, never shown as NaN.

### 5.2 Microcontroller Lab — P2 · v0.2
- **Beginner:** blink an LED, read a button and a potentiometer, block coding (Blockly → C++).
- **Advanced:** multi-file C++ sketches, timers, PWM, interrupts, I2C/SPI devices, serial monitor and
  plotter, logic analyser with single-step.
- **Must:** real compiled firmware runs on emulated chips (Arduino Uno/Nano/Mega, Raspberry Pi Pico)
  wired to the simulated circuit; `millis()`/`micros()` timing error < 0.1 %; common libraries
  pre-installed.

### 5.3 IoT Lab — P3 · v0.3
- **Beginner:** ESP32 GPIO, PWM and servo, a web page on the ESP32 that switches an LED.
- **Advanced:** FreeRTOS tasks on two cores, deep sleep with energy estimate, Wi-Fi, HTTP, MQTT
  (in-browser broker), Bluetooth LE with a virtual phone app, drag-and-drop IoT dashboard,
  MicroPython.
- **Must:** normal Arduino-ESP32 code compiles and runs unchanged; ESP32 traps (input-only pins,
  strapping pins, ADC2 with Wi-Fi, 5 V on 3.3 V) give teaching warnings; the lab states clearly that
  ESP32 simulation is API-level, not cycle-accurate.

### 5.4 Sensors & Actuators Lab — P4 · v0.4
- **Beginner:** read an ultrasonic sensor, drive a DC motor and a servo, light a NeoPixel ring.
- **Advanced:** register-level IMU models, encoders, load cell, steppers with microstepping, motor
  electro-mechanical dynamics; tune noise, bias, drift, quantisation and latency.
- **Must:** every model has unit tests and datasheet-range checks; the same model instance is used by
  the circuit, 2D and 3D labs.

### 5.5 2D Robotics Lab — P5 · v0.5
- **Beginner:** drive a differential-drive robot, follow a line, solve a maze.
- **Advanced:** robot builder (chassis, wheels, sensor poses), Ackermann and mecanum bases, a planar
  arm, multi-robot scenes, Python controllers, odometry vs ground truth.
- **Must:** hardware-in-the-loop — MCU pins → driver → motors → robot and world → sensors → MCU pins,
  with synchronised timing; deterministic replay for tests and challenges.

### 5.6 Control Systems Lab — P6 · v0.6
- **Beginner:** tune a PID speed controller with sliders and watch the step response.
- **Advanced:** block-diagram editor, transfer functions and state space, Bode/Nyquist/root locus,
  LQR and observers, discretisation, Python notebook (python-control), the same controller running on
  a simulated Arduino/ESP32.
- **Must:** analysis results match MATLAB on a reference set of 10 systems; animated plants (DC motor,
  cart-pole, ball-and-beam, water tank, 1-D drone).

### 5.7 Power Electronics Lab — P6 · v0.6
- **Beginner:** see PWM switching and how a buck converter steps voltage down.
- **Advanced:** buck, boost and buck-boost (switching vs averaged models, CCM/DCM), solar PV model with
  MPPT (P&O, Incremental Conductance), battery model, ESP32-controlled solar charger.
- **Must:** ripple and conversion ratios match textbook formulas; MPPT tracks the maximum power point
  under changing irradiance.

### 5.8 3D Robotics Lab — P7 · v0.7
- **Beginner:** move a robot arm with sliders, drive a rover, fly a drone with keyboard or gamepad.
- **Advanced:** forward/inverse kinematics, Jacobian and singularities, DH editor, URDF import with
  meshes, dynamics (RNEA), pick-and-place with physics, LiDAR, depth and RGB cameras, computer vision
  (OpenCV.js), quadcopter control.
- **Must:** kinematics ported from RoboSim with its known bugs fixed and tested (see `MIGRATION.md`);
  IK success rate at least as good as RoboSim; 30 fps on an 8 GB laptop.

### 5.9 ROS Lab — P8 · v0.8
- **Beginner:** see nodes and topics, echo and plot a topic, drive a robot with `/cmd_vel`.
- **Advanced:** write nodes in Python with an rclpy-like API, TF tree and RViz-style view, mapping,
  path planning (A*, RRT*, DWA), localisation and SLAM, micro-ROS concept on a virtual ESP32, export
  URDF + launch files.
- **Must:** code written here transfers to real ROS 2 with minimal changes; a bridge (rosbridge)
  streams simulated topics to a real ROS 2 install.

### 5.10 Gesture Control Lab — P9 · v0.9
- **Beginner:** turn on the webcam, see the hand and body skeleton drawn over the live video, open and
  close a simulated gripper with a pinch, move a robot arm by moving a hand.
- **Advanced:** Cartesian mode (hand → end-effector target through IK) and Mimic mode (human arm angles
  → robot joint angles), gesture driving of rovers and drones, gestures as ROS topics, real servo arms
  over USB (Web Serial) or Wi-Fi, live video of the real robot next to its 3D digital twin, recording
  demonstrations as trajectory datasets.
- **Must:**
  - **Privacy:** camera video is processed only in the browser and is never uploaded or stored unless
    the learner explicitly records and saves it.
  - **Latency:** under 100 ms from camera frame to robot command; tracking ≥ 15 fps on an 8 GB laptop.
  - **Safety:** a safety layer sits in front of every robot, simulated or real — the robot stops
    smoothly within 200 ms if the hand is lost or tracking confidence drops; speed, acceleration,
    joint and workspace limits; an always-visible e-stop. Real-hardware mode is for small, low-power
    teaching robots only.
  - Testable without a camera: CI replays recorded landmark files.

## 6. Supported boards and platforms

### 6.1 Boards (v1.0)
| Board | Languages | How it is simulated | Fidelity | Lab |
|---|---|---|---|---|
| Arduino Uno, Nano (ATmega328P) | Arduino C++, Blockly | avr8js instruction-level emulator running the real `.hex` | Cycle-accurate | Microcontroller |
| Arduino Mega 2560 | Arduino C++, Blockly | avr8js | Cycle-accurate | Microcontroller |
| Raspberry Pi Pico (RP2040) | MicroPython, Arduino C++ (arduino-pico) | rp2040js instruction-level emulator | Instruction-level | Microcontroller |
| ESP32-DevKitC (WROOM-32), ESP32-S3, ESP32-C3 | Arduino-ESP32 C++ | Our open "Virtual ESP32 Core": sketch compiled to WebAssembly against a simulated ESP32 hardware layer | API-level | IoT |
| ESP32 family | MicroPython | MicroPython WebAssembly port with our `machine` / `network` modules | API-level | IoT |
| ESP32-C3 running real ESP-IDF binaries | C (ESP-IDF) | Own RISC-V instruction-level emulator — feasibility spike on Day 69 | Planned for v2 | — |

**Fidelity levels** are shown in the UI next to every board, so learners and teachers know how far to
trust timing results: *cycle-accurate* (timing matches the real chip), *instruction-level* (real
machine code, approximate peripheral timing), *API-level* (real source code, simulated library
behaviour).

### 6.2 Real hardware (Gesture Control Lab and bridges)
| Connection | Use | Requirement |
|---|---|---|
| Web Serial (USB) | Real Arduino / ESP32 servo or stepper arm runs our open firmware and command protocol | Chrome or Edge on desktop |
| Wi-Fi WebSocket | Real ESP32 robot on the same network | Any modern browser |
| Robot camera | Live video of the real robot (ESP32-CAM MJPEG, phone camera via WebRTC, USB webcam) | Any modern browser |
| rosbridge | Simulated topics to a real ROS 2 install, or real ROS 2 robots to Studio | ROS 2 LTS (Humble or Jazzy; pinned on Day 139) via Docker / WSL / Linux |

Real hardware is always optional: every lab is complete without it.

### 6.3 Browsers and devices
| Platform | Support |
|---|---|
| Chrome, Edge (desktop, latest 2 versions) | **Full**, including Web Serial |
| Firefox, Safari (desktop, latest 2 versions) | All labs; no Web Serial (real hardware uses Wi-Fi instead) |
| Operating system | Windows, macOS, Linux, ChromeOS — anything that runs a supported browser |
| Devices | **Desktops and laptops only.** Phones and tablets are not supported |
| Minimum computer | 8 GB RAM, 4 CPU cores, integrated graphics with WebGL2 (Low-end mode switches on automatically) |
| Screen | 1366 × 768 or larger, keyboard and mouse/touchpad |
| Webcam | Any 720p webcam or laptop camera (Gesture Control Lab only) |
| Network | Needed for the first load and the compile service; loaded labs work offline |

## 7. Non-goals (v1.0)
Saying no keeps a one-person project shippable. These are **out of scope for v1.0**; some may come in v2.

1. **No phone or tablet app.** Desktops and laptops only (§6.3).
2. **Not a Gazebo / Isaac Sim replacement.** No photorealistic rendering, soft bodies or large-scale
   fluid physics.
3. **No full ROS 2 runtime in the browser.** We teach ROS concepts in the browser and connect to real
   ROS 2 through rosbridge.
4. **No PCB layout or manufacturing output.** KiCad already does this well and is free.
5. **No cycle-accurate ESP32 in v1.0.** ESP32 is API-level; real ESP-IDF binaries are a v2 research goal.
6. **No certified safety for real robots.** Gesture control of real hardware is for small, low-power
   teaching robots, not industrial arms.
7. **No paid tiers, adverts or selling user data.** Ever (§3, principle 1).
8. **No user-uploaded native code on our servers** beyond the sandboxed compile service.
9. **No languages beyond English and Bangla in v1.0** (the i18n system allows more later).

## 8. Success metrics
Targets are for **v1.0 (≈ 2027-07-27)** unless a phase is named. They are checked at every phase review.

### 8.1 Quality and accuracy (must pass before any release)
| Metric | Target |
|---|---|
| Circuit DC results vs hand calculation | error < 0.1 % on 20 reference circuits |
| Control analysis vs MATLAB | match on 10 reference systems |
| MCU timing (`millis`/`micros`) vs emulated cycles | error < 0.1 % |
| IK success rate | ≥ RoboSim on the same benchmark |
| Every example | has an automated test; CI green |
| Gesture control | < 100 ms camera-to-command; stop within 200 ms when the hand is lost |

### 8.2 Performance (8 GB laptop, integrated graphics)
| Metric | Target |
|---|---|
| First load on a 4G-speed connection | < 3 s to an interactive landing page |
| 3D scenes | ≥ 30 fps |
| Circuit editing | 60 fps with 50 parts |
| Lighthouse (landing page) | ≥ 90 performance and accessibility |

### 8.3 Adoption and learning
| Metric | Target |
|---|---|
| Beta testers (v0.10) | 20–30 students and teachers |
| Learner study (P12) | ≥ 30 participants; significant pre/post knowledge gain |
| Usability (SUS score) | ≥ 70 ("good") |
| Lessons | ≥ 20 at v1.0, in English and Bangla |
| Teachers using classroom mode | ≥ 5 at v1.0 |
| Monthly active users | ≥ 500 within 3 months of v1.0 |
| GitHub stars | ≥ 200 within 6 months of v1.0 |

### 8.4 Research and career
| Metric | Target |
|---|---|
| Citable software | Zenodo DOI + `CITATION.cff` at v1.0 |
| Paper | Submitted to a peer-reviewed venue (P12) |
| Public releases | One deployed release at the end of every phase (12 in total) |

## 9. Constraints
- **Budget:** development runs on free tools and free hosting tiers (Vercel, Render, Neon/Supabase
  free plans). The owner can spend up to **~3,000 BDT (≈ US$25) per month** when a free tier is truly
  not enough (for example compile-service hosting). Paid services are mainly for after development
  is complete (launch and scale). Any paid service needs the owner's approval first, and the code
  must not lock us into it.
- **Licences:** project is MIT; dependencies must be MIT, Apache-2.0 or BSD. Our own visual design;
  no copied assets from other products.
- **Team:** one developer working with Claude Code, 5 sessions a week (see `PLAN.md`).
- **Browser-first:** everything runs client-side except the compile service. Heavy work runs in Web
  Workers / WebAssembly.
- **Free-tier limits:** Render free instances sleep (cold start) and have little memory; the compile
  service must cache results and work around this.
- **Privacy:** no tracking beyond privacy-friendly analytics; camera video never leaves the browser;
  accounts are optional.
- **Quality bar:** TypeScript strict, lint + typecheck + tests green before every merge
  (`CLAUDE.md`).

## 10. Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Scope too large for one person (10 labs) | High | Phase reviews, non-goals (§7), each phase ships on its own, extras go to v2 |
| Simulation results wrong, learners lose trust | High | Reference tests against formulas, SPICE, MATLAB and datasheets in CI (principle 2) |
| ESP32 emulation not faithful enough | Medium | Fidelity level shown in the UI; validation suite; instruction-level ESP32 as research track |
| Gesture tracking unreliable (light, background, weak webcam) | Medium | Filtering, calibration, confidence thresholds; keyboard/gamepad always available |
| Real robot moves unsafely under gesture control | Medium | Safety layer with deadman stop, limits and e-stop, tested in CI; small teaching robots only |
| Performance on weaker laptops | Medium | Workers, lazy-loaded labs, Low-end mode, testing on an 8 GB laptop every release |
| Free-tier changes or cold starts (Render, Vercel) | Medium | Static-first design, compile cache, pre-compiled examples, easy move to other free hosts |
| Abuse of the public compile service | Medium | Sandboxed containers, no network, CPU/time limits, rate limits |
| Developer time and motivation | Medium | Small daily finish lines, visible release every 2–4 weeks, DEVLOG |
| Licence problems from dependencies | Low | Licence check in CI; MIT/Apache/BSD only |

## 11. Open questions
To be decided on the Day shown (or earlier if it blocks work).

| # | Question | Decide by |
|---|---|---|
| Q1 | Support newer boards in v1.0 — Raspberry Pi Pico 2 (RP2350), Arduino Uno R4? Depends on emulator support. | Day 44 / Day 46 |
| Q2 | Hosting for the compile service if Render's free tier is not enough (budget up to ~3,000 BDT / month, §9). | Day 36 |
| Q3 | Accounts and database: reuse RoboSim's Neon auth or use Supabase? | Day 161 |
| Q4 | Which low-cost servo arm to recommend for the real-hardware gesture demo (parts list under ~3,000 BDT)? | Day 152 |
| Q5 | Analytics tool that is free and privacy-friendly (no cookies banner needed). | Day 174 |
| Q6 | Product name for v1.0: keep "RoboSim Studio" or rename before launch? | Day 176 |
| Q7 | Target venue for the paper (journal vs conference). | Day 181 |
