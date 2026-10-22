/**
 * Checks the rules that need no Foundry (scripts/rules.js, the layout
 * arithmetic in scripts/arrange.js, scripts/constants.js), with Node's own
 * test runner. Run it like the load check:
 *
 *   ELECTRON_RUN_AS_NODE=1 ~/foundryvtt/foundryvtt tools/test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

// The scripts are ES modules named .js; copy them as .mjs so Node loads them as modules.
const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vn-stage-test-"));
const load = async (name) => {
  const code = fs.readFileSync(path.join(here, "..", "scripts", `${name}.js`), "utf8").replace(/from "\.\/([\w-]+)\.js"/g, 'from "./$1.mjs"');
  fs.writeFileSync(path.join(tmp, `${name}.mjs`), code);
  return import(pathToFileURL(path.join(tmp, `${name}.mjs`)).href);
};
const { LAYOUT, FRAME, faceGuide, GUIDE_TOP } = await load("constants");
const { arrange, clusterCentres, clusterWidth } = await load("arrange");
const R = await load("rules");
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));

/* -------------------------------------------- */
/*  Layout arithmetic                           */
/* -------------------------------------------- */

const W = 400; // a typical portrait width in frame pixels

test("a cluster's width: half of each end plus a step per neighbour", () => {
  assert.equal(clusterWidth([], 0.55), 0);
  assert.equal(clusterWidth([W], 0.55), W);
  assert.equal(clusterWidth([W, W], 0.5), W + 0.5 * W);
});

test("one side alone is centred in the usable width, at full size", () => {
  const { zoom, regions } = arrange({ left: [W, W], right: [] }, FRAME.width, LAYOUT);
  assert.equal(zoom, 1);
  assert.equal(regions.right, null);
  assert.equal(regions.left.anchor, "centre");
  assert.ok(regions.left.to <= FRAME.width * (1 - LAYOUT.sidebar), "never uses the sidebar's share");
});

test("two sides share the width in proportion to what each needs", () => {
  const { regions } = arrange({ left: [W], right: [W, W, W] }, FRAME.width, LAYOUT);
  const l = regions.left.to - regions.left.from, r = regions.right.to - regions.right.from;
  const needL = clusterWidth([W], LAYOUT.step), needR = clusterWidth([W, W, W], LAYOUT.step);
  assert.ok(Math.abs(l / r - needL / needR) < 1e-9);
  assert.ok(regions.left.to < regions.right.from, "a gap between the sides");
});

test("a crowded stage shrinks buffers, then zooms, never below the floor", () => {
  const calm = arrange({ left: [W, W], right: [W] }, FRAME.width, LAYOUT);
  const packed = arrange({ left: Array(6).fill(W), right: Array(6).fill(W) }, FRAME.width, LAYOUT);
  assert.equal(calm.buffers, 1);
  assert.ok(packed.crowding > LAYOUT.crowdEnd);
  assert.equal(packed.buffers, LAYOUT.minBuffer);
  assert.equal(packed.zoom, LAYOUT.minZoom);
});

test("the right side stands right to left; a roomy cluster spreads no further than roomyStep", () => {
  const region = { from: 0, to: 2000, anchor: "end" };
  const [first, second] = clusterCentres("right", [W, W], region, LAYOUT.step, LAYOUT.roomyStep);
  assert.ok(first > second, "first-placed stands at the outer (right) edge");
  assert.ok(Math.abs(first - second - LAYOUT.roomyStep * W) < 1e-9);
});

test("a zoomed face keeps its centre on the guide", () => {
  const full = faceGuide(1, 1), zoomed = faceGuide(1, 0.75);
  assert.equal(full.top, GUIDE_TOP);
  assert.ok(Math.abs((full.top + full.bottom) / 2 - (zoomed.top + zoomed.bottom) / 2) < 1e-12);
});

/* -------------------------------------------- */
/*  The party and presets                       */
/* -------------------------------------------- */

const A = { id: "a", uuid: "A", name: "Ana" }, B = { id: "b", uuid: "B", name: "Bo" }, C = { id: "c", uuid: "C", name: "Cy" };
const names = (cast) => cast.map((e) => `${e.name}:${e.side}`);
const saved = [
  { name: "Strahd", side: "right" },
  { name: "Ana", actorUuid: "A", side: "left", partyMember: true },
  { name: "Bo", actorUuid: "B", side: "right", partyMember: true },
  { name: "Ireena", side: "left" },
];

