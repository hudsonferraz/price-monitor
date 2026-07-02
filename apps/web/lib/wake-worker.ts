export interface WakeWorkerResult {
  skipped: boolean;
  ok: boolean;
  status?: number;
  error?: string;
}

export async function wakeWorker(timeoutMs = 8_000): Promise<WakeWorkerResult> {
  const healthUrl = process.env.WORKER_HEALTH_URL;
  if (!healthUrl) {
    return { skipped: true, ok: false };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    return {
      skipped: false,
      ok: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      skipped: false,
      ok: false,
      error: error instanceof Error ? error.message : "Worker health check failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}
