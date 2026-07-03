import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../../..");

interface StorageStateCookie {
  name?: string;
  domain?: string;
  expires?: number;
}

interface StorageStateFile {
  cookies?: StorageStateCookie[];
}

export type FacebookSessionMode = "browser_profile" | "storage_state" | "none";
export type FacebookSessionStatus = "ok" | "missing" | "invalid" | "incomplete" | "not_configured";

export interface FacebookSessionDiagnostics {
  status: FacebookSessionStatus;
  mode: FacebookSessionMode;
  configured: boolean;
  path: string | null;
  exists: boolean;
  validJson: boolean;
  facebookCookieCount: number;
  hasCUserCookie: boolean;
  hasXsCookie: boolean;
  expiredCookieCount: number;
  persistentCookieCount: number;
  earliestExpiryIso: string | null;
  message: string;
}

function resolveProjectPath(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
}

export function getFacebookBrowserProfileDir(): string | undefined {
  return resolveProjectPath(process.env.FACEBOOK_BROWSER_PROFILE_DIR);
}

export function getFacebookStorageStatePath(): string | undefined {
  return resolveProjectPath(process.env.FACEBOOK_STORAGE_STATE_PATH);
}

export function getFacebookSessionDiagnostics(
  storageStatePath: string | null | undefined = getFacebookStorageStatePath(),
  now = Date.now(),
  browserProfileDir: string | null | undefined = getFacebookBrowserProfileDir(),
): FacebookSessionDiagnostics {
  if (browserProfileDir) {
    return {
      status: "ok",
      mode: "browser_profile",
      configured: true,
      path: browserProfileDir,
      exists: existsSync(browserProfileDir),
      validJson: false,
      facebookCookieCount: 0,
      hasCUserCookie: false,
      hasXsCookie: false,
      expiredCookieCount: 0,
      persistentCookieCount: 0,
      earliestExpiryIso: null,
      message: "Persistent Facebook browser profile is configured. Login is validated during browser navigation.",
    };
  }

  if (!storageStatePath) {
    return {
      status: "not_configured",
      mode: "none",
      configured: false,
      path: null,
      exists: false,
      validJson: false,
      facebookCookieCount: 0,
      hasCUserCookie: false,
      hasXsCookie: false,
      expiredCookieCount: 0,
      persistentCookieCount: 0,
      earliestExpiryIso: null,
      message: "FACEBOOK_BROWSER_PROFILE_DIR or FACEBOOK_STORAGE_STATE_PATH must be configured.",
    };
  }

  if (!existsSync(storageStatePath)) {
    return {
      status: "missing",
      mode: "storage_state",
      configured: true,
      path: storageStatePath,
      exists: false,
      validJson: false,
      facebookCookieCount: 0,
      hasCUserCookie: false,
      hasXsCookie: false,
      expiredCookieCount: 0,
      persistentCookieCount: 0,
      earliestExpiryIso: null,
      message: "Facebook storage state file does not exist at configured path.",
    };
  }

  let parsed: StorageStateFile;
  try {
    parsed = JSON.parse(readFileSync(storageStatePath, "utf8")) as StorageStateFile;
  } catch {
    return {
      status: "invalid",
      mode: "storage_state",
      configured: true,
      path: storageStatePath,
      exists: true,
      validJson: false,
      facebookCookieCount: 0,
      hasCUserCookie: false,
      hasXsCookie: false,
      expiredCookieCount: 0,
      persistentCookieCount: 0,
      earliestExpiryIso: null,
      message: "Facebook storage state file is not valid JSON.",
    };
  }

  const cookies = Array.isArray(parsed.cookies) ? parsed.cookies : [];
  const facebookCookies = cookies.filter((cookie) =>
    typeof cookie.domain === "string" && cookie.domain.includes("facebook.com"),
  );
  const nowSeconds = Math.floor(now / 1000);
  const expiringCookies = facebookCookies.filter(
    (cookie) => typeof cookie.expires === "number" && cookie.expires > 0,
  );
  const expiredCookieCount = expiringCookies.filter((cookie) => (cookie.expires ?? 0) <= nowSeconds).length;
  const persistentCookieCount = facebookCookies.filter(
    (cookie) => typeof cookie.expires === "number" && cookie.expires > nowSeconds,
  ).length;
  const earliestExpiry = expiringCookies
    .map((cookie) => cookie.expires as number)
    .filter((expires) => expires > nowSeconds)
    .sort((left, right) => left - right)[0];
  const hasCUserCookie = facebookCookies.some((cookie) => cookie.name === "c_user");
  const hasXsCookie = facebookCookies.some((cookie) => cookie.name === "xs");
  const hasRequiredCookies = hasCUserCookie && hasXsCookie;

  if (facebookCookies.length === 0) {
    return {
      status: "invalid",
      mode: "storage_state",
      configured: true,
      path: storageStatePath,
      exists: true,
      validJson: true,
      facebookCookieCount: 0,
      hasCUserCookie,
      hasXsCookie,
      expiredCookieCount,
      persistentCookieCount,
      earliestExpiryIso: null,
      message: "Storage state is valid JSON, but it does not contain Facebook cookies.",
    };
  }

  if (!hasRequiredCookies) {
    return {
      status: "incomplete",
      mode: "storage_state",
      configured: true,
      path: storageStatePath,
      exists: true,
      validJson: true,
      facebookCookieCount: facebookCookies.length,
      hasCUserCookie,
      hasXsCookie,
      expiredCookieCount,
      persistentCookieCount,
      earliestExpiryIso: earliestExpiry ? new Date(earliestExpiry * 1000).toISOString() : null,
      message: "Facebook cookies are present, but login cookies c_user/xs are incomplete.",
    };
  }

  return {
    status: "ok",
    mode: "storage_state",
    configured: true,
    path: storageStatePath,
    exists: true,
    validJson: true,
    facebookCookieCount: facebookCookies.length,
    hasCUserCookie,
    hasXsCookie,
    expiredCookieCount,
    persistentCookieCount,
    earliestExpiryIso: earliestExpiry ? new Date(earliestExpiry * 1000).toISOString() : null,
    message: "Facebook storage state looks usable.",
  };
}

export function assertFacebookSessionReady(): void {
  const diagnostics = getFacebookSessionDiagnostics();

  if (diagnostics.status !== "ok") {
    throw new Error(`${diagnostics.message} Run npm run facebook:login locally or refresh facebook-storage-state.json.`);
  }
}
