# Security policy

RoboSim Studio is free, open-source software used by students and teachers. We take security seriously.

## Reporting a vulnerability

**Please do not open a public issue.** Report privately through GitHub:
**Security** tab → **Report a vulnerability** (private vulnerability reporting).

Please include what is affected, steps to reproduce, and the impact you expect. You will get a first
reply within 7 days. We will keep you informed and credit you in the release notes if you wish.

## Supported versions

Only the latest release on `main` (and the `develop` branch during development) receives fixes.

## How we keep RoboSim Studio secure

- Dependencies are audited (`pnpm audit`), updated by Dependabot, and new versions are only installed
  after a 3-day cooling-off period (supply-chain protection).
- CodeQL static analysis runs on every pull request and weekly.
- GitHub Actions are pinned to exact commit SHAs and run with least-privilege tokens.
- The web app sends strict security headers (content security policy, no framing, no MIME sniffing,
  restricted browser permissions).
- Camera video (Gesture Control Lab) is processed only in the browser and never uploaded.
- No secrets are stored in the repository; secret scanning with push protection is enabled.
