import { execFileSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { assertIsolatedTargets, getRedisDbIndex, TEST_DATABASE_URL, TEST_REDIS_URL } from "./env";

const ROOT = path.resolve(__dirname, "../..");
const CONNECT_TIMEOUT_MS = 3_000;

function describeTarget(url: string): { host: string; port: number } {
  const parsed = new URL(url);
  const defaultPort = parsed.protocol.startsWith("redis") ? 6379 : 5432;
  return { host: parsed.hostname, port: Number(parsed.port || defaultPort) };
}

function checkReachable(name: string, url: string): Promise<void> {
  const { host, port } = describeTarget(url);
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    const fail = (reason: string) => {
      socket.destroy();
      reject(
        new Error(
          `${name} is not reachable at ${host}:${port} (${reason}).\n` +
            "Start the local services with `npm run docker:up` (Docker Desktop must be running), " +
            `or point ${name === "Postgres" ? "TEST_DATABASE_URL" : "TEST_REDIS_URL"} at a running instance.`,
        ),
      );
    };
    socket.setTimeout(CONNECT_TIMEOUT_MS, () => fail("timed out"));
    // Connection refusals arrive as an AggregateError with an empty message on some platforms.
    socket.once("error", (error: NodeJS.ErrnoException) => fail(error.code ?? (error.message || "connection failed")));
    socket.once("connect", () => {
      socket.end();
      resolve();
    });
  });
}

/** SELECT <db> + FLUSHDB over raw RESP, to avoid a Redis client dependency. */
function flushRedisDb(url: string): Promise<void> {
  const { host, port } = describeTarget(url);
  const db = String(getRedisDbIndex(url));
  const parsed = new URL(url);
  const commands: string[][] = [];
  if (parsed.password) {
    commands.push(parsed.username ? ["AUTH", parsed.username, parsed.password] : ["AUTH", parsed.password]);
  }
  commands.push(["SELECT", db], ["FLUSHDB"]);
  const payload = commands
    .map((args) => `*${args.length}\r\n${args.map((arg) => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`).join("")}`)
    .join("");

  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port }, () => socket.write(payload));
    let received = "";
    socket.setTimeout(CONNECT_TIMEOUT_MS, () => {
      socket.destroy();
      reject(new Error(`Redis did not answer FLUSHDB in time (got: ${JSON.stringify(received)}).`));
    });
    socket.on("data", (chunk) => {
      received += chunk.toString();
      if (received.startsWith("-") || received.includes("\r\n-")) {
        socket.destroy();
        reject(new Error(`Redis rejected the reset: ${received.trim()}`));
        return;
      }
      if ((received.match(/\+OK\r\n/g) ?? []).length >= commands.length) {
        socket.end();
        resolve();
      }
    });
    socket.once("error", reject);
  });
}

export default async function setup(): Promise<void> {
  assertIsolatedTargets();
  await Promise.all([
    checkReachable("Postgres", TEST_DATABASE_URL),
    checkReachable("Redis", TEST_REDIS_URL),
  ]);

  // Creates the test database if needed and syncs its schema. Non-destructive: tests never rely
  // on an empty database, because each test creates its own users and searches and only asserts
  // on those. CI always starts from a fresh database.
  execFileSync(
    process.execPath,
    [
      path.join(ROOT, "node_modules/prisma/build/index.js"),
      "db",
      "push",
      "--skip-generate",
      "--schema",
      path.join(ROOT, "packages/database/prisma/schema.prisma"),
    ],
    {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: ["ignore", "ignore", "inherit"],
    },
  );

  // Leftover jobs from an interrupted run would be picked up by the test worker; start clean.
  await flushRedisDb(TEST_REDIS_URL);
}
