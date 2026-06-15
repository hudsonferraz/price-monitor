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

- `price-monitor/.env` — `DATABASE_URL`, `REDIS_URL`, worker vars
- `apps/web/.env.local` — all web vars including `DATABASE_URL`, `REDIS_URL`, auth keys

Required values:

- `DATABASE_URL` — PostgreSQL (Neon or Supabase)
- `REDIS_URL` — Redis (Upstash free tier works)
- `AUTH_SECRET` — random secret (`openssl rand -base64 32`)
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` — GitHub OAuth (dev app for localhost)
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google OAuth

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

### Mock mode (no Facebook session)

Set in root `.env`:

```
MOCK_MARKETPLACE=true
```

Restart the worker. Polls return fake listings — useful for testing alerts without Playwright.

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

## Run the live spike

```bash
npm run spike:facebook
```

See `.env.example` for Facebook session setup. On failure, debug artifacts are saved under `fixtures/debug/`.

## Run tests

```bash
npm test
```

## Deploy

**Web (Vercel):**

1. Root Directory: `apps/web`
2. Env vars: `DATABASE_URL`, `REDIS_URL`, `AUTH_*`, OAuth keys
3. `apps/web/vercel.json` handles monorepo install/build

**Worker (Render / Railway / local):**

The worker runs Playwright + BullMQ and cannot run on Vercel. Deploy separately with:

- `DATABASE_URL`, `REDIS_URL`
- `FACEBOOK_STORAGE_STATE_PATH` or `MOCK_MARKETPLACE=true`
- Start command: `npm run start --workspace=@price-monitor/worker`

Add `REDIS_URL` to Vercel so **Poll now** can enqueue jobs.

## Architecture (Phase 2)

```
Dashboard → POST /api/searches/:id/poll → Redis (BullMQ)
                                              ↓
                                         Worker polls Facebook
                                              ↓
                                    Listings + Alerts → PostgreSQL
```

The scheduler enqueues due searches every 60 seconds based on each search's `pollIntervalMin`.
