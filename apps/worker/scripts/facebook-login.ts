import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");
const defaultProfileDir = path.join(projectRoot, ".facebook-profile");
const configuredProfileDir = process.env.FACEBOOK_BROWSER_PROFILE_DIR;
const profileDir = configuredProfileDir
  ? path.isAbsolute(configuredProfileDir)
    ? configuredProfileDir
    : path.resolve(projectRoot, configuredProfileDir)
  : defaultProfileDir;

async function main(): Promise<void> {
  await mkdir(profileDir, { recursive: true });

  console.log("Opening Facebook Marketplace with a persistent local browser profile...");
  console.log(`Profile directory: ${profileDir}`);
  console.log("");
  console.log("1. Sign in to Facebook in the browser that opens.");
  console.log("2. Complete any checkpoint, 2FA, or 'confirm this is you' prompts.");
  console.log("3. Open Marketplace and confirm listings are visible.");
  console.log("4. Return here and press Enter to close the browser.");
  console.log("");
  console.log("Use this same FACEBOOK_BROWSER_PROFILE_DIR when running the worker.");

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

  console.log("Facebook browser profile saved.");
  console.log("Run the worker with:");
  console.log(`  FACEBOOK_BROWSER_PROFILE_DIR="${profileDir}" npm run worker:dev`);
  console.log("Run a live scrape smoke test with:");
  console.log(`  FACEBOOK_BROWSER_PROFILE_DIR="${profileDir}" npm run spike:facebook`);
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
