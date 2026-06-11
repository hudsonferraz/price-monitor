# price-monitor

Full-stack marketplace alert app for **Brazil**. Monitor **Facebook Marketplace** for used-item deals and get notified when new listings match your saved searches.

## Legal notice

Facebook prohibits unauthorized automated data collection without permission. This project is intended for **personal, educational, and portfolio use**. You are responsible for complying with Meta's terms and applicable laws.

## Setup

```bash
npm install
npx playwright install chromium
```

Copy `.env.example` to `apps/web/.env.local` and fill in your values:

- `DATABASE_URL` — PostgreSQL connection string (Neon or Supabase work well)
- `AUTH_SECRET` — run `openssl rand -base64 32`
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` — GitHub OAuth app (callback: `http://localhost:3000/api/auth/callback/github`)
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google OAuth client (redirect: `http://localhost:3000/api/auth/callback/google`)

Push the schema to your database:

```bash
npm run db:push
```

## Development

Start the web app:

```bash
npm run dev --workspace=@price-monitor/web
```

Open [http://localhost:3000](http://localhost:3000). Sign in with Google or GitHub, then create saved searches on the dashboard.

## Run the live spike

```bash
npm run spike:facebook
```

Facebook often requires a logged-in session.

**Save a session (one-time):**

```bash
npm run save:facebook-session
```

Sign in when the browser opens, then press Enter in the terminal. This writes `facebook-storage-state.json`.

**Run the spike with that session:**

```powershell
$env:FACEBOOK_STORAGE_STATE_PATH="facebook-storage-state.json"
$env:PLAYWRIGHT_HEADLESS="false"
npm run spike:facebook
```

On success, the script prints matching listings. It also saves the full page HTML locally to `fixtures/facebook-search-iphone-13.html` (gitignored) for optional debugging.

Facebook often shows listings near your **account location** even when the search city differs. That is expected Marketplace behavior.

On failure, debug artifacts are saved under `fixtures/debug/`.

## Run tests

```bash
npm test
```

## Deploy (Vercel)

1. Import the repo and set the **Root Directory** to `apps/web`.
2. Vercel uses `apps/web/vercel.json` to install from the monorepo root and build only the web app (avoids Turbo workspace issues).
3. Add environment variables from `.env.example` in the Vercel project settings.
4. Run `npm run db:push` against your production database before first deploy (if not already done).
5. Update GitHub and Google OAuth callback URLs to your production domain.

The background worker is stubbed for Phase 1; polling and alerts arrive in Phase 2.
