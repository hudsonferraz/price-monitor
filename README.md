# price-monitor

![Next.js 15](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**Local-first Facebook Marketplace deal monitor** for Brazil. Save keyword + price searches, run a local Playwright worker with your own Facebook browser profile, and review matching listings, price drops, and worker health in a polished dashboard.

This is a **personal, educational, and portfolio project** for exploring scraping resilience, job queues, local automation, and soon AI-assisted listing evaluation. It is **not** authorized Facebook/Meta tooling. See [Legal notice](#legal-notice).

**What it does:** save searches -> local worker scrapes Marketplace -> diff against per-search history -> dashboard alerts + optional email.

**How it is built:** Next.js, BullMQ, Playwright, Prisma, local Docker Postgres/Redis, Resend, and a persistent local Facebook browser profile.

## Highlights

- **Local-first worker** - Facebook-facing browser/session stays on your machine in `.facebook-profile/`.
- **Worker heartbeat dashboard** - the UI shows local worker online/stale/offline state, Facebook session mode, latest successful scrape, and latest failure type.
- **Resilient Facebook scraping** - GraphQL interception + embedded JSON + DOM fallback with unified merge.
- **Per-search price memory** - `SavedSearchListingPrice` tracks last seen price per search so overlapping searches still detect drops correctly.
- **Reliable polling** - BullMQ job dedup, concurrency 1, exponential failure backoff, stale RUNNING recovery, and manual poll cooldown.
- **Brazil-first UX** - `pt-BR` default, BRL cents, Marketplace location hints, with English supported.
- **Mock mode** - fake listings without Facebook session for local alert/email testing.

## Quickstart

Requires Node.js 18+, Docker Desktop, and Playwright Chromium.

```bash
cd price-monitor
npm install
npx playwright install chromium
cp .env.example .env
npm run docker:up
npm run db:push
npm run facebook:login
npm run spike:facebook
```

Terminal 1 - web:

```bash
npm run dev --workspace=@price-monitor/web
```

Terminal 2 - worker:

```bash
npm run worker:dev
```

Open [http://localhost:3000](http://localhost:3000), sign in, create a search, and click **Poll now**. The dashboard should show the local worker heartbeat once `npm run worker:dev` is running.

For the full local setup flow, see [docs/local-first-setup.md](docs/local-first-setup.md).

## Facebook Session Model

The recommended workflow is a persistent local browser profile:

```env
FACEBOOK_BROWSER_PROFILE_DIR=.facebook-profile
PLAYWRIGHT_HEADLESS=false
MOCK_MARKETPLACE=false
```

Run `npm run facebook:login` whenever Facebook asks for login, 2FA, checkpoint, or confirmation. The profile is ignored by git and should never be committed.


## Mock Mode

In root `.env`:

```env
MOCK_MARKETPLACE=true
```

Restart the worker. Polls return fake listings, which is useful for dashboard, alert, and email testing without touching Facebook.

## Tests

```bash
npm test
```

## API

| Endpoint                             | Description                                    |
| ------------------------------------ | ---------------------------------------------- |
| `GET/POST/PATCH /api/searches`       | List, create, update saved searches            |
| `DELETE /api/searches/[id]`          | Delete search (cancel job; 409 if poll active) |
| `POST /api/searches/[id]/poll`       | Enqueue manual poll (rate limited)             |
| `GET /api/searches/[id]/poll-status` | BullMQ job state + queue message               |
| `GET /api/searches/[id]/poll-runs`   | Poll history (`?limit=`)                       |
| `GET /api/alerts`                    | Alert feed (`?savedSearchId=`, `?limit=`)      |
| `DELETE /api/alerts/[id]`            | Dismiss alert                                  |
| `GET/PATCH /api/user/preferences`    | Email notifications + locale                   |
| `GET /health` (worker)               | Local worker health and Facebook session check |

## Roadmap

The project has pivoted from a hosted scraper into a local-first, self-hosted worker model. Next up is AI-assisted listing evaluation. See [Local-first AI roadmap](docs/local-first-ai-roadmap.md).

## Architecture

```txt
Local machine
  Next.js web dashboard
  BullMQ + Playwright worker
  Docker Postgres
  Docker Redis
  .facebook-profile browser profile
  optional Resend email
  future AI provider
```

The worker currently writes directly to Postgres for local-first simplicity, including heartbeat rows used by the dashboard. A web API/token bridge can be added later if the worker needs to run on a separate machine.

## Configuration

See `.env.example`. Key variables:

| Variable                       | Description                                      |
| ------------------------------ | ------------------------------------------------ |
| `DATABASE_URL`                 | PostgreSQL, local Docker by default              |
| `REDIS_URL`                    | Redis for BullMQ, local Docker by default        |
| `AUTH_SECRET`                  | Auth.js / NextAuth secret                        |
| `RESEND_API_KEY`               | Optional email alerts, used by the worker        |
| `MOCK_MARKETPLACE`             | Skip Playwright and return fake listings         |
| `FACEBOOK_BROWSER_PROFILE_DIR` | Persistent local Facebook browser profile        |

## Legal Notice

Facebook prohibits unauthorized automated data collection without permission. This project is intended for **personal, educational, and portfolio use**. You are responsible for complying with Meta's terms and applicable laws.

## License

See [LICENSE](LICENSE).
