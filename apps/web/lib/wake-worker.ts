export function wakeWorker(): void {
  const healthUrl = process.env.WORKER_HEALTH_URL;
  if (!healthUrl) {
    return;
  }

  fetch(healthUrl, { method: "GET", cache: "no-store" }).catch(() => undefined);
}
