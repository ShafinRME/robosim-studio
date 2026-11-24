# Changelog

All notable changes to RoboSim Studio. Versions follow [Semantic Versioning](https://semver.org/);
before 1.0, minor versions may change anything.

## 0.0.1 — 2026-11-24 · Phase 0: Foundation

First public release: the studio foundation every lab will be built on. No lab is available yet.

### Added
- **Home page** with what works today, the 10 planned labs, and a chart computed by the real simulation kernel.
- **Studio workspace:** dock, split, tab, float and maximize panels; layout saved and restored; top bar with
  File / Edit / View / Help menus; project tabs; status bar; Console; command palette (Ctrl + K); keyboard
  shortcuts with a help window.
- **Projects:** versioned, validated project format with migrations; undo / redo for every change (Ctrl + Z / Y);
  automatic saving in the browser with restore after a reload; Recent projects; `.rsim` export / import; share
  links that carry the project inside the link (nothing uploaded).
- **Simulation kernel:** fixed 1 ms steps in a background worker, Run / Pause / Step / Stop, speed 0.1×–10×,
  typed Signal Bus, demo model; the page stays smooth while it runs.
- **Low-end mode:** detects slower computers (memory, cores, WebGL2, software graphics) and switches itself on with a
  stated reason; Help → System information.
- **Error screens** for pages, the studio and each panel; Page not found.
- **User Manual** (PDF) covering every feature above.

### Security
- Strict security headers and Content Security Policy (no `eval`), SHA-pinned CI actions, CodeQL, Dependabot,
  `pnpm audit` gate (0 known vulnerabilities), 3-day release-age guard for dependencies.
- Everything read back (saved projects, `.rsim` files, share links, layouts) is size-limited and validated;
  zip-bomb and decompression-bomb protection.

### Known limitations
- Studio start-up: Lighthouse desktop Performance 85–88 (home page 100); to be optimized when labs add panels.
- Desktop and laptop browsers only (no phone / tablet layout).
