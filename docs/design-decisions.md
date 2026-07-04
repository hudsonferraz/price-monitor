# Design Decisions

## Local-first architecture

Facebook Marketplace sessions are interactive. Login walls, checkpoints, 2FA, and confirmation prompts are normal operational events, not rare edge cases. Keeping the Facebook-facing browser profile on your machine lets you fix those prompts directly with `npm run facebook:login`.

The app is built as local-first automation: a Playwright worker on your machine, Docker Postgres and Redis for data and job queues, and a dashboard with clear worker and session diagnostics.

## Persistent browser profile

`FACEBOOK_BROWSER_PROFILE_DIR` is the primary session mechanism. The worker uses Playwright persistent context mode so cookies, local storage, and Facebook browser state survive restarts.


## Direct DB heartbeat

The worker writes `WorkerHeartbeat` directly to Postgres every 30 seconds. The dashboard reads that table for local worker health without a separate worker-to-web API.

## BullMQ and Redis

BullMQ provides:

- manual and scheduled polls share one queue
- deduplication prevents duplicate poll jobs per search
- concurrency 1 protects browser memory and Facebook rate limits
- job state powers the dashboard poll-status UX

The local Docker Redis service uses `noeviction` because BullMQ warns against eviction policies that can drop queue keys.

## Concurrency 1

Facebook scraping is heavy and stateful. One poll at a time is enough for a personal monitor and avoids noisy failures from parallel Chromium pages, memory pressure, and aggressive Marketplace rate limiting.

## Baseline poll behavior

The first successful poll establishes a baseline and displays matches in the dashboard, but email notifications are reserved for new matches or future price drops. This prevents a new search from immediately spamming all existing Marketplace results.

## Optional email

Email is useful, but not required. Resend failures are logged and do not fail the poll because scraping and alert persistence are the core workflow.
