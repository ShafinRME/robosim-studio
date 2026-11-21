# Vercel setup (owner)

RoboSim Studio's web app (`apps/web`) is hosted on Vercel's free Hobby plan.
Project: `robosim-studio` (team "Shafin", Hobby) · production domain: <https://robosim-studio-lemon.vercel.app>

| Git branch | Vercel environment |
|---|---|
| `main` | **Production** (only at releases: v0.0.1 on Day 10, then every phase release) |
| `develop`, `feat/*`, every PR | **Preview** — a unique URL, posted on the PR |

## One-time setup (done on Day 04)

1. Go to <https://vercel.com/new> and sign in with **GitHub**.
2. Under **Import Git Repository**, find **ShafinRME/robosim-studio** and click **Import**.
   If it is not listed: **Adjust GitHub App Permissions** → give the Vercel app access to
   `robosim-studio` → **Save**, then come back.
3. **Configure Project** screen:
   - **Project Name:** `robosim-studio`
   - **Framework Preset:** Next.js (detected automatically)
   - **Root Directory:** click **Edit** → choose `apps/web` → **Continue**
   - **Build and Output Settings:** leave everything on the defaults
     (Vercel detects pnpm and installs the whole workspace).
   - **Environment Variables:** none needed.
4. Click **Deploy**. The first build takes 2–4 minutes. It deploys the `develop` branch.
5. In the new project open **Settings**:
   - **Build and Deployment → Node.js Version:** choose **22.x** → **Save**.
   - **Environments → Production → Branch Tracking:** change the branch from `develop` to **`main`**
     → **Save**. (From now on `develop` and PRs get Preview URLs; only `main` is Production.)
6. Done. Every new push to a PR now shows a **Vercel** check and a **Preview** link on GitHub.

## If a deployment fails

Open the project on Vercel → **Deployments** → click the failed one → **Build Logs**, and send the last
lines to Claude.
