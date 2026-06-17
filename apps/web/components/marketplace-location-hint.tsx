"use client";

import { useTranslations } from "@/components/locale-provider";

export function MarketplaceLocationHint() {
  const t = useTranslations();

  return (
    <p className="rounded-md border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--muted)]">
      {t("marketplaceLocationHint")}
    </p>
  );
}
