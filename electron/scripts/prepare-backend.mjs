// Assembles a clean, production-only copy of the backend into electron/backend-dist/, which
// electron-builder then bundles via its `extraResources` config (outside the asar archive, so the
// spawned backend process and its node_modules behave like a normal install on disk). Run via
// `npm run prepare-backend` (or automatically as part of `npm run dist`) from inside electron/.

import { execFileSync } from "node:child_process";
import { cpSync, rmSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..");
const stagingDir = path.join(__dirname, "..", "backend-dist");

function run(command, args, cwd) {
    console.log(`> ${command} ${args.join(" ")}  (in ${cwd})`);
    execFileSync(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
}

console.log("1/4 Building the backend (tsc)...");
run("npm", ["run", "build"], repoRoot);

console.log("2/4 Resetting staging directory...");
rmSync(stagingDir, { recursive: true, force: true });
mkdirSync(stagingDir, { recursive: true });

console.log("3/4 Copying package.json/package-lock.json and running a production-only install...");
cpSync(path.join(repoRoot, "package.json"), path.join(stagingDir, "package.json"));
cpSync(path.join(repoRoot, "package-lock.json"), path.join(stagingDir, "package-lock.json"));
run("npm", ["ci", "--omit=dev", "--ignore-scripts"], stagingDir);

console.log("4/4 Copying dist/, public/, and configs/...");
cpSync(path.join(repoRoot, "dist"), path.join(stagingDir, "dist"), { recursive: true });
cpSync(path.join(repoRoot, "public"), path.join(stagingDir, "public"), { recursive: true });

// Ship the two example configs so a fresh install isn't completely empty; skip configs/data
// folders entirely if they don't exist yet (a brand-new checkout before its first run).
if (existsSync(path.join(repoRoot, "configs"))) {
    cpSync(path.join(repoRoot, "configs"), path.join(stagingDir, "configs"), { recursive: true });
}

console.log(`Done. Backend staged at ${stagingDir}`);
