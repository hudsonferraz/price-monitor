# price-monitor

Full-stack marketplace alert app for **Brazil**. Monitor **Facebook Marketplace** for used-item deals and get notified when new listings match your saved searches.

## Legal notice

Facebook prohibits unauthorized automated data collection without permission. This project is intended for **personal, educational, and portfolio use**. You are responsible for complying with Meta's terms and applicable laws.

## Setup

```bash
npm install
npx playwright install chromium
```

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
