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
const { arrange, clusterCentres, clusterWidth, shadeCut } = await load("arrange");
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

const H = FRAME.height;
const at = (bottom, extra = {}) => ({ box: { y: bottom - 800, height: 800 }, ...extra });

test("the bottom shade: a raised flyer alone brings up none", () => {
  assert.equal(shadeCut([at(H - 200, { flying: true })], H), H);
});

test("the bottom shade: a flyer beside a raised non-flyer starts at the non-flyer's edge", () => {
  assert.equal(shadeCut([at(H - 500, { flying: true }), at(H - 200)], H), H - 200);
});

test("the bottom shade: everyone flying brings up none", () => {
  assert.equal(shadeCut([at(H - 300, { flying: true }), at(H - 100, { flying: true })], H), H);
});

test("the bottom shade: fallback images are still ignored", () => {
  assert.equal(shadeCut([at(H - 300, { fallback: true })], H), H);
  assert.equal(shadeCut([at(H - 300, { fallback: true }), at(H - 150)], H), H - 150);
});

/* -------------------------------------------- */
/*  The party and presets                       */
/* -------------------------------------------- */

const A = { id: "a", uuid: "A", name: "Ana" }, B = { id: "b", uuid: "B", name: "Bo" }, C = { id: "c", uuid: "C", name: "Cy" };
const names = (cast) => cast.map((e) => `${e.name}:${e.side}`);
const saved = [
  { name: "Vane", side: "right" },
  { name: "Ana", actorUuid: "A", side: "left", partyMember: true },
  { name: "Bo", actorUuid: "B", side: "right", partyMember: true },
  { name: "Pell", side: "left" },
];

test("a preset loads the same party exactly as saved, without the party marks", () => {
  const out = R.fitPartyCast(saved, [A, B]);
  assert.deepEqual(names(out), ["Vane:right", "Ana:left", "Bo:right", "Pell:left"]);
  assert.ok(out.every((e) => !("partyMember" in e)));
});

test("members who left stay off; new members join after the last saved member still here", () => {
  assert.deepEqual(names(R.fitPartyCast(saved, [A, C])), ["Vane:right", "Ana:left", "Cy:left", "Pell:left"]);
});

test("an all-new party stands where the first saved member stood", () => {
  assert.deepEqual(names(R.fitPartyCast(saved, [C])), ["Vane:right", "Cy:left", "Pell:left"]);
});

test("an old whole-party entry becomes every member, in its order, skipping members standing alone", () => {
  const old = [{ name: "Bo", actorUuid: "B", side: "right" }, { id: "x", party: true, side: "left", order: ["c", "a"] }];
  assert.deepEqual(names(R.fitPartyCast(old, [A, B, C])), ["Bo:right", "Cy:left", "Ana:left"]);
});

test("a preset with no party members adds nobody", () => {
  assert.deepEqual(names(R.fitPartyCast([{ name: "Vane", side: "right" }], [A, B])), ["Vane:right"]);
});

test("upgrading an old cast: Full reads as left; the party entry becomes its members, keeping ids", () => {
  const old = [{ id: "s", name: "Vane", side: "full" }, { id: "p", party: true, side: "right", order: ["b"] }, { id: "x", name: "Ana", actorUuid: "A", side: "left" }];
  const out = R.upgradeCast(old, [A, B]);
  assert.deepEqual(out.map((e) => `${e.id}:${e.name}:${e.side}`), ["s:Vane:left", "p.b:Bo:right", "x:Ana:left"]);
  assert.ok(R.upgradeCast(old, [A, B], { preset: true }).find((e) => e.name === "Bo").partyMember);
});

