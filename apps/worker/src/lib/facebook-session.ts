import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../../..");

export type FacebookSessionMode = "browser_profile" | "none";
export type FacebookSessionStatus = "ok" | "needs_login" | "not_configured";

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
  const emptyCookieFields = {
    validJson: false,
    facebookCookieCount: 0,
    hasCUserCookie: false,
    hasXsCookie: false,
    expiredCookieCount: 0,
    persistentCookieCount: 0,
    earliestExpiryIso: null,
  };

  if (browserProfileDir) {
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

    return {
      status: "ok",
      mode: "browser_profile",
      configured: true,
      path: browserProfileDir,
      exists: true,
      ...emptyCookieFields,
      message:
        "Persistent Facebook browser profile is ready. Login is re-validated during each Marketplace poll.",
    };
  }

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

export function assertFacebookSessionReady(): void {
  const diagnostics = getFacebookSessionDiagnostics();

  if (diagnostics.status === "not_configured") {
    throw new Error(`${diagnostics.message} Confirm Marketplace loads before starting the worker.`);
  }
}
