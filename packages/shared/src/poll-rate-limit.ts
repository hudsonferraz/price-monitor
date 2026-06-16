export const MIN_MANUAL_POLL_INTERVAL_MS = 15 * 60 * 1000;

export function getPollCooldownRemainingMs(
  lastPolledAt: Date | string | null,
  minIntervalMs: number = MIN_MANUAL_POLL_INTERVAL_MS,
): number {
  if (!lastPolledAt) {
    return 0;
  }

  const lastPolledTimestamp =
    lastPolledAt instanceof Date ? lastPolledAt.getTime() : new Date(lastPolledAt).getTime();

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
