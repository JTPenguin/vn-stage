/**
 * Load every script the way Foundry does (the full import graph), with stand-ins
 * for Foundry's globals, and report the first error. Catches what a syntax check
 * misses: clashing names, missing exports, bad import paths.
 *
 *   ELECTRON_RUN_AS_NODE=1 ~/foundryvtt/foundryvtt tools/check-load.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "..", "scripts");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vn-stage-load-"));
for (const f of fs.readdirSync(src).filter((f) => f.endsWith(".js"))) {
  const code = fs.readFileSync(path.join(src, f), "utf8").replace(/from "\.\/([\w-]+)\.js"/g, 'from "./$1.mjs"');
  fs.writeFileSync(path.join(tmp, f.replace(/\.js$/, ".mjs")), code);
}

class Base {}
globalThis.foundry = {
  applications: { api: { ApplicationV2: Base, HandlebarsApplicationMixin: (B) => class extends B {}, DialogV2: Base }, handlebars: { loadTemplates() {} } },
  utils: {},
};
globalThis.Hooks = { on() {}, once() {}, callAll() {}, off() {} };
globalThis.game = {};
globalThis.CONST = {};
globalThis.PIXI = {};

try {
  await import(pathToFileURL(path.join(tmp, "module.mjs")).href);
  console.log("OK: every script loads");
} catch (err) {
  console.log(`LOAD ERROR: ${err.constructor.name}: ${err.message}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
