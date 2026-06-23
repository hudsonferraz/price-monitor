# Architecture

## Overview

price-monitor is a full-stack deal-alert app for **Facebook Marketplace (Brazil)**. Users save keyword + price searches; a background worker polls Marketplace on a schedule, diffs results against per-search price history, and surfaces new matches and price drops in the dashboard (with optional email).

```mermaid
flowchart TB
  subgraph web [Web — Vercel]
    UI[Next.js dashboard]
    API[API routes]
    Auth[NextAuth GitHub/Google]
  end

  subgraph queue [Queue — Upstash Redis]
    PollQ[poll-search queue]
    SchedQ[schedule-polls repeatable]
  end

  subgraph worker [Worker — Render]
    Bull[BullMQ consumer]
    PW[Playwright Chromium]
    Adapter[FacebookMarketplaceAdapter]
    Email[Resend notifications]
    Health[/health endpoint]
  end

  subgraph data [Data — Neon PostgreSQL]
    Prisma[(Prisma models)]
  end

  UI --> API
  Auth --> API
  API -->|enqueue poll| PollQ
  API -->|wake ping| Health
  SchedQ -->|due searches| PollQ
  PollQ --> Bull
  Bull --> PW --> Adapter
  Adapter -->|listings| Prisma
  Bull --> Email
  API --> Prisma
  Bull --> Prisma
```

## Monorepo layout

| Package / app | Path | Role |
|---------------|------|------|
| **@price-monitor/web** | `apps/web/` | Next.js 15 App Router, dashboard UI, REST API, NextAuth |
| **@price-monitor/worker** | `apps/worker/` | BullMQ workers, Playwright scraping, Resend email, `/health` |
| **@price-monitor/database** | `packages/database/` | Prisma schema + client |
| **@price-monitor/queue** | `packages/queue/` | BullMQ queue setup, enqueue/cancel, scheduler registration |
| **@price-monitor/shared** | `packages/shared/` | Zod schemas, parsers, poll schedule, price-drop logic, types |

Turbo orchestrates dev/build; Vitest runs at the repo root.

## Poll lifecycle

1. **Trigger** — User clicks **Poll now** (`POST /api/searches/[id]/poll`) or the scheduler enqueues a due search (repeatable job every 60s).
2. **Wake** — Web pings `WORKER_HEALTH_URL` so Render free tier spins up before the job waits too long.
3. **Enqueue** — Job ID `poll-{savedSearchId}` deduplicates concurrent manual + scheduled polls for the same search.
4. **Execute** — Worker runs `executePollSearch` (`apps/worker/src/jobs/poll-search.job.ts`):
   - Mark `PollRun` as RUNNING
   - Open ephemeral Playwright browser → scrape Facebook (or mock listings)
   - Abort if search was deleted/disabled mid-poll
   - Upsert `Listing` rows, snapshot prices in `PollSnapshotListing`
   - Compare against `SavedSearchListingPrice` for new matches and price drops
   - Upsert `Alert` rows; send Resend email for new non-baseline alerts
   - Update `consecutiveFailures` / `lastSuccessfulPollAt` on success or failure
5. **Observe** — Dashboard polls `/poll-status` and `/poll-runs` until SUCCESS/FAILED.

Worker concurrency is **1** — only one Facebook scrape at a time to respect memory limits and rate pressure.

## Facebook scraping pipeline

`FacebookMarketplaceAdapter` (`apps/worker/src/adapters/facebook-marketplace.adapter.ts`) implements `MarketplaceAdapter` from shared types:

| Source | Purpose |
|--------|---------|
| **GraphQL responses** | Intercept Marketplace search API payloads during navigation |
| **Embedded JSON** | Parse `__bbox` / bootstrap JSON in page HTML |
| **DOM fallback** | Aria-label listing cards when structured data is incomplete |

`collectAvailableListings()` merges all sources with explicit priority. Scroll attempts scale with `listingLimit` (12 / 24 / 48).

Playwright opens a **new browser per poll** and blocks images/fonts/media/stylesheets to stay within Render free-tier memory (~512 MB).

## Storage model

| Model | Purpose |
|-------|---------|
| `User` | OAuth identity, email notification preference, locale |
| `SavedSearch` | Keywords, BRL price range, poll interval, listing limit, failure backoff counter |
| `Listing` | Normalized marketplace listing (`source` + `externalId` unique) |
| `Alert` | Per-search match; tracks `previousPriceCents`, `priceDroppedAt`, dismiss state |
| `PollRun` | Audit trail per poll (status, duration, counts, error message) |
| `PollSnapshotListing` | Point-in-time price per listing for a poll run |
| `SavedSearchListingPrice` | Latest known price per `(savedSearchId, listingId)` — fast price-drop detection |

Prices are stored as **integer cents** (BRL).

## Deployment topology

| Service | Host | Notes |
|---------|------|-------|
| Web | Vercel (`apps/web`) | Serverless Next.js; enqueues jobs, never runs Playwright |
| Worker | Render (`render.yaml` + Docker) | Long-running process; exposes `GET /health` on port 10000 |
| Database | Neon PostgreSQL | Shared `DATABASE_URL` on web + worker |
| Queue | Upstash Redis | Shared `REDIS_URL`; BullMQ backend |

**Schema migrations are manual:** Vercel and Render run `prisma generate` on install but do **not** run `db push` or migrations. Apply schema changes locally before deploy:

```bash
npm run db:push
```

See [render-deploy.md](render-deploy.md) for the full worker setup walkthrough.

## API surface (web)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/auth/[...nextauth]` | GET, POST | OAuth session |
| `/api/searches` | GET, POST, PATCH | List/create/update saved searches |
| `/api/searches/[id]` | DELETE | Delete search (cancel queue job, block if active poll) |
| `/api/searches/[id]/poll` | POST | Manual poll (15 min cooldown, wake worker) |
| `/api/searches/[id]/poll-status` | GET | BullMQ job state + queue position |
| `/api/searches/[id]/poll-runs` | GET | Paginated poll history |
| `/api/searches/[id]/alerts` | DELETE | Dismiss all alerts for a search |
| `/api/alerts` | GET | List alerts |
| `/api/alerts/[id]` | DELETE | Dismiss single alert |
| `/api/user/preferences` | GET, PATCH | Email notifications + locale |
| `/api/locale` | POST | Set locale cookie |
| `/api/cron/wake-worker` | GET | Optional Vercel Pro cron to ping worker health |

## Testing

57 Vitest tests cover shared parsers, poll scheduling/backoff, price-drop logic, email HTML safety, Zod schemas, and adapter merge priority. API routes, Prisma, BullMQ integration, and Playwright live scraping are not automated — they are exercised via mock mode and manual polls.
