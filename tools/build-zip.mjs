/**
 * Build the release zip: dist/vn-stage-<version>.zip, plus dist/module.json, the
 * manifest Foundry reads to install and update. Needs `zip` and `unzip`.
 *
 *   ELECTRON_RUN_AS_NODE=1 ~/foundryvtt/foundryvtt tools/build-zip.mjs
 *
 * The working copy's module.json has no `manifest` or `download`, so Foundry's
 * updater can never overwrite it through the symlink. This script writes both
 * into the zip's module.json and dist/module.json only. The repository comes
 * from GITHUB_REPOSITORY (set in GitHub Actions), else REPO below.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "JTPenguin/vn-stage";
const CONTENTS = ["LICENSE", "README.md", "CHANGELOG.md", "docs", "assets", "scripts", "styles", "templates", "lang"];

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8"));
for (const key of ["manifest", "download"]) {
  if (source[key]) {
    console.error(`module.json holds "${key}". Take it out: this script adds it to the release only.`);
    process.exit(1);
  }
}

const repo = process.env.GITHUB_REPOSITORY || REPO;
const tag = `v${source.version}`;
const released = {
  ...source,
  url: `https://github.com/${repo}`,
  manifest: `https://github.com/${repo}/releases/latest/download/module.json`,
  download: `https://github.com/${repo}/releases/download/${tag}/${source.id}.zip`,
};
const manifestText = `${JSON.stringify(released, null, 2)}\n`;

const dist = path.join(root, "dist");
const output = path.join(dist, `${source.id}-${source.version}.zip`);
fs.mkdirSync(dist, { recursive: true });
fs.rmSync(output, { force: true });
fs.writeFileSync(path.join(dist, "module.json"), manifestText);

// A temporary copy gives the zip its top folder, whatever this repository's folder is called.
const staging = fs.mkdtempSync(path.join(os.tmpdir(), "vn-stage-zip-"));
try {
  const top = path.join(staging, source.id);
  for (const name of CONTENTS) fs.cpSync(path.join(root, name), path.join(top, name), { recursive: true });
  fs.writeFileSync(path.join(top, "module.json"), manifestText);
  execFileSync("zip", ["-rqX", output, source.id], { cwd: staging, stdio: "inherit" });
} finally {
  fs.rmSync(staging, { recursive: true, force: true });
}

// Every file the manifest names must be in the zip, or the module fails to load after install.
const listed = new Set(execFileSync("unzip", ["-Z1", output], { encoding: "utf8" }).split("\n").filter(Boolean));
const needed = ["module.json", ...source.esmodules, ...source.styles, ...source.languages.map((l) => l.path)];
const missing = needed.filter((file) => !listed.has(`${source.id}/${file}`));
if (missing.length) {
  console.error(`Missing from the zip: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`OK: ${path.relative(root, output)} (${listed.size} entries) and dist/module.json for ${tag}`);
