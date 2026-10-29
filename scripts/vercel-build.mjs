/**
 * Vercel api-service build entry.
 * Always rebuilds shared + web UI into apps/api/public, then compiles the API.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd: root, stdio: "inherit", env: process.env });
}

run("node scripts/sync-web-public.mjs");
run("npm run build -w @humanizer/api");
console.log("vercel-build complete");
