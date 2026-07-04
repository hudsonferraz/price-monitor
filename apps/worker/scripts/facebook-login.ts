import { chromium } from "playwright";
import {
  getFacebookBrowserProfileDir,
  markFacebookSessionVerified,
} from "../src/lib/facebook-session.js";

async function main(): Promise<void> {
  const profileDir = getFacebookBrowserProfileDir();

  console.log("Opening Facebook Marketplace with a persistent local browser profile...");
  console.log(`Profile directory: ${profileDir}`);
  console.log("");
  console.log("1. Sign in to Facebook in the browser that opens.");
  console.log("2. Complete any checkpoint, 2FA, or 'confirm this is you' prompts.");
  console.log("3. Open Marketplace and confirm listings are visible.");
  console.log("4. Return here and press Enter to close the browser.");
  console.log("");
  console.log("The worker uses the same FACEBOOK_BROWSER_PROFILE_DIR from your .env file.");

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    locale: "pt-BR",
    viewport: { width: 1366, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto("https://www.facebook.com/marketplace/", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  await waitForEnterKey();
  await context.close();

  markFacebookSessionVerified("facebook_login", profileDir);

  console.log("Facebook browser profile saved and session marked as confirmed.");
  console.log("Run the worker with:");
  console.log("  npm run worker:dev");
  console.log("Run a live scrape smoke test with:");
  console.log("  npm run spike:facebook");
}

function waitForEnterKey(): Promise<void> {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", () => resolve());
  });
}

main().catch((error: unknown) => {
  console.error("Failed to prepare Facebook browser profile:", error);
  process.exitCode = 1;
});
