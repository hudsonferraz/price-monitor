#!/usr/bin/env node

/**
 * One-command local demo: no Facebook account, no OAuth apps, no Chromium.
 *
 * 1. Checks Docker, starts Postgres + Redis and waits until they are healthy.
 *    Demo data lives in its own database (price_monitor_demo) and Redis DB (1),
 *    isolated from a real local setup that uses the same containers.
 * 2. Pushes the Prisma schema and (re)seeds demo data.
 * 3. Runs the worker (mock marketplace) and the web app (demo sign-in) together.
 *
 * `--seed-only` stops after step 2 (used by `npm run demo:seed`).
 *
 * Demo settings are passed through the environment. dotenv-cli and Next.js never override
 * variables that are already set, so existing .env files cannot turn demo mode off.
 */

import { spawn, spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const WEB_URL = "http://localhost:3000";

const demoEnv = {
  ...process.env,
  DEMO_MODE: "true",
  MOCK_MARKETPLACE: "true",
  // Same containers as docker-compose.yml, but a separate Postgres database and Redis
  // logical DB, so the demo worker never polls (or writes mock data into) real searches.
  // `prisma db push` creates the demo database on first run.
  DATABASE_URL: "postgresql://price_monitor:price_monitor@localhost:5433/price_monitor_demo",
  REDIS_URL: "redis://localhost:6379/1",
  AUTH_URL: WEB_URL,
  AUTH_SECRET: process.env.AUTH_SECRET || "price-monitor-local-demo-secret-not-for-production",
};
// Leftover CI flags change Next.js/Prisma behavior; not wanted for a local demo.
delete demoEnv.CI;

function runStep(label, command, args) {
  console.log(`\n> ${label}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: isWindows, env: demoEnv });
  if (result.status !== 0) {
    console.error(`\nDemo setup failed at: ${label}`);
    process.exit(result.status ?? 1);
  }
}

function dockerReady() {
  const result = spawnSync("docker", ["info"], { stdio: "ignore", shell: isWindows });
  return result.status === 0;
}

if (!dockerReady()) {
  console.error(`
Docker is not running (or the engine is not ready).

1) Start Docker Desktop and wait until it says running
2) From the price-monitor folder run: npm run demo
`);
  process.exit(1);
}

runStep("Starting Postgres and Redis", "docker", [
  "compose",
  "up",
  "-d",
  "--wait",
  "postgres",
  "redis",
]);
runStep("Applying database schema", "npm", ["run", "db:push"]);
runStep("Seeding demo data", "npm", ["run", "seed:demo", "--workspace=@price-monitor/worker"]);

if (process.argv.includes("--seed-only")) {
  console.log("\nDemo data reset. Run `npm run demo` to start the demo.");
  process.exit(0);
}

const children = [];
let shuttingDown = false;

function prefixStream(stream, prefix, target, onLine) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      target.write(`${prefix} ${line}\n`);
      onLine?.(line);
    }
  });
  stream.on("end", () => {
    if (buffer) {
      target.write(`${prefix} ${buffer}\n`);
    }
  });
}

function startChild(name, args, onLine) {
  const child = spawn("npm", args, {
    env: demoEnv,
    shell: isWindows,
    // Own process group on POSIX so the whole tree can be stopped together.
    detached: !isWindows,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const prefix = `[${name}]`;
  prefixStream(child.stdout, prefix, process.stdout, onLine);
  prefixStream(child.stderr, prefix, process.stderr, onLine);
  child.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`\n${prefix} exited with code ${code ?? "unknown"}; stopping the demo.`);
      shutdown(code ?? 1);
    }
  });
  children.push(child);
  return child;
}

function killTree(child) {
  if (child.exitCode != null || child.pid == null) {
    return;
  }

  if (isWindows) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log("\nStopping demo (worker + web)...");
  for (const child of children) {
    killTree(child);
  }
  // Give the worker a moment to mark itself offline before exiting.
  setTimeout(() => process.exit(exitCode), 1500);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

let bannerShown = false;
function showBannerWhenReady(line) {
  if (bannerShown || !/ready in|local:\s+http/i.test(line)) {
    return;
  }
  bannerShown = true;
  console.log(`
==============================================================
  price-monitor demo is running

  Open ${WEB_URL} and choose "Continue as demo user".
  Polls use a simulated marketplace; nothing touches Facebook.
  Press Ctrl+C to stop.
==============================================================
`);
}

console.log("\n> Starting worker (mock marketplace) and web app (demo mode)");
startChild("worker", ["run", "worker:dev"]);
startChild("web", ["run", "dev", "--workspace=@price-monitor/web"], showBannerWhenReady);
