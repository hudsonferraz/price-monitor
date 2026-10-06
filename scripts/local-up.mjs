#!/usr/bin/env node

import { spawnSync } from "node:child_process";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function dockerReady() {
  const result = spawnSync("docker", ["info"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  return result.status === 0;
}

if (!dockerReady()) {
  console.error(`
Docker Desktop is not running (or the engine is not ready).

1) Start Docker Desktop and wait until it says running
2) From the price-monitor folder run: npm run local:up

Without Postgres on localhost:5433, Google/GitHub login fails with AdapterError / Can't reach database server.
`);
  process.exit(1);
}

const childEnv = { ...process.env };
// Avoid leftover CI/shell DATABASE_URL overriding .env (common after local CI builds).
delete childEnv.DATABASE_URL;
delete childEnv.CI;

run("npm", ["run", "docker:up"]);
run("npm", ["run", "db:push"], { env: childEnv });

console.log(`
Next steps (full local):
  1) npm run facebook:login
  2) npm run worker:dev
  3) npm run dev --workspace=@price-monitor/web

One install uses one Facebook browser profile in .facebook-profile/
`);
