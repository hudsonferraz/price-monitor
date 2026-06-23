# Design decisions

This document records **why** price-monitor is shaped the way it is — not just what the code does.

---

## Split web and worker deploy

**Context**  
Facebook Marketplace scraping needs a long-lived Chromium process, filesystem access for session state, and more RAM than Vercel serverless functions allow. Polling must continue when no user has the dashboard open.

**Decision**  
- **Web on Vercel** — Next.js UI + API that enqueues jobs and reads/writes Postgres.
- **Worker on Render** — Docker container running BullMQ consumers + Playwright + Resend.

**Trade-off**  
Two deploy targets, shared env vars, and a wake/ping step for Render free tier. In return, scraping is reliable and the web app stays fast and cheap.

**Revisit when**  
A single host can run Playwright within serverless limits, or Facebook offers an official search API.

---

## BullMQ with concurrency 1

**Context**  
Each poll launches Chromium, loads a heavy SPA, and may scroll multiple times. Render free tier has ~512 MB RAM. Parallel scrapes risk OOM kills and aggressive rate limiting from Facebook.

**Decision**  
- `poll-search` worker `concurrency: 1`, `lockDuration: 120s`.
- Deterministic job ID `poll-{savedSearchId}` prevents duplicate queued jobs for the same search.
- Separate repeatable `schedule-polls` job (every 60s) enqueues due searches without loading all poll-run history.

**Trade-off**  
Polls are serialized — a long poll delays others. Acceptable for personal/portfolio scale; queue position is surfaced in the UI.

**Revisit when**  
Multiple workers with shared rate-limit budget are needed, or memory headroom allows `concurrency > 1`.

---

## Ephemeral Playwright browser per poll

**Context**  
Keeping Chromium open between polls saves cold-start time but holds hundreds of MB on a small container.

**Decision**  
Open browser + context at poll start, close after scrape completes (`marketplace-browser.ts`). Block images, fonts, media, and stylesheets. Pass Chromium flags for low memory (`playwright-memory.ts`).

**Trade-off**  
~30–60s extra per poll for browser startup. Predictable memory footprint on free tier.

**Revisit when**  
Always-on worker tier with guaranteed RAM, or a lighter HTTP-only data path exists.

---

## Triple-source Facebook parsing

**Context**  
Facebook Marketplace is a React SPA. Listing data may arrive via GraphQL XHR, embedded bootstrap JSON, or only as DOM nodes — and which path works can change with A/B tests or loading state.

**Decision**  
`FacebookMarketplaceAdapter` collects from all three during wait, scroll, and final merge. `collectAvailableListings()` deduplicates with explicit source priority (structured data over DOM).

**Trade-off**  
More code and test surface than a single parser. Resilient when one channel is empty during loading or after UI changes.

**Revisit when**  
A stable official API or a single reliable JSON endpoint is confirmed long-term.

---

## Per-search price tracking

**Context**  
The same physical listing can appear in multiple saved searches with different price filters. A global `Listing.priceCents` alone cannot detect “price dropped since **this search** last saw it.”

**Decision**  
`SavedSearchListingPrice` stores the latest price per `(savedSearchId, listingId)`. Price-drop alerts compare current scrape price against that row, not global listing price or full snapshot history scans.

**Trade-off**  
Extra table and upserts each poll. O(1) lookups vs scanning all `PollSnapshotListing` history.

**Revisit when**  
Cross-search price analytics need a separate warehouse; the hot path stays per-search.

---

## Baseline poll (no email on first success)

**Context**  
The first successful poll for a search returns many listings that are “new” to the system but not new to the user who just created the search.

**Decision**  
First successful poll establishes alerts with `seenAt` set (baseline). Email is suppressed for baseline matches. Subsequent polls only notify on genuinely new listings or price drops.

**Trade-off**  
Users do not get spammed on setup. They must understand the first poll is a snapshot, not a burst of deals.

**Revisit when**  
Product asks for “notify me about everything in first poll” as an opt-in.

---

## Exponential backoff on poll failures

**Context**  
Failed polls (Facebook session expired, network blips) should not retry every minute forever — that wastes worker time and can worsen blocks.

**Decision**  
`SavedSearch.consecutiveFailures` increments on failure, resets on success. `isSearchDueForScheduledPoll()` applies exponential backoff (capped at 24h) from `lastAttemptedAt`. BullMQ job `attempts: 1` — no automatic in-queue retries.

**Trade-off**  
A broken session backs off instead of hammering Facebook. User sees failure in poll history and session warning banner.

