# GitHub security settings (owner)

Turn on GitHub's free security features for the public repository. Done once, on Day 05.

1. Repo **Settings** → **Advanced Security** (left menu, under "Security").
2. Turn **on** (click **Enable** for each):
   - **Private vulnerability reporting** — lets people report problems privately (see `SECURITY.md`).
   - **Dependency graph** (usually already on).
   - **Dependabot alerts**
   - **Dependabot security updates** — GitHub opens fix PRs automatically.
   - **Grouped security updates**
   - **Secret Protection** → **Push protection** — blocks pushes that contain passwords or API keys.
   - **Code scanning** — leave on **Advanced**: our own CodeQL workflow (`.github/workflows/codeql.yml`)
     already runs. Do **not** choose "Default" setup (it would run a second, duplicate CodeQL).
3. Repo **Settings** → **Actions** → **General**:
   - **Workflow permissions:** select **Read repository contents and packages permissions** → **Save**.
   - Untick **Allow GitHub Actions to create and approve pull requests** → **Save**.

## Check it worked
**Security** tab: "Private vulnerability reporting: Enabled", Dependabot and Code scanning show results
(no open alerts).
