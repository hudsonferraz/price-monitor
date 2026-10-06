# Design: Full-local scraper reliability (phase 1)

Date: 2026-10-06  
Status: draft for review  
Repo: price-monitor

## Goal

Make price-monitor primarily a **reliable full-local Facebook Marketplace scraper**, so polls find listings when the session is valid, and fail loudly with clear reasons when they do not.

Secondary: a thin **local ops** slice so the worker is easy to keep running (the main source of “delay” / empty results when the worker was not up).

## Product decisions (locked)

| Decision | Choice |
|----------|--------|
| Marketplace sources | Facebook only (OLX out of scope) |
| Session ownership | Person using the install logs into **their own** Facebook profile |
| Runtime | **Full local** — Docker Postgres/Redis + web + worker on their machine |
| Multi-user SaaS | North star later; phase 1 = one install ≈ one FB profile |
| Paid notifications | Out of scope (no spend). Existing in-dashboard alerts stay |
| AI / Ollama | Out of scope this phase (roadmap remains separate) |

## Problem

Users saw worker delay and polls that returned no listings. Causes mix:

1. Worker not running / not ready (ops).
2. Facebook session / login wall / checkpoint.
3. Scraper extract weaknesses (merge, wait/scroll, thin GraphQL without images, ambiguous `NO_LISTINGS`).

## Approach

**Approach 2 + thin 1:** scraper-first hardening, plus clearer local bring-up and worker status UX.

Not in phase 1: per-user profile directories on one PC, Discord/email/Telegram, hosted worker, city/radius URL params unless Marketplace still supports them for free and stably.

## Success criteria

Phase 1 is done when:

1. Documented cold start (Docker → login → worker → web) leads to a first poll that either returns listings **or** a clear session/login error — not a silent empty success.
2. With a valid session, a smoke keyword via `spike:facebook` and dashboard **Poll now** usually returns listings.
3. Failed polls always map to a clear issue code and localized dashboard message.
4. Unit tests cover new merge/classification behavior; CI stays green (add `next build` or typecheck if low-cost).

## Architecture (unchanged shape)

```
[Next.js web] --Prisma--> [Postgres]
     | enqueues                ^
     v                         |
[Redis/BullMQ] --> [Worker + Playwright]
                         |
                         v
              [.facebook-profile/] → Facebook Marketplace
```

One browser profile directory per install. Auth can still have multiple OAuth users in DB; scrape identity remains the local profile until a later phase adds per-user dirs.

## Design details

### 1) Local ops

- Document cold path in README; prefer a root script such as `npm run local:up` (or equivalent documented commands) so Docker + guidance for worker/web is obvious.
- Dashboard worker card: first-class **offline / starting / session needed** — must not look like “search broken” when the worker is simply down.
- Keep Poll now; surface failure reasons via shared poll-error helpers.

### 2) Scraper reliability

- **Classify empty better:** distinguish “Marketplace page loaded but parsers extracted 0” from “search truly empty / wrong place” where possible; extend `packages/shared/src/poll-errors.ts` codes and display strings (pt-BR + en-US).
- **Merge polish:** GraphQL + embedded JSON + DOM; fill `imageUrl` when GraphQL omits it; do not skip DOM too aggressively when GraphQL/embedded are thin.
- **Wait/scroll:** reduce premature `NO_LISTINGS` on slow loads while keeping login/checkpoint detection loud.
- **Session:** verify / detect wall before treating as empty; point user to `npm run facebook:login`.
- **Search URL:** optional stable free params (e.g. sort by newest) in `facebook-search-url.ts` only if still valid. No fake city picker without real URL support; keep “results follow FB profile region” hint.
- **Canary:** keep `spike:facebook` as post-login smoke; refresh fixtures when parsers break.

### 3) Data / API / UI touch list

**Data:** no new core models required. Optional PollRun/heartbeat detail fields only if UI needs them during implementation.

**Shared / worker**

- `packages/shared/src/facebook-search-url.ts`
- `packages/shared/src/poll-errors.ts` (+ i18n messages)
- `apps/worker/src/adapters/facebook-marketplace.adapter.ts` (+ parsers)
- `apps/worker/src/lib/facebook-session.ts`, login + spike scripts
- `apps/worker/src/lib/marketplace-browser.ts`

**API / queue**

- Poll job + status routes: clearer error codes through existing ownership (`userId`)
- Worker heartbeat: offline vs session-bad vs last-success distinguishable
- Scheduler behavior unchanged; reliability comes from worker being up

**Web**

- Worker status card, poll banner/history, location hint copy
- Search form: minimal change (only if a real URL option such as sort is added)
- README quickstart / optional `local:up`

**Tests / CI**

- Unit tests for merge, issue classification, URL builder
- No live Facebook in CI; fixtures + local spike
- Optional CI `next build` / typecheck

### 4) Out of scope

- Alert delivery channels, AI implementation, OLX, hosted multi-tenant worker, Auth provider changes, broad UI refactors unrelated to reliability.

### 5) Error handling

| Situation | Expected behavior |
|-----------|-------------------|
| Worker process down | Dashboard: offline; polls do not pretend success |
| Login redirect / wall | `FACEBOOK_SESSION` (+ login instructions) |
| Checkpoint | `FACEBOOK_CHECKPOINT` |
| Page OK, extract 0 | Distinct parse/empty code if distinguishable; else improved `NO_LISTINGS` copy |
| Poll hangs | Existing timeout path; clear `POLL_TIMEOUT` |

### 6) Testing

- Extend adapter/parser/poll-errors unit tests with fixtures.
- Manual: `facebook:login` → `spike:facebook` → Poll now on a known keyword.
- CI: `npm test`; add build/typecheck if cheap.

## Implementation order (guidance for plan)

1. Poll issue classification + dashboard copy.
2. Adapter merge / wait / image fill + tests.
3. Session/spike clarity.
4. Local ops script + README + worker status UX.
5. Optional search URL sort param if verified.
6. CI harden if cheap.

## Non-goals reminder

Do not spend money on infra or notifications. Prefer free local tooling only.
