export const CHROMIUM_MEMORY_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--disable-dev-shm-usage",
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-gpu",
  "--disable-software-rasterizer",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-default-apps",
  "--disable-sync",
  "--disable-translate",
  "--metrics-recording-only",
  "--mute-audio",
  "--no-first-run",
  "--safebrowsing-disable-auto-update",
];

export const BLOCKED_PLAYWRIGHT_RESOURCE_TYPES = new Set([
  "image",
  "font",
  "media",
  "stylesheet",
]);

export const MAX_GRAPHQL_RESPONSE_BYTES = 512_000;

export function formatMemoryUsage(): string {
  const { rss, heapUsed, external } = process.memoryUsage();
  const toMegabytes = (bytes: number) => `${Math.round(bytes / 1024 / 1024)}MB`;

  return `rss=${toMegabytes(rss)} heap=${toMegabytes(heapUsed)} external=${toMegabytes(external)}`;
}

export function logMemoryUsage(label: string): void {
  console.log(`[memory] ${label} ${formatMemoryUsage()}`);
}
