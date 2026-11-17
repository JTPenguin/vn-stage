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

/** Every cluster's centres, as layout.js places them. */
const placeAll = (widths) => {
  const a = arrange(widths, FRAME.width, LAYOUT);
  return { ...a, centres: widths.map((w, c) => clusterCentres(w.map((x) => x * a.zoom), a.regions[c], LAYOUT.step, LAYOUT.roomyStep)) };
};
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);

/*
 * Two clusters must stand exactly where the left and right sides stood. These
 * numbers came from the side-based arrange and clusterCentres (before
 * clusters), with the right side's centres sorted left to right and its
 * widths reversed to match (it stood from the right edge inward).
 */
const BEFORE_CLUSTERS = {
  "1 + 3": {
    widths: [[W], [W, W, W]], zoom: 1, crowding: 0.564375, buffers: 1,
    regions: [{ from: 51.2, to: 810.9419354838709, anchor: "start" }, { from: 913.3419354838711, to: 2508.8, anchor: "end" }],
    centres: [[251.2], [1708.8000000000002, 2008.8000000000002, 2308.8]],
  },
  "mixed widths": {
    widths: [[300, 500], [300, 450]], zoom: 1, crowding: 0.54923828125, buffers: 1,
    regions: [{ from: 51.2, to: 1266.7870967741935, anchor: "start" }, { from: 1369.1870967741938, to: 2508.8, anchor: "end" }],
    centres: [[201.2, 501.2], [2002.5500000000002, 2283.8]],
  },
  "7 + 7, packed": {
    widths: [Array(7).fill(W), Array(7).fill(W)], zoom: 0.75, crowding: 1.42375, buffers: 0.25,
    regions: [{ from: 12.8, to: 1267.2, anchor: "start" }, { from: 1292.7999999999997, to: 2547.2, anchor: "end" }],
    centres: [
      [162.8, 321.86666666666673, 480.93333333333345, 640.0000000000001, 799.0666666666668, 958.1333333333336, 1117.2000000000003],
      [1442.7999999999995, 1601.8666666666663, 1760.933333333333, 1919.9999999999995, 2079.0666666666666, 2238.133333333333, 2397.2],
    ],
  },
  // A side alone (left or right gave the same numbers): one centred cluster.
  "2 alone": {
    widths: [[W, W]], zoom: 1, crowding: 0.2821875, buffers: 1,
    regions: [{ from: 51.2, to: 2508.8, anchor: "centre" }],
    centres: [[1130, 1430]],
  },
};

for (const [name, want] of Object.entries(BEFORE_CLUSTERS)) {
  test(`clusters stand exactly where the sides stood: ${name}`, () => {
    const got = placeAll(want.widths);
    for (const k of ["zoom", "crowding", "buffers"]) close(got[k], want[k], k);
    assert.equal(got.regions.length, want.regions.length);
    got.regions.forEach((r, i) => {
      close(r.from, want.regions[i].from, `region ${i} from`);
      close(r.to, want.regions[i].to, `region ${i} to`);
      assert.equal(r.anchor, want.regions[i].anchor);
    });
    want.centres.forEach((list, c) => {
      assert.equal(got.centres[c].length, list.length);
      list.forEach((x, i) => close(got.centres[c][i], x, `cluster ${c}, centre ${i}`));
    });
  });
}

test("a lone cluster is centred in the full frame width, at full size", () => {
  const { zoom, regions } = arrange([[W, W]], FRAME.width, LAYOUT);
  assert.equal(zoom, 1);
  assert.equal(regions.length, 1);
  assert.equal(regions[0].anchor, "centre");
  assert.equal(regions[0].to, FRAME.width * (1 - LAYOUT.pad), "runs to the outer pad on the right");
});

test("three lone characters: one at each pad, one in the middle, none overlapping", () => {
  const { centres } = placeAll([[W], [W], [W]]);
  const pad = LAYOUT.pad * FRAME.width;
  close(centres[0][0], pad + W / 2, "left");
  close(centres[1][0], FRAME.width / 2, "middle");
  close(centres[2][0], FRAME.width - pad - W / 2, "right");
  assert.ok(centres[0][0] + W / 2 < centres[1][0] - W / 2 && centres[1][0] + W / 2 < centres[2][0] - W / 2);
});

test("clusters share the width in proportion to what each needs, with a gap between neighbours", () => {
  const widths = [[W], [W, W, W], [W, W]];
  const { regions } = arrange(widths, FRAME.width, LAYOUT);
  const room = regions.map((r) => r.to - r.from);
  const need = widths.map((w) => clusterWidth(w, LAYOUT.step));
  close(room[0] / room[1], need[0] / need[1], "first to second");
  close(room[1] / room[2], need[1] / need[2], "second to third");
  close(regions[1].from - regions[0].to, LAYOUT.clusterGap * FRAME.width, "gap");
  assert.deepEqual(regions.map((r) => r.anchor), ["start", "centre", "end"]);
});

test("crowding counts a gap between each pair of neighbours", () => {
  const { crowding } = arrange([[W], [W], [W]], FRAME.width, LAYOUT);
  close(crowding, (3 * W + (2 * LAYOUT.pad + 2 * LAYOUT.clusterGap) * FRAME.width) / FRAME.width, "crowding");
});

