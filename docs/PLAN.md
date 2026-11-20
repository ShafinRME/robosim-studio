# RoboSim Studio — Development Plan

190 work sessions ("Days") in 13 phases, 5 sessions per week (Sun–Thu) starting 2026-11-22.
Dates are targets: if a session is missed, later dates shift. Every phase ends in a deployed, tested release.

| Phase | Name | Days | Release |
|---|---|---|---|
| P0 | Foundation | 1–10 | v0.0.1 — Studio shell online |
| P1 | Circuit Lab | 11–32 | v0.1 — Circuit Lab |
| P2 | Microcontroller Lab: Arduino & Raspberry Pi Pico | 33–50 | v0.2 — Arduino & Pico |
| P3 | ESP32 & IoT Lab | 51–70 | v0.3 — ESP32 & IoT |
| P4 | Sensors & Actuators | 71–80 | v0.4 — Sensors & Actuators |
| P5 | 2D Robotics Lab | 81–95 | v0.5 — 2D Robotics |
| P6 | Control & Power Electronics Lab | 96–110 | v0.6 — Control & Power |
| P7 | 3D Robotics Lab | 111–132 | v0.7 — 3D Robotics |
| P8 | ROS Lab | 133–145 | v0.8 — ROS Lab |
| P9 | Gesture Control Lab | 146–155 | v0.9 — Gesture Control |
| P10 | Learning Platform | 156–168 | v0.10 — Public beta |
| P11 | Hardening & v1.0 Launch | 169–180 | v1.0 — Public launch |
| P12 | Research Paper & Evaluation | 181–190 | Paper submitted |

## P0 · Foundation (Days 1–10)

**Goal:** A clean, professional codebase that every later module plugs into.  
**Milestone:** v0.0.1 — Studio shell online