test("a preset loads the same party exactly as saved, without the party marks", () => {
  const out = R.fitPartyCast(saved, [A, B]);
  assert.deepEqual(names(out), ["Strahd:right", "Ana:left", "Bo:right", "Ireena:left"]);
  assert.ok(out.every((e) => !("partyMember" in e)));
});

test("members who left stay off; new members join after the last saved member still here", () => {
  assert.deepEqual(names(R.fitPartyCast(saved, [A, C])), ["Strahd:right", "Ana:left", "Cy:left", "Ireena:left"]);
});

test("an all-new party stands where the first saved member stood", () => {
  assert.deepEqual(names(R.fitPartyCast(saved, [C])), ["Strahd:right", "Cy:left", "Ireena:left"]);
});

test("an old whole-party entry becomes every member, in its order, skipping members standing alone", () => {
  const old = [{ name: "Bo", actorUuid: "B", side: "right" }, { id: "x", party: true, side: "left", order: ["c", "a"] }];
  assert.deepEqual(names(R.fitPartyCast(old, [A, B, C])), ["Bo:right", "Cy:left", "Ana:left"]);
});

test("a preset with no party members adds nobody", () => {
  assert.deepEqual(names(R.fitPartyCast([{ name: "Strahd", side: "right" }], [A, B])), ["Strahd:right"]);
});

test("remembered order first, then the rest as given", () => {
  assert.deepEqual(R.orderMembers([A, B, C], ["c"]).map((a) => a.id), ["c", "a", "b"]);
});

test("cast entries compare equal whatever their field order, and missing equals null", () => {
  assert.equal(R.stable([{ side: "left", name: "A", actorUuid: null }]), R.stable([{ name: "A", side: "left" }]));
  assert.notEqual(R.stable([{ name: "A", side: "left" }]), R.stable([{ name: "A", side: "right" }]));
});

/* -------------------------------------------- */
/*  Art and groups                              */
/* -------------------------------------------- */

test("forms read as a list (folder) or an object (dir), without trailing slashes", () => {
  assert.deepEqual(R.formsOf({ forms: [{ form: "corrupted", folder: "forms/corrupted/" }] }).map((f) => f.folder), ["forms/corrupted"]);
  assert.deepEqual(R.formsOf({ forms: { ghost: { dir: "forms/ghost" } } }).map((f) => [f.form, f.folder]), [["ghost", "forms/ghost"]]);
  assert.deepEqual(R.formsOf({}), []);
  assert.deepEqual(R.formsOf(null), []);
});

test("a form's family is the character it belongs to", () => {
  assert.equal(R.familyOf("Rahadin/forms/corrupted"), "Rahadin");
  assert.equal(R.familyOf("Rahadin"), "Rahadin");
});

test("group members: tags plus hand additions, and a hand removal wins over a tag", () => {
  const index = [{ name: "Ezren", groups: ["PFS Intro 1"] }, { name: "Valeros", groups: ["PFS Intro 1"] }, { name: "Merisiel", groups: [] }];
  const members = R.groupMembers("PFS Intro 1", index, { add: ["Merisiel"], remove: ["Valeros"] });
  assert.deepEqual(members.sort(), ["Ezren", "Merisiel"]);
});

test("Recent puts the newest first, without repeats, up to its limit", () => {
  assert.deepEqual(R.mergeRecent(["b", "x"], ["a", "b", "c"], 3), ["b", "x", "a"]);
});

/* -------------------------------------------- */
/*  Dropping on the stage                       */
/* -------------------------------------------- */

test("a drop picks the side by the gap between the clusters, and counts from the outer edge", () => {
  const left = [300, 600], right = [1900, 1600]; // standing order: outer edge first
  assert.deepEqual(R.dropSlot(450, left, right, FRAME.width, LAYOUT.sidebar), { side: "left", index: 1, x: 450 });
  const r = R.dropSlot(1750, left, right, FRAME.width, LAYOUT.sidebar);
  assert.equal(r.side, "right");
  assert.equal(r.index, 1);
});

test("on an empty stage a drop's side is by the middle of the usable width", () => {
  const middle = (FRAME.width * (1 - LAYOUT.sidebar)) / 2;
  assert.equal(R.dropSlot(middle - 1, [], [], FRAME.width, LAYOUT.sidebar).side, "left");
  assert.equal(R.dropSlot(middle + 1, [], [], FRAME.width, LAYOUT.sidebar).side, "right");
});
