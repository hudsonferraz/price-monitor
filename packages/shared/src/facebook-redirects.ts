export type FacebookRedirect = "login" | "checkpoint" | "consent";

/**
 * What Facebook sent the browser to instead of Marketplace, judged by the URL path only, so it
 * works in any account language and a search for the word "login" is not mistaken for a redirect.
 */
export function classifyFacebookRedirect(url: string): FacebookRedirect | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    return null;
  }

  if (pathname.startsWith("/privacy/consent")) return "consent";
  if (pathname.startsWith("/checkpoint") || pathname.includes("two_step_verification")) return "checkpoint";
  if (pathname.startsWith("/login")) return "login";
  return null;
}

/**
 * Error messages for each redirect. Their wording is matched by getPollIssueCode: "redirected to
 * login" is a session problem; "checkpoint" covers both checkpoints and the consent screen, whose
 * fix is the same (open the browser profile and clear the prompt).
 */
export const FACEBOOK_REDIRECT_MESSAGES: Record<FacebookRedirect, string> = {
  login: "Facebook redirected to login. Run npm run facebook:login and fix the local Facebook browser profile.",
  checkpoint:
    "Facebook redirected to checkpoint (security check or two-step verification). Run npm run facebook:login and clear the prompt in the browser profile.",
  consent:
    "Facebook redirected to checkpoint: Marketplace data-usage consent. Run npm run facebook:login and accept it once in the browser profile; the scraper never accepts it for you.",
};
