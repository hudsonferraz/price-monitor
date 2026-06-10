/**
 * Parses Brazilian Real price strings such as "R$ 1.200", "R$1.700", or "R$ 850,50" into cents.
 */
export function parseBrazilianPriceToCents(rawPrice: string): number | null {
  const normalized = rawPrice
    .replace(/\u00a0/g, " ")
    .replace(/R\$\s*/i, "")
    .trim();

  if (!normalized || /grátis|gratis|consulte|troca|free/i.test(normalized)) {
    return null;
  }

  const digitsOnly = normalized.replace(/[^\d,.-]/g, "");
  if (!digitsOnly) {
    return null;
  }

  let amount: number;

  if (digitsOnly.includes(",") && digitsOnly.includes(".")) {
    amount = Number(digitsOnly.replace(/\./g, "").replace(",", "."));
  } else if (digitsOnly.includes(",")) {
    amount = Number(digitsOnly.replace(",", "."));
  } else if (digitsOnly.includes(".")) {
    const segments = digitsOnly.split(".");
    const lastSegment = segments.at(-1) ?? "";

    if (segments.length > 1 && lastSegment.length === 3) {
      amount = Number(digitsOnly.replace(/\./g, ""));
    } else {
      amount = Number(digitsOnly);
    }
  } else {
    amount = Number(digitsOnly);
  }

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Math.round(amount * 100);
}
