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