**Revisit when**  
Different failure classes need different backoff (e.g. immediate retry on 503 vs day-long backoff on auth failure).

---

## Manual poll rate limit (15 minutes)

**Context**  
“Poll now” is useful for debugging and impatience, but unrestricted manual polls could queue many jobs and stress the single worker.

**Decision**  
15-minute cooldown per search on `POST /api/searches/[id]/poll` (HTTP 429 with retry hint). Scheduled polls unaffected.

**Trade-off**  
Power users wait between manual triggers. Protects worker and Facebook session.

**Revisit when**  
Paid tier or admin role needs burst polling.

---

## Soft-dismiss alerts

**Context**  
Users want to clear noise without losing audit history or breaking foreign keys.

**Decision**  
`Alert.dismissedAt` soft-delete. List endpoints filter dismissed rows. “Clear all” sets dismiss on every alert for a search.

**Trade-off**  
Table grows over time; acceptable at personal scale. Hard delete available via search deletion cascade.

**Revisit when**  
Retention policy or GDPR export requires purge jobs.

---

## JWT sessions with Prisma adapter

**Context**  
NextAuth supports database sessions or JWT. The app needs `userId` on API routes with minimal session DB reads.

**Decision**  
`session: { strategy: "jwt" }` with Prisma adapter for account linking. User id embedded in token; preferences read from DB when needed.

**Trade-off**  
Token invalidation is coarser than DB sessions. Fine for a personal alert tool.

**Revisit when**  
Immediate revoke-all-sessions or org SSO is required.

---

## Brazil-first product defaults

**Context**  
Target users search Facebook Marketplace Brazil in reais with Portuguese UI expectations.

**Decision**  
- Default locale `pt-BR`; `en-US` supported via cookie + DB preference.
- Prices stored as BRL cents; `parse-price` handles Brazilian formatting.
- Marketplace location hint and Facebook session docs assume BR Marketplace.

**Trade-off**  
Other regions need adapter and locale work. Scope matches portfolio story and personal use case.

**Revisit when**  
Multi-country Marketplace support is a goal.

---

## Mock marketplace mode

**Context**  
Developers and CI should test alert diffing, email HTML, and dashboard flows without Facebook login or Playwright.

**Decision**  
`MOCK_MARKETPLACE=true` returns deterministic fake listings from the adapter boundary.

**Trade-off**  
Mock data does not catch Facebook HTML/GraphQL drift. Adapter unit tests cover parser merge logic separately.

**Revisit when**  
Recorded HTTP fixtures (VCR-style) are added for regression against real responses.

---

## Email from worker only

**Context**  
Alerts are created during poll execution. Sending email in the web app would duplicate logic and require the web to know poll results.

**Decision**  
Resend calls live in `apps/worker/src/lib/email-notifications.ts`. HTML is escaped (`email-html.ts`). `User.emailNotificationsEnabled` is checked before send.

**Trade-off**  
`RESEND_API_KEY` only on Render, not Vercel. Simpler security boundary.

**Revisit when**  
Transactional email moves to a queue with templates managed in the web app.

---

## Render free tier wake strategy

**Context**  
Render free web services spin down after ~15 minutes without HTTP traffic. BullMQ jobs wait while the worker is asleep.

**Decision**  
- Worker exposes `GET /health`.
- Web pings `WORKER_HEALTH_URL` on **Poll now**.
- Docs recommend UptimeRobot every 5 minutes.
- Optional Vercel Pro cron at `/api/cron/wake-worker` (not on Hobby — blocks deploy).

**Trade-off**  
Extra moving parts for 24/7 polling on free tier. Paid Render Starter removes spin-down.

**Revisit when**  
Worker is always-on or queue supports delayed retry after wake.

---

## Manual schema push before deploy

**Context**  
Vercel and Render run `postinstall` → `prisma generate` but never migrate production Postgres.

**Decision**  
Document and enforce: `npm run db:push` against Neon **before** deploying schema changes.

**Trade-off**  
One manual step per schema release; no migration runner in CI yet.

**Revisit when**  
Prisma Migrate or a CI migration step is added with reviewed SQL.

---

## Legal and scope boundary

**Context**  
Facebook’s terms restrict unauthorized automated collection. This is a portfolio / personal-education project.

**Decision**  
README legal notice; no claims of production scale or ToS compliance. User responsible for their own use.

**Trade-off**  
Limits how the project can be marketed commercially without rework.

**Revisit when**  
Official API access or explicit permission model exists.
