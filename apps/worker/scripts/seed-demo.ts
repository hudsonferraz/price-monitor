/**
 * Seeds (or resets) local demo data: a demo user with saved searches, multi-day poll
 * history, price drops, and deal-quality signals.
 *
 * History is produced by replaying the deterministic mock catalog through the same
 * persistence code live polls use (`persistListingsAndAlerts`), with backdated timestamps.
 * The next live poll continues from where the seeded history stops.
 *
 * Only the demo user's data and orphaned demo listings are touched.
 */
import { prisma, PollRunStatus } from "@price-monitor/database";
import { DEMO_USER_EMAIL, DEMO_USER_NAME } from "@price-monitor/shared/demo";
import { generateMockCatalog, MOCK_LISTING_ID_PREFIX } from "@price-monitor/shared/mock-catalog";
import { normalizeListingLimit } from "@price-monitor/shared/sort-alerts";
import { persistListingsAndAlerts } from "../src/jobs/poll-search.job";
import { SIMULATED_MOCK_FAILURE_MESSAGE } from "../src/lib/mock-marketplace";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const SEEDED_SUCCESSFUL_POLLS = 6;

interface SeedSearch {
  name: string;
  keywords: string;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  pollIntervalMin: number;
  listingLimit: number;
  /** Insert a failed run after this successful sequence (or never). */
  failAfterSequence: number | null;
  excludeKeywords?: string[];
}

const SEED_SEARCHES: SeedSearch[] = [
  {
    name: "iPhone 13",
    keywords: "iphone 13",
    minPriceCents: null,
    maxPriceCents: 350_000,
    pollIntervalMin: 30,
    listingLimit: 24,
    failAfterSequence: 2,
    // Shows exclusions in action: accessory listings ("Capa para iphone 13") stay hidden.
    excludeKeywords: ["capa", "película", "peças", "carregador"],
  },
  {
    name: "Bicicleta aro 29",
    keywords: "bicicleta aro 29",
    minPriceCents: 80_000,
    maxPriceCents: 300_000,
    pollIntervalMin: 60,
    listingLimit: 24,
    failAfterSequence: null,
  },
  {
    name: "Geladeira frost free",
    keywords: "geladeira frost free",
    minPriceCents: null,
    maxPriceCents: 250_000,
    pollIntervalMin: 120,
    listingLimit: 12,
    failAfterSequence: null,
  },
];

async function resetDemoData(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    create: { email: DEMO_USER_EMAIL, name: DEMO_USER_NAME },
    update: {},
  });

  // Cascades alerts, poll runs, snapshots, and per-search prices.
  await prisma.savedSearch.deleteMany({ where: { userId: user.id } });

  // Remove demo listings nobody references anymore (never touches other users' data).
  await prisma.listing.deleteMany({
    where: {
      externalId: { startsWith: MOCK_LISTING_ID_PREFIX },
      alerts: { none: {} },
      snapshots: { none: {} },
      searchPrices: { none: {} },
    },
  });

  return user.id;
}

/** Spread runs over the last 5 days, ending ~1 hour ago. */
function getRunStartedAt(now: number, sequence: number, searchIndex: number): Date {
  const daysAgo = (SEEDED_SUCCESSFUL_POLLS - 1 - sequence) * (5 / (SEEDED_SUCCESSFUL_POLLS - 1));
  const offsetMs = (searchIndex * 17 + sequence * 7) * 60 * 1000;
  return new Date(now - HOUR_MS - daysAgo * DAY_MS - offsetMs);
}

function getRunDurationMs(sequence: number, searchIndex: number): number {
  return 2_000 + ((sequence * 1_337 + searchIndex * 911) % 4_000);
}

