const signInErrorMessages: Record<string, string> = {
  Signin: "Sign-in failed. Try a different account or provider.",
  OAuthSignin: "Could not start sign-in with that provider. Please try again.",
  OAuthCallback: "Sign-in was interrupted. Please try again.",
  OAuthCallbackError: "Sign-in was interrupted. Please try again.",
  OAuthCreateAccount: "Could not create your account. Please try again.",
  EmailCreateAccount: "Could not create your account. Please try again.",
  Callback: "Sign-in failed. Please try again.",
  OAuthAccountNotLinked:
    "This email is already linked to another sign-in method. Use the same provider you signed up with originally (for example, GitHub if you first signed in with GitHub).",
  EmailSignin: "The sign-in email could not be sent. Please try again.",
  CredentialsSignin: "Sign-in failed. Check your details and try again.",
  SessionRequired: "Please sign in to continue.",
  Configuration: "Sign-in is not configured correctly. Contact the site administrator.",
  AccessDenied: "Access was denied. You may have cancelled sign-in or do not have permission.",
  Verification: "The sign-in link has expired or was already used.",
  Default: "Unable to sign in. Please try again.",
};

export function getSignInErrorMessage(errorCode: string | undefined): string | null {
  if (!errorCode) {
    return null;
  }

  return signInErrorMessages[errorCode] ?? signInErrorMessages.Default;
}
