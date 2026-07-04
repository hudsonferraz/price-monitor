# Architecture

price-monitor is a local-first personal automation app. The web dashboard and worker share a local Postgres database and Redis queue, while the Facebook-facing browser profile stays on the user's machine.

```txt
Local machine
  Next.js web app
    - dashboard UI
    - saved search APIs
    - alert APIs
    - reads worker heartbeat from Postgres

  BullMQ worker
    - scheduler and poll consumers
    - Playwright Facebook Marketplace scraper
    - persistent local browser profile
    - writes heartbeat and poll results to Postgres

  Docker Compose services
    - Postgres
    - Redis with noeviction policy

  Local filesystem
    - .facebook-profile/ ignored by git
```

## Poll Lifecycle

1. User creates a saved search in the dashboard.
2. User clicks **Poll now** or the worker scheduler finds a due search.
3. Web/API enqueues a BullMQ poll job in Redis.
4. Worker consumes the job with concurrency 1.
5. Worker opens Facebook Marketplace using the persistent browser profile.
6. Listings are extracted through captured API responses, embedded JSON, and DOM fallback.
7. Worker upserts listings, snapshots prices per saved search, creates alerts, and records a `PollRun`.
8. Dashboard refreshes poll status, alerts, worker heartbeat, and latest scrape/failure summaries.

## Facebook Session Model

The primary session mechanism is `FACEBOOK_BROWSER_PROFILE_DIR=.facebook-profile` with `chromium.launchPersistentContext()`. The user refreshes the session by running:

```bash
npm run facebook:login
```

This opens a visible browser where the user can complete login, 2FA, checkpoint, or CAPTCHA prompts.

## Worker Health

The worker writes a `WorkerHeartbeat` row every 30 seconds with:

- worker id
- hostname and pid
- last seen timestamp
- Facebook session status/mode

The dashboard uses that DB heartbeat as the local worker health signal.

## Data Stores

| Store            | Purpose                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| Postgres         | Users, sessions, saved searches, listings, alerts, poll runs, heartbeat |
| Redis            | BullMQ queues and scheduler state                                       |
| Local filesystem | Persistent Facebook browser profile                                     |
