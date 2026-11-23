---
title: RoboSim Studio — User Manual
version: 0.0.0
updated: 2026-11-22
---

# About this manual

This manual explains **what every screen, button and tool in RoboSim Studio does and how to use it**.
It grows together with the software: each feature is added here on the Day it is built and tested.

- **Software version covered:** v0.0.0 (Phase 0 — Foundation)
- **Last updated:** 2026-11-23 (Day 07)
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

![The home page (dark theme)](images/home-page.png)

The home page is the first screen you see. In v0.0.0 it is a **preview page** that confirms the
software is running and leads you to the studio.

| Part of the screen | What it does |
|---|---|
| **Logo** (cube with X/Y/Z arrows and a copper gear) | The RoboSim Studio logo — a robot's coordinate frame and servo joint inside a 3D simulation world. The same picture is the icon in your browser tab. |
| **RoboSim Studio** title | Shows the name of the software. |
| **Open the studio** | Opens the studio workspace (chapter 7). |
| **UI kit** | Opens the design preview page with all controls (chapters 4–6). |
| Grid of 10 labs | Lists the labs in release order (P1 = phase 1, and so on). Not clickable yet. |
| Footer line | Shows the software version and the current development phase. |

# 4. Appearance: light and dark themes

![Theme switcher (top right) and the UI kit in the dark theme](images/theme-dark.png)

RoboSim Studio has a **dark** theme (the default — easier on the eyes during long sessions and it makes
circuits and plots stand out) and a **light** theme (good for classrooms, projectors and printing).

**How to change the theme**

1. Find the **SYSTEM · LIGHT · DARK** switch (top right of the page).
2. Click **LIGHT** or **DARK**. The whole page changes at once.
3. Click **SYSTEM** to follow your computer's own light/dark setting automatically.

![The same page in the light theme](images/theme-light.png)

| Option | What happens |
|---|---|
| **System** | Uses your operating system's setting and follows it if it changes. |
| **Light** | Light grey workspace with white panels. |
| **Dark** | Deep graphite workspace with a teal accent (default). |

- Your choice is **remembered** on this computer and browser, even after closing it.
- **Keyboard:** press **Tab** to reach the switch, then **←** / **→** to change the theme.

# 5. Entering values (engineering number fields)

![An engineering number field: 4.7 kΩ entered, current calculated live](images/number-field.png)

Wherever you set a value with a unit — resistance, voltage, frequency, capacitance — RoboSim Studio
uses an **engineering number field**. You can type values the way engineers write them.

**Typing a value**

1. Click in the field and type the value, e.g. `4.7k`.
2. Press **Enter** (or click somewhere else). The field shows it neatly as **4.7 k** and the unit (Ω).
3. Everything that depends on the value updates immediately (in the example, the current).

**SI prefixes you can type**

| Type | Means | Example | Value |
|---|---|---|---|
| `p` | pico, × 10⁻¹² | `22p` | 22 pF |
| `n` | nano, × 10⁻⁹ | `100n` | 100 nF |
| `u` or `µ` | micro, × 10⁻⁶ | `4.7u` | 4.7 µF |
| `m` | milli, × 10⁻³ | `20m` | 20 mA |
| `k` | kilo, × 10³ | `4.7k` | 4 700 Ω |
| `M` or `meg` | mega, × 10⁶ | `1M` | 1 000 000 Ω |
| `G` | giga, × 10⁹ | `2.4G` | 2.4 GHz |

Small **m** is milli and capital **M** is mega. Normal numbers (`220`, `3.3`) and scientific notation
(`2.2e-6`) also work.

**Keys**

| Key | Action |
|---|---|
| **↑** / **↓** | Increase / decrease by one step |
| **Shift** + **↑** / **↓** | Change by ten steps |
| **Enter** | Accept the typed value |
| **Esc** | Cancel typing and go back to the previous value |

The small **▲ / ▼** buttons on the right of the field do the same as the arrow keys.

**If you type something that is not a number** (for example `abc`), the field turns **red** and the
old value is kept, so a wrong entry can never break a simulation. Correct the text or press **Esc**.

# 6. The workspace: panels, toolbar and inspector

![A workspace preview: Parts panel, canvas with toolbar, and Inspector](images/workspace.png)

RoboSim Studio's labs are built from three kinds of building blocks. In v0.0.0 you can try them in a
small LED-circuit preview on the UI kit page (`/ui-kit` → **Workspace**). The studio itself is described
in chapter 7.

**Panels** are the boxes that hold each tool (parts list, inspector, oscilloscope…).

