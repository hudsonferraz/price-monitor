# Full-local scraper reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make full-local Facebook Marketplace polls reliably return listings when the session is valid, and fail with clear issue codes when they do not; make the local worker cold-path obvious.

**Architecture:** Keep one-install / one-FB-profile local stack. Harden adapter merge (GraphQL + embedded + DOM with image fill), clarify empty vs parse failures, optional newest sort on search URL, strengthen worker offline UX + README/`local:up`, optionally add CI `next build`.

**Tech Stack:** TypeScript, Vitest, Playwright worker, Next.js web, Prisma/Postgres, BullMQ/Redis, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-10-06-scraper-local-reliability-design.md`

## Global Constraints

- Facebook only; no OLX; no paid notification services; no AI this phase.
- Full local: Docker Postgres/Redis + web + worker on the user's machine.
- One install ≈ one Facebook browser profile (`.facebook-profile/`).
- No live Facebook calls in CI — fixtures + unit tests only.
- Prefer improving existing modules over large refactors.

## File map

| File | Responsibility |
|------|----------------|
| `packages/shared/src/poll-errors.ts` | Issue codes + English display fallbacks |
| `packages/shared/src/facebook-search-url.ts` | Marketplace search URL (add sort) |
| `apps/worker/src/adapters/facebook-marketplace.adapter.ts` | Wait/scroll/merge/GraphQL extract |
| `apps/web/lib/poll-error-i18n.ts` | Map codes → message keys |
| `apps/web/lib/i18n/messages/{en-US,pt-BR}.ts` | Copy |
| `apps/web/components/worker-status-card.tsx` | Offline/missing guidance |
| `apps/web/components/poll-diagnostics-panel.tsx` | New issue code titles |
| `package.json` / `README.md` | `local:up` + cold path |
| `.github/workflows/ci.yml` | Optional build step |

---

### Task 1: PARSE_EMPTY issue code

**Files:**
- Modify: `packages/shared/src/poll-errors.ts`
- Modify: `packages/shared/src/poll-errors.test.ts`
- Modify: `apps/web/lib/poll-error-i18n.ts`
- Modify: `apps/web/lib/i18n/messages/en-US.ts`, `pt-BR.ts`
- Modify: `apps/web/components/poll-diagnostics-panel.tsx`
- Modify: `apps/web/components/worker-status-card.tsx` (`formatIssueCode`)

**Interfaces:**
- Produces: `PollIssueCode` includes `"PARSE_EMPTY"`; `getPollIssueCode` matches substring `failed to parse marketplace listings` (case-insensitive).

- [ ] **Step 1: Extend failing tests in `poll-errors.test.ts`**

```ts
it("classifies parse-empty separately from no-listings", () => {
  expect(
    getPollIssueCode(
      "Failed to parse Marketplace listings from a loaded Facebook page. Current URL: https://www.facebook.com/marketplace/search?query=x",
    ),
  ).toBe("PARSE_EMPTY");
  expect(getPollIssueCode("No Facebook Marketplace listings found. Current URL: ...")).toBe(
    "NO_LISTINGS",
  );
});
```

- [ ] **Step 2: Run test — expect FAIL** (`PARSE_EMPTY` not in type / returns UNKNOWN)

Run: `npm test -- packages/shared/src/poll-errors.test.ts`

- [ ] **Step 3: Implement code + i18n + diagnostics switches**

Add `"PARSE_EMPTY"` to `PollIssueCode`. In `getPollIssueCode`, check `failed to parse marketplace listings` **before** the generic no-listings matcher. Add `formatPollErrorForDisplay` branch. Wire `pollErrorParseEmpty` / `diagnosticsParseEmptyTitle` / `diagnosticsParseEmptyDescription` in en-US + pt-BR. Update `poll-error-i18n`, `poll-diagnostics-panel`, `worker-status-card`.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/poll-errors.ts packages/shared/src/poll-errors.test.ts apps/web/lib/poll-error-i18n.ts apps/web/lib/i18n/messages/en-US.ts apps/web/lib/i18n/messages/pt-BR.ts apps/web/components/poll-diagnostics-panel.tsx apps/web/components/worker-status-card.tsx
git commit -m "feat: distinguish PARSE_EMPTY from NO_LISTINGS poll errors"
```

---

### Task 2: Adapter merge + GraphQL images + wait errors

**Files:**
- Modify: `apps/worker/src/adapters/facebook-marketplace.adapter.ts`
- Modify: `apps/worker/src/adapters/facebook-marketplace.adapter.test.ts`

**Interfaces:**
- Consumes: PARSE_EMPTY message wording from Task 1 (`Failed to parse Marketplace listings from a loaded Facebook page`)
- Produces: `collectAvailableListings` merges GraphQL + embedded + DOM and fills missing `imageUrl`; `waitForSearchResults` throws PARSE_EMPTY vs NO_LISTINGS; GraphQL listings may include `imageUrl`.

- [ ] **Step 1: Add failing tests**