test("upgrading with no party known: a preset keeps the old entry (it fills in when loaded); a stage drops it", () => {
  const old = [{ party: true, side: "left", order: [] }, { name: "Vane", side: "right" }];
  assert.deepEqual(R.upgradeCast(old, [], { preset: true }), old);
  assert.deepEqual(R.upgradeCast(old, []), [{ name: "Vane", side: "right" }]);
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

test("a form's family is the character it belongs to", () => {
  assert.equal(R.familyOf("Mira Voss/forms/corrupted"), "Mira Voss");
  assert.equal(R.familyOf("Mira Voss"), "Mira Voss");
});

test("group members: tags plus hand additions, and a hand removal wins over a tag", () => {
  const index = [{ name: "Ezren", groups: ["The Crew"] }, { name: "Valeros", groups: ["The Crew"] }, { name: "Merisiel", groups: [] }];
  const members = R.groupMembers("The Crew", index, { add: ["Merisiel"], remove: ["Valeros"] });
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

test("a drop on an empty side snaps to the mirror of the other side's outermost character", () => {
  const usable = FRAME.width * (1 - LAYOUT.sidebar);
  const left = [300, 600];
  const r = R.dropSlot(usable - 100, left, [], FRAME.width, LAYOUT.sidebar);
  assert.deepEqual(r, { side: "right", index: 0, x: usable - 300 });
  const a = R.dropSlot(usable - 100, left, [], FRAME.width, LAYOUT.sidebar).x;
  const b = R.dropSlot(usable - 400, left, [], FRAME.width, LAYOUT.sidebar).x;
  assert.equal(a, b);
  assert.equal(R.dropSlot(1, [], [], FRAME.width, LAYOUT.sidebar).x, usable * 0.25);
});

test("a full one-sided stage still lets a drop reach the far edge as the other side", () => {
  const usable = FRAME.width * (1 - LAYOUT.sidebar);
  const left = [150, 350, 550, 750, 950, 1150, 1350, usable - 150];
  const across = R.dropSlot(usable - 20, left, [], FRAME.width, LAYOUT.sidebar);
  assert.equal(across.side, "right");
  assert.ok(across.x >= Math.max(...left));
});

test("a crowded side with the other empty keeps drops beyond the middle", () => {
  const middle = (FRAME.width * (1 - LAYOUT.sidebar)) / 2;
  const left = [200, 500, middle + 200, middle + 400];
  const inside = R.dropSlot(middle + 500, left, [], FRAME.width, LAYOUT.sidebar);
  assert.equal(inside.side, "left");
  assert.equal(inside.index, 4);
  assert.equal(R.dropSlot(middle + 400 + 0.07 * FRAME.width, left, [], FRAME.width, LAYOUT.sidebar).side, "right");
});

/* -------------------------------------------- */
/*  Art folders                                 */
/* -------------------------------------------- */

const bare = { files: ["portrait.webp"], dirs: [] };

test("a bare folder: a portrait is all a character needs", () => {
  const a = R.normaliseArt("Mira Voss", bare, null);
  assert.equal(a.key, "Mira Voss");
  assert.equal(a.name, "Mira Voss");
  assert.equal(a.label, "Mira Voss");
  assert.equal(a.portrait, "Mira Voss/portrait.webp");
  assert.equal(a.thumb, "Mira Voss/portrait.webp", "no avatar: the portrait stands in");
  assert.deepEqual(a.expressions, { neutral: "Mira Voss/portrait.webp" });
  assert.deepEqual(a.labels, { neutral: "Neutral" });
  assert.equal(a.size, "medium");
  assert.equal(a.scale, 1);
  assert.equal(a.yOffset, 0);
  assert.deepEqual(a.groups, []);
  assert.deepEqual(a.forms, []);
  assert.deepEqual(a.warnings, []);
});

test("no portrait, no character", () => {
  assert.equal(R.normaliseArt("Empty", { files: ["avatar.webp", "notes.txt"], dirs: [] }, null), null);
});

test("a full file sets every field", () => {
  const listing = { files: ["portrait.webp", "avatar.png", "vn-stage.json"], dirs: ["expressions"], expressions: ["happy.webp", "angry.webp", "fear.webp"] };
  const file = { format: 1, label: "Lady Mira", avatar: "avatar.png", expressions: { happy: "Glad", fear: "Afraid" }, size: "large", scale: 0.57, yOffset: 0.055, groups: ["Crew", " Allies "] };
  const a = R.normaliseArt("Mira Voss", listing, file);
  assert.equal(a.label, "Lady Mira");
  assert.equal(a.thumb, "Mira Voss/avatar.png");
  assert.equal(a.size, "large");
  assert.equal(a.scale, 0.57);
  assert.equal(a.yOffset, 0.055);
  assert.deepEqual(a.groups, ["Crew", "Allies"]);
  assert.deepEqual(a.warnings, []);
});

test("expressions: neutral first, listed names in the file's order, the rest by file name, labels from names", () => {
  const listing = { files: ["portrait.webp"], dirs: ["expressions"], expressions: ["angry.webp", "deep-sorrow.png", "happy.webp", "fear.webp"] };
  const a = R.normaliseArt("X", listing, { format: 1, expressions: { happy: "Glad", fear: "Afraid", missing: "Gone" } });
  assert.deepEqual(Object.keys(a.expressions), ["neutral", "happy", "fear", "angry", "deep-sorrow"]);
  assert.deepEqual(a.labels, { neutral: "Neutral", happy: "Glad", fear: "Afraid", angry: "Angry", "deep-sorrow": "Deep sorrow" });
  assert.equal(a.expressions["deep-sorrow"], "X/expressions/deep-sorrow.png");
});

test("an expression called neutral is ignored: the portrait is always neutral", () => {
  const a = R.normaliseArt("X", { files: ["portrait.webp"], expressions: ["neutral.webp", "Neutral.png", "calm.webp"] }, null);
  assert.deepEqual(Object.keys(a.expressions), ["neutral", "calm"]);
  assert.equal(a.expressions.neutral, "X/portrait.webp");
});

test("mixed image types: any of the five count, others don't, and webp wins a tie", () => {
  const listing = { files: ["Portrait.JPG", "portrait.png", "avatar.avif"], expressions: ["a.jpeg", "b.avif", "c.gif", "notes.txt", "d.png", "d.webp"] };
  const a = R.normaliseArt("X", listing, null);
  assert.equal(a.portrait, "X/portrait.png", "png beats jpg");
  assert.equal(a.thumb, "X/avatar.avif");
  assert.deepEqual(Object.keys(a.expressions), ["neutral", "a", "b", "d"]);
  assert.equal(a.expressions.d, "X/expressions/d.webp");
});

test("forms are listed by key; a form's label joins its parent's, and a form has no forms of its own", () => {
  const parent = R.normaliseArt("Mira Voss", { files: ["portrait.webp"], dirs: ["forms"], forms: ["corrupted", "ghost"] }, null);
  assert.deepEqual(parent.forms, ["Mira Voss/forms/corrupted", "Mira Voss/forms/ghost"]);
  const form = R.normaliseArt("Mira Voss/forms/corrupted", { files: ["portrait.webp"], forms: ["x"], parentLabel: "Mira Voss" }, null);
  assert.equal(form.label, "Mira Voss · Corrupted");
  assert.equal(form.formLabel, "Corrupted");
  assert.deepEqual(form.forms, []);
  const named = R.normaliseArt("Mira Voss/forms/ghost", { files: ["portrait.webp"] }, { format: 1, label: "Spectre" });
  assert.equal(named.label, "Mira Voss · Spectre");
  assert.equal(R.familyOf(named.key), "Mira Voss");
});

test("a form folder with no portrait isn't offered", () => {
  assert.equal(R.normaliseArt("Mira Voss/forms/twin-scimitars", { files: ["token-combat.webp"] }, null), null);
});

test("an unknown format warns and still reads what it can", () => {
  const a = R.normaliseArt("X", bare, { format: 2, label: "Future", scale: 0.8 });
  assert.equal(a.label, "Future");
  assert.equal(a.scale, 0.8);
  assert.equal(a.warnings.length, 1);
  assert.match(a.warnings[0], /format 2/);
  assert.equal(R.normaliseArt("X", bare, { label: "No number" }).warnings.length, 1);
});

test("a broken file warns once and the folder still loads", () => {
  const listing = { files: ["portrait.webp", "vn-stage.json"] };
  for (const file of [null, "text", [1, 2]]) {
    const a = R.normaliseArt("X", listing, file);
    assert.equal(a.portrait, "X/portrait.webp");
    assert.equal(a.warnings.length, 1);
  }
  assert.deepEqual(R.normaliseArt("X", bare, null).warnings, [], "no file is not a problem");
});

test("bad values fall back to defaults, each with a warning", () => {
  const a = R.normaliseArt("X", bare, { format: 1, size: "colossal", scale: -1, yOffset: "low", groups: "Crew", avatar: "missing.png", portrait: "nope.png" });
  assert.equal(a.size, "medium");
  assert.equal(a.scale, 1);
  assert.equal(a.yOffset, 0);
  assert.deepEqual(a.groups, []);
  assert.equal(a.portrait, "X/portrait.webp", "a named portrait that isn't there falls back to portrait.*");
  assert.equal(a.thumb, "X/portrait.webp");
  assert.equal(a.warnings.length, 3);
});

test("unknown fields are ignored", () => {
  const a = R.normaliseArt("X", bare, { format: 1, scale: 0.9, "some-tool": { anything: true } });
  assert.equal(a.scale, 0.9);
  assert.deepEqual(a.warnings, []);
  assert.equal("some-tool" in a, false);
});

test("a named portrait and avatar in the file are used when they exist", () => {
  const a = R.normaliseArt("X", { files: ["main.png", "small.png"] }, { format: 1, portrait: "main.png", avatar: "small.png" });
  assert.equal(a.portrait, "X/main.png");
  assert.equal(a.thumb, "X/small.png");
});

test("expression names that match built-in object names are ordinary names", () => {
  const listing = { files: ["portrait.webp"], expressions: ["constructor.webp", "angry.webp", "toString.png"] };
  const a = R.normaliseArt("X", listing, { format: 1, expressions: { angry: "Cross" } });
  assert.deepEqual(Object.keys(a.expressions), ["neutral", "angry", "constructor", "toString"]);
  assert.equal(a.labels.constructor, "Constructor");
  assert.equal(a.labels.angry, "Cross");
});

/* -------------------------------------------- */
/*  Scale and drop                              */
/* -------------------------------------------- */

const artAt = (scale, yOffset) => ({ scale, yOffset });

test("placement: Adjust's values win, else the art's own, else the no-art default", () => {
  assert.deepEqual(R.placementOf({}, artAt(0.54, 0.024)), { scale: 0.54, yOffset: 0.024 });
  assert.deepEqual(R.placementOf({ scale: 0.6 }, artAt(0.54, 0.024)), { scale: 0.6, yOffset: 0.024 });
  assert.deepEqual(R.placementOf({ yOffset: 0 }, artAt(0.54, 0.024)), { scale: 0.54, yOffset: 0 }, "a drop of 0 is a choice");
  assert.deepEqual(R.placementOf({}, null), { scale: R.FALLBACK_SCALE, yOffset: 0 });
});

test("schema 2: old relative Adjust values become the actual ones", () => {
  assert.deepEqual(R.absolutePrefs({ scale: 0.5, yOffset: 0.01, flip: true }, artAt(1, 0.02)), { scale: 0.5, yOffset: 0.03, flip: true });
  assert.deepEqual(R.absolutePrefs({ scale: 1.1 }, artAt(0.6, 0)), { scale: 0.66 });
  assert.deepEqual(R.absolutePrefs({ scale: 2 }, null), { scale: 1 }, "no art: relative to the fallback height");
});

test("schema 2: values that match the art's own are dropped", () => {
  assert.deepEqual(R.absolutePrefs({ scale: 1, yOffset: 0, size: "lg" }, artAt(0.54, 0.024)), { size: "lg" });
  assert.deepEqual(R.absolutePrefs({ flip: true }, artAt(0.54, 0.024)), { flip: true });
});

test("view lock: players are always locked; the GM only when they chose to", () => {
  assert.equal(R.locksView({ isGM: false, gmLock: false }), true);
  assert.equal(R.locksView({ isGM: false, gmLock: true }), true);
  assert.equal(R.locksView({ isGM: true, gmLock: false }), false);
  assert.equal(R.locksView({ isGM: true, gmLock: true }), true);
});
