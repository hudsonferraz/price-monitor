import "./env-bootstrap.js";
import { Worker } from "bullmq";
import {
  getRedisConnectionOptions,
  POLL_SEARCH_QUEUE,
  registerScheduler,
  SCHEDULE_POLLS_QUEUE,
} from "@price-monitor/queue";
import type { PollSearchJobData } from "@price-monitor/shared/queue";
import { cleanupPollJobs } from "./lib/poll-job-cleanup";
import { closeBrowser } from "./lib/marketplace-browser";
import { getFacebookSessionDiagnostics } from "./lib/facebook-session";
import { startHealthServer } from "./lib/health-server";
import { markWorkerOffline, startWorkerHeartbeat } from "./lib/worker-heartbeat";
import {
  cleanupStaleRunningPolls,
  executePollSearch,
  POLL_JOB_LOCK_MS,
  scheduleDuePolls,
} from "./jobs/poll-search.job";

async function main(): Promise<void> {
  const connection = getRedisConnectionOptions();
  const healthServer = startHealthServer();
  const startedAt = new Date();

  console.log("Starting price-monitor worker...");

  if (process.env.MOCK_MARKETPLACE === "true") {
    console.log("MOCK_MARKETPLACE=true - using mock listings instead of Facebook.");
  } else {
    const facebookSession = getFacebookSessionDiagnostics();
    const logPayload = {
      status: facebookSession.status,
      mode: facebookSession.mode,
      path: facebookSession.path,
      exists: facebookSession.exists,
      message: facebookSession.message,
    };

    if (facebookSession.status === "ok") {
      console.log("Facebook session diagnostics:", logPayload);
    } else {
      console.warn("Facebook session diagnostics:", logPayload);
    }
  }

  const staleCleaned = await cleanupStaleRunningPolls();
  if (staleCleaned > 0) {
    console.log(`Marked ${staleCleaned} stale RUNNING poll(s) as FAILED.`);
  }

  const pollWorker = new Worker(
    POLL_SEARCH_QUEUE,
    async (job) => {
      const data = job.data as PollSearchJobData;
      console.log(`Polling search ${data.savedSearchId} (${data.triggeredBy})...`);

      try {
        const result = await executePollSearch(data.savedSearchId);
        console.log(
          `Poll complete: ${result.listingsFound} listings, ${result.newAlerts} new alerts`,
        );
        return result;
      } finally {
        await closeBrowser();
      }
    },
    {
      connection,
      concurrency: 1,
      lockDuration: POLL_JOB_LOCK_MS,
      stalledInterval: 30_000,
      maxStalledCount: 1,
    },
  );

  const cleanup = await cleanupPollJobs();
  if (cleanup.orphansRemoved > 0 || cleanup.activeJobsLeftRunning > 0) {
    console.log(
      `Cleaned poll queue: ${cleanup.orphansRemoved} orphan job(s), ${cleanup.activeJobsLeftRunning} active job(s) left for BullMQ/worker cleanup.`,
    );
  }

  pollWorker.on("failed", (job, error) => {
    const data = job?.data as PollSearchJobData | undefined;
    console.error(
      `[poll-job] jobId=${job?.id ?? "unknown"} savedSearchId=${data?.savedSearchId ?? "unknown"} failed: ${error.message}`,
    );
  });

  const scheduleWorker = new Worker(
    SCHEDULE_POLLS_QUEUE,
    async () => {
      const enqueued = await scheduleDuePolls();
      if (enqueued > 0) {
        console.log(`Scheduler enqueued ${enqueued} poll job(s).`);
      }
    },
    {
      connection,
      concurrency: 1,
    },
  );

  scheduleWorker.on("failed", (_job, error) => {
    console.error("Scheduler job failed:", error.message);
  });

  await registerScheduler();
  const heartbeat = startWorkerHeartbeat(startedAt);
  console.log(`Worker heartbeat active as ${heartbeat.workerId}.`);
  console.log("Scheduler registered (checks every 60 seconds).");
  console.log("Worker is running. Press Ctrl+C to stop.");

  const shutdown = async () => {
    console.log("Shutting down worker...");
    await pollWorker.close();
    await scheduleWorker.close();
    await closeBrowser();
    heartbeat.stop();
    try {
      await markWorkerOffline(heartbeat.workerId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("Failed to mark worker offline:", message);
    }
    healthServer.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  console.error("Worker failed to start:", error);
  process.exit(1);
});
