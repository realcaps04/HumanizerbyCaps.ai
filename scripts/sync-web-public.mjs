/**
 * Builds the Vite web app (unless --skip-build) and copies dist → apps/api/public.
 * Required because Vercel Express serves the UI from apps/api/public.
 */
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const webDist = path.join(root, "apps/web/dist");
const apiPublic = path.join(root, "apps/api/public");
const stampPath = path.join(root, "apps/api/BUILD_STAMP");
const skipBuild = process.argv.includes("--skip-build");

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd: root, stdio: "inherit", env: process.env });
}

function rimraf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

if (!skipBuild) {
  run("npx tsc -p packages/shared/tsconfig.json");
  run("npm run build -w @humanizer/web");
}

if (!fs.existsSync(path.join(webDist, "index.html"))) {
  console.error("Missing apps/web/dist/index.html — web build failed or --skip-build used too early.");
  process.exit(1);
}

rimraf(apiPublic);
copyDir(webDist, apiPublic);

// Ensure static SEO assets from web/public are present (Vite usually copies them into dist)
const webPublic = path.join(root, "apps/web/public");
if (fs.existsSync(webPublic)) {
  for (const name of fs.readdirSync(webPublic)) {
    const from = path.join(webPublic, name);
    const to = path.join(apiPublic, name);
    if (fs.statSync(from).isFile()) fs.copyFileSync(from, to);
  }
}

const indexPath = path.join(apiPublic, "index.html");
if (!fs.existsSync(indexPath)) {
  console.error("sync-web-public failed: apps/api/public/index.html missing after copy.");
  process.exit(1);
}

const index = fs.readFileSync(indexPath, "utf8");
const digest = createHash("sha256").update(index).digest("hex").slice(0, 16);
const stamp = `# UI bundle ${digest}\n# Do not edit by hand — updated by scripts/sync-web-public.mjs\n`;
const previous = fs.existsSync(stampPath) ? fs.readFileSync(stampPath, "utf8") : "";
if (previous !== stamp) {
  fs.writeFileSync(stampPath, stamp, "utf8");
}

const asset = index.match(/assets\/index-[^"]+\.js/);
console.log(`Synced web → apps/api/public (${asset?.[0] ?? "bundle ok"}, stamp ${digest})`);
