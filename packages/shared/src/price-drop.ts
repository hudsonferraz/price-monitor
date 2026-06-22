export function hasPriceDropped(
  previousPriceCents: number | null,
  nextPriceCents: number | null,
): boolean {
  return (
    previousPriceCents != null &&
    nextPriceCents != null &&
    nextPriceCents < previousPriceCents
  );
}

export function shouldClearPriceDropEvent(input: {
  recordedPreviousPriceCents: number | null;
  previousSnapshotPriceCents: number | null;
  nextPriceCents: number | null;
}): boolean {
  if (input.nextPriceCents == null) {
    return false;
  }

  if (
    input.recordedPreviousPriceCents != null &&
    input.nextPriceCents >= input.recordedPreviousPriceCents
  ) {
    return true;
  }

  return (
    input.previousSnapshotPriceCents != null &&
    input.nextPriceCents > input.previousSnapshotPriceCents
  );
}

export function isActivePriceDropAlert(input: {
  priceDroppedAt: string | null;
  previousPriceCents: number | null;
  currentPriceCents: number | null;
}): boolean {
  return (
    input.priceDroppedAt != null &&
    input.previousPriceCents != null &&
    input.currentPriceCents != null &&
    input.currentPriceCents < input.previousPriceCents
  );
}
