import { Worker } from "bullmq";
import {
  getRedisConnectionOptions,
  POLL_SEARCH_JOB,
  POLL_SEARCH_QUEUE,
  registerScheduler,
  SCHEDULE_POLLS_JOB,
  SCHEDULE_POLLS_QUEUE,
} from "@price-monitor/queue";
import type { PollSearchJobData } from "@price-monitor/shared/queue";
import { closeBrowser } from "../lib/marketplace-browser.ts";
import { executePollSearch, scheduleDuePolls } from "./jobs/poll-search.job.ts";

async function main(): Promise<void> {
  const connection = getRedisConnectionOptions();

  console.log("Starting price-monitor worker...");

  if (process.env.MOCK_MARKETPLACE === "true") {
    console.log("MOCK_MARKETPLACE=true — using mock listings instead of Facebook.");
  } else if (process.env.FACEBOOK_STORAGE_STATE_PATH) {
    console.log(`Using Facebook session: ${process.env.FACEBOOK_STORAGE_STATE_PATH}`);
  } else {
    console.warn(
      "FACEBOOK_STORAGE_STATE_PATH is not set. Polls may fail when Facebook requires login.",
    );
  }

  const pollWorker = new Worker(
    POLL_SEARCH_QUEUE,
    async (job) => {
      const data = job.data as PollSearchJobData;
      console.log(`Polling search ${data.savedSearchId} (${data.triggeredBy})...`);
      const result = await executePollSearch(data.savedSearchId);
      console.log(
        `Poll complete: ${result.listingsFound} listings, ${result.newAlerts} new alerts`,
      );
      return result;
    },
    {
      connection,
      concurrency: 1,
    },
  );

  pollWorker.on("failed", (job, error) => {
    console.error(`Poll job ${job?.id} failed:`, error.message);
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
  console.log("Scheduler registered (checks every 60 seconds).");
  console.log("Worker is running. Press Ctrl+C to stop.");

  const shutdown = async () => {
    console.log("Shutting down worker...");
    await pollWorker.close();
    await scheduleWorker.close();
    await closeBrowser();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  console.error("Worker failed to start:", error);
  process.exit(1);
});