| Part of a panel | What it does |
|---|---|
| Title bar | Panel name in capitals, with an icon. A small grey number or text next to it gives extra info (e.g. how many parts). |
| Buttons on the right of the title bar | Actions for that panel, e.g. **+** to add a part. |
| Bottom line | Status of the panel, e.g. the current tool, grid size and number of warnings. |

**The toolbar** sits above the canvas.

| Control | What it does |
|---|---|
| **Select / Wire / Pan** (arrow, curve, hand) | Choose the mouse tool. Only one can be active; it lights up in teal. |
| **Run / Pause** (▶ / ⏸) | Start or pause the simulation. While running, the badge shows **LIVE** with a blinking light and current flows along the wires. |
| **Step** (▷|) | Advance the simulation by one step (when paused). |
| **Reset** (↺) | Return to the starting values. |
| **Zoom − / +** and the % value | Zoom the canvas out or in. |

- **Hover** over any tool to see its name and keyboard shortcut (e.g. **Wire W**).
- **Keyboard:** press **Tab** to enter the toolbar, then use **←** / **→** to move between tools and
  **Enter** to use one.

**The inspector** shows the properties of the selected part.

1. Click a part in the **Parts** panel or on the canvas — it is highlighted with a dashed teal frame.
2. Change its properties in the **Inspector** (name, value, rating, position, rotation, label).
3. Click a section title (**▸ COMPONENT**, **▸ TRANSFORM**…) to fold or unfold it.
4. The **Live simulation** section shows results in teal (current, voltage, power). If a value is
   dangerous — for example a resistor's power is above its rating — it turns **red** and the canvas
   status line shows a **warning**. This teaches the safe limits of real parts.

# 7. The studio workspace

![The studio: top bar, project tabs, four panels and the status bar](images/studio-overview.png)

The studio is where you will build and simulate. Open it with **Open the studio** on the home page
(or go to `/studio`). In v0.0.0 the panels are still empty — each lab fills them in later versions —
but you can already arrange the workspace the way you like.

## 7.1 Parts of the window

| Part | What it does |
|---|---|
| **Top bar** | Logo, the **File · Edit · View · Help** menus, the simulation buttons, **Search commands…** and the theme switch. |
| **Simulation buttons** (▶ ⏸ ⏭ ■) | Run, Pause, Step and Stop. Greyed out until a lab can run a simulation. |
| **Project tabs** | One tab per open project. **+** adds a new one. |
| **Explorer** (left) | Will list the files and parts of your project. |
| **Canvas** (middle) | The drawing area with a blueprint grid. |
| **Console** (under the canvas) | A log of everything the studio tells you, with the time. |
| **Inspector** (right) | Shows the open project (name, lab, parts). Will also show the properties of the selected part. |
| **Status bar** (bottom) | State, latest message, pointer position, Low-end mode and version. |

## 7.2 Arranging panels

Every panel has a **tab** (its name in capitals) and two buttons on the right of its title row.

| To… | Do this |
|---|---|
| Put two panels in one place as tabs | Drag a tab onto another panel's tab row. |
| Split a panel | Drag a tab onto the **edge** of another panel. A teal area shows where it will land. |
| Resize | Drag the thin gap between two panels. It lights up teal while you drag. |
| Float a panel as a window | Click the **window** button (▭) in its title row. Drag the window by its top strip. |
| Put a floating panel back | Click the **dock** button in the floating window's title row. |
| Fill the whole workspace with one panel | Click the **expand** button (⤢). Click it again to restore. |
| Close a panel | Click the **×** on its tab. |
| More options | **Right-click** a tab: Close, Close others, Close all, Float, Maximize. |

![A floating Inspector window above the canvas](images/studio-floating.png)

**Show or hide panels** with the **View** menu: a tick means the panel is open. A closed panel comes
back in its usual place.

![The View menu with panel ticks and their shortcuts](images/studio-view-menu.png)

**Your layout is saved.** The studio remembers how you arranged the panels on this computer and
browser and restores it next time. If the saved layout cannot be used, the studio opens the default
layout and says so in the status bar. To go back to the default at any time, choose
**View → Reset layout**.

## 7.3 Projects

- **New project:** click **+** next to the tabs, or **File → New project**. Projects are named
  *Untitled*, *Untitled 2*, … (up to 12 at once).
- **Switch:** click a tab, or use **←** / **→** when a tab has keyboard focus.
- **Close:** click the **×** on a tab, or **File → Close project**. The next tab opens.
- With no project open, the workspace shows **New project**.

Projects have no parts yet and are not saved yet — parts arrive with the labs, saving in a later
version.

## 7.4 Project name and Undo / Redo

![The Inspector with the project name, and the Edit menu offering "Undo Rename project"](images/studio-undo.png)

