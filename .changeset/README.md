# Changesets

RoboSim Studio uses [Changesets](https://github.com/changesets/changesets) to version releases.

- Every PR that changes what users see or how the app behaves adds a changeset:
  `pnpm changeset` → pick the bump (patch / minor / major) → write one line for the changelog.
- Docs-only, CI-only and test-only PRs do not need a changeset.
- At each phase release (v0.1, v0.2, …) we run `pnpm version-packages`, which bumps the versions of
  all `@robosim/*` packages together (they are "fixed") and writes `CHANGELOG.md` files.
- Packages are private: nothing is published to npm.
