export const messages = {
  appName: "price-monitor",
  appDescription: "Facebook Marketplace deal alerts for Brazil",

  navDashboard: "Dashboard",
  navSignIn: "Sign in",
  navSignOut: "Sign out",
  languageLabel: "Language",

  homeEyebrow: "Facebook Marketplace · Brazil",
  homeTitle: "Get alerted when used deals match your search",
  homeDescription:
    "Save searches for items on Facebook Marketplace. When new listings appear within your price range, they show up in your dashboard.",
  homeGetStarted: "Get started",
  homeGoToDashboard: "Go to dashboard",
  homeFeatureSaveTitle: "Save searches",
  homeFeatureSaveDescription: "Keywords and optional min/max price in Brazilian reais.",
  homeFeaturePollingTitle: "Automatic polling",
  homeFeaturePollingDescription: "Background worker checks Marketplace on a schedule you control.",
  homeFeatureAlertsTitle: "Deal alerts",
  homeFeatureAlertsDescription: "New matches show up in your feed — no manual refreshing.",

  signInTitle: "Sign in",
  signInDescription: "Sign in with Google or GitHub to access your saved searches and alerts.",
  signInFailedTitle: "Sign-in failed",
  signInBackHome: "Back to home",
  signInGoogle: "Continue with Google",
  signInGitHub: "Continue with GitHub",

  dashboardTitle: "Dashboard",
  dashboardDescription: "Monitor Facebook Marketplace searches and review new listing alerts.",
  dashboardYourSearches: "Your searches",
  dashboardNewSearch: "New search",
  dashboardNoSearches:
    "No saved searches yet. Create one below to start monitoring Facebook Marketplace.",


  apiErrorUnauthorized: "Please sign in to continue.",
  apiErrorSearchNotFound: "Saved search not found.",
  apiErrorSearchIdRequired: "Search id is required.",
  apiErrorSearchDisabled: "This search is disabled. Enable it before polling.",
  apiErrorSearchDeleteActivePoll:
    "A poll is currently running for this search. Try deleting again in a minute.",
  apiErrorSearchDeleteCancelFailed:
    "Could not cancel the pending poll job. Try again shortly.",
  apiErrorAlertNotFound: "Alert not found.",
  apiErrorUserNotFound: "User not found.",
  apiErrorValidationFailed: "Some fields are invalid. Check the form and try again.",
  apiErrorNoPreferenceFields: "No valid preference fields were provided.",
  apiErrorInvalidPreferredLocale: "Language must be English or Portuguese.",
  apiErrorRedisNotConfigured: "Redis is not configured. Start Docker and the local worker to enable polling.",
  apiErrorPollQueueFailed: "Failed to queue the poll. Check that Redis and the worker are running.",
  apiErrorWorkerOffline:
    "Local worker is not running. Open a second terminal and run: npm run worker:dev — then try Poll now again.",
  apiErrorWorkerStale:
    "Local worker heartbeat is stale (worker may have stopped). Restart it with: npm run worker:dev — then try Poll now again.",
  apiErrorUnknown: "Something went wrong. Please try again.",


  workerStatusTitle: "Local worker",
  workerStatusOnline: "Worker is online and writing heartbeats. Polls should run locally.",
  workerStatusStale:
    "Worker heartbeat is stale. Restart the worker with: npm run worker:dev",
  workerStatusOffline: "Worker stopped cleanly. Start it again with: npm run worker:dev",
  workerStatusMissing:
    "No local worker connected yet. Open a second terminal and run: npm run worker:dev",
  workerStatusId: "Worker: {id}",
  workerStatusLastSeen: "Last seen: {date}",
  workerStatusRuntime: "Runtime",
  workerStatusFacebookSession: "Facebook session",
  workerStatusLastSuccess: "Last successful scrape",
  workerStatusLastFailure: "Last failure",
  workerStatusNoSuccess: "No successful scrape yet.",
  workerStatusNoFailure: "No failed polls recorded.",
  workerStatusSuccessSummary: "{date} - {listings} listing(s), {alerts} alert(s){duration}",
  workerStatusFailureSummary: "{date} - {issue}. Failed polls in 24h: {failedPolls}",
  workerFacebookSessionUnknown: "Unknown",
  workerFacebookSessionOk: "Confirmed",
  workerFacebookSessionUnverified: "Not confirmed yet",
  workerFacebookSessionNeedsLogin: "Needs login",
  workerFacebookSessionNotConfigured: "Not configured",
  workerFacebookSessionModeProfile: "Browser profile",
  workerFacebookSessionModeNone: "Not configured",
  marketplaceLocationHint:
    "Results follow your Facebook account's region — listings are shown near where your Facebook session is logged in, not a city you pick in the app.",

  facebookSessionTitle: "Facebook session needs refresh",
  facebookSessionDescription:
    "Recent polls failed because the local worker lost its Facebook login.",
  facebookSessionStep1:
    "Run npm run facebook:login and sign in to Facebook in the visible browser.",
  facebookSessionStep2: "Complete any 2FA, checkpoint, or confirmation prompts.",
  facebookSessionStep3:
    "Open Marketplace in that browser and confirm listings are visible.",
  facebookSessionStep4: "Return to the terminal, press Enter, then restart npm run worker:dev if needed.",

  searchKeywords: "Keywords",
  searchPriceRange: "Price range",
  searchPollEvery: "Poll every",
  searchMaxPerPoll: "Max per poll",
  searchLastAttempted: "Last attempted",
  searchLastSuccessfulPoll: "Last successful poll: {date}",
  searchNoSuccessfulPollYet: "No successful poll yet.",
  searchConsecutiveFailures: "{count} consecutive failure(s)",
  searchSessionFailureHint: "Facebook session likely needs refresh.",
  searchReliabilityHealthy: "Healthy polling. Last successful poll: {date}",
  searchNever: "Never",
  searchListingsCount: "{count} listing(s)",
  searchEnabled: "Enabled",
  searchDisabled: "Disabled",
  searchPollNow: "Poll now",
  searchQueuing: "Queuing...",
  searchPolling: "Polling...",
  searchEdit: "Edit",
  searchDisable: "Disable",
  searchEnable: "Enable",
  searchDelete: "Delete",
  searchDeleteConfirm: "Delete this saved search?",
  searchMinutes: "{count} min",
  searchListingsPerPoll: "{count} listings",

  searchFormName: "Name",
  searchFormNamePlaceholder: "iPhone 13 deals",
  searchFormKeywords: "Keywords",
  searchFormKeywordsPlaceholder: "iphone 13",
  searchFormMinPrice: "Min price (R$)",
  searchFormMaxPrice: "Max price (R$)",
  searchFormPollInterval: "Poll interval (minutes)",
  searchFormListingLimit: "Max listings per poll",
  searchFormListingLimitHint:
    "Higher limits take longer to scrape and use more memory on your local machine.",
  searchFormEnabled: "Enabled",
  searchFormCreate: "Create search",
  searchFormUpdate: "Update search",
  searchFormSaving: "Saving...",
  searchFormCancel: "Cancel",
  searchFormSaveFailed: "Failed to save search",

  pollRecentTitle: "Recent polls",
  pollCheckingMarketplace: "Checking Facebook Marketplace — usually takes 1–2 minutes.",
  pollListingsSummary: "{listings} listings · {alerts} new alert(s)",
  pollErrorSession:
    "Facebook session expired or missing on the worker. Run npm run facebook:login locally.",
  pollErrorCheckpoint:
    "Facebook sent the worker to a checkpoint. Run npm run facebook:login locally and clear the prompt.",
  pollErrorNoListings:
    "Facebook loaded, but the worker could not extract Marketplace listings. Try a broader search or refresh the Facebook session if this repeats.",
  pollErrorTimeout:
    "Poll timed out. The worker may have been asleep or Facebook took too long to respond. Try Poll now again.",
  pollErrorUnknown: "Poll failed for an unknown reason.",

  pollStatusQueuing: "Queuing",
  pollStatusQueued: "Queued",
  pollStatusRunning: "Running",
  pollStatusSuccess: "Complete",
  pollStatusFailed: "Failed",
  pollStatusSending: "Sending poll request...",
  pollStatusQueuedAuto: "Poll queued. Updating automatically.",
  pollStatusSuccessSummary: "Found {listings} listing(s), {alerts} new.",
  pollStatusFailedGeneric: "Poll failed. Try again in a few minutes.",
  pollStatusFailedQueue: "Failed to queue poll",
  pollStatusTimeout: "Poll is taking longer than expected. Refresh the page in a minute.",
  pollCooldown: "Please wait {minutes} minute(s) before polling this search again.",
  pollQueueQueued:
    "Poll queued. The worker may take up to a minute to start, then results will appear shortly.{positionNote} Updating automatically.",
  pollQueueQueuedBehindNamed:
    'Poll queued — waiting for "{searchName}" to finish first (one poll at a time).{positionNote} Updating automatically.',
  pollQueueQueuedBehindGeneric:
    "Poll queued — waiting for another search to finish first (one poll at a time).{positionNote} Updating automatically.",
  pollQueuePositionNote: " You are #{position} in line.",
  pollQueueAlreadyRunning: "A poll is already running for this search.",
  pollQueueAlreadyQueuedBehindNamed:
    'Poll already queued — waiting for "{searchName}" to finish first (one poll at a time).',
  pollQueueAlreadyQueuedBehindGeneric:
    "Poll already queued — waiting for another search to finish first (one poll at a time).",
  pollQueueAlreadyQueued: "A poll is already queued. The worker may take up to a minute to start.",
  pollQueueAlreadyInProgress: "A poll is already in progress for this search.",

  diagnosticsSessionTitle: "Facebook session expired",
  diagnosticsSessionDescription:
    "Recent polls reached the worker, but Facebook asked it to log in again. Run npm run facebook:login locally and clear the prompt. Failed polls in the last 24h: {failedPolls}.",
  diagnosticsCheckpointTitle: "Facebook checkpoint detected",
  diagnosticsCheckpointDescription:
    "Facebook sent the worker session to a checkpoint. Run npm run facebook:login locally, clear it, and try again. Failed polls in the last 24h: {failedPolls}.",
  diagnosticsNoListingsTitle: "No listings extracted",
  diagnosticsNoListingsDescription:
    "Facebook loaded, but the scraper could not find Marketplace listing data. This can happen with narrow searches, Marketplace layout changes, or a stale Facebook session. Failed polls in the last 24h: {failedPolls}.",
  diagnosticsTimeoutTitle: "Poll timed out",
  diagnosticsTimeoutDescription:
    "The worker started a poll but did not finish in time. The local worker may be busy, asleep, or Facebook may be slow. Failed polls in the last 24h: {failedPolls}.",
  diagnosticsUnknownTitle: "Polling issue detected",
  diagnosticsUnknownDescription:
    "A recent poll failed with an unclassified error. Check the poll history and local worker logs. Failed polls in the last 24h: {failedPolls}.",

  alertsNoListings: "No listings yet. Click Poll now to search Facebook Marketplace.",
  alertsListingsTitle: "Listings ({count})",
  alertsShow: "Show",
  alertsHide: "Hide",
  alertsSort: "Sort",
  alertsClearAll: "Clear all",
  alertsClearing: "Clearing...",
  alertsClearConfirm: "Remove all listings for this search from your dashboard?",
  alertsDismiss: "Dismiss",
  alertsDismissing: "Removing...",
  alertsViewFacebook: "View on Facebook",
  alertsNoImage: "No image",
  alertsPriceDrop: "Price drop · was {price}",
  alertsFirstSeen: "First seen {date}",
  alertsLastSeen: "Last seen {date}",
  alertsBaselineBanner:
    "Baseline scan complete — showing every match from this first poll (up to {limit} per poll). Future polls will highlight new listings and price drops.",
  alertsBaselineResults: "Baseline results ({count})",
  alertsNewSincePoll: "New since last poll ({count})",
  alertsPreviousListings: "Previous listings ({count})",
  alertsAllMatches: "All matches ({count})",
  alertsWhyKeyword: "Keyword hit: {keyword}",
  alertsWhyPriceRange: "Within price range",
  alertsWhyBaseline: "Baseline result",
  alertsWhyNew: "New since last poll",
  alertsWhyLowestSeen: "Lowest seen",
  alertsWhyBelowAverage: "Below recent average ({average})",
  alertsNoNewSincePoll: "No new listings since the last poll. Showing previous matches below.",
  alertsShowAll: "Show all {count}",
  alertsShowLess: "Show less",
  alertsSortNewest: "Newest first",
  alertsSortOldest: "Oldest first",
  alertsSortPriceAsc: "Price: low to high",
  alertsSortPriceDesc: "Price: high to low",

  signInErrorSignin: "Sign-in failed. Try a different account or provider.",
  signInErrorOAuthSignin: "Could not start sign-in with that provider. Please try again.",
  signInErrorOAuthCallback: "Sign-in was interrupted. Please try again.",
  signInErrorOAuthCallbackError: "Sign-in was interrupted. Please try again.",
  signInErrorOAuthCreateAccount: "Could not create your account. Please try again.",
  signInErrorEmailCreateAccount: "Could not create your account. Please try again.",
  signInErrorCallback: "Sign-in failed. Please try again.",
  signInErrorOAuthAccountNotLinked:
    "This email is already linked to another sign-in method. Use the same provider you signed up with originally.",
  signInErrorEmailSignin: "The sign-in email could not be sent. Please try again.",
  signInErrorCredentialsSignin: "Sign-in failed. Check your details and try again.",
  signInErrorSessionRequired: "Please sign in to continue.",
  signInErrorConfiguration: "Sign-in is not configured correctly. Contact the site administrator.",
  signInErrorAccessDenied: "Access was denied. You may have cancelled sign-in or do not have permission.",
  signInErrorVerification: "The sign-in link has expired or was already used.",
  signInErrorDefault: "Unable to sign in. Please try again.",
} as const;

export type MessageKey = keyof typeof messages;
