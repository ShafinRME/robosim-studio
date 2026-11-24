# ADR 005 — Saving, files and share links

- **Status:** Accepted
- **Date:** 2026-11-23 (Day 08)

## Context
Projects (ADR 004) must survive a reload, move between computers as files, and be shareable as a
link — all without an account or a server (accounts and cloud sync come later). Everything read
back — from the browser database, a file someone sends, or a link someone posts — is untrusted and
can be old, corrupt or crafted to attack the app (huge sizes, zip bombs, prototype keys).

## Options considered
| Need | Option | Licence | Notes |
|---|---|---|---|
| Browser storage | **Dexie 4** over IndexedDB | Apache-2.0 | No dependencies; typed tables, indexes, transactions, schema versions; large quota. |
| | idb (Jake Archibald) | ISC | Thin wrapper; we would write versioning and queries ourselves. |
| | localStorage | — | ~5 MB, synchronous, strings only — fine for layout, not for projects. |
| | OPFS | — | Good for big binary assets later; overkill for JSON projects now. |
| File format | **Zip via fflate 0.8** | MIT | No dependencies, small, fast, sync + streaming APIs; room for assets (images, firmware) later. |
| | JSZip | MIT / GPL-3 (dual) | Larger; dual licence needs care. |
| | Plain `.json` | — | Simplest, but no room for assets and no compression. |
| Share link | **Deflate (fflate) + base64url in the URL fragment** | — | `#` part never reaches any server or log; works offline; size-limited. |
| | Server-stored short links | — | Needs a backend and moderation; later, with accounts. |
| Tests | **fake-indexeddb 6** (dev only) | Apache-2.0 | IndexedDB in Node for unit tests. |

## Decision
- **Dexie 4.4.7** (`apps/web`), **fflate 0.8.3** (`@robosim/core`), **fake-indexeddb 6.2.8** (dev).
  Exact versions pinned.
- **Security check (2026-11-23):** licences Apache-2.0 / MIT; no runtime dependencies. Dexie's only
  advisory (GHSA-3xgx-r9j4-qw9w) affects `< 3.2.2` and 4.0 alphas; fflate's (GHSA-px8p-9vwx-vf98,
  infinite loop on malformed ZIP64) affects `< 0.8.3` — 0.8.3 is fixed; fake-indexeddb has none. All
  releases are older than the 3-day guard. `pnpm audit` must stay at 0.
- **Database** `robosim-studio`: table `projects` (key `id`, index `updatedAt`) holding the project
  plus a small summary (name, lab, part count) for the recent list; table `settings` for the open
  tabs. Every project read from the database goes through `loadProject` (migrate + validate) —
  never trusted as-is. Storage errors (quota full, IndexedDB blocked in private mode) are reported
  in the status bar; the studio keeps working without saving.
- **Autosave:** 1 s after the last edit and when the page is hidden/closed. `updatedAt` is set in
  the saved copy, so undo history is not affected.
- **`.rsim` file** = zip with `manifest.json` (`{ format: "robosim-archive", version: 1 }`) and
  `project.json`. Import limits: file ≤ 10 MB, ≤ 16 entries, only known names, every entry's real
  decompressed size counted while inflating (stop above 5 MB per entry, 20 MB total) — never trusting
  the sizes written in the zip. Then `parseProject` validates. An imported project gets a **new id**,
  so it never overwrites an existing one.
- **Share link:** `/studio#share=<base64url(deflate(project.json))>`, only for projects whose link is
  ≤ 8 000 characters (larger ones: use a file). Opening a link decodes with the same decompression
  limits, validates, and opens it as a new project (new id). Nothing is sent to a server.

## Consequences
- Projects stay on the user's own computer and browser; clearing site data deletes them — the
  manual says so and recommends exporting `.rsim` files as backups.
- Every new place that reads a project must use `loadProject` / `parseProject`.
- Assets (images, firmware) can be added to `.rsim` later by adding known entry names and limits.
