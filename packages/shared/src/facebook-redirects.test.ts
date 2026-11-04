import { describe, expect, it } from "vitest";
import { classifyFacebookRedirect, FACEBOOK_REDIRECT_MESSAGES } from "./facebook-redirects";
import { getPollIssueCode } from "./poll-errors";

describe("classifyFacebookRedirect", () => {
  it("detects login, checkpoint, two-step verification and consent by path", () => {
    expect(classifyFacebookRedirect("https://www.facebook.com/login/?next=%2Fmarketplace")).toBe("login");
    expect(classifyFacebookRedirect("https://www.facebook.com/login.php")).toBe("login");
    expect(classifyFacebookRedirect("https://www.facebook.com/checkpoint/1501092823525282/")).toBe("checkpoint");
    expect(classifyFacebookRedirect("https://www.facebook.com/auth_platform/two_step_verification/")).toBe("checkpoint");
    expect(classifyFacebookRedirect("https://www.facebook.com/privacy/consent/marketplace/?flow=x")).toBe("consent");
  });

  it("does not flag Marketplace pages, even when the query mentions login", () => {
    expect(classifyFacebookRedirect("https://www.facebook.com/marketplace/search?query=login")).toBeNull();
    expect(classifyFacebookRedirect("https://www.facebook.com/marketplace/search?query=checkpoint%20bike")).toBeNull();
    expect(classifyFacebookRedirect("not a url")).toBeNull();
  });

  it("uses messages the dashboard already classifies", () => {
    expect(getPollIssueCode(FACEBOOK_REDIRECT_MESSAGES.login)).toBe("FACEBOOK_SESSION");
    expect(getPollIssueCode(FACEBOOK_REDIRECT_MESSAGES.checkpoint)).toBe("FACEBOOK_CHECKPOINT");
    expect(getPollIssueCode(FACEBOOK_REDIRECT_MESSAGES.consent)).toBe("FACEBOOK_CHECKPOINT");
  });
});
