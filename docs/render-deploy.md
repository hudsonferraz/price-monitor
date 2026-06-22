# Deploying the worker on Render

The web app stays on **Vercel**. The **worker** (Playwright + BullMQ) runs on **Render** so polling works without your PC.

## Prerequisites

- Code pushed to GitHub (`hudsonferraz/price-monitor` or your fork)
- **Neon** `DATABASE_URL` (same as Vercel)
- **Upstash** `REDIS_URL` (same as Vercel — **Redis** URL, `rediss://...`)
- **Resend** `RESEND_API_KEY` (optional, for email alerts)
- **`facebook-storage-state.json`** on your machine (from `npm run save:facebook-session`)

## Step 1 — Commit and push

Make sure `render.yaml` and `apps/worker/Dockerfile` are on `main`:

```bash
git add .
git commit -m "Add Render worker deployment"
git push
```

## Step 2 — Create the Render service

> **Note:** Render **free tier does not support background workers**. This repo uses a **Web Service** that runs the worker and exposes `/health` for Render's health checks.

1. Go to [https://dashboard.render.com](https://dashboard.render.com) and sign in (GitHub is easiest).
2. Click **New +** → **Blueprint**.
3. Connect your GitHub account and select the **price-monitor** repository.
4. Render detects `render.yaml` and shows a **Web** service: `price-monitor-worker`.
5. Click **Apply**.

Render will start the first deploy. It will likely **fail** until you add environment variables — that is normal.

## Step 3 — Environment variables

Open the worker service → **Environment** → add:

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Your Neon connection string (same as Vercel) |
| `REDIS_URL` | Your Upstash **Redis** URL (`rediss://default:...@....upstash.io:6379`) |
| `RESEND_API_KEY` | Your Resend key (`re_...`) |
| `EMAIL_FROM` | `price-monitor <onboarding@resend.dev>` or your verified domain |
| `APP_URL` | `https://fb-price-monitor.vercel.app` |

These are already set in `render.yaml` (no need to add manually unless you changed them):

- `PLAYWRIGHT_HEADLESS` = `true`
- `MOCK_MARKETPLACE` = `false`
- `NODE_OPTIONS` = `--max-old-space-size=384` (already in `render.yaml`)
- `FACEBOOK_STORAGE_STATE_PATH` = `/etc/secrets/facebook-storage-state.json`

Click **Save Changes** and trigger a **Manual Deploy** if needed.

## Step 4 — Upload Facebook session (secret file)

Facebook requires a logged-in session. Upload your local file to Render:

1. Worker service → **Environment** → scroll to **Secret Files**.
2. Click **Add Secret File**.
3. **Filename / mount path:** `/etc/secrets/facebook-storage-state.json`
4. **Contents:** paste the full contents of your local `facebook-storage-state.json`  
   (run `Get-Content facebook-storage-state.json` in PowerShell to copy).
5. Save and redeploy.

When the session expires (weeks/months), re-run `npm run save:facebook-session` locally and update this file.

## Step 5 — Verify the deploy

1. Open **Logs** on the Render worker. You should see:
   ```
   Starting price-monitor worker...
   Using Facebook session: /etc/secrets/facebook-storage-state.json
   Scheduler registered (checks every 60 seconds).
   Worker is running.
   ```
2. Open your **Vercel** app → dashboard → **Poll now** on a search.
3. Within ~30 seconds, check **Recent polls** → status should be `SUCCESS` (or `FAILED` with a message if Facebook blocked the session).
4. If email is configured, new matches trigger a Resend email.

## Step 6 — Vercel checklist

On Vercel, confirm these are set (same values as worker where shared):

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Neon connection string |
| `REDIS_URL` | Upstash Redis URL |
| `WORKER_HEALTH_URL` | `https://price-monitor-worker.onrender.com/health` |
| `CRON_SECRET` | Optional — only if you use `/api/cron/wake-worker` (Vercel Pro or manual curl) |
| `AUTH_*` | Auth secret + OAuth keys |
| `AUTH_URL` | Your production URL (e.g. `https://fb-price-monitor.vercel.app`) |

You do **not** need `RESEND_API_KEY` on Vercel (email is sent from the worker).

### Keep the worker awake (free tier, no Render upgrade)

Render free services spin down after ~15 minutes without traffic. Use **UptimeRobot** (recommended on Vercel Hobby / Render free):

1. Create a free account at [UptimeRobot](https://uptimerobot.com).
2. Add an **HTTP(s) monitor** for `https://price-monitor-worker.onrender.com/health`.
3. Set the interval to **5 minutes**.

The web app also pings the worker when you click **Poll now** (`WORKER_HEALTH_URL` on Vercel).

**Optional (Vercel Pro only):** the repo includes `/api/cron/wake-worker` — set `CRON_SECRET` and add a cron in `vercel.json`. Do **not** use this on Vercel Hobby; sub-daily crons block deployment.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Poll stays queued forever | Worker asleep (free tier) or invalid `DATABASE_URL` on Render |
| `DATABASE_URL must start with postgresql://` | Paste the Neon URL on Render **without quotes** — same value as Vercel |
| `REDIS_URL is not set` | Missing env var on Render |
| Facebook login error in poll | Session expired — re-upload `facebook-storage-state.json` |
| Email not sent | Missing `RESEND_API_KEY`, user disabled notifications, or Resend sender not verified |
| Build fails on Docker | Check build logs; ensure `package-lock.json` is committed |
| Worker exceeded memory limit | Chromium + Playwright on Render free tier (~512 MB). Use **12 listings per poll**, keep poll intervals ≥ 30 min, redeploy worker with latest memory optimizations |
| Free tier sleeps | Render free workers may spin down; upgrade to Starter for 24/7 |

## Cost and free-tier behavior

- **Free web service** may **spin down** after ~15 minutes without HTTP traffic. While asleep, queued polls wait until something wakes the service.
- **Keep it awake (free):** use [UptimeRobot](https://uptimerobot.com) to ping `https://price-monitor-worker.onrender.com/health` every **5 minutes**. Clicking **Poll now** also wakes the worker via `WORKER_HEALTH_URL`.
- **Always-on (optional):** upgrade the Render service to **Starter** (~$7/mo) — no spin-down, faster cold starts.

## Memory on Render free tier

Render free web services have about **512 MB RAM**. Playwright + Chromium typically needs 300–450 MB while a poll runs, so OOM restarts are common if the browser stays open or too much page content is loaded.

The worker is tuned to reduce memory use:

- **Browser opens only for each poll**, then closes (no idle Chromium between polls)
- **Images, fonts, CSS, and media are blocked** — only HTML/JSON needed for scraping
- **Smaller viewport** and lighter page waits
- **`NODE_OPTIONS=--max-old-space-size=384`** caps Node heap (set in `render.yaml`)

**What you should do in the app:**

1. Set **Max listings per poll** to **12** on each search (not 48)
2. Use **poll intervals of 30+ minutes** — avoid many searches polling every 5 min at once
3. Redeploy the worker after pulling memory fixes; check logs for `[memory] before poll` / `after poll`
4. If OOM emails continue, disable non-essential searches or increase interval further

Each poll may take **~30–60 seconds longer** (browser cold start per poll) — that is the tradeoff for staying on free tier.

## Architecture

```
Vercel (web)  ──Poll now──►  Upstash Redis  ◄── worker ──  Render (Playwright)
                                    │
                                    ▼
                              Neon PostgreSQL
                                    │
                                    ▼
                              Resend (email)
```