```ts
it("fills missing GraphQL imageUrl from DOM for the same externalId", () => {
  const listings = collectAvailableListings(domFixture, 24, [
    {
      externalId: "4720490308074106",
      title: "GraphQL listing",
      price: "R$ 100",
      url: "https://www.facebook.com/marketplace/item/4720490308074106",
    },
  ]);
  expect(listings.find((l) => l.externalId === "4720490308074106")?.imageUrl).toBeTruthy();
});

it("still uses DOM when embedded JSON is present but thin", () => {
  // if fixtures allow: ensure DOM not hard-skipped when we change merge policy
});
```

Also export or unit-test a small helper if needed: prefer changing `dedupeRawListings` to merge images in place.

- [ ] **Step 2: Run adapter tests — expect image fill FAIL**

Run: `npm test -- apps/worker/src/adapters/facebook-marketplace.adapter.test.ts`

- [ ] **Step 3: Implement**

1. Change `collectAvailableListings` to always parse DOM (not only when embedded empty), then `dedupeRawListings` that **merges** missing `imageUrl` / `location` / `price` onto first-seen id.
2. In `extractListingsFromGraphqlJson`, set `imageUrl` from `primary_listing_photo?.image?.uri` (same shape as embedded parser) when present on the record.
3. In `waitForSearchResults`: bump deadline to ~50s; if timeout and `looksLikeMarketplaceSearchPage(html, url)` throw PARSE_EMPTY message; else keep NO_LISTINGS message. Helper: URL contains `/marketplace` and html matches `/marketplace/i` without requiring login wall.
4. Export `looksLikeMarketplaceSearchPage` only if tested.

- [ ] **Step 4: Run adapter + shared tests — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "fix: harden Marketplace listing merge, images, and empty-page errors"
```

---

### Task 3: Search URL sort by newest

**Files:**
- Modify: `packages/shared/src/facebook-search-url.ts`
- Modify: `packages/shared/src/facebook-search-url.test.ts`

**Interfaces:**
- Produces: `buildFacebookMarketplaceSearchUrl` always appends `sortBy=creation_time_descend` (stable free FB param).

- [ ] **Step 1: Failing test expecting `sortBy=creation_time_descend` in URL**
- [ ] **Step 2: Run — FAIL**
- [ ] **Step 3: Implement param in builder**
- [ ] **Step 4: Run — PASS**
- [ ] **Step 5: Commit** `feat: sort Marketplace search results by newest`

---

### Task 4: Local ops script + README + worker copy

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `apps/web/lib/i18n/messages/en-US.ts`, `pt-BR.ts` (workerStatusMissing / Offline / Stale)

**Interfaces:**
- Produces: `npm run local:up` runs `docker:up` then `db:push` and prints next steps (login, worker, web).

- [ ] **Step 1: Add script**

```json
"local:up": "npm run docker:up && npm run db:push && node -e \"console.log('\\nNext:\\n 1) npm run facebook:login\\n 2) npm run worker:dev\\n 3) npm run dev --workspace=@price-monitor/web\\n')\""
```

(Use a tiny `scripts/local-up.mjs` if escaping is painful on Windows.)

- [ ] **Step 2: Update README Quickstart** to lead with `npm run local:up` then login → worker → web; note one FB profile per install.
- [ ] **Step 3: Strengthen worker missing/offline/stale strings** to mention cold order (`local:up` / `facebook:login` / `worker:dev`).
- [ ] **Step 4: Commit** `docs: add local:up cold path and clearer worker offline copy`

---

### Task 5: CI build harden

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: After tests, add build step** with dummy env:

```yaml
- name: Build web app
  run: npm run build
  env:
    CI: true
    DATABASE_URL: postgresql://ci:ci@localhost:5432/ci
    AUTH_SECRET: ci-secret-for-build-only
    AUTH_GITHUB_ID: ci
    AUTH_GITHUB_SECRET: ci
    AUTH_GOOGLE_ID: ci
    AUTH_GOOGLE_SECRET: ci
```

(Adjust env keys to match what `apps/web` requires at build time — inspect `auth` config if build fails.)

- [ ] **Step 2: Run `npm run build` locally with dummy env — fix if needed**
- [ ] **Step 3: Commit** `ci: build Next.js app in GitHub Actions`

---

### Task 6: Full verification

- [ ] **Step 1:** `npm test`
- [ ] **Step 2:** `npm run build` with dummy AUTH/DATABASE env
- [ ] **Step 3:** Mark plan checkboxes done in this file if convenient
- [ ] **Step 4:** Report to user: what changed, how to smoke-test (`local:up` → login → spike → Poll now)

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Cold path documented / script | 4 |
| Worker offline UX | 4 |
| Clear issue codes | 1, 2 |
| Merge + images | 2 |
| Wait/scroll / empty classification | 2 |
| Search URL sort | 3 |
| Session guidance (existing + copy) | 1, 4 |
| Canary spike (keep, no rewrite) | covered by docs in 4 |
| CI build | 5 |
| Out of scope (alerts/AI/OLX) | not scheduled |
