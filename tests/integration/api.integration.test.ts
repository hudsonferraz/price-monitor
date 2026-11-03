import type { Worker } from "bullmq";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { GET as getPriceHistory } from "@/app/api/searches/[id]/listings/[listingId]/price-history/route";
import { POST as pollSearch } from "@/app/api/searches/[id]/poll/route";
import { GET as getPollRuns } from "@/app/api/searches/[id]/poll-runs/route";
import { GET as getPollStatus } from "@/app/api/searches/[id]/poll-status/route";
import { DELETE as deleteSearch } from "@/app/api/searches/[id]/route";
import {
  GET as listSearches,
  PATCH as updateSearch,
  POST as createSearch,
} from "@/app/api/searches/route";
import { prisma } from "@price-monitor/database";
import { getPollSearchQueue } from "@price-monitor/queue";
import {
  closeQueueResources,
  createTestUser,
  jsonRequest,
  markWorkerOnline,
  routeContext,
  signInAs,
  startPollWorker,
  waitFor,
  waitForPollToFinish,
} from "./helpers";

let worker: Worker;

beforeAll(async () => {
  worker = startPollWorker();
});

afterAll(async () => {
  await closeQueueResources(worker);
});

beforeEach(async () => {
  process.env.MOCK_MARKETPLACE_DELAY_MS = "0";
  process.env.MOCK_MARKETPLACE_FAILURE_RATE = "0";
  await markWorkerOnline();
  if (worker.isPaused()) worker.resume();
});

async function createOwnedSearch(user: { id: string }, keywords = "câmera canon") {
  signInAs(user);
  const response = await createSearch(
    jsonRequest("/api/searches", "POST", { name: `Search ${keywords}`, keywords, maxPriceReais: 4_000 }),
  );
  expect(response.status).toBe(201);
  return (await response.json()) as { id: string; name: string; keywords: string };
}

function poll(id: string) {
  return pollSearch(jsonRequest(`/api/searches/${id}/poll`, "POST"), routeContext({ id }));
}

async function jobCount(): Promise<number> {
  const counts = await getPollSearchQueue().getJobCounts("waiting", "active", "delayed");
  return counts.waiting + counts.active + counts.delayed;
}

describe("web API against real services", () => {
  it("creates a search owned by the signed-in user and lists it", async () => {
    const user = await createTestUser("creator");
    const created = await createOwnedSearch(user, "Nintendo Switch");

    const stored = await prisma.savedSearch.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored).toMatchObject({
      userId: user.id,
      keywords: "Nintendo Switch",
      maxPriceCents: 400_000,
      isEnabled: true,
    });

    const listResponse = await listSearches();
    const listed = (await listResponse.json()) as Array<{ id: string }>;
    expect(listed.map((search) => search.id)).toEqual([created.id]);
  });

  it("rejects requests without a session", async () => {
    signInAs(null);
    expect((await listSearches()).status).toBe(401);
    expect((await poll("anything")).status).toBe(401);
  });

  describe("ownership", () => {
    it.each([
      ["poll", (id: string) => poll(id)],
      ["poll status", (id: string) => getPollStatus(jsonRequest(`/api/searches/${id}/poll-status`, "GET"), routeContext({ id }))],
      ["poll runs", (id: string) => getPollRuns(jsonRequest(`/api/searches/${id}/poll-runs`, "GET"), routeContext({ id }))],
      [
        "price history",
        (id: string) =>
          getPriceHistory(
            jsonRequest(`/api/searches/${id}/listings/x/price-history`, "GET"),
            routeContext({ id, listingId: "x" }),
          ),
      ],
      ["update", (id: string) => updateSearch(jsonRequest("/api/searches", "PATCH", { id, name: "hijacked" }))],
      ["delete", (id: string) => deleteSearch(jsonRequest(`/api/searches/${id}`, "DELETE"), routeContext({ id }))],
    ])("returns 404 when another user tries to %s", async (_label, call) => {
      const owner = await createTestUser("owner");
      const intruder = await createTestUser("intruder");
      const search = await createOwnedSearch(owner);
      const before = await prisma.savedSearch.findUniqueOrThrow({ where: { id: search.id } });
      const jobsBefore = await jobCount();

      signInAs(intruder);
      const response = await call(search.id);

      expect(response.status).toBe(404);
      expect((await response.json()).errorCode).toBe("SEARCH_NOT_FOUND");
      expect(await prisma.savedSearch.findUniqueOrThrow({ where: { id: search.id } })).toEqual(before);
      expect(await jobCount()).toBe(jobsBefore);

      const intruderList = (await (await listSearches()).json()) as Array<{ id: string }>;
      expect(intruderList).toEqual([]);
    });
  });

  it("enforces the manual poll cooldown without queueing a job", async () => {
    const user = await createTestUser("cooldown");
    const search = await createOwnedSearch(user);

    expect((await poll(search.id)).status).toBe(200);
    await waitForPollToFinish(search.id, 0);
    const jobsBefore = await jobCount();

    const response = await poll(search.id);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.errorCode).toBe("POLL_COOLDOWN");
    expect(body.remainingMinutes).toBeGreaterThan(0);
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
    expect(await jobCount()).toBe(jobsBefore);
    expect(await prisma.pollRun.count({ where: { savedSearchId: search.id } })).toBe(1);
  });

  it("reports a queued poll as waiting, matching the queue", async () => {
    const user = await createTestUser("status");
    const search = await createOwnedSearch(user);
    await worker.pause();

    expect((await poll(search.id)).status).toBe(200);
    const queueState = await (await getPollSearchQueue().getJob(`poll-${search.id}`))?.getState();
    const response = await getPollStatus(
      jsonRequest(`/api/searches/${search.id}/poll-status`, "GET"),
      routeContext({ id: search.id }),
    );
    const body = await response.json();

    expect(queueState).toBe("waiting");
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ isQueued: true, jobState: "waiting" });

    // A second request while queued is reported, not queued twice.
    const again = await (await poll(search.id)).json();
    expect(again).toMatchObject({ queued: false, state: "waiting" });

    worker.resume();
    const run = await waitForPollToFinish(search.id, 0);
    expect(run.status).toBe("SUCCESS");
  });

  it("refuses to delete a search while its poll is running", async () => {
    const user = await createTestUser("delete-active");
    const search = await createOwnedSearch(user);
    process.env.MOCK_MARKETPLACE_DELAY_MS = "3000";

    expect((await poll(search.id)).status).toBe(200);
    await waitFor("the poll job to become active", async () => {
      const state = await (await getPollSearchQueue().getJob(`poll-${search.id}`))?.getState();
      return state === "active";
    });

    const response = await deleteSearch(
      jsonRequest(`/api/searches/${search.id}`, "DELETE"),
      routeContext({ id: search.id }),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).errorCode).toBe("SEARCH_DELETE_ACTIVE_POLL");
    const stored = await prisma.savedSearch.findUnique({ where: { id: search.id } });
    expect(stored).not.toBeNull();
    expect(stored?.isEnabled).toBe(false);

    // Let the running job settle so it doesn't leak into later tests.
    await waitFor("the active poll job to settle", async () => {
      const state = await (await getPollSearchQueue().getJob(`poll-${search.id}`))?.getState();
      return state !== "active";
    });
  });
});
