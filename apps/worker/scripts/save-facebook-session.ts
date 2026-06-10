import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");
const defaultOutputPath = path.join(projectRoot, "facebook-storage-state.json");

async function main(): Promise<void> {
  const outputPath = process.env.FACEBOOK_STORAGE_STATE_PATH ?? defaultOutputPath;
  await mkdir(path.dirname(outputPath), { recursive: true });

  console.log("Opening Facebook in a visible browser...");
  console.log("1. Sign in to your Facebook account");
  console.log("2. Open Marketplace once if prompted");
  console.log("3. Return here and press Enter to save the session");
  console.log(`Session will be saved to: ${outputPath}`);

  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    locale: "pt-BR",
    viewport: { width: 1366, height: 900 },
  });
  const page = await context.newPage();

  await page.goto("https://www.facebook.com/marketplace/", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  await waitForEnterKey();

  await context.storageState({ path: outputPath });
  console.log(`Saved Facebook storage state to ${outputPath}`);
  console.log("Run the spike with:");
  console.log(`  FACEBOOK_STORAGE_STATE_PATH="${outputPath}" npm run spike:facebook`);

  await browser.close();
}

function waitForEnterKey(): Promise<void> {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", () => resolve());
  });
}

main().catch((error: unknown) => {
  console.error("Failed to save Facebook session:", error);
  process.exitCode = 1;
});
