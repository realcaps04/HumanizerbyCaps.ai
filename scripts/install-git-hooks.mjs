import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, ".githooks/pre-push");
const gitDir = path.join(root, ".git");
const destDir = path.join(gitDir, "hooks");
const dest = path.join(destDir, "pre-push");

if (!fs.existsSync(gitDir)) {
  console.log("install-git-hooks: not a git checkout, skipping");
  process.exit(0);
}

if (!fs.existsSync(src)) {
  console.error("install-git-hooks: missing .githooks/pre-push");
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
try {
  fs.chmodSync(dest, 0o755);
} catch {
  // Windows may ignore chmod; hook still runs via Git for Windows sh.
}

console.log("install-git-hooks: installed .git/hooks/pre-push");
