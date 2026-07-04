import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../../..");

export const DEFAULT_FACEBOOK_BROWSER_PROFILE_DIR = ".facebook-profile";
export const FACEBOOK_SESSION_VERIFICATION_FILE = ".facebook-session-verified.json";

export type FacebookSessionMode = "browser_profile" | "none";
export type FacebookSessionStatus = "ok" | "unverified" | "needs_login" | "not_configured";
export type FacebookSessionVerificationSource = "facebook_login" | "successful_poll";

export interface FacebookSessionVerification {
  verifiedAt: string;
  source: FacebookSessionVerificationSource;
  lastFailureAt?: string | null;
}

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
  lastVerifiedAt: string | null;
  lastFailureAt: string | null;
  message: string;
}

function resolveProjectPath(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
}

export function getFacebookBrowserProfileDir(): string {
  const configured = process.env.FACEBOOK_BROWSER_PROFILE_DIR?.trim();
  const profilePath = configured || DEFAULT_FACEBOOK_BROWSER_PROFILE_DIR;
  return resolveProjectPath(profilePath);
}

export function getFacebookSessionVerificationPath(profileDir: string): string {
  return path.join(profileDir, FACEBOOK_SESSION_VERIFICATION_FILE);
}

function isValidVerificationSource(value: unknown): value is FacebookSessionVerificationSource {
  return value === "facebook_login" || value === "successful_poll";
}

export function readFacebookSessionVerification(
  profileDir: string,
): FacebookSessionVerification | null {
  const verificationPath = getFacebookSessionVerificationPath(profileDir);

  if (!existsSync(verificationPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(verificationPath, "utf8")) as FacebookSessionVerification;

    if (typeof parsed.verifiedAt !== "string" || !isValidVerificationSource(parsed.source)) {
      return null;
    }

    if (parsed.lastFailureAt != null && typeof parsed.lastFailureAt !== "string") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeFacebookSessionVerification(
  profileDir: string,
  verification: FacebookSessionVerification,
): void {
  mkdirSync(profileDir, { recursive: true });

  writeFileSync(
    getFacebookSessionVerificationPath(profileDir),
    `${JSON.stringify(verification, null, 2)}\n`,
    "utf8",
  );
}

export function isFacebookSessionAuthFailureActive(
  verification: FacebookSessionVerification,
): boolean {
  if (!verification.lastFailureAt) {
    return false;
  }

  return (
    new Date(verification.lastFailureAt).getTime() >= new Date(verification.verifiedAt).getTime()
  );
}

export function markFacebookSessionVerified(
  source: FacebookSessionVerificationSource,
  profileDir: string = getFacebookBrowserProfileDir(),
): void {
  const verification: FacebookSessionVerification = {
    verifiedAt: new Date().toISOString(),
    source,
    lastFailureAt: null,
  };

  writeFacebookSessionVerification(profileDir, verification);
}

export function markFacebookSessionAuthFailure(
  profileDir: string = getFacebookBrowserProfileDir(),
): void {
  const existing = readFacebookSessionVerification(profileDir);
  const verification: FacebookSessionVerification = {
    verifiedAt: existing?.verifiedAt ?? new Date(0).toISOString(),
    source: existing?.source ?? "facebook_login",
    lastFailureAt: new Date().toISOString(),
  };

  writeFacebookSessionVerification(profileDir, verification);
}

export function getFacebookSessionDiagnostics(
  browserProfileDir: string | null | undefined = getFacebookBrowserProfileDir(),
): FacebookSessionDiagnostics {
  const emptyCookieFields = {
    validJson: false,
    facebookCookieCount: 0,
    hasCUserCookie: false,
    hasXsCookie: false,
    expiredCookieCount: 0,
    persistentCookieCount: 0,
    earliestExpiryIso: null,
    lastVerifiedAt: null,
    lastFailureAt: null,
  };

  if (browserProfileDir == null) {
    return {
      status: "not_configured",
      mode: "none",
      configured: false,
      path: null,
      exists: false,
      ...emptyCookieFields,
      message:
        "FACEBOOK_BROWSER_PROFILE_DIR must be configured. Run npm run facebook:login to create a local Facebook browser profile.",
    };
  }

  const profileExists = existsSync(browserProfileDir);

  if (!profileExists) {
    return {
      status: "needs_login",
      mode: "browser_profile",
      configured: true,
      path: browserProfileDir,
      exists: false,
      ...emptyCookieFields,
      message:
        "Facebook browser profile directory is not created yet. Run npm run facebook:login before polling.",
    };
  }

  const verification = readFacebookSessionVerification(browserProfileDir);
  const lastVerifiedAt = verification?.verifiedAt ?? null;
  const lastFailureAt = verification?.lastFailureAt ?? null;

  if (verification && isFacebookSessionAuthFailureActive(verification)) {
    return {
      status: "needs_login",
      mode: "browser_profile",
      configured: true,
      path: browserProfileDir,
      exists: true,
      ...emptyCookieFields,
      lastVerifiedAt,
      lastFailureAt,
      message:
        "Facebook rejected the local browser session on a recent poll. Run npm run facebook:login and confirm Marketplace loads.",
    };
  }

  if (verification) {
    return {
      status: "ok",
      mode: "browser_profile",
      configured: true,
      path: browserProfileDir,
      exists: true,
      ...emptyCookieFields,
      lastVerifiedAt,
      lastFailureAt,
      message:
        "Facebook session confirmed locally. Login is re-validated during each Marketplace poll.",
    };
  }

  return {
    status: "unverified",
    mode: "browser_profile",
    configured: true,
    path: browserProfileDir,
    exists: true,
    ...emptyCookieFields,
    message:
      "Facebook browser profile folder exists, but login has not been confirmed yet. Run npm run facebook:login or complete a successful poll.",
  };
}

export function assertFacebookSessionReady(): void {
  const diagnostics = getFacebookSessionDiagnostics();

  if (diagnostics.status === "not_configured" || diagnostics.status === "needs_login") {
    throw new Error(`${diagnostics.message} Confirm Marketplace loads before starting the worker.`);
  }
}
