import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../../..");

export type FacebookSessionMode = "browser_profile" | "none";
export type FacebookSessionStatus = "ok" | "not_configured";

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

export function getFacebookSessionDiagnostics(
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
    message: "FACEBOOK_BROWSER_PROFILE_DIR must be configured. Run npm run facebook:login to create a local Facebook browser profile.",
  };
}

export function assertFacebookSessionReady(): void {
  const diagnostics = getFacebookSessionDiagnostics();

  if (diagnostics.status !== "ok") {
    throw new Error(`${diagnostics.message} Confirm Marketplace loads before starting the worker.`);
  }
}