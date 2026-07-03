import { existsSync, readFileSync } from "node:fs";

interface StorageStateCookie {
  name?: string;
  domain?: string;
  expires?: number;
}

interface StorageStateFile {
  cookies?: StorageStateCookie[];
}

export type FacebookSessionStatus = "ok" | "missing" | "invalid" | "incomplete" | "not_configured";

export interface FacebookSessionDiagnostics {
  status: FacebookSessionStatus;
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

export function getFacebookStorageStatePath(): string | undefined {
  return process.env.FACEBOOK_STORAGE_STATE_PATH || undefined;
}

export function getFacebookSessionDiagnostics(
  storageStatePath = getFacebookStorageStatePath(),
  now = Date.now(),
): FacebookSessionDiagnostics {
  if (!storageStatePath) {
    return {
      status: "not_configured",
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
      message: "FACEBOOK_STORAGE_STATE_PATH is not configured.",
    };
  }

  if (!existsSync(storageStatePath)) {
    return {
      status: "missing",
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
    throw new Error(`${diagnostics.message} Refresh facebook-storage-state.json on Render.`);
  }
}
