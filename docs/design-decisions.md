# Design Decisions

## Local-first over hosted scraping

Facebook Marketplace sessions are interactive. Login walls, checkpoints, 2FA, and confirmation prompts are normal operational events, not rare edge cases. Keeping the Facebook-facing browser profile local lets the user fix those prompts directly with `npm run facebook:login`.

The old hosted worker path required exporting cookies and uploading a secret file. That made the demo look cloud-native, but it made the core workflow unreliable. The current product story is simpler and more honest: local/self-hosted automation with clear diagnostics.

## Persistent browser profile

`FACEBOOK_BROWSER_PROFILE_DIR` is the primary session mechanism. The worker uses Playwright persistent context mode so cookies, local storage, and Facebook browser state survive restarts.


## Direct DB heartbeat

The worker writes `WorkerHeartbeat` directly to Postgres every 30 seconds. This avoids adding a worker-to-web API and token before the project needs it. If the worker later runs on a separate host with tighter network boundaries, a `WORKER_TOKEN` + web API bridge can replace direct DB writes.

## BullMQ and Redis remain

Even in local-first mode, BullMQ keeps useful behavior:

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

Email is useful, but not required for the local-first app. Resend failures are logged and do not fail the poll because scraping and alert persistence are the core workflow.

## AI after scraping stability

AI evaluation is intentionally Phase 5. The scraper, worker heartbeat, and session recovery needed to be understandable first. Once listings are reliably captured, AI can score relevance, explain risks, and reduce notification noise without masking infrastructure problems.
