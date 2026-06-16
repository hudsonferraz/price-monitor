# price-monitor

Full-stack marketplace alert app for **Brazil**. Monitor **Facebook Marketplace** for used-item deals and get notified when new listings match your saved searches.

## Legal notice

Facebook prohibits unauthorized automated data collection without permission. This project is intended for **personal, educational, and portfolio use**. You are responsible for complying with Meta's terms and applicable laws.

## Setup

```bash
npm install
npx playwright install chromium
```

Copy `.env.example` to:

- `price-monitor/.env` — `DATABASE_URL`, `REDIS_URL`, worker + email vars
- `apps/web/.env.local` — all web vars including `DATABASE_URL`, `REDIS_URL`, auth keys

Required values:

- `DATABASE_URL` — PostgreSQL (Neon or Supabase)
- `REDIS_URL` — Redis (Upstash free tier works)
- `AUTH_SECRET` — random secret (`openssl rand -base64 32`)
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` — GitHub OAuth (dev app for localhost)
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google OAuth

Optional for email alerts (worker):

- `RESEND_API_KEY` — from [resend.com](https://resend.com)
- `EMAIL_FROM` — verified sender address
- `APP_URL` — public web URL for links in emails

Push the schema to your database:

```bash
npm run db:push
```

## Development

**Terminal 1 — web app:**

```bash
npm run dev --workspace=@price-monitor/web
```

**Terminal 2 — background worker:**

```bash
npm run worker:dev
```

Open [http://localhost:3000](http://localhost:3000), sign in, create a search, then click **Poll now** on the dashboard.

Manual polls are rate-limited to once every **15 minutes** per search.

### Mock mode (no Facebook session)

Set in root `.env`:

```
MOCK_MARKETPLACE=true
```

Restart the worker. Polls return fake listings — useful for testing alerts and email without Playwright.

### Live Facebook polling

```bash
npm run save:facebook-session
```

Then set in root `.env`:

```
FACEBOOK_STORAGE_STATE_PATH=facebook-storage-state.json
PLAYWRIGHT_HEADLESS=false
MOCK_MARKETPLACE=false
```

## Run tests

```bash
npm test
```

## Deploy

**Web (Vercel):**

1. Root Directory: `apps/web`
2. Env vars: `DATABASE_URL`, `REDIS_URL`, `AUTH_*`, OAuth keys, `APP_URL`
3. `apps/web/vercel.json` handles monorepo install/build

**Worker (Render):**

The worker runs Playwright + BullMQ and cannot run on Vercel. Use the included `render.yaml`:

1. Connect the repo on [Render](https://render.com)
2. Set env vars: `DATABASE_URL`, `REDIS_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`
3. Upload `facebook-storage-state.json` as a secret file (or use `MOCK_MARKETPLACE=true` for demos)

You can also run the worker locally while using production Vercel + Upstash — both must share the same `REDIS_URL` and `DATABASE_URL`.

## Architecture

```
Dashboard → Poll now → Redis (BullMQ) → Worker → Facebook Marketplace
                                              ↓
                                    Listings + Alerts → PostgreSQL
                                              ↓
                                    Resend email (optional)
```

The scheduler enqueues due searches every 60 seconds based on each search's `pollIntervalMin`.
