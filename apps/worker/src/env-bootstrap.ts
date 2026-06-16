function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function normalizeDatabaseUrl(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return;
  }

  process.env.DATABASE_URL = stripWrappingQuotes(databaseUrl);
}

function validateRequiredEnvironment(): void {
  normalizeDatabaseUrl();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
    throw new Error(
      'DATABASE_URL must start with "postgresql://" or "postgres://". On Render, paste the Neon URL with no quotes or extra spaces.',
    );
  }

  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is not set.");
  }
}

validateRequiredEnvironment();
