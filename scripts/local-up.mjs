#!/usr/bin/env node

import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npm", ["run", "docker:up"]);
run("npm", ["run", "db:push"]);

console.log(`
Next steps (full local):
  1) npm run facebook:login
  2) npm run worker:dev
  3) npm run dev --workspace=@price-monitor/web

One install uses one Facebook browser profile in .facebook-profile/
`);