| Day | Date | Focus | Tasks | Done when |
|---|---|---|---|---|
| 01 | 2026-11-22 | RoboSim audit (read-only) | Read the original RoboSim repo (read-only). Inventory every module as Reuse / Refactor / Drop. Write MIGRATION.md (what moves into which package). The original RoboSim repo is never modified. | MIGRATION.md lists all 236 files with a decision |
| 02 | 2026-11-23 | Product spec | Write PRD.md: vision, target users (school, university, self-learners, teachers), the 10 labs, supported boards, non-goals, success metrics. Pick MIT license. Create the new GitHub repo robosim-studio. | PRD reviewed and committed; repo public |
| 03 | 2026-11-24 | Monorepo scaffold | pnpm workspaces + Turborepo; apps/web (Next.js 16, React 19, TS strict); packages/core, ui; ESLint, Prettier, Tailwind 4, shadcn/ui. Same versions as RoboSim so code ports cleanly. | pnpm dev runs; pnpm build passes |
| 04 | 2026-11-25 | CI/CD & quality gates | GitHub Actions: lint, typecheck, Vitest, Playwright smoke, build. Vercel preview deploy per PR. Branches: main / develop / feat/*. Conventional commits + changesets for versioning. | Green CI on a test PR with preview URL |
| 05 | 2026-11-26 | Design system | Design tokens (color, spacing, type), dark/light theme, icon set, refreshed logo, panel/toolbar/inspector components in packages/ui. | UI kit page renders all components |
| 06 | 2026-11-29 | Studio workspace shell | IDE-style layout with Dockview (dockable/tabbed panels), top bar, project tabs, status bar, command palette (Ctrl+K), keyboard shortcuts. | Panels can be docked, split, saved as layout |
| 07 | 2026-11-30 | Project model & undo/redo | core: versioned JSON project schema (Zod) with migrations; Zustand + Immer store; command pattern undo/redo. | Unit tests: 100 random edits undo back to initial state |
| 08 | 2026-12-01 | Persistence & sharing | IndexedDB (Dexie) autosave; export/import .rsim (zip via fflate); share-by-link (compressed project in URL for small projects); recent-projects screen. | Project survives reload; .rsim round-trip test passes |
| 09 | 2026-12-02 | Simulation kernel | Fixed-step scheduler (pause/step/real-time factor), Web Worker host with Comlink, typed Signal Bus (ADR-001: how pins, wires, sensors, motors exchange values). | Worker runs a 1 kHz dummy model without UI jank |
| 10 | 2026-12-03 | Low-end mode & v0.0.1 | Capability detection (WebGL2, memory, cores), Low-end mode toggle, global error boundary, landing page v0, deploy to Vercel. Phase review. | Lighthouse ≥ 90; deployed v0.0.1 |

## P1 · Circuit Lab (Days 11–32)

**Goal:** Draw and simulate real circuits (DC, transient, AC) in schematic and breadboard views.  
**Milestone:** v0.1 — Circuit Lab

| Day | Date | Focus | Tasks | Done when |
|---|---|---|---|---|
| 11 | 2026-12-06 | Circuit model ADR | Netlist data model, component interface (MNA 'stamp' + state), units and SI prefixes, error model for beginners. | ADR-002 committed |
| 12 | 2026-12-07 | Schematic canvas | React Flow canvas: grid, pan/zoom, place/rotate/flip/delete parts, multi-select. | Place 50 parts smoothly |
| 13 | 2026-12-08 | Wiring | Orthogonal wire routing, junction dots, net labels, copy/paste, drag with rubber-band wires. | Nets computed correctly in tests |
| 14 | 2026-12-09 | Parts library & inspector | Component registry (SVG symbol + model + properties), searchable parts drawer, property inspector panel. | Adding a new part = 1 file |
| 15 | 2026-12-10 | MNA solver: DC | Modified Nodal Analysis in a Worker: R, V and I sources, ground; LU solve. Tests against textbook problems. | 20 DC test circuits match hand results (<0.1%) |
| 16 | 2026-12-13 | Solver robustness | Sparse matrix solver, floating-node / short-circuit detection with friendly messages ("Pin 2 of R1 is not connected"). | Beginner errors explained, never NaN |
| 17 | 2026-12-14 | Non-linear parts | Newton–Raphson with step limiting; diode, Zener, LED (color, glow brightness from current, burn-out warning). | LED + resistor examples behave physically |
| 18 | 2026-12-15 | Transient analysis | Capacitor/inductor companion models (trapezoidal + backward Euler), adaptive time step. | RC/RL/RLC match analytic curves |
| 19 | 2026-12-16 | Instruments I | Multimeter (V/A/Ω), probes, animated current-flow dots. | Probe values update live |
| 20 | 2026-12-17 | Instruments II | Oscilloscope (uPlot, 4 channels, trigger, timebase), function generator (sine/square/tri/PWM). | Scope shows RC charging correctly |
| 21 | 2026-12-20 | Interactive parts | Switch, push button, potentiometer, LDR, thermistor, with on-canvas interaction. | Turning the pot changes voltages live |
| 22 | 2026-12-21 | Semiconductors | BJT (Ebers–Moll), MOSFET (level-1), op-amp (ideal + macro model). | Transistor switch & op-amp amplifier examples pass |
| 23 | 2026-12-22 | Output devices | DC motor (electrical + mechanical), buzzer, relay, 7-segment, RGB LED. | Motor speed follows voltage |
| 24 | 2026-12-23 | Power parts | Battery with internal resistance, 7805 and AMS1117-3.3 regulators (needed for ESP32), fuse. | 3.3 V rail example works |
| 25 | 2026-12-24 | Breadboard view | Our own breadboard visual style; breadboard connectivity model (rails, rows). | Parts snap to holes, nets correct |
| 26 | 2026-12-27 | View sync | Single netlist shared by schematic and breadboard; editing one updates the other. | Round-trip tests pass |
| 27 | 2026-12-28 | Polish | Wire colors, part artwork (SVG), pin-name tooltips, datasheet links. | UX review checklist done |
| 28 | 2026-12-29 | SPICE engine | ngspice compiled to WebAssembly: netlist export, DC sweep, AC analysis, Bode plot. | Same circuit: MNA vs SPICE agree |
| 29 | 2026-12-30 | Export | SPICE netlist, schematic PNG/SVG, BOM CSV. | Exports open in LTspice/KiCad viewers |
| 30 | 2026-12-31 | Example gallery | 15 example circuits (Ohm's law → op-amp filter), each with an automated validation test. | All examples tested in CI |
| 31 | 2027-01-03 | Cross-device test | Chrome, Edge, Firefox, Safari on Windows, macOS and Linux; 8 GB RAM laptop with integrated graphics. Fix performance issues. | 60 fps editing on low-end laptop |
| 32 | 2027-01-04 | Release v0.1 | Changelog, docs page, tag release, deploy. Phase review & plan adjustment. | v0.1 live |

## P2 · Microcontroller Lab: Arduino & Raspberry Pi Pico (Days 33–50)

**Goal:** Real compiled firmware runs on emulated chips wired to the simulated circuit.  
**Milestone:** v0.2 — Arduino & Pico

| Day | Date | Focus | Tasks | Done when |
|---|---|---|---|---|
| 33 | 2027-01-05 | MCU architecture ADR | Board definition format (JSON: pins, voltage, peripherals), pin↔net bridge (output impedance, input thresholds), MCU–circuit co-simulation timing. | ADR-003 committed |
| 34 | 2027-01-06 | avr8js integration | ATmega328P emulator in a Worker; load .hex; run/pause/reset; GPIO port listeners. | Pre-built blink.hex blinks an LED in the circuit |
| 35 | 2027-01-07 | Pin bridge | Digital in/out, INPUT_PULLUP, 5 V logic levels, current limits with warnings. | Button + LED example works |
| 36 | 2027-01-10 | Compile service v1 | Docker image with arduino-cli (AVR core); POST /compile; cache by source hash; time/memory limits; rate limiting. Deploy on Render (free). | Compile in <10 s warm; cached in <1 s |
| 37 | 2027-01-11 | Code editor | Monaco with Arduino C++ highlighting, multi-file sketches, compiler errors shown on the right lines. | Error click jumps to line |
| 38 | 2027-01-12 | Serial | Serial monitor (send/receive), serial plotter. | Serial.println + plotter work |
| 39 | 2027-01-13 | Timers & PWM | analogWrite PWM → circuit, tone(), Timer0/1/2 behaviour. | LED brightness & motor speed via PWM |
| 40 | 2027-01-14 | ADC | analogRead samples the circuit node voltage (10-bit, AREF). | Potentiometer reading matches meter |
| 41 | 2027-01-17 | Interrupts & timing | attachInterrupt, millis/micros accuracy tests against emulator cycles. | Timing error < 0.1% |
| 42 | 2027-01-18 | I2C/SPI devices | Virtual device framework (register-level models); SSD1306 OLED rendered on canvas. | Adafruit OLED example shows text |
| 43 | 2027-01-19 | Libraries | Pre-installed common libraries (Servo, Wire, SPI, LiquidCrystal_I2C, Adafruit GFX/SSD1306); library list UI. | 10 library examples compile |
| 44 | 2027-01-20 | More boards | Arduino Nano, Arduino Mega 2560 board definitions. | Same sketch runs on all 3 boards |
| 45 | 2027-01-21 | Logic analyzer | Pin timeline / logic analyzer panel, pin-state inspector, pause & single-step. | Decode a PWM signal visually |
| 46 | 2027-01-24 | Raspberry Pi Pico | rp2040js + MicroPython firmware: REPL, file editor, machine.Pin/PWM/ADC. | MicroPython blink runs with no server |
| 47 | 2027-01-25 | Pico Arduino | arduino-pico core added to compile service. | C++ sketch runs on Pico |
| 48 | 2027-01-26 | Block coding | Blockly mode that generates Arduino C++ (for school students). | Blocks → code → runs |
| 49 | 2027-01-27 | Examples & tests | 20 example sketches with golden pin-trace tests in CI. | All traces match |
| 50 | 2027-01-28 | Release v0.2 | Docs, changelog, deploy, phase review. | v0.2 live |

## P3 · ESP32 & IoT Lab (Days 51–70)

**Goal:** Write normal Arduino-ESP32 or MicroPython code and simulate GPIO, PWM, ADC, FreeRTOS, Wi-Fi, HTTP, MQTT and BLE in the browser.  
**Milestone:** v0.3 — ESP32 & IoT

| Day | Date | Focus | Tasks | Done when |
|---|---|---|---|---|
| 51 | 2027-01-31 | ESP32 strategy ADR + spike | Map the Arduino-ESP32 API surface used by beginners/intermediates; prove the toolchain: sketch → Emscripten → WebAssembly with Asyncify (JSPI where supported) so delay() and loop() work. | Hello-world sketch prints to Serial in browser |
| 52 | 2027-02-01 | Virtual ESP32 core | Our own open implementation of Arduino.h for ESP32 (setup/loop runner, millis, delay, yield). New Docker image for the compile service. | Blink sketch compiles & runs |
| 53 | 2027-02-02 | ESP32 board & GPIO | ESP32-DevKitC (WROOM-32) pin map; 3.3 V logic; input-only pins 34–39; strapping-pin and 5 V-on-3.3 V warnings. | Wrong wiring gives a teaching warning |
| 54 | 2027-02-03 | LEDC PWM & servo | LEDC channels (frequency/resolution), analogWrite compatibility, ESP32Servo. | Servo sweep example works |
| 55 | 2027-02-04 | ADC, DAC, touch | 12-bit ADC with attenuation & non-linearity model; ADC2-vs-Wi-Fi conflict warning; DAC on 25/26; capacitive touch pins. | ADC curve matches datasheet shape |
| 56 | 2027-02-07 | UART | Serial, Serial1/Serial2 with custom pins; reuse serial monitor/plotter. | Two-UART example works |
| 57 | 2027-02-08 | I2C/SPI on ESP32 | Wire/SPI bound to the shared virtual-device framework: OLED, MPU-6050, BME280. | Weather-station example shows data |
| 58 | 2027-02-09 | FreeRTOS | xTaskCreate / PinnedToCore, vTaskDelay, queues, semaphores, mutexes; dual-core task timeline panel. | Producer/consumer tasks example correct |
| 59 | 2027-02-10 | Interrupts, timers, sleep | attachInterrupt, hardware timers, deep/light sleep with wake sources, and an energy-consumption estimate panel. | Battery-life estimate shown for sleep example |
| 60 | 2027-02-11 | Virtual network | Virtual Wi-Fi access points, WiFi.begin/status/RSSI/IP, Wi-Fi events. | Connect/disconnect events fire |
| 61 | 2027-02-14 | HTTP | WebServer on the ESP32 opened in a 'Device Browser' panel; HTTPClient to sandboxed mock APIs. | ESP32 web page toggles an LED |
| 62 | 2027-02-15 | MQTT | In-browser MQTT broker + PubSubClient; optional opt-in bridge to a public broker over WebSocket. | Two ESP32s talk over MQTT |
| 63 | 2027-02-16 | IoT dashboard | Drag-and-drop dashboard (gauges, switches, charts) bound to MQTT topics. | Solar-monitor dashboard example |
| 64 | 2027-02-17 | Bluetooth LE | BLE peripheral: advertising, services, characteristics; a virtual phone app panel to read/write. | BLE LED-control example |
| 65 | 2027-02-18 | MicroPython on ESP32 | MicroPython WebAssembly port with machine/network modules bound to the virtual ESP32 (no server needed). | MicroPython Wi-Fi + MQTT example |
| 66 | 2027-02-21 | ESP32-S3 & ESP32-C3 | Board definitions, pin maps and capability differences. | Same sketch on 3 ESP32 boards |
| 67 | 2027-02-22 | ESP32 project gallery | 20 projects: smart home, weather station, MQTT dashboard, solar power monitor, BLE sensor, web-controlled robot. | All run in CI |
| 68 | 2027-02-23 | Validation & limits | Behaviour tests against datasheet/real-board notes; document clearly what is API-level (not cycle-accurate). | Limits page published |
| 69 | 2027-02-24 | Research spike: real ESP32 binaries | Feasibility of an instruction-level ESP32-C3 (RISC-V RV32IMC) emulator in TypeScript/WASM running real ESP-IDF binaries. Go / no-go for v2. | Spike report with decision |
| 70 | 2027-02-25 | Release v0.3 | Docs, changelog, deploy, phase review. | v0.3 live |

## P4 · Sensors & Actuators (Days 71–80)

**Goal:** Realistic sensor and actuator models shared by circuit, 2D and 3D labs.  
**Milestone:** v0.4 — Sensors & Actuators

| Day | Date | Focus | Tasks | Done when |
|---|---|---|---|---|
| 71 | 2027-02-28 | Sensor model framework | Noise, bias, drift, quantization, latency, sample-rate parameters for every sensor. | Same model used in 2D & 3D later |
| 72 | 2027-03-01 | Distance & line | HC-SR04 (real echo-pulse timing), IR distance, IR line-sensor array. | pulseIn() reads correct distance |
| 73 | 2027-03-02 | IMU | MPU-6050 / ICM-20948 register-level models, magnetometer; noise & bias. | Raw IMU data matches datasheet ranges |
| 74 | 2027-03-03 | Encoders & force | Quadrature encoders, limit switches, load cell + HX711. | Weighing-scale example |
| 75 | 2027-03-04 | Motors & drivers | DC motor + gearbox + load (electro-mechanical ODE), L298N & TB6612 drivers, servo dynamics. | Step response looks physical |
| 76 | 2027-03-07 | Steppers | Stepper motor + A4988/DRV8825 (microstepping). | AccelStepper example |
| 77 | 2027-03-08 | Displays & input | LCD1602 I2C, WS2812 NeoPixel (incl. ESP32 RMT), keypad, joystick. | NeoPixel ring animates |
| 78 | 2027-03-09 | Environment & power sensors | DHT22, BME280, soil moisture, gas, INA219 current sensor. | Examples for each |
| 79 | 2027-03-10 | Tests & examples | Unit tests for every model; 10 new examples. | CI green |
| 80 | 2027-03-11 | Release v0.4 | Docs, changelog, deploy, phase review. | v0.4 live |

## P5 · 2D Robotics Lab (Days 81–95)

**Goal:** Firmware or Python drives a 2D robot through motors and sensors in a physics world.  
**Milestone:** v0.5 — 2D Robotics

| Day | Date | Focus | Tasks | Done when |
|---|---|---|---|---|
| 81 | 2027-03-14 | sim2d architecture | Rapier 2D physics in a Worker, PixiJS (WebGL) renderer, entity-component model. | 1,000 bodies at 60 fps |
| 82 | 2027-03-15 | World editor | Walls, obstacles, line tracks, floor textures, save/load worlds. | Maze built in 5 minutes |
| 83 | 2027-03-16 | Differential-drive robot | Wheel/motor dynamics, friction, slip, battery sag. | Robot drives straight/curves realistically |
| 84 | 2027-03-17 | Robot builder | Chassis, wheels, sensor placement with mounting poses. | Custom robot saved in project |
| 85 | 2027-03-18 | Hardware-in-the-loop | THE key link: MCU pins → driver → motors → robot; world → sensors → MCU pins. Synchronised timing. | Arduino & ESP32 code moves the robot |
| 86 | 2027-03-21 | Ranging sensors | Ultrasonic cone, IR beam, 2D LiDAR via raycasts. | Obstacle-avoider example |
| 87 | 2027-03-22 | Line sensors & odometry | Line sensors read floor texture; encoders from wheel rotation. | Line-follower example |
| 88 | 2027-03-23 | Python controllers | Pyodide controller mode as alternative to firmware. | Same robot, Python PID |
| 89 | 2027-03-24 | Plots & traces | Path trace, odometry vs ground truth, data export CSV. | Drift visible and exportable |
| 90 | 2027-03-25 | More robots | Ackermann car, omni/mecanum base, 2-link planar arm. | Each with example |
| 91 | 2027-03-28 | Challenges | Maze, line race, mini-sumo: scoring, timer, replay. | Challenge replay works |
| 92 | 2027-03-29 | Multi-robot | Several robots, each with its own MCU. | Two robots in one world |
| 93 | 2027-03-30 | Examples & tests | 15 robot examples; deterministic replay tests in CI. | CI green |
| 94 | 2027-03-31 | Performance | Low-end tuning, physics rate control. | 30 fps on 8 GB laptop |
| 95 | 2027-04-01 | Release v0.5 | Docs, changelog, deploy, phase review. | v0.5 live |

## P6 · Control & Power Electronics Lab (Days 96–110)

**Goal:** Simulink-style control design and power-converter simulation, linked to real firmware.  
**Milestone:** v0.6 — Control & Power

| Day | Date | Focus | Tasks | Done when |
|---|---|---|---|---|
| 96 | 2027-04-04 | Block-diagram editor | Sources, gain, sum, integrator, derivative, transfer function, state-space, saturation, delay, scope. | Closed-loop diagram builds |
| 97 | 2027-04-05 | ODE engine | RK4, adaptive RK45, stiff fallback; algebraic-loop detection. | Matches reference solutions |
| 98 | 2027-04-06 | Python notebook | Pyodide cells with NumPy/SciPy and python-control; plots inline. | python-control step() works in browser |
| 99 | 2027-04-07 | Analysis tools | Step/impulse, Bode, Nyquist, root locus, pole-zero map. | Matches MATLAB results on 10 systems |
| 100 | 2027-04-08 | PID | PID block, anti-windup, Ziegler–Nichols & relay auto-tune, live tuning sliders. | Motor speed PID tuned live |
| 101 | 2027-04-11 | Plant library | DC motor, mass-spring-damper, cart-pole, ball-and-beam, water tank, 1-D drone. | Each plant validated |
| 102 | 2027-04-12 | Animations | Animated plant views synced to simulation. | Cart-pole animates |
| 103 | 2027-04-13 | Modern control | State-space, LQR, Luenberger observer, discretization (ZOH), sample-time effects. | LQR balances cart-pole |
| 104 | 2027-04-14 | Digital control on MCU | Run the same controller on Arduino/ESP32 in the loop (quantization, sample rate, jitter). | Compare ideal vs MCU control |
| 105 | 2027-04-15 | Power switching basics | Ideal/lossy switch, PWM generator, dead-time. | Half-bridge example |
| 106 | 2027-04-18 | DC/DC converters | Buck, boost, buck-boost; switching vs averaged model; CCM/DCM. | Ripple matches formulas |
| 107 | 2027-04-19 | Solar PV & MPPT | Single-diode PV model (irradiance/temperature), MPPT: P&O and Incremental Conductance. | MPPT tracks max power |
| 108 | 2027-04-20 | Battery & per-unit | Thevenin battery model, solar charger with ESP32 control, per-unit scaling demo. | Solar charger example |
| 109 | 2027-04-21 | Examples & tests | 15 control/power examples, analytic tests. | CI green |
| 110 | 2027-04-22 | Release v0.6 | Docs, changelog, deploy, phase review. | v0.6 live |

## P7 · 3D Robotics Lab (Days 111–132)

**Goal:** Gazebo-style 3D physics with arms, mobile robots, drones and sensors, reusing RoboSim's proven kinematics.  
**Milestone:** v0.7 — 3D Robotics

| Day | Date | Focus | Tasks | Done when |
|---|---|---|---|---|
| 111 | 2027-04-25 | sim3d architecture | React Three Fiber + Rapier 3D; entity-component scene; physics in Worker. | Scene with 200 bodies at 60 fps |
| 112 | 2027-04-26 | Scene editor | Primitives, GLTF/STL/OBJ import, transform gizmo, materials, lighting presets. | Build a table-top scene |
| 113 | 2027-04-27 | Port FK | Move RoboSim forward kinematics to packages/kinematics: no Three.js types, radians internally, strict types. | FK tests on UR5/SCARA known poses |
| 114 | 2027-04-28 | Port IK & Jacobian | DLS IK with multi-start seeds, Jacobian, manipulability, singularity detection. | IK success-rate benchmark ≥ RoboSim |
| 115 | 2027-04-29 | Port trajectory, DH, URDF | Trajectory profiles, DH editor, URDF parser with meshes; upgrade dynamics to RNEA. | UR5 URDF with meshes loads |
| 116 | 2027-05-02 | Articulated physics | Rapier multibody joints, joint motors, PD control, torque limits. | Arm holds pose against gravity |
| 117 | 2027-05-03 | Arms & grasping | UR5, SCARA, planar arms, physical gripper, pick-and-place sequencer. | Pick-and-place with physics |
| 118 | 2027-05-04 | Mobile robots & drones | 3D diff-drive, Ackermann, quadrotor dynamics. | Each drivable |
| 119 | 2027-05-05 | 3D sensors | 2D/3D LiDAR (point cloud), depth & RGB cameras, IMU, GPS, contact. | Point cloud visible |
| 120 | 2027-05-06 | Controllers | Arduino/ESP32 firmware or Python drives 3D robots through the same Signal Bus. | ESP32 drives a 3D rover |
| 121 | 2027-05-09 | Environments | Warehouse, maze, home, farm, outdoor terrain. | 5 worlds |
| 122 | 2027-05-10 | Teleop | Keyboard and gamepad control. | Gamepad drives robot |
| 123 | 2027-05-11 | Record & replay | Recording, replay, CSV/JSON export; port Python-notebook generator. | Notebook reproduces plots |
| 124 | 2027-05-12 | Computer vision | OpenCV.js in Worker: color tracking, ArUco markers. | Robot follows a colored ball |
| 125 | 2027-05-13 | Quadcopter control | Cascaded PID, attitude estimation (complementary filter). | Stable hover & waypoint |
| 126 | 2027-05-16 | MuJoCo spike | Evaluate MuJoCo WebAssembly for research-grade contacts. Go / no-go. | Spike report |
| 127 | 2027-05-17 | Performance | Instancing, LOD, shadow quality tiers, optional WebGPU renderer flag. | 30 fps on 8 GB laptop |
| 128 | 2027-05-18 | Benchmarks port | IK, workspace, smoothness, manipulability benchmark suite. | JSON reports |
| 129 | 2027-05-19 | Examples | 15 3D examples. | All load in < 3 s |
| 130 | 2027-05-20 | Visual tests | Playwright screenshot tests for 3D scenes. | CI green |
| 131 | 2027-05-23 | Cross-device test | Browsers, desktops and laptops (Windows, macOS, Linux). | Issues fixed |
| 132 | 2027-05-24 | Release v0.7 | Docs, changelog, deploy, phase review. | v0.7 live |

## P8 · ROS Lab (Days 133–145)

**Goal:** Learn ROS 2 concepts in the browser, then connect to real ROS 2.  
**Milestone:** v0.8 — ROS Lab

| Day | Date | Focus | Tasks | Done when |
|---|---|---|---|---|
| 133 | 2027-05-25 | ROS-lite ADR | Graph model (nodes, topics, services, actions, params), ROS 2 standard message types, simplified QoS. | ADR-004 committed |
| 134 | 2027-05-26 | Middleware | Pub/sub, services, actions, parameters, /clock sim time — in a Worker. | Unit tests pass |
| 135 | 2027-05-27 | TF & visualizer | TF2 tree + RViz-style 3D panel (markers, point clouds, paths, frames). | TF tree of UR5 shown |
| 136 | 2027-05-30 | rclpy-lite | Write nodes in Python (Pyodide) with an rclpy-like API, so code transfers to real ROS 2. | Talker/listener runs |
| 137 | 2027-05-31 | Tools | Node graph (rqt_graph-like), topic echo, topic plot. | Graph updates live |
| 138 | 2027-06-01 | Standard topics | /cmd_vel, /odom, /scan, /imu, /joint_states, /camera for all robots. | Teleop via /cmd_vel |
| 139 | 2027-06-02 | Real ROS 2 bridge | roslibjs ↔ rosbridge_suite: stream sim topics to a real ROS 2 install (Docker/WSL guide). | RViz2 on PC shows sim LiDAR |
| 140 | 2027-06-03 | ESP32 + micro-ROS concept | Virtual ESP32 publishes/subscribes ROS topics. | ESP32 node in graph |
| 141 | 2027-06-06 | Export | URDF + launch-file export (port RoboSim generator). | Exported package builds in ROS 2 |
| 142 | 2027-06-07 | Navigation | Occupancy-grid mapping, A*, Dijkstra, RRT/RRT*, DWA local planner. | Robot navigates maze |
| 143 | 2027-06-08 | Localization & SLAM | EKF, particle filter (AMCL-lite), scan-matching SLAM demo. | Map built while driving |
| 144 | 2027-06-09 | Examples & tests | 10 ROS examples. | CI green |
| 145 | 2027-06-10 | Release v0.8 | Docs, changelog, deploy, phase review. | v0.8 live |

## P9 · Gesture Control Lab (Days 146–155)

**Goal:** Move simulated and real robot arms, mobile robots and drones in real time with hand and body gestures from a webcam.  
**Milestone:** v0.9 — Gesture Control

| Day | Date | Focus | Tasks | Done when |
|---|---|---|---|---|
| 146 | 2027-06-13 | Gesture lab ADR | Pipeline: webcam → landmark model → filter → gesture/pose → mapping → safety layer → target (sim robot, real robot or ROS topic). Latency budget (< 100 ms camera-to-motion), privacy rule (video is processed only in the browser, never uploaded), Low-end fallback. | ADR-005 committed |
| 147 | 2027-06-14 | Live video & tracking | getUserMedia camera picker; MediaPipe Tasks Vision (Apache-2.0) Hand + Pose Landmarker running in a Worker (WASM/WebGL); live skeleton overlay on the video; FPS and latency meter; Low-end mode (lower resolution, hands only). | 21 hand + 33 body landmarks tracked live at ≥ 15 fps on an 8 GB laptop |
| 148 | 2027-06-15 | Gestures & calibration | One Euro filter for smooth, low-lag landmarks; calibration (neutral pose, arm length, camera distance); static gestures (open hand, fist, pinch, point) and dynamic gestures (swipe, circle); confidence thresholds. | Gesture recogniser ≥ 95% on a recorded test set |
| 149 | 2027-06-16 | Arm teleoperation | Two modes: Cartesian (hand position → end-effector target via the IK from Day 114) and Mimic (shoulder/elbow/wrist angles → robot joint angles). Pinch → gripper; workspace scaling; clutch gesture to re-centre. | Pick-and-place with gestures on the 3D UR5 and a 4-DOF servo arm |
| 150 | 2027-06-17 | Mobile robots, drones & ROS | Body/hand pose → /cmd_vel for 2D and 3D mobile robots; gesture commands for the quadcopter (take off, land, move, hover); gestures published as ROS topics (/gesture, /cmd_vel, /joint_trajectory). | Rover and drone driven by gestures; topics visible in the ROS Lab |
| 151 | 2027-06-20 | Safety layer | Deadman rule (hand lost or low confidence → smooth stop), velocity/acceleration/joint limits, virtual workspace fence, e-stop key and on-screen e-stop, rate limiting of commands. Unit tests for every rule. | All safety tests pass; robot stops within 200 ms when the hand leaves the frame |
| 152 | 2027-06-21 | Real robot bridge | Web Serial (Chrome/Edge) to Arduino/ESP32 servo or stepper arms with our open firmware and command protocol; ESP32 over Wi-Fi WebSocket; same safety layer for real hardware; end-to-end latency measurement. | A real low-cost servo arm follows the hand in real time |
| 153 | 2027-06-22 | Real-time robot video & digital twin | Second video stream of the real robot (ESP32-CAM MJPEG, phone camera via WebRTC, or USB webcam) shown next to the simulated twin; twin follows the real joint feedback; real ROS 2 robots via rosbridge (Day 139). | Gesture video, robot video and 3D twin run side by side in one workspace |
| 154 | 2027-06-23 | Record, replay & tests | Record gesture sessions as robot trajectories; replay on sim or real robot; export CSV/JSON datasets (learning-from-demonstration). CI uses recorded landmark files instead of a camera. 8 gesture examples. | CI green with recorded-landmark tests |
| 155 | 2027-06-24 | Release v0.9 | Docs (including a low-cost servo-arm build guide and camera privacy note), changelog, deploy, phase review. | v0.9 live |

## P10 · Learning Platform (Days 156–168)

**Goal:** Turn the labs into a structured course with lessons, tasks, accounts and classrooms.  
**Milestone:** v0.10 — Public beta

| Day | Date | Focus | Tasks | Done when |
|---|---|---|---|---|
| 156 | 2027-06-27 | Lesson engine | MDX lessons with embedded live labs, step validation, local progress. | Sample lesson works offline |
| 157 | 2027-06-28 | Port RoboSim tutorials | Move the 10 existing tutorials into the new format. | 10 lessons live |
| 158 | 2027-06-29 | Curriculum map | Tracks: Electronics → Arduino → ESP32/IoT → Robots → Control → Power → 3D → ROS → Gesture Control → Advanced. | Course map page |
| 159 | 2027-06-30 | Auto-graded tasks | Quiz engine + task checks (pin traces, robot position, controller performance). | Tasks grade automatically |
| 160 | 2027-07-01 | Guided tours | Port spotlight tours to new UI. | 3 tours |
| 161 | 2027-07-04 | Optional accounts | Reuse RoboSim's Neon auth (scrypt, sessions); cloud save; public project gallery. Labs still work without login. | Login optional, tested |
| 162 | 2027-07-05 | Classroom mode | Teachers create classes and assignments, view submissions. | End-to-end class test |
| 163 | 2027-07-06 | Certificates | Port PDF certificate generator. | Certificate downloads |
| 164 | 2027-07-07 | Bangla + English | i18n for UI and lessons. | Language switch |
| 165 | 2027-07-08 | Accessibility | WCAG 2.1 AA audit, keyboard navigation, screen-reader labels. | Audit issues fixed |
| 166 | 2027-07-11 | Documentation site | User guide, developer docs, component-authoring guide (Fumadocs). | docs site live |
| 167 | 2027-07-12 | Flagship lessons | 10 new lessons covering ESP32, robots, control. | 20 lessons total |
| 168 | 2027-07-13 | Release v0.10 beta | Invite 20–30 beta testers (students, juniors, teachers). | Beta live |

## P11 · Hardening & v1.0 Launch (Days 169–180)

**Goal:** Production quality: fast, secure, documented, open-source ready.  
**Milestone:** v1.0 — Public launch

| Day | Date | Focus | Tasks | Done when |
|---|---|---|---|---|
| 169 | 2027-07-14 | Beta triage | Collect and prioritise feedback (GitHub issues). | Prioritised backlog |
| 170 | 2027-07-15 | Bug-fix sprint 1 | Top-priority bugs. | P0 bugs = 0 |
| 171 | 2027-07-18 | Bug-fix sprint 2 | Remaining P1 bugs. | P1 bugs = 0 |
| 172 | 2027-07-19 | Performance budget | Lazy-load each lab and WASM, bundle splitting, Lighthouse. | First load < 3 s on 4G |
| 173 | 2027-07-20 | Security | Compile-service sandbox (no network, CPU/memory/time limits), CSP, rate limits, dependency audit. | Security checklist passed |
| 174 | 2027-07-21 | Observability | Sentry (free), Vercel Analytics, uptime monitor + keep-warm for Render. | Alerts working |
| 175 | 2027-07-22 | Open-source readiness | CONTRIBUTING, Code of Conduct, issue/PR templates, plugin API docs. | First external PR possible |
| 176 | 2027-07-25 | Professional website | Landing page, demos, screenshots, CITATION.cff, Zenodo DOI. | Citable software |
| 177 | 2027-07-26 | Launch assets | Demo video, screenshots, README, press kit. | Assets ready |
| 178 | 2027-07-27 | v1.0 release | Tag, deploy, announce. | v1.0 live |
| 179 | 2027-07-28 | Post-launch fixes | Hotfixes from launch traffic. | Stable |
| 180 | 2027-07-29 | Retrospective | What worked, roadmap v2 (instruction-level ESP32, MuJoCo, humanoids, RL). | ROADMAP-v2.md |

## P12 · Research Paper & Evaluation (Days 181–190)

**Goal:** Turn the software into a peer-reviewed publication — the strongest signal for PhD offers.  
**Milestone:** Paper submitted

| Day | Date | Focus | Tasks | Done when |
|---|---|---|---|---|
| 181 | 2027-08-01 | Study design | Pre/post knowledge test + usability survey (SUS) for beta users; ethics/consent form. | Study protocol |
| 182 | 2027-08-02 | Run study | Collect data from learners (target ≥ 30). | Data collected |
| 183 | 2027-08-03 | Technical evaluation | Solver accuracy vs SPICE/MATLAB, timing accuracy of MCU emulation, gesture-control latency and tracking accuracy, performance across devices. | Tables & figures |
| 184 | 2027-08-04 | Paper: intro & related work | Position vs Tinkercad, Wokwi, Gazebo, Webots, CoppeliaSim. | Sections drafted |
| 185 | 2027-08-05 | Paper: architecture | Signal Bus, co-simulation, ESP32 API-level emulation, browser-only gesture teleoperation with a safety layer, browser-only design. | Section drafted |
| 186 | 2027-08-08 | Paper: results | Study + technical results, limitations. | Section drafted |
| 187 | 2027-08-09 | Paper: polish | Abstract, figures, references (IEEE format). | Full draft |
| 188 | 2027-08-10 | Review | Ask a senior researcher to review; revise. | Revised draft |
| 189 | 2027-08-11 | arXiv + submission | Submit to IEEE Trans. on Education / Computer Applications in Engineering Education / IEEE FIE. | Submitted |
| 190 | 2027-08-12 | Hand-off to content phase | Start the weekly lesson series built on v1.0. | Season 1 calendar ready |

