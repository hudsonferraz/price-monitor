import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const healthUrl = process.env.WORKER_HEALTH_URL;
  if (!healthUrl) {
    return NextResponse.json({ error: "WORKER_HEALTH_URL is not configured" }, { status: 503 });
  }

  const startedAt = Date.now();

  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    const latencyMs = Date.now() - startedAt;

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      latencyMs,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "Worker health check failed",
        checkedAt: new Date().toISOString(),
      },
      { status: 502 },
    );
  }
}