When no part is selected, the **Inspector** shows the **Project** section:

| Row | What it does |
|---|---|
| **Name** | The project's name. Click it, type a new name and press **Enter** (or click elsewhere). The project tab shows the new name. **Esc** cancels your typing. A name must have 1–100 characters. |
| **Lab** | The lab the project belongs to (*None yet* until labs arrive). |
| **Parts** | How many parts the project has. |

**Undo and Redo.** Every change to a project can be undone:

- **Undo:** press **Ctrl + Z** or choose **Edit → Undo**. The menu says what will be undone, for
  example **Undo Rename project**, and the status bar confirms it (*Undo: Rename project.*).
- **Redo:** press **Ctrl + Y** or **Ctrl + Shift + Z**, or choose **Edit → Redo**.
- When there is nothing to undo (or redo), the menu item is greyed out.
- Each project tab has its **own** undo history: Undo never changes another project.
- The studio remembers the last 200 changes of each project.
- Inside a text box (such as the project name while you type), **Ctrl + Z** undoes your typing, not
  the project.

## 7.5 Status bar and Low-end mode

![The status bar](images/studio-status-bar.png)

| Part | What it shows |
|---|---|
| **Idle** | Simulation state (no simulation is loaded yet). |
| Message | The latest message, e.g. *Saved layout restored.* All messages are in the **Console**. |
| **X … Y …** | Mouse pointer position on the canvas, in pixels. |
| **Low-end off / on** | Click to switch **Low-end mode**: all animations are turned off, which helps slower computers. The choice is remembered. On computers with 4 GB of memory or less it starts switched on. |
| **v0.0.0** | Software version. |

## 7.6 Command palette

![The command palette, searching for "lay"](images/command-palette.png)

Every action in the studio can be found and run from one search box.

1. Press **Ctrl + K** (**⌘ + K** on a Mac) or click **Search commands…** in the top bar.
2. Type a few letters — for example `lay` finds **Reset layout**. Matching letters light up in teal.
3. Use **↑** / **↓** to choose and **Enter** to run, or click a command. **Esc** closes the palette.

- Commands you used recently are listed first.
- A command that cannot run right now (for example *Next project tab* with only one project) is shown
  dimmed.
- The keys on the right of a command are its keyboard shortcut.

## 7.7 Keyboard shortcuts

Press **Ctrl + /** or **?** (or **Help → Keyboard shortcuts**) to see this list in the studio.

![The Keyboard shortcuts window](images/keyboard-shortcuts.png)

| Keys | Action |
|---|---|
| **Ctrl + K** | Command palette (open / close) |
| **Ctrl + /** or **?** | Keyboard shortcuts window |
| **Ctrl + Z** | Undo |
| **Ctrl + Y** or **Ctrl + Shift + Z** | Redo |
| **Alt + N** | New project |
| **Alt + W** | Close project |
| **Alt + ]** / **Alt + [** | Next / previous project tab |
| **Alt + 1 … 4** | Show or hide Explorer, Canvas, Inspector, Console |
| **Alt + Shift + R** | Reset layout |
| **Alt + Shift + L** | Low-end mode on / off |

- On a Mac use **⌘** instead of **Ctrl** and **⌥ Option** instead of **Alt**.
- While you type in a text box (such as the palette search), only **Ctrl** shortcuts work, so your
  typing is never interrupted. **Ctrl + Z** and **Ctrl + Y** then undo and redo your typing.
- The browser keeps some keys for itself (Ctrl + N, Ctrl + W, Ctrl + Tab…), so the studio uses
  **Alt** for those actions instead.

# Coming soon

These parts of the manual will be written as each feature is finished:

- Saving, opening, exporting and sharing projects (Day 08)
- Simulation controls in the real studio: play, pause, step and speed (Day 09)
- More Low-end mode options and automatic graphics detection (Day 10)
- One chapter for each of the 10 labs

# Version history of this manual

| Version | Date | Changes |
|---|---|---|
| 0.0.0 | 2026-11-21 | First edition: about RoboSim Studio, requirements, home page preview. |
| 0.0.0 · Day 05 | 2026-11-22 | New logo on the home page; chapters on themes, engineering number fields and the workspace (panels, toolbar, inspector). |
| 0.0.0 · Day 07 | 2026-11-23 | New section 7.4: project name in the Inspector, Undo / Redo (Edit menu, Ctrl + Z, Ctrl + Y). Shortcut table updated. |
| 0.0.0 · Day 06 | 2026-11-22 | New chapter 7, the studio workspace: docking panels, saved layout, menus, project tabs, status bar, Low-end mode, command palette and keyboard shortcuts. Home page links to the studio. |
