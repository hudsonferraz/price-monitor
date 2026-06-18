export const MIN_MANUAL_POLL_INTERVAL_MS = 15 * 60 * 1000;

export function getPollCooldownRemainingMs(
  lastAttemptedAt: Date | string | null,
  minIntervalMs: number = MIN_MANUAL_POLL_INTERVAL_MS,
): number {
  if (!lastAttemptedAt) {
    return 0;
  }

  const lastPolledTimestamp =
    lastAttemptedAt instanceof Date
      ? lastAttemptedAt.getTime()
      : new Date(lastAttemptedAt).getTime();

  const elapsed = Date.now() - lastPolledTimestamp;
  return Math.max(0, minIntervalMs - elapsed);
}

export function formatPollCooldownMessage(remainingMs: number): string {
  const remainingMinutes = Math.ceil(remainingMs / 60_000);
  return `Please wait ${remainingMinutes} minute(s) before polling this search again.`;
}

export function formatPriceCents(priceCents: number | null): string {
  if (priceCents == null) {
    return "Price unavailable";
  }

  return `R$ ${(priceCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}
