/**
 * Connection targets for the integration suite. Defaults point at the local Docker Compose
 * services, but on a separate database and Redis DB so real (`price_monitor`, Redis DB 0) and
 * demo (`price_monitor_demo`, Redis DB 1) data are never touched. CI overrides both URLs.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://price_monitor:price_monitor@localhost:5433/price_monitor_test";

export const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:6379/2";

export function getRedisDbIndex(redisUrl: string): number {
  const path = new URL(redisUrl).pathname.replace("/", "");
  return path === "" ? 0 : Number(path);
}

/** Refuses to run against anything that could hold real or demo data. */
export function assertIsolatedTargets(databaseUrl = TEST_DATABASE_URL, redisUrl = TEST_REDIS_URL): void {
  const databaseName = new URL(databaseUrl).pathname.replace("/", "");
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `Integration tests write to their database. Refusing to use "${databaseName}": the database name must end with "_test".`,
    );
  }

  const redisDb = getRedisDbIndex(redisUrl);
  if (!Number.isInteger(redisDb) || redisDb < 2) {
    throw new Error(
      `Integration tests flush their Redis DB. Refusing to use DB ${redisDb}: use DB 2 or higher (0 is the real app, 1 is the demo).`,
    );
  }
}