test("a crowded stage shrinks buffers, then zooms, never below the floor", () => {
  const calm = arrange([[W, W], [W]], FRAME.width, LAYOUT);
  const packed = arrange([Array(7).fill(W), Array(7).fill(W)], FRAME.width, LAYOUT);
  const many = arrange([Array(4).fill(W), Array(4).fill(W), Array(4).fill(W), Array(4).fill(W)], FRAME.width, LAYOUT);
  assert.equal(calm.buffers, 1);
  assert.ok(packed.crowding > LAYOUT.crowdEnd);
  assert.equal(packed.buffers, LAYOUT.minBuffer);
  assert.equal(packed.zoom, LAYOUT.minZoom);
  assert.equal(many.buffers, LAYOUT.minBuffer);
  assert.ok(many.zoom >= LAYOUT.minZoom);
});

test("a cluster runs left to right: hugging the end, centred, or from the start; a roomy one spreads no further than roomyStep", () => {
  const at = (anchor) => clusterCentres([W, W], { from: 0, to: 2000, anchor }, LAYOUT.step, LAYOUT.roomyStep);
  const end = at("end"), centre = at("centre"), start = at("start");
  for (const list of [end, centre, start]) assert.ok(list[0] < list[1], "left to right");
  close(end[1], 2000 - W / 2, "end hugs the region's right edge");
  close(start[0], W / 2, "start hugs the region's left edge");
  close((centre[0] + centre[1]) / 2, 1000, "centre is centred");
  close(end[1] - end[0], LAYOUT.roomyStep * W, "roomy spread");
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
const names = (cast) => cast.map((e) => `${e.name}:${e.cluster}`);
const saved = [
  { name: "Vane", cluster: 1 },
  { name: "Ana", actorUuid: "A", cluster: 0, partyMember: true },
  { name: "Bo", actorUuid: "B", cluster: 1, partyMember: true },
  { name: "Pell", cluster: 0 },
];

test("a preset loads the same party exactly as saved, without the party marks", () => {
  const out = R.fitPartyCast(saved, [A, B]);
  assert.deepEqual(names(out), ["Vane:1", "Ana:0", "Bo:1", "Pell:0"]);
  assert.ok(out.every((e) => !("partyMember" in e)));
});

test("members who left stay off; new members join after the last saved member still here", () => {
  assert.deepEqual(names(R.fitPartyCast(saved, [A, C])), ["Vane:1", "Ana:0", "Cy:0", "Pell:0"]);
});

test("an all-new party stands where the first saved member stood", () => {
  assert.deepEqual(names(R.fitPartyCast(saved, [C])), ["Vane:1", "Cy:0", "Pell:0"]);
});

test("an old whole-party entry becomes every member, in its order, skipping members standing alone", () => {
  const old = [{ name: "Bo", actorUuid: "B", cluster: 1 }, { id: "x", party: true, cluster: 0, order: ["c", "a"] }];
  assert.deepEqual(names(R.fitPartyCast(old, [A, B, C])), ["Bo:1", "Cy:0", "Ana:0"]);
});

test("a preset with no party members adds nobody", () => {
  assert.deepEqual(names(R.fitPartyCast([{ name: "Vane", cluster: 1 }], [A, B])), ["Vane:1"]);
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
  assert.equal(R.stable([{ cluster: 0, name: "A", actorUuid: null }]), R.stable([{ name: "A", cluster: 0 }]));
  assert.notEqual(R.stable([{ name: "A", cluster: 0 }]), R.stable([{ name: "A", cluster: 1 }]));
});

/* -------------------------------------------- */
/*  Art and tags                                */
/* -------------------------------------------- */

test("a form's family is the character it belongs to", () => {
  assert.equal(R.familyOf("Mira Voss/forms/corrupted"), "Mira Voss");
  assert.equal(R.familyOf("Mira Voss"), "Mira Voss");
});

test("form locks: the GM sees every form, players only the open ones", () => {
  const forms = [{ key: "A" }, { key: "A/forms/cursed" }];
  assert.deepEqual(R.visibleForms(forms, ["A"], { isGM: true }).map((f) => f.key), ["A", "A/forms/cursed"]);
  assert.deepEqual(R.visibleForms(forms, ["A"], { isGM: false }).map((f) => f.key), ["A/forms/cursed"]);
  assert.equal(R.visibleForms(forms, undefined).length, 2);
  assert.equal(R.visibleForms(forms, []).length, 2);
});

test("form locks: locking adds once, opening removes, a missing list counts as empty", () => {
  assert.deepEqual(R.toggleLock(undefined, "A", true), ["A"]);
  assert.deepEqual(R.toggleLock(["A"], "A", true), ["A"]);
  const list = ["A", "B"];
  assert.deepEqual(R.toggleLock(list, "A", false), ["B"]);
  assert.deepEqual(list, ["A", "B"]);
  assert.deepEqual(R.toggleLock(null, "A", false), []);
});

test("a tag's characters: named in the art plus tagged by hand, and a hand removal wins over the art", () => {
  const index = [{ name: "Ezren", tags: ["The Crew"] }, { name: "Valeros", tags: ["The Crew"] }, { name: "Merisiel", tags: [] }];
  const members = R.tagMembers("The Crew", index, { add: ["Merisiel"], remove: ["Valeros"] });
  assert.deepEqual(members.sort(), ["Ezren", "Merisiel"]);
});

test("a tag is listed while a character, a background, a folder or a preset carries it", () => {
  const index = [{ name: "Ezren", tags: ["Crew"] }, { name: "Valeros", tags: ["Gone"] }];
  const stored = {
    Vallaki: { label: "Vallaki town", images: ["a.webp"] },
    Docks: { folders: ["scenes/docks/"] },
    Hand: { add: ["Ezren"] },
    Empty: { label: "Empty", add: [], images: [], folders: [], hideAuto: ["x/"] },
    Gone: { deleted: true },
    Hidden: { remove: ["Nobody"] },
  };
  const tags = R.liveTags(stored, index, ["Session 2", "Session 10"]);
  assert.deepEqual(tags.map((t) => t.id), ["Crew", "Docks", "Hand", "Session 2", "Session 10", "Vallaki"]);
  assert.equal(tags.find((t) => t.id === "Vallaki").label, "Vallaki town");
});

test("a tag named in the art goes once every character is untagged by hand", () => {
  const index = [{ name: "Ezren", tags: ["Crew"] }];
  assert.deepEqual(R.liveTags({ Crew: { remove: ["Ezren"] } }, index), []);
});

test("typed tags: split at commas, and matched to a tag by label or id whatever the case", () => {
  assert.deepEqual(R.splitTagText(" Vallaki, session 12 ,,Vallaki "), ["Vallaki", "session 12"]);
  assert.deepEqual(R.splitTagText(""), []);
  const tags = [{ id: "PFS 4-07", label: "Docks job" }, { id: "Crew", label: "Crew" }];
  assert.equal(R.matchTag("docks JOB", tags), "PFS 4-07");
  assert.equal(R.matchTag(" pfs 4-07", tags), "PFS 4-07");
  assert.equal(R.matchTag("Vallaki", tags), null);
});

test("upgrade to tags: groups, presets, the art index and the folder pattern move over whole", () => {
  const before = {
    groups: { Crew: { label: "The Crew", folders: ["f/"], images: ["i.webp"], add: ["A"], remove: ["B"], hideAuto: ["h/"] }, Old: { deleted: true } },
    groupFolders: "scenes/{group}/",
    presets: { p1: { name: "Docks", groups: ["Crew"], cast: [] }, p2: { name: "Bare", groups: [] } },
    artIndex: { root: "art/", art: { A: { key: "A", groups: ["Crew"] }, B: { key: "B", groups: [] } } },
  };
  const copy = JSON.parse(JSON.stringify(before));
  const next = R.groupsToTags(before);
  assert.deepEqual(before, copy);
  assert.deepEqual(next.tags, before.groups);
  assert.equal(next.tagFolders, "scenes/{group}/");
  assert.deepEqual(next.presets, { p1: { name: "Docks", tags: ["Crew"], cast: [] }, p2: { name: "Bare", tags: [] } });
  assert.deepEqual(next.artIndex, { root: "art/", art: { A: { key: "A", tags: ["Crew"] }, B: { key: "B", tags: [] } } });
});

test("upgrade to tags: run again it changes nothing, and tags or a pattern already set are kept", () => {
  const once = R.groupsToTags({ groups: { Crew: { add: ["A"] } }, presets: { p: { name: "P", groups: ["Crew"] } } });
  assert.deepEqual(R.groupsToTags({ groups: { Crew: { add: ["A"] } }, ...once }), once);
  const kept = R.groupsToTags({ groups: { Crew: { add: ["A"] } }, tags: { Crew: { add: ["Z"] } }, groupFolders: "old/{group}/", tagFolders: "new/{tag}/" });
  assert.deepEqual(kept.tags, { Crew: { add: ["Z"] } });
  assert.equal(kept.tagFolders, "new/{tag}/");
  assert.deepEqual(R.groupsToTags(), { tags: {}, tagFolders: "", presets: {}, artIndex: {} });
});

test("Recent puts the newest first, without repeats, up to its limit", () => {
  assert.deepEqual(R.mergeRecent(["b", "x"], ["a", "b", "c"], 3), ["b", "x", "a"]);
});

/* -------------------------------------------- */
/*  Clusters                                    */
/* -------------------------------------------- */

/** A cast from cluster strings, left to right: castOf("ab", "c") is a and b in cluster 0, c in cluster 1. */
const castOf = (...clusters) => clusters.flatMap((ids, c) => [...ids].map((id) => ({ id, cluster: c })));
/** A cast back as cluster strings: "ab|c". */
const shape = (cast) => {
  const out = [];
  for (const e of cast) out[e.cluster] = (out[e.cluster] ?? "") + e.id;
  return out.join("|");
};
const pick = (cast, ids) => [...ids].map((id) => cast.find((e) => e.id === id));

test("compacting numbers clusters without gaps, in order, and groups the cast by cluster", () => {
  const cast = [{ id: "a", cluster: 2 }, { id: "b", cluster: 0 }, { id: "c", cluster: 5 }, { id: "d", cluster: 2 }];
  const out = R.compactClusters(cast);
  assert.deepEqual(out.map((e) => `${e.id}${e.cluster}`), ["b0", "a1", "d1", "c2"]);
  assert.equal(R.clusterCount(out), 3);
  assert.equal(cast[0].cluster, 2, "the input is left alone");
});

test("placing: leaving a cluster alone removes it, and the clusters to its right move down", () => {
  const cast = castOf("ab", "c", "de");
  assert.equal(shape(R.placeEntries(cast, pick(cast, "c"), { cluster: 0 })), "abc|de");
  assert.equal(shape(R.placeEntries(cast, pick(cast, "c"), { cluster: 1, index: 0 })), "ab|cde", "cluster 1 counted without c is d and e");
});

test("placing: a place in the cluster counts from the left; null is the right end", () => {
  const cast = castOf("abc");
  assert.equal(shape(R.placeEntries(cast, pick(cast, "a"), { cluster: 0, index: 1 })), "bac");
  assert.equal(shape(R.placeEntries(cast, pick(cast, "a"), { cluster: 0, index: null })), "bca");
  assert.equal(shape(R.placeEntries(cast, pick(cast, "a"), { cluster: 0, index: 9 })), "bca");
});

test("placing: a new cluster between two moves the right one up; a new one at the left edge moves them all", () => {
  const cast = castOf("ab", "cd");
  assert.equal(shape(R.placeEntries(cast, pick(cast, "a"), { cluster: 1, newCluster: true })), "b|a|cd");
  assert.equal(shape(R.placeEntries(cast, pick(cast, "d"), { cluster: 0, newCluster: true })), "d|ab|c");
});

test("placing: cluster equal to the count starts one at the right edge; past it is an error", () => {
  const cast = castOf("ab", "cd");
  assert.equal(shape(R.placeEntries(cast, pick(cast, "a"), { cluster: 2 })), "b|cd|a");
  assert.throws(() => R.placeEntries(cast, pick(cast, "a"), { cluster: 3 }), /no cluster 3/);
  assert.equal(shape(R.placeEntries([], [{ id: "x" }], { cluster: 0 })), "x", "an empty stage");
});

test("placing: the party lands as one block, in the order given", () => {
  const cast = castOf("ab", "cd");
  assert.equal(shape(R.placeEntries(cast, pick(cast, "da"), { cluster: 1, index: 0 })), "b|dac");
  assert.equal(shape(R.placeEntries(cast, pick(cast, "da"), { cluster: 1, newCluster: true })), "b|da|c");
});

test("the console's cluster numbers are the ones the cast shows, turned into a move's", () => {
  const cast = castOf("a", "bc");
  const into = R.targetFromShown(cast, "a", { cluster: 1 });
  assert.deepEqual(into, { cluster: 0, index: null, newCluster: false }, "counted without a, b and c are cluster 0");
  assert.equal(shape(R.placeEntries(cast, pick(cast, "a"), into)), "bca");
  assert.equal(shape(R.placeEntries(cast, pick(cast, "a"), R.targetFromShown(cast, "a", { cluster: 1, index: 1 }))), "bac");
  assert.equal(shape(R.placeEntries(cast, pick(cast, "a"), R.targetFromShown(cast, "a", { cluster: 0 }))), "a|bc", "their own cluster: they stay");
  assert.equal(shape(R.placeEntries(cast, pick(cast, "a"), R.targetFromShown(cast, "a", { cluster: 2 }))), "bc|a");
  assert.equal(shape(R.placeEntries(cast, pick(cast, "b"), R.targetFromShown(cast, "b", { cluster: 1, index: 1 }))), "a|cb", "index is the place they end up at");
  assert.equal(shape(R.placeEntries(cast, pick(cast, "c"), R.targetFromShown(cast, "c", { cluster: 1, index: 0 }))), "a|cb");
  const three = castOf("ab", "c", "de");
  assert.equal(shape(R.placeEntries(three, pick(three, "c"), R.targetFromShown(three, "c", { cluster: 2, index: 0 }))), "ab|cde");
  assert.equal(shape(R.placeEntries(three, pick(three, "a"), R.targetFromShown(three, "a", { cluster: 2, newCluster: true }))), "b|c|a|de");
  assert.deepEqual(R.targetFromShown([], [], { cluster: 0 }), { cluster: 0, index: null, newCluster: true }, "an empty stage");
  assert.throws(() => R.targetFromShown(cast, "a", { cluster: 3 }), /no cluster 3/);
});

test("the party, split across clusters, gathers as one block where it's asked to stand", () => {
  const cast = castOf("ab", "cd");
  const to = R.targetFromShown(cast, ["b", "c"], { cluster: 0 });
  assert.equal(shape(R.placeEntries(cast, pick(cast, "bc"), to)), "abc|d");
  assert.equal(shape(R.placeEntries(cast, pick(cast, "bc"), R.targetFromShown(cast, ["b", "c"], { cluster: 1, index: 0 }))), "a|bcd");
});

test("who stands in front: the leftmost left of the middle and in it, the rightmost right of it", () => {
  assert.equal(R.frontRank(0, 3, 0, 2), 0);
  assert.equal(R.frontRank(2, 3, 1, 2), 0, "the right cluster's rightmost");
  assert.equal(R.frontRank(0, 3, 1, 2), 2);
  assert.equal(R.frontRank(0, 2, 0, 1), 0, "a lone cluster: its leftmost");
  assert.equal(R.frontRank(0, 2, 1, 3), 0, "the exact middle: its leftmost");
  assert.equal(R.frontRank(1, 2, 2, 4), 0);
  assert.equal(R.frontRank(0, 2, 1, 4), 0);
});

test("schema 3: a stage's left side is cluster 0, its right side cluster 1, reversed to run left to right", () => {
  const before = [
    { id: "a", name: "Ana", actorUuid: "Actor.A", side: "left" },
    { id: "b", name: "Bo", actorUuid: null, side: "left", expression: "smile" },
    { id: "v", name: "Vane", actorUuid: null, side: "right" },
    { id: "p", name: "Pell", actorUuid: null, side: "right" },
  ];
  const after = [
    { id: "a", name: "Ana", actorUuid: "Actor.A", cluster: 0 },
    { id: "b", name: "Bo", actorUuid: null, cluster: 0, expression: "smile" },
    { id: "p", name: "Pell", actorUuid: null, cluster: 1 },
    { id: "v", name: "Vane", actorUuid: null, cluster: 1 },
  ];
  assert.deepEqual(R.clustersFromSides(before), after);
  assert.deepEqual(R.clustersFromSides(after), after, "running it again changes nothing");
});

test("schema 3: a right side alone becomes cluster 0", () => {
  const before = [{ id: "v", name: "Vane", actorUuid: null, side: "right" }, { id: "p", name: "Pell", actorUuid: null, side: "right" }];
  assert.deepEqual(R.clustersFromSides(before), [{ id: "p", name: "Pell", actorUuid: null, cluster: 0 }, { id: "v", name: "Vane", actorUuid: null, cluster: 0 }]);
});

test("schema 3: a preset's cast, an old party entry keeping its order", () => {
  const before = [
    { name: "Ana", actorUuid: "Actor.A", side: "left", partyMember: true, form: null },
    { party: true, side: "right", order: ["c", "a"] },
    { name: "Vane", actorUuid: null, side: "right" },
  ];
  assert.deepEqual(R.clustersFromSides(before), [
    { name: "Ana", actorUuid: "Actor.A", cluster: 0, partyMember: true, form: null },
    { name: "Vane", actorUuid: null, cluster: 1 },
    { party: true, cluster: 1, order: ["c", "a"] },
  ]);
});

/* -------------------------------------------- */
/*  Dropping on the stage                       */
/* -------------------------------------------- */

const FW = FRAME.width;

test("the remove band: the top of the frame only, above the markers and every face", () => {
  const FH = FRAME.height;
  assert.equal(R.inRemoveBand(FW / 2, 0, FW, FH), true);
  assert.equal(R.inRemoveBand(FW / 2, R.REMOVE_BAND * FH - 1, FW, FH), true);
  assert.equal(R.inRemoveBand(FW / 2, R.REMOVE_BAND * FH, FW, FH), false);
  assert.equal(R.inRemoveBand(-1, 10, FW, FH), false);       // left of the frame
  assert.equal(R.inRemoveBand(FW + 1, 10, FW, FH), false);   // right of it (the sidebar)
  assert.equal(R.inRemoveBand(FW / 2, -1, FW, FH), false);   // above it
  assert.ok(R.REMOVE_BAND < 0.4);                            // markers start at 0.4 of the height
  assert.ok(R.REMOVE_BAND < faceGuide(1.08).top);            // the biggest creature's face starts lower
});

test("a drop on an empty stage starts cluster 0, marked in the middle", () => {
  assert.deepEqual(R.dropSlot(300, [], FW), { cluster: 0, index: 0, newCluster: true, x: FW / 2 });
});

test("a drop inside a cluster joins it, counted from the left, marked between the neighbours", () => {
  const clusters = [[300, 600], [1600, 1900]];
  assert.deepEqual(R.dropSlot(450, clusters, FW), { cluster: 0, index: 1, newCluster: false, x: 450 });
  assert.deepEqual(R.dropSlot(1750, clusters, FW), { cluster: 1, index: 1, newCluster: false, x: 1750 });
});

test("a drop between two clusters: near one joins it; in the middle starts a new cluster there", () => {
  const clusters = [[300, 600], [1600, 1900]];
  const j = 0.06 * FW;
  assert.deepEqual(R.dropSlot(650, clusters, FW), { cluster: 0, index: 2, newCluster: false, x: 600 + j / 2 });
  assert.deepEqual(R.dropSlot(1550, clusters, FW), { cluster: 1, index: 0, newCluster: false, x: 1600 - j / 2 });
  assert.deepEqual(R.dropSlot(1100, clusters, FW), { cluster: 1, index: 0, newCluster: true, x: 1100 });
});

test("a drop at the far edge of a crowded stage starts a new cluster there", () => {
  const clusters = [[100, 400, 700], [1800, 2100, 2450]];
  const left = R.dropSlot(50, clusters, FW);
  assert.equal(left.newCluster, true);
  assert.equal(left.cluster, 0);
  assert.ok(left.x >= 0.025 * FW, "the marker stays clear of the edge");
  const right = R.dropSlot(FW - 50, clusters, FW);
  assert.equal(right.newCluster, true);
  assert.equal(right.cluster, 2);
  assert.ok(right.x <= FW - 0.025 * FW);
  assert.equal(R.dropSlot(0.05 * FW + 1, clusters, FW).newCluster, false, "just past the edge zone joins");
});

test("one centred cluster: well past its last character starts a new cluster; near it joins", () => {
  const clusters = [[1130, 1430]];
  assert.deepEqual(R.dropSlot(1600, clusters, FW), { cluster: 1, index: 0, newCluster: true, x: (1430 + 0.06 * FW + FW) / 2 });
  const join = R.dropSlot(1550, clusters, FW);
  assert.equal(join.newCluster, false);
  assert.equal(join.cluster, 0);
  assert.equal(join.index, 2);
  assert.equal(R.dropSlot(900, clusters, FW).newCluster, true);
});

test("a drop and the move count the same way: a lone character dropped back in their gap stays put", () => {
  const cast = castOf("ab", "c", "de");
  const centre = { a: 300, b: 600, c: 1100, d: 1600, e: 1900 };
  const clusters = [];
  for (const e of R.castWithout(cast, "c")) (clusters[e.cluster] ??= []).push(centre[e.id]);
  const slot = R.dropSlot(1100, clusters, FW);
  assert.equal(shape(R.placeEntries(cast, pick(cast, "c"), slot)), "ab|c|de");
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
  assert.deepEqual(a.tags, []);
  assert.deepEqual(a.forms, []);
  assert.deepEqual(a.warnings, []);
});

test("an art file's tags: `tags` and the older `groups` read as one list, without repeats", () => {
  const listing = { files: ["portrait.webp", "vn-stage.json"], dirs: [] };
  assert.deepEqual(R.normaliseArt("X", listing, { format: 1, tags: ["Vallaki", " Crew "] }).tags, ["Vallaki", "Crew"]);
  assert.deepEqual(R.normaliseArt("X", listing, { format: 1, tags: ["Vallaki"], groups: ["Crew", "Vallaki"] }).tags, ["Vallaki", "Crew"]);
  assert.deepEqual(R.normaliseArt("X", listing, { format: 1, tags: "Vallaki", groups: [3, ""] }).tags, []);
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
  assert.deepEqual(a.tags, ["Crew", "Allies"]);
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
  assert.deepEqual(a.tags, []);
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

/** Where the frame's edges land on screen for a fit, in screen pixels. */
const onScreen = (f, screenW, screenH) => ({
  left: screenW / 2 - f.x * f.scale,
  right: screenW / 2 + (FRAME.width - f.x) * f.scale,
  top: screenH / 2 - f.y * f.scale,
  bottom: screenH / 2 + (FRAME.height - f.y) * f.scale,
});
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);

test("view fit, sidebar closed: the frame covers the screen; a wide one loses the top, not the bottom", () => {
  const exact = R.fitFrame(1920, 1080, 0, FRAME.width, FRAME.height);
  assert.deepEqual(exact, { x: FRAME.width / 2, y: FRAME.height / 2, scale: 1920 / FRAME.width });
  const tall = onScreen(R.fitFrame(1920, 1200, 0, FRAME.width, FRAME.height), 1920, 1200); // 16:10 crops the sides
  near(tall.top, 0, "16:10 top");
  near(tall.bottom, 1200, "16:10 bottom");
  assert.ok(tall.left < 0 && tall.right > 1920, "16:10 crops the sides");
  near(tall.left, 1920 - tall.right, "16:10 centred");
  const wide = onScreen(R.fitFrame(2560, 1080, 0, FRAME.width, FRAME.height), 2560, 1080); // 21:9 crops top and bottom
  near(wide.left, 0, "21:9 left");
  near(wide.right, 2560, "21:9 right");
  assert.ok(wide.top < 0, "21:9 crops the top");
  near(wide.bottom, 1080, "21:9 bottom meets the screen's bottom");
  const short = onScreen(R.fitFrame(1600, 500, 0, FRAME.width, FRAME.height), 1600, 500); // a short window
  near(short.bottom, 500, "short window: bottom meets the screen's bottom");
  assert.ok(short.top < 0, "short window crops the top");
  // 4:1: the crop stops at MAX_TOP_CROP, just above the highest face, and the rest comes off the bottom.
  const ultra = R.fitFrame(4000, 1000, 0, FRAME.width, FRAME.height);
  const shown = 1000 / ultra.scale;
  near(ultra.y - shown / 2, R.MAX_TOP_CROP * FRAME.height, "4:1 top crop capped");
  assert.ok(R.MAX_TOP_CROP < faceGuide(1.08).top, "the cap is above every face");
});

test("view fit, sidebar open: the whole frame fits left of the sidebar, centred there", () => {
  const sw = 1920, sh = 1080, side = 360, free = sw - side;
  const f = R.fitFrame(sw, sh, side, FRAME.width, FRAME.height);
  assert.ok(f.scale * FRAME.width <= free + 1e-9 && f.scale * FRAME.height <= sh + 1e-9, "fits");
  assert.ok(Math.abs(f.scale * FRAME.width - free) < 1e-9 || Math.abs(f.scale * FRAME.height - sh) < 1e-9, "touches one way");
  const e = onScreen(f, sw, sh);
  near(e.right, sw - side, "right edge meets the sidebar");
  near(e.left, free - e.right, "centred across the free width");
  near(e.top, sh - e.bottom, "centred top to bottom");
  assert.ok(e.top > 0, "bands above and below");
});

test("view fit, sidebar open on an ultrawide: height-limited, bands at both sides", () => {
  const sw = 3440, sh = 1440, side = 360, free = sw - side;
  const f = R.fitFrame(sw, sh, side, FRAME.width, FRAME.height);
  near(f.scale * FRAME.height, sh, "fills the height");
  const e = onScreen(f, sw, sh);
  assert.ok(e.left > 0 && e.right < free, "bands at both sides");
  near(e.left, free - e.right, "centred left of the sidebar");
});

test("view fit: a sidebar wider than half the screen, or none, means cover", () => {
  const cover = R.fitFrame(1920, 1080, 0, FRAME.width, FRAME.height);
  assert.deepEqual(R.fitFrame(1920, 1080, 1000, FRAME.width, FRAME.height), cover);
  assert.deepEqual(R.fitFrame(1920, 1080, -50, FRAME.width, FRAME.height), cover);
});

/* -------------------------------------------- */
/*  Moves                                       */
/* -------------------------------------------- */

const BOX_A = { x: 100, y: 200, w: 300, h: 600 }, BOX_B = { x: 500, y: 100, w: 150, h: 400 };

test("a move starts exactly at its box and ends exactly at the new one", () => {
  assert.deepEqual(R.tweenBox(BOX_A, BOX_B, 0), BOX_A);
  assert.deepEqual(R.tweenBox(BOX_A, BOX_B, 1), BOX_B);
});

test("halfway through a move, every side and size is halfway", () => {
  assert.deepEqual(R.tweenBox(BOX_A, BOX_B, 0.5), { x: 300, y: 150, w: 225, h: 500 });
});

test("a move redirected mid-way ends at the new target", () => {
  const BOX_C = { x: -40, y: 333.3, w: 77, h: 901 };
  assert.deepEqual(R.tweenBox(R.tweenBox(BOX_A, BOX_B, 0.37), BOX_C, 1), BOX_C);
});

test("same box: within half a pixel on every field, not at a full pixel on any one", () => {
  assert.ok(R.sameBox(BOX_A, { x: 100.5, y: 199.5, w: 300.4, h: 599.6 }));
  for (const k of ["x", "y", "w", "h"]) assert.ok(!R.sameBox(BOX_A, { ...BOX_A, [k]: BOX_A[k] + 1 }), k);
});

test("a tile update jumps only when sent as instant and it moves or resizes the tile", () => {
  assert.ok(R.snapsBox({ x: 10 }, true));
  assert.ok(R.snapsBox({ height: 10 }, true));
  assert.ok(!R.snapsBox({ x: 10 }, false), "not instant: slides");
  assert.ok(!R.snapsBox({ x: 10 }, undefined));
  assert.ok(!R.snapsBox({ texture: { scaleX: -1 } }, true), "a flip alone doesn't move the box");
  assert.ok(!R.snapsBox({ sort: 99 }, true));
});

/* -------------------------------------------- */
/*  Shadows                                     */
/* -------------------------------------------- */

const { SHADOW } = await load("constants");

test("shadows: none when off or at strength 0", () => {
  assert.equal(R.shadowLook({ on: false, strength: 0.5, scale: 1 }, SHADOW), null);
  assert.equal(R.shadowLook({ on: true, strength: 0, scale: 1 }, SHADOW), null);
});

test("shadows: strength is clamped to 0–1", () => {
  assert.equal(R.shadowLook({ on: true, strength: 1.5, scale: 1 }, SHADOW).alpha, 1);
  assert.equal(R.shadowLook({ on: true, strength: -0.2, scale: 1 }, SHADOW), null);
});

test("shadows: offset and blur follow the view's zoom, darkness doesn't", () => {
  const full = R.shadowLook({ on: true, strength: 0.4, scale: 1 }, SHADOW);
  assert.deepEqual([full.shiftX, full.shiftY, full.blur, full.alpha], [SHADOW.x, SHADOW.y, SHADOW.blur, 0.4]);
  const half = R.shadowLook({ on: true, strength: 0.4, scale: 0.5 }, SHADOW);
  assert.deepEqual([half.shiftX, half.shiftY, half.blur, half.alpha], [SHADOW.x / 2, SHADOW.y / 2, SHADOW.blur / 2, 0.4]);
});

test("shadows: the padding always covers the shift plus the blur on both sides", () => {
  for (const look of [SHADOW, { ...SHADOW, x: -30, y: 5 }]) {
    for (const scale of [0.1, 0.37, 1, 2.5]) {
      const s = R.shadowLook({ on: true, strength: 1, scale }, look);
      assert.ok(s.padding >= Math.max(Math.abs(s.shiftX), Math.abs(s.shiftY)) + 2 * s.blur + 1, `scale ${scale}`);
      assert.ok(Number.isInteger(s.padding));
    }
  }
});

test("shadows: the default strength lies in the slider's range and on one of its steps", () => {
  assert.ok(SHADOW.strength >= SHADOW.min && SHADOW.strength <= SHADOW.max);
  const steps = (SHADOW.strength - SHADOW.min) / SHADOW.step;
  assert.ok(Math.abs(steps - Math.round(steps)) < 1e-9);
});

/* -------------------------------------------- */
/*  Same names, shared art                      */
/* -------------------------------------------- */

const hasArt = (...keys) => (k) => keys.includes(k);

test("automatic art: a folder named like the actor, else the folder its images live in", () => {
  assert.deepEqual(R.automaticKey("Mira Voss", [null, null, null], hasArt("Mira Voss")), { key: "Mira Voss", source: "name" });
  assert.deepEqual(R.automaticKey("Captain", [null, "Mira Voss"], hasArt("Mira Voss")), { key: "Mira Voss", source: "images" });
  assert.deepEqual(R.automaticKey("Nobody", [null], hasArt("Mira Voss")), { key: null, source: null });
});

test("automatic art: images in another character's folder beat the name, so two Guards find their own art", () => {
  const has = hasArt("Guard", "Guard (5-04)", "Guard (7-01)");
  assert.deepEqual(R.automaticKey("Guard", ["Guard (5-04)"], has), { key: "Guard (5-04)", source: "images" });
  assert.deepEqual(R.automaticKey("Guard", [null, "Guard (7-01)"], has), { key: "Guard (7-01)", source: "images" });
  assert.deepEqual(R.automaticKey("Guard", ["Guard"], has), { key: "Guard", source: "name" });
});

test("automatic art: images that are a form of the actor's own character keep its base art", () => {
  const has = hasArt("Mira Voss", "Mira Voss/forms/corrupted");
  assert.deepEqual(R.automaticKey("Mira Voss", ["Mira Voss/forms/corrupted"], has), { key: "Mira Voss", source: "name" });
});

test("a cast entry is matched by its actor alone; only art alone goes by name", () => {
  const guardA = { name: "Guard", actorUuid: "Actor.a" }, guardB = { name: "Guard", actorUuid: "Actor.b" }, art = { name: "Guard", actorUuid: null };
  assert.equal(R.isEntryFor(guardA, { name: "Guard", actorUuid: "Actor.a" }), true);
  assert.equal(R.isEntryFor(guardA, { name: "Guard", actorUuid: "Actor.b" }), false, "another actor with the same name");
  assert.equal(R.isEntryFor(guardA, { name: "Renamed", actorUuid: "Actor.a" }), true, "the name is only a label");
  assert.equal(R.isEntryFor(guardB, { name: "Guard", actorUuid: null }), false, "art alone isn't an actor's entry");
  assert.equal(R.isEntryFor(art, { name: "Guard" }), true);
  assert.equal(R.isEntryFor(art, { name: "Guard", actorUuid: "Actor.a" }), false);
});

test("saved choices: by art key, else by actor, else by name", () => {
  assert.equal(R.prefsKey("Guard (5-04)", "a1", "Guard"), "Guard (5-04)", "actors sharing art share choices");
  assert.equal(R.prefsKey(null, "a1", "Bandit"), "actor:a1");
  assert.equal(R.prefsKey(null, null, "Gone"), "Gone");
});

test("schema 5: a name's choices are copied to each actor of that name without art", () => {
  const before = { Bandit: { flip: true }, "Mira Voss": { size: "lg" }, "actor:b2": { scale: 0.5 } };
  const after = R.prefsByActor(before, [{ id: "b1", name: "Bandit" }, { id: "b2", name: "Bandit" }, { id: "x", name: "Unset" }]);
  assert.deepEqual(after, { Bandit: { flip: true }, "Mira Voss": { size: "lg" }, "actor:b1": { flip: true }, "actor:b2": { scale: 0.5 } });
  assert.deepEqual(before, { Bandit: { flip: true }, "Mira Voss": { size: "lg" }, "actor:b2": { scale: 0.5 } }, "the input is left alone");
  assert.deepEqual(R.prefsByActor(after, [{ id: "b1", name: "Bandit" }]), after, "running it again changes nothing");
});

test("Cast rows with one name: told apart by art, then by the actor's folder", () => {
  const row = (label, artLabel, folder = "", note = artLabel !== label ? artLabel : null) => ({ label, note, artLabel, folder });
  const rows = R.tellApart([
    row("Guard", "Guard (5-04)", "Scenario 5"), row("Guard", "Guard (7-01)", "Scenario 7"),
    row("Cultist", "Cultist", "Scenario 5 / Crypt"), row("Cultist", "Cultist", "Scenario 6"), row("Cultist", "Cultist"),
    row("Mira Voss", "Mira Voss", "PCs"), row("Captain", "Mira Voss", "NPCs"),
  ]);
  assert.deepEqual(rows.map((r) => r.note), [
    "Guard (5-04)", "Guard (7-01)",
    "Cultist · Scenario 5 / Crypt", "Cultist · Scenario 6", "Cultist",
    null, "Mira Voss",
  ]);
});

test("tag items: one wording everywhere", () => {
  assert.equal(R.tagItemLabel(true, "Gatehouse"), "Add to Gatehouse");
  assert.equal(R.tagItemLabel(false, "Gatehouse"), "Remove from Gatehouse");
});

test("a background's tag item: remove its own tag, point to the folder otherwise", () => {
  assert.equal(R.backgroundTagItem([], "a"), null);
  assert.equal(R.backgroundTagItem([{ id: "b", viaFolder: false }], "a"), null);
  assert.equal(R.backgroundTagItem([{ id: "a", viaFolder: false }], "a"), "remove");
  assert.equal(R.backgroundTagItem([{ id: "a", viaFolder: true }], "a"), "folder");
  assert.equal(R.backgroundTagItem([{ id: "a", viaFolder: false }, { id: "a", viaFolder: true }], "a"), "remove");
});
