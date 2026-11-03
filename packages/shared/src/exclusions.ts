/**
 * Per-search exclusion terms ("capa", "película", "tela trincada"): listings whose title contains
 * a term as a whole word or phrase, ignoring case and accents, are kept out of a search's alerts.
 */

export const MAX_EXCLUSION_TERMS = 20;
export const MAX_EXCLUSION_TERM_LENGTH = 50;

/** Lowercase, accents removed, anything that is not a letter or digit collapsed to one space. */
export function normalizeForMatching(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Trims, drops empty entries and duplicates (case- and accent-insensitive), keeps first spelling. */
export function normalizeExclusionTerms(terms: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of terms ?? []) {
    const term = raw.trim().replace(/\s+/g, " ");
    const key = normalizeForMatching(term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(term);
  }
  return result;
}

/** Splits the comma-separated form input into terms. */
export function parseExclusionInput(value: string): string[] {
  return normalizeExclusionTerms(value.split(/[,;\n]/));
}

function containsPhrase(normalizedText: string, normalizedTerm: string): boolean {
  return normalizedTerm !== "" && ` ${normalizedText} `.includes(` ${normalizedTerm} `);
}

/** The first exclusion term found in the title, or null. */
export function findExcludedTerm(title: string, terms: readonly string[] | null | undefined): string | null {
  if (!terms || terms.length === 0) return null;
  const normalizedTitle = normalizeForMatching(title);
  return terms.find((term) => containsPhrase(normalizedTitle, normalizeForMatching(term))) ?? null;
}

export function isExcludedTitle(title: string, terms: readonly string[] | null | undefined): boolean {
  return findExcludedTerm(title, terms) != null;
}

/** An exclusion that matches the search's own keywords would hide every result. */
export function findKeywordConflict(keywords: string, terms: readonly string[] | null | undefined): string | null {
  return findExcludedTerm(keywords, terms);
}
