import type { NormalizedListing } from "./types";

/**
 * Deterministic mock Marketplace catalog used by demo mode.
 *
 * The same (seed, keywords, pollSequence, filters) input always returns the same listings,
 * so demos and tests are reproducible. Across sequences the catalog evolves like a real
 * marketplace: one new listing appears per poll, some prices drop, and some listings go away.
 */

export const MOCK_CATALOG_INITIAL_LISTINGS = 20;
export const MOCK_CATALOG_MAX_RESULTS = 20;
export const MOCK_CATALOG_IMAGE_COUNT = 8;
export const MOCK_LISTING_ID_PREFIX = "demo-";
export const MOCK_LISTING_URL_PREFIX = "/demo/listing/";

const RANDOM_DROP_CHANCE = 0.08;
/** Sellers sometimes raise prices too; keeps "lowest seen" meaningful. */
const RANDOM_RAISE_CHANCE = 0.12;
const DELIST_CHANCE = 0.15;
const MIN_PRICE_CENTS = 1_000;

const TITLE_SUFFIXES = [
  "seminovo",
  "usado, ótimo estado",
  "na caixa",
  "com nota fiscal",
  "pouco uso",
  "aceito troca",
  "revisado",
  "conservado",
  "zero, lacrado",
  "com garantia",
] as const;

const LOCATIONS = [
  "São Paulo, SP",
  "Rio de Janeiro, RJ",
  "Belo Horizonte, MG",
  "Curitiba, PR",
  "Porto Alegre, RS",
  "Salvador, BA",
  "Recife, PE",
  "Fortaleza, CE",
  "Brasília, DF",
  "Campinas, SP",
  "Florianópolis, SC",
  "Goiânia, GO",
] as const;

export interface MockCatalogInput {
  /** Stable identity of the search (e.g. savedSearchId). */
  seed: string;
  keywords: string;
  /** Number of successful polls before this one (0 = baseline poll). */
  pollSequence: number;
  minPriceCents?: number;
  maxPriceCents?: number;
  limit?: number;
}

interface Candidate {
  index: number;
  appearsAt: number;
  disappearsAt: number | null;
  basePriceCents: number;
  title: string;
  location: string;
}

/** FNV-1a 32-bit string hash. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 PRNG: small, fast, deterministic. Returns floats in [0, 1). */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Placeholder image per product category, matched on whole words of the keyword.
 * Image numbers map to apps/web/public/demo/listing-N.svg. First matching category wins.
 */
const IMAGE_CATEGORIES: ReadonlyArray<{ imageNumber: number; terms: readonly string[] }> = [
  {
    imageNumber: 1,
    terms: ["iphone", "celular", "smartphone", "telefone", "galaxy", "xiaomi", "redmi", "motorola", "moto"],
  },
  { imageNumber: 2, terms: ["bicicleta", "bike", "mtb", "bicicletas"] },
  { imageNumber: 3, terms: ["geladeira", "refrigerador", "freezer", "geladeiras"] },
  { imageNumber: 4, terms: ["camera", "cameras", "canon", "nikon", "gopro", "fotografica", "filmadora"] },
  { imageNumber: 5, terms: ["notebook", "laptop", "macbook", "computador", "pc", "monitor", "ultrabook"] },
  { imageNumber: 6, terms: ["sofa", "poltrona", "cadeira", "mesa", "cama", "guarda-roupa", "armario", "estante"] },
  {
    imageNumber: 7,
    terms: ["playstation", "ps4", "ps5", "xbox", "nintendo", "switch", "videogame", "console", "controle"],
  },
];
const GENERIC_IMAGE_NUMBER = MOCK_CATALOG_IMAGE_COUNT;

function toSearchWords(keywords: string): string[] {
  return keywords
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter(Boolean);
}

/** Image number (1..MOCK_CATALOG_IMAGE_COUNT) for a keyword; unknown keywords get the generic image. */
export function getMockImageNumber(keywords: string): number {
  const words = new Set(toSearchWords(keywords));
  const category = IMAGE_CATEGORIES.find(({ terms }) => terms.some((term) => words.has(term)));
  return category?.imageNumber ?? GENERIC_IMAGE_NUMBER;
}

function normalizeKeywords(keywords: string): string {
  return keywords.trim().replace(/\s+/g, " ") || "item";
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
}

function roundToReais(priceCents: number): number {
  return Math.max(MIN_PRICE_CENTS, Math.round(priceCents / 100) * 100);
}

function getCenterPriceCents(
  keywordHash: number,
  minPriceCents?: number,
  maxPriceCents?: number,
): number {
  if (maxPriceCents != null && maxPriceCents > 0) {
    return Math.round(maxPriceCents * 0.85);
  }

  if (minPriceCents != null && minPriceCents > 0) {
    return Math.round(minPriceCents * 1.3);
  }

  // R$ 300 – R$ 4.000 depending on the keyword.
  return 30_000 + (keywordHash % 370_000);
}

function buildCandidate(
  index: number,
  catalogKey: string,
  keywords: string,
  centerPriceCents: number,
): Candidate {
  const random = createRandom(hashString(`${catalogKey}|candidate|${index}`));
  const appearsAt =
    index < MOCK_CATALOG_INITIAL_LISTINGS ? 0 : index - MOCK_CATALOG_INITIAL_LISTINGS + 1;
  const delistRoll = random();
  const delistDelay = 3 + Math.floor(random() * 6);
  const basePriceCents = roundToReais(centerPriceCents * (0.5 + random()));
  const suffix = TITLE_SUFFIXES[Math.floor(random() * TITLE_SUFFIXES.length)];
  const location = LOCATIONS[Math.floor(random() * LOCATIONS.length)];
  // Former per-listing image roll. Still drawn so existing seeds keep the same prices and titles.
  random();

  return {
    index,
    appearsAt,
    disappearsAt: delistRoll < DELIST_CHANCE ? appearsAt + delistDelay : null,
    basePriceCents,
    title: `${capitalize(keywords)} - ${suffix}`,
    location,
  };
}

