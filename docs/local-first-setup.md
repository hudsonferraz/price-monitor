# Local-first setup

This is the recommended direction for price-monitor. The Facebook-facing worker runs on your own machine, with a persistent browser profile that you can open whenever Facebook asks for login, 2FA, checkpoint, or CAPTCHA.

## Why local-first?

Facebook Marketplace sessions are interactive. Keeping the browser profile local lets you fix login prompts, 2FA, checkpoints, or confirmation screens directly in a visible browser.

## Prerequisites

- Node.js 18+
- Docker Desktop
- Playwright Chromium installed with `npx playwright install chromium`

## Environment

Copy the example env:

```bash
cp .env.example .env
```

The default local-first infrastructure values are:

```env
DATABASE_URL=postgresql://price_monitor:price_monitor@localhost:5433/price_monitor
REDIS_URL=redis://localhost:6379
FACEBOOK_BROWSER_PROFILE_DIR=.facebook-profile
PLAYWRIGHT_HEADLESS=false
MOCK_MARKETPLACE=false
```


## Start local infrastructure

Run Postgres and Redis locally with Docker Compose:

```bash
npm run docker:up
```

Check service status:

```bash
npm run docker:ps
```

Apply the Prisma schema to local Postgres:

```bash
npm run db:push
```

This Redis service is configured with `maxmemory-policy noeviction`, which avoids BullMQ's eviction-policy warning.

## Create or refresh the Facebook profile

Run:

```bash
npm run facebook:login
```

A visible browser opens with a persistent profile directory. In that browser:

1. Sign in to Facebook.
2. Complete any 2FA, checkpoint, or "confirm this is you" prompts.
3. Open Marketplace and confirm listings are visible.
4. Return to the terminal and press Enter.

The profile is stored in `.facebook-profile/`, which is ignored by git.

## Smoke-test the scraper

After login, run:

```bash
npm run spike:facebook
```

If the profile is valid and Marketplace is accessible, the script prints listings. If it fails, it saves debug HTML/screenshot artifacts under `fixtures/debug/`.

## Run the app locally

Terminal 1:

```bash
npm run dev --workspace=@price-monitor/web
```

Terminal 2:

```bash
npm run worker:dev
```

Open:

```txt
http://localhost:3000
```

Create a saved search and click **Poll now**. The scheduler may also enqueue due searches automatically.


## Worker status in the dashboard

After `npm run db:push`, the worker writes a heartbeat row to Postgres every 30 seconds. The dashboard uses that row to show whether the local worker is online, stale, stopped, or not connected yet. It also summarizes the latest successful scrape and latest failure type from recent poll history.

If the dashboard says no worker heartbeat was found, start the worker:

```bash
npm run worker:dev
```

If you pull a version that adds or changes heartbeat fields, run `npm run db:push` again before starting the worker.

## Session diagnostics

The worker health endpoint reports the active session mode:

```bash
curl http://localhost:10000/health
```

Profile mode looks like:

```json
{
  "status": "ok",
  "checks": {
    "facebookSession": {
      "status": "ok",
      "mode": "browser_profile",
      "path": ".facebook-profile",
      "message": "Persistent Facebook browser profile is configured. Login is validated during browser navigation."
    }
  }
}
```

If Facebook later shows a login wall during a poll, run `npm run facebook:login` again and fix the prompt in the visible browser.

## Stop local infrastructure

Stop containers while keeping data volumes:

```bash
npm run docker:down
```

To remove local Postgres/Redis data too, run Docker Compose manually with volumes:

```bash
docker compose down -v
```

## Notes

- Docker Postgres listens on **host port 5433** (not 5432) to avoid clashing with a local Windows PostgreSQL service. If `db:push` fails with `P1000`, confirm `DATABASE_URL` uses port `5433`.
- Do not commit `.facebook-profile/`; it contains your browser session.
- Keep `PLAYWRIGHT_HEADLESS=false` while debugging login/session issues.
- Once the profile is healthy, headless mode can be used, but visible mode is easier to recover.
- The Facebook browser profile is local-only and ignored by git.
