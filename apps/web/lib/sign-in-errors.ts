import type { MessageKey } from "@/lib/i18n/messages/en-US";

const signInErrorMessageKeys: Record<string, MessageKey> = {
  Signin: "signInErrorSignin",
  OAuthSignin: "signInErrorOAuthSignin",
  OAuthCallback: "signInErrorOAuthCallback",
  OAuthCallbackError: "signInErrorOAuthCallbackError",
  OAuthCreateAccount: "signInErrorOAuthCreateAccount",
  EmailCreateAccount: "signInErrorEmailCreateAccount",
  Callback: "signInErrorCallback",
  OAuthAccountNotLinked: "signInErrorOAuthAccountNotLinked",
  EmailSignin: "signInErrorEmailSignin",
  CredentialsSignin: "signInErrorCredentialsSignin",
  SessionRequired: "signInErrorSessionRequired",
  Configuration: "signInErrorConfiguration",
  AccessDenied: "signInErrorAccessDenied",
  Verification: "signInErrorVerification",
  Default: "signInErrorDefault",
};

export function getSignInErrorMessageKey(
  errorCode: string | undefined,
): MessageKey | null {
  if (!errorCode) {
    return null;
  }

  return signInErrorMessageKeys[errorCode] ?? signInErrorMessageKeys.Default;
}
