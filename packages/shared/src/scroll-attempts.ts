export function getScrollAttemptsForLimit(limit: number): number {
  if (limit <= 12) {
    return 2;
  }

  if (limit <= 24) {
    return 3;
  }

  return 4;
}

export const MAX_GRAPHQL_RESPONSE_BYTES = 512_000;