function isVisibleAt(candidate: Candidate, sequence: number): boolean {
  return (
    sequence >= candidate.appearsAt &&
    (candidate.disappearsAt == null || sequence < candidate.disappearsAt)
  );
}

function compareNewestFirst(a: Candidate, b: Candidate): number {
  return b.appearsAt - a.appearsAt || a.index - b.index;
}

/** Candidates that fit in the result window at `sequence`, before price filtering. */
function getWindowIndexes(candidates: Candidate[], sequence: number, maxResults: number): Set<number> {
  return new Set(
    candidates
      .filter((candidate) => isVisibleAt(candidate, sequence))
      .sort(compareNewestFirst)
      .slice(0, maxResults)
      .map((candidate) => candidate.index),
  );
}

/**
 * Index of the candidate that is guaranteed to drop in price at `sequence`, chosen among
 * candidates shown both at `sequence - 1` and `sequence`, so the drop is visible to the
 * diffing logic.
 */
function getForcedDropIndex(
  candidates: Candidate[],
  sequence: number,
  maxResults: number,
): number | null {
  if (sequence < 1) {
    return null;
  }

  const previousWindow = getWindowIndexes(candidates, sequence - 1, maxResults);
  const eligible = [...getWindowIndexes(candidates, sequence, maxResults)]
    .filter((index) => previousWindow.has(index))
    .sort((a, b) => a - b);
  if (eligible.length === 0) {
    return null;
  }

  return eligible[(sequence * 7) % eligible.length];
}

function getPriceAtSequence(
  candidate: Candidate,
  catalogKey: string,
  sequence: number,
  forcedDropIndexes: Array<number | null>,
): number {
  let priceCents = candidate.basePriceCents;

  for (let step = candidate.appearsAt + 1; step <= sequence; step += 1) {
    const random = createRandom(hashString(`${catalogKey}|price|${candidate.index}|${step}`));
    const roll = random();
    const forced = forcedDropIndexes[step] === candidate.index;

    if (forced || roll < RANDOM_DROP_CHANCE) {
      const dropFraction = 0.05 + random() * 0.1;
      const dropped = roundToReais(priceCents * (1 - dropFraction));
      // Guarantee a visible drop even for very cheap items.
      priceCents = dropped < priceCents ? dropped : Math.max(MIN_PRICE_CENTS, priceCents - 100);
    } else if (roll < RANDOM_DROP_CHANCE + RANDOM_RAISE_CHANCE) {
      const raiseFraction = 0.03 + random() * 0.05;
      priceCents = roundToReais(priceCents * (1 + raiseFraction));
    }
  }

  return priceCents;
}

export function isMockListingExternalId(externalId: string): boolean {
  return externalId.startsWith(MOCK_LISTING_ID_PREFIX);
}

export function generateMockCatalog(input: MockCatalogInput): NormalizedListing[] {
  const keywords = normalizeKeywords(input.keywords);
  const sequence = Math.max(0, Math.floor(input.pollSequence));
  const catalogKey = `${input.seed}|${keywords.toLocaleLowerCase("pt-BR")}`;
  const catalogId = hashString(catalogKey).toString(36);
  const keywordHash = hashString(keywords.toLocaleLowerCase("pt-BR"));
  const centerPriceCents = getCenterPriceCents(
    keywordHash,
    input.minPriceCents,
    input.maxPriceCents,
  );
  const maxResults = Math.min(
    MOCK_CATALOG_MAX_RESULTS,
    Math.max(1, input.limit ?? MOCK_CATALOG_MAX_RESULTS),
  );

  const imageUrl = `/demo/listing-${getMockImageNumber(keywords)}.svg`;
  const poolSize = MOCK_CATALOG_INITIAL_LISTINGS + sequence;
  const candidates = Array.from({ length: poolSize }, (_, index) =>
    buildCandidate(index, catalogKey, keywords, centerPriceCents),
  );
  const forcedDropIndexes = Array.from({ length: sequence + 1 }, (_, step) =>
    getForcedDropIndex(candidates, step, maxResults),
  );

  return candidates
    .filter((candidate) => isVisibleAt(candidate, sequence))
    .map((candidate) => ({
      candidate,
      priceCents: getPriceAtSequence(candidate, catalogKey, sequence, forcedDropIndexes),
    }))
    .filter(({ priceCents }) => {
      if (input.minPriceCents != null && priceCents < input.minPriceCents) {
        return false;
      }
      if (input.maxPriceCents != null && priceCents > input.maxPriceCents) {
        return false;
      }
      return true;
    })
    // Newest listings first, like a marketplace feed.
    .sort((a, b) => compareNewestFirst(a.candidate, b.candidate))
    .slice(0, maxResults)
    .map(({ candidate, priceCents }) => {
      const externalId = `${MOCK_LISTING_ID_PREFIX}${catalogId}-${candidate.index}`;
      return {
        externalId,
        title: candidate.title,
        priceCents,
        currency: "BRL",
        url: `${MOCK_LISTING_URL_PREFIX}${externalId}`,
        imageUrl,
        location: candidate.location,
      };
    });
}
