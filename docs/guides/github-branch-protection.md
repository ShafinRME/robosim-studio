# GitHub branch protection (owner)

Goal: nothing reaches `develop` or `main` unless it came through a pull request with all checks green.
We use **Rulesets** (GitHub's current way to protect branches). Done once, on Day 04.

## Ruleset 1 — `develop`

1. Repo **Settings** → **Rules** → **Rulesets** → **New ruleset** → **New branch ruleset**.
2. **Ruleset name:** `protect-develop` · **Enforcement status:** **Active**.
3. **Bypass list:** leave empty.
4. **Target branches** → **Add target** → **Include by pattern** → `develop`.
5. Under **Branch rules** tick:
   - **Restrict deletions**
   - **Require linear history**
   - **Require a pull request before merging** — set **Required approvals = 0**
     (you are the only maintainer; GitHub does not let you approve your own PR).
     Under **Allowed merge methods** keep only **Squash**.
   - **Require status checks to pass** → **Add checks** and add these four (type the name, pick it):
     - `Format · Lint · Typecheck · Unit tests · Build`
     - `Browser smoke tests (Playwright)`
     - `Conventional Commits title`
     - `Vercel`
     Leave "Require branches to be up to date before merging" **off** (fewer re-runs for a solo project).
   - **Block force pushes**
6. Click **Create**.

## Ruleset 2 — `main`

Same as above with **Ruleset name** `protect-main` and target pattern `main`.
(`main` only changes at releases, through a PR from `develop`.)

## Check it worked

Repo home page: the yellow "Your develop branch isn't protected" banner is gone. On an open PR, the
merge box lists the four required checks.
