import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../../..");

export const DEFAULT_POLL_SNAPSHOT_DIR = ".debug/poll-failures";
export const KEEP_POLL_SNAPSHOTS = 20;

/** The parts of a Playwright page a snapshot needs. */
export interface SnapshotPage {
  url(): string;
  title(): Promise<string>;
  content(): Promise<string>;
  screenshot(options: { path: string; fullPage?: boolean; timeout?: number }): Promise<unknown>;
}

export function getPollSnapshotDir(): string {
  const configured = process.env.POLL_SNAPSHOT_DIR?.trim() || DEFAULT_POLL_SNAPSHOT_DIR;
  return path.isAbsolute(configured) ? configured : path.resolve(projectRoot, configured);
}

function timestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 23);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "error";
}

/**
 * Saves what the browser showed when a real Facebook poll failed: page.png, page.html and
 * page.txt (URL, title, error). Failures are often intermittent, so the page is gone by the time
 * anyone looks. The files can contain personal data (account name, messages), so they stay in a
 * git-ignored local folder. Best-effort: never throws, and returns the folder or null.
 */
export async function saveFailureSnapshot(
  page: SnapshotPage,
  reason: string,
  error: unknown,
  options: { dir?: string; keep?: number; now?: Date } = {},
): Promise<string | null> {
  const dir = options.dir ?? getPollSnapshotDir();
  const keep = options.keep ?? KEEP_POLL_SNAPSHOTS;
  try {
    const folder = path.join(dir, `${timestamp(options.now ?? new Date())}_${slug(reason)}`);
    await mkdir(folder, { recursive: true });

    const message = error instanceof Error ? error.message : String(error);
    const url = (() => {
      try {
        return page.url();
      } catch {
        return "(unknown)";
      }
    })();
    const title = await page.title().catch(() => "(unknown)");
    await writeFile(path.join(folder, "page.txt"), `URL: ${url}\nTitle: ${title}\nError: ${message}\n`, "utf8");
    const html = await page.content().catch(() => null);
    if (html != null) await writeFile(path.join(folder, "page.html"), html, "utf8");
    await page.screenshot({ path: path.join(folder, "page.png"), fullPage: false, timeout: 10_000 }).catch(() => undefined);

    await pruneSnapshots(dir, keep);
    return folder;
  } catch {
    return null;
  }
}

/** Keeps the newest `keep` snapshot folders (names start with a sortable timestamp). */
export async function pruneSnapshots(dir: string, keep: number): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const excess = folders.slice(0, Math.max(0, folders.length - keep));
  await Promise.all(excess.map((name) => rm(path.join(dir, name), { recursive: true, force: true })));
}
