# Local-first AI roadmap

## Goal

Build a self-hosted Facebook Marketplace monitor with a local interactive worker and AI-assisted listing ranking.

The dashboard should feel portfolio-ready, but the Facebook-facing browser/session lives on the user's machine. The app optimizes for recoverable sessions, clear diagnostics, and useful listing triage.

## Product story

- User runs local Postgres and Redis with Docker Compose.
- User logs into Facebook through `npm run facebook:login`.
- Worker reuses `.facebook-profile/` across restarts.
- Dashboard shows worker heartbeat, Facebook session status, latest successful scrape, and latest failure type.
- AI scores and explains which listings are actually worth attention.

## Architecture target

```txt
Local machine / self-hosted box
  web dashboard          Next.js
  worker                 BullMQ + Playwright
  database               Postgres
  queue                  Redis
  browser profile        .facebook-profile/
  AI provider            OpenAI-compatible API, optional/local configurable
```

## Guiding decisions

- Keep Facebook browser state local.
- Make session recovery interactive through a visible browser.
- Prefer explicit dashboard diagnostics over hidden terminal-only failures.
- Add AI after the scrape path is operational.
- Preserve package boundaries and tests where they help the local-first app.

## Phase 1 - Local-first development mode

Status: done.

Completed:

- Added `docs/local-first-setup.md`.
- Made README local-first.
- Added Docker Compose Postgres/Redis defaults.
- Added `npm run facebook:login` for visible Facebook login.
- Added `FACEBOOK_BROWSER_PROFILE_DIR=.facebook-profile` setup.

Acceptance criteria:

- A developer can run web and worker locally.
- The worker can reuse a local Facebook session across restarts.
- If Facebook shows login/checkpoint, the user can solve it locally.

## Phase 2 - Persistent browser profile

Status: done.

Completed:

- Worker uses `chromium.launchPersistentContext()` with `FACEBOOK_BROWSER_PROFILE_DIR`.
- Spike script uses the same profile path.
- Session diagnostics report browser profile mode.
- Storage-state export/import workflow was removed from the active app.

Acceptance criteria:

- User logs into Facebook once in the local profile.
- Worker polls reuse that profile without exporting/importing JSON.
- Session recovery is "open the browser and fix Facebook".

## Phase 3 - Docker Compose local stack

Status: done for local infrastructure.

Completed:

- Added local Postgres.
- Added local Redis with `noeviction` for BullMQ.
- Added `npm run docker:up`, `docker:down`, `docker:ps`, and `docker:logs`.
- Added local `.env.example` defaults.

Remaining optional work:

- Containerize web and worker for a one-command self-hosted stack.
- Add noVNC/browser access if fully containerized Facebook login becomes useful.

## Phase 4 - Worker pairing and health model

Status: done for direct-DB local architecture.

Completed:

- Added `WorkerHeartbeat` table.
- Worker writes heartbeat every 30 seconds.
- Dashboard shows worker online/offline/stale state.
- Dashboard shows last heartbeat.
- Dashboard shows Facebook session status.
- Dashboard shows latest successful scrape.
- Dashboard shows latest failure type.
- Chose direct DB writes for local-first mode.

Deferred:

- Worker-to-web API token only if the worker later runs on a separate host that should not write directly to Postgres.

## Phase 5 - AI listing evaluation MVP

Status: next.

Objective:

Add a portfolio-worthy AI layer after listings are scraped.

MVP feature:

For each listing, score relevance and explain why it is or is not worth attention.

Data model ideas:

- `ListingEvaluation`
  - `listingId`
  - `savedSearchId`
  - `score` 0-100
  - `verdict` enum: `GOOD_MATCH`, `MAYBE`, `LOW_RELEVANCE`, `RISKY`
  - `reason`
  - `riskNotes`
  - `model`
  - `createdAt`

Prompt inputs:

- saved search keywords
- min/max price
- listing title
- listing price
- location
- optional seller/listing metadata if available
- previous seen prices

Acceptance criteria:

- Dashboard can sort/filter alerts by AI score.
- Alerts show a short AI reason.
- AI failure does not block scraping or alerts.
- Mock mode can run with deterministic fake evaluations for tests.

## Phase 6 - Better notifications

Objective:

Make alerts more useful once AI scoring exists.

Work items:

- Add AI score/reason to email.
- Add Telegram or Discord webhook notifications.
- Add notification thresholds:
  - only notify if score >= N
  - notify price drops regardless of score
  - daily digest mode

Acceptance criteria:

- User gets fewer, better notifications.
- Notification copy explains why the listing is interesting.

## Phase 7 - Search quality improvements

Objective:

Make saved searches closer to real Marketplace workflows.

Work items:

- Exclude keywords.
- Category filter.
- Condition filter.
- Date-listed filter.
- Radius/location configuration.
- Multiple marketplace locations per saved search.

Acceptance criteria:

- Users can reduce noise before AI scoring.
- Scraper URL builder and schemas cover new filters with tests.

## Phase 8 - Documentation and portfolio polish

Objective:

Tell the local-first AI automation story clearly.

Work items:

- Add screenshots of worker/session status.
- Add screenshots of AI scoring on listing cards.
- Add a short architecture diagram for the local setup.
- Add a "Why local-first?" section focused on reliability and privacy.

Acceptance criteria:

- A reviewer understands the product in under one minute.
- Setup docs match the actual local-first path.
- The AI layer is visible, useful, and grounded in real scraped data.