async function seedSearch(
  userId: string,
  search: SeedSearch,
  searchIndex: number,
  now: number,
): Promise<{ runs: number; newAlerts: number }> {
  const savedSearch = await prisma.savedSearch.create({
    data: {
      // Fixed id: the mock catalog is keyed by search id, so reseeding is reproducible.
      id: `demo-search-${searchIndex + 1}`,
      userId,
      name: search.name,
      keywords: search.keywords,
      minPriceCents: search.minPriceCents,
      maxPriceCents: search.maxPriceCents,
      pollIntervalMin: search.pollIntervalMin,
      listingLimit: search.listingLimit,
      excludeKeywords: search.excludeKeywords ?? [],
      createdAt: new Date(getRunStartedAt(now, 0, searchIndex).getTime() - HOUR_MS),
    },
  });

  let runs = 0;
  let totalNewAlerts = 0;
  let lastFinishedAt = new Date(now);

  for (let sequence = 0; sequence < SEEDED_SUCCESSFUL_POLLS; sequence += 1) {
    const startedAt = getRunStartedAt(now, sequence, searchIndex);
    const durationMs = getRunDurationMs(sequence, searchIndex);
    const finishedAt = new Date(startedAt.getTime() + durationMs);

    const listings = generateMockCatalog({
      seed: savedSearch.id,
      keywords: savedSearch.keywords,
      pollSequence: sequence,
      minPriceCents: savedSearch.minPriceCents ?? undefined,
      maxPriceCents: savedSearch.maxPriceCents ?? undefined,
      limit: normalizeListingLimit(savedSearch.listingLimit),
    });

    const pollRun = await prisma.pollRun.create({
      data: {
        savedSearchId: savedSearch.id,
        status: PollRunStatus.RUNNING,
        startedAt,
      },
    });

    const { newAlerts, excludedCount } = await persistListingsAndAlerts(
      savedSearch.id,
      userId,
      pollRun.id,
      listings,
      sequence === 0,
      finishedAt,
      savedSearch.excludeKeywords,
    );

    await prisma.pollRun.update({
      where: { id: pollRun.id },
      data: {
        status: PollRunStatus.SUCCESS,
        listingsFound: listings.length,
        newAlerts,
        excludedCount,
        durationMs,
        finishedAt,
      },
    });

    runs += 1;
    totalNewAlerts += newAlerts;
    lastFinishedAt = finishedAt;

    if (search.failAfterSequence === sequence) {
      const failedStartedAt = new Date(finishedAt.getTime() + 6 * HOUR_MS);
      await prisma.pollRun.create({
        data: {
          savedSearchId: savedSearch.id,
          status: PollRunStatus.FAILED,
          errorMessage: SIMULATED_MOCK_FAILURE_MESSAGE,
          listingsFound: 0,
          newAlerts: 0,
          startedAt: failedStartedAt,
          finishedAt: new Date(failedStartedAt.getTime() + 45_000),
          durationMs: 45_000,
        },
      });
      runs += 1;
    }
  }

  await prisma.savedSearch.update({
    where: { id: savedSearch.id },
    data: {
      lastAttemptedAt: lastFinishedAt,
      lastSuccessfulPollAt: lastFinishedAt,
      consecutiveFailures: 0,
    },
  });

  return { runs, newAlerts: totalNewAlerts };
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Run `npm run demo` or set it in .env.");
  }

  const userId = await resetDemoData();
  const now = Date.now();

  for (const [index, search] of SEED_SEARCHES.entries()) {
    const { runs, newAlerts } = await seedSearch(userId, search, index, now);
    console.log(`[seed] ${search.name}: ${runs} poll run(s), ${newAlerts} new alert(s)`);
  }

  const [alerts, priceDrops] = await Promise.all([
    prisma.alert.count({ where: { userId } }),
    prisma.alert.count({ where: { userId, priceDroppedAt: { not: null } } }),
  ]);

  console.log(
    `[seed] Demo data ready for ${DEMO_USER_EMAIL}: ${SEED_SEARCHES.length} searches, ${alerts} alerts, ${priceDrops} price drop(s).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("[seed] Failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
