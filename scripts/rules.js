/**
 * The module's rules that need no Foundry: plain data in, plain data out. Kept
 * apart so tools/test.mjs can check them outside Foundry. (The layout's
 * arithmetic lives in arrange.js for the same reason.) Nothing here imports
 * anything.
 */

/* -------------------------------------------- */
/*  The view                                    */
/* -------------------------------------------- */

/** Is this screen's view locked to the stage? Players always; the GM only when they chose to. */
export function locksView({ isGM, gmLock }) {
  return !isGM || !!gmLock;
}

/**
 * Where to centre the view (frame coordinates) and at what scale. With the
 * sidebar closed, the frame covers the screen. A screen narrower than 16:9
 * loses the sides equally; a wider one loses the top (the sky), not the bottom,
 * so the cast stays in view, up to `MAX_TOP_CROP` of the frame height, after
 * which the bottom goes too. With the sidebar open, the whole frame fits in
 * the area left of it, centred there; Foundry's canvas shows in the bands. A
 * sidebar wider than half the screen counts as closed.
 */
export function fitFrame(screenW, screenH, sidebarW, frameW, frameH) {
  const free = screenW - sidebarW;
  if (sidebarW <= 0 || free < screenW / 2) {
    const scale = Math.max(screenW / frameW, screenH / frameH);
    const shown = screenH / scale; // frame pixels from top to bottom of the screen
    const crop = Math.min(frameH - shown, MAX_TOP_CROP * frameH);
    return { x: frameW / 2, y: crop + shown / 2, scale };
  }
  const scale = Math.min(free / frameW, screenH / frameH);
  return { x: frameW / 2 + sidebarW / (2 * scale), y: frameH / 2, scale };
}

/**
 * The most a wide screen crops off the top of the frame, as a share of its
 * height: just above the highest face guide (a Large creature's, near 0.5).
 * Only screens wider than about 3.2:1 reach it.
 */
export const MAX_TOP_CROP = 0.45;

/* -------------------------------------------- */
/*  The party                                   */
/* -------------------------------------------- */

/** An entry from before party members were separate: it stands for the whole party. */
export function isOldPartyEntry(e) {
  return !!e?.party && !e.name && !e.actorUuid;
}

/**
 * Party members ({ id, uuid, name }) in a remembered order (actor ids); members
 * not in it come after, in the order given.
 */
export function orderMembers(members, order = []) {
  const rank = (a) => { const i = order.indexOf(a.id); return i === -1 ? Infinity : i; };
  return members.map((a, i) => ({ a, i })).sort((x, y) => rank(x.a) - rank(y.a) || x.i - y.i).map(({ a }) => a);
}

/**
 * A cast from before schema 1 in today's form (the one-time migration): the
 * removed "Full" side reads as left (alone, a side is centred anyway), and an
 * old whole-party entry becomes the party's `members` ({ id, uuid, name }) in
 * its order, skipping members standing alone, with ids "<entry id>.<actor id>".
 * For presets, `preset` marks members `partyMember: true`, and with no members
 * known keeps the old entry as it is, so it can still fill in when loaded. On a
 * stage an empty party has nobody to show, so the entry goes. Entries still
 * have sides here; the schema 3 step (clustersFromSides) runs after it.
 */
export function upgradeCast(cast, members, { preset = false } = {}) {
  const sides = ["left", "right"];
  const alone = new Set(cast.filter((e) => !isOldPartyEntry(e)).map((e) => e.actorUuid).filter(Boolean));
  const out = [];
  for (const raw of cast) {
    const e = { ...raw, side: sides.includes(raw.side) ? raw.side : "left" };
    if (!isOldPartyEntry(e)) { out.push(e); continue; }
    if (!members.length) { if (preset) out.push(e); continue; }
    for (const a of orderMembers(members, e.order)) {
      if (alone.has(a.uuid)) continue;
      const entry = { name: a.name, actorUuid: a.uuid, side: e.side };
      if (e.id) entry.id = `${e.id}.${a.id}`;
      if (preset) entry.partyMember = true;
      out.push(entry);
    }
  }
  return out;
}

/**
 * A preset's saved cast fitted to today's party (`members`, in standing order).
 * Saved members still in the party keep their places; members who've left are
 * dropped; new members join right after the last saved member who's still here
 * (or where the first saved member stood). An old whole-party entry becomes
 * every member not placed otherwise, where it stood.
 */
export function fitPartyCast(saved, members) {
  const here = new Set(members.map((a) => a.uuid));
  // Members the preset already places (marked, or standing alone in an older preset).
  const placed = new Set(saved.filter((e) => !isOldPartyEntry(e) && here.has(e.actorUuid)).map((e) => e.actorUuid));
  const entryOf = (a, cluster) => ({ name: a.name, actorUuid: a.uuid, cluster });
  const out = [];
  let anchor = null; // where newcomers go: { at (index in out), cluster }
  for (const e of saved) {
    if (isOldPartyEntry(e)) {
      for (const a of orderMembers(members, e.order)) {
        if (placed.has(a.uuid)) continue;
        out.push(entryOf(a, e.cluster));
        placed.add(a.uuid);
      }
      continue;
    }
    if (!e.partyMember) { out.push(e); continue; }
    if (here.has(e.actorUuid)) {
      const { partyMember: _p, ...rest } = e;
      out.push(rest);
      anchor = { at: out.length, cluster: e.cluster };
    } else anchor ??= { at: out.length, cluster: e.cluster };
  }
  if (anchor) out.splice(anchor.at, 0, ...members.filter((a) => !placed.has(a.uuid)).map((a) => entryOf(a, anchor.cluster)));
  return out;
}

/* -------------------------------------------- */
/*  Presets                                     */
/* -------------------------------------------- */

/** JSON with sorted keys and no empty fields, so entries compare equal whatever order their fields were written in. */
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).filter((k) => value[k] != null).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/* -------------------------------------------- */
/*  Art                                         */
/* -------------------------------------------- */

export const ART_FORMAT = 1;
export const ART_SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
const IMAGE_EXTENSIONS = ["webp", "png", "jpg", "jpeg", "avif"]; // in order of preference

const extensionOf = (file) => (file.includes(".") ? file.slice(file.lastIndexOf(".") + 1).toLowerCase() : "");
const stemOf = (file) => (file.includes(".") ? file.slice(0, file.lastIndexOf(".")) : file);
const isImage = (file) => IMAGE_EXTENSIONS.includes(extensionOf(file));

/** "deep-sorrow" → "Deep sorrow". */
export function humanise(name) {
  const text = name.replace(/[-_]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The best image in `files` whose name (without extension) is `stem`, or null. Names match without regard to case. */
function pickImage(files, stem) {
  const matches = files.filter((f) => isImage(f) && stemOf(f).toLowerCase() === stem);
  matches.sort((a, b) => IMAGE_EXTENSIONS.indexOf(extensionOf(a)) - IMAGE_EXTENSIONS.indexOf(extensionOf(b)) || a.localeCompare(b));
  return matches[0] ?? null;
}

/**
 * The internal shape of one character or form, from what its folder holds and
 * its `vn-stage.json` (docs/art-format.md). Nothing here reads files: the
 * caller lists the folders and parses the file.
 *
 * `key` is the folder under the art folder ("Aganis Downard", or a form:
 * "Mira Voss/forms/corrupted"). `listing` is { files, dirs } for that folder
 * (names only), plus `expressions` (file names in its expressions/ folder),
 * `forms` (names of its forms/ folders that have a portrait) and, for a form,
 * `parentLabel` (the character's label). `file` is the parsed file, or null
 * when there is none or it couldn't be read.
 *
 * Paths come back relative to the art folder (portrait, thumb and every
 * expression), so whoever reads them from the index must put the art folder
 * in front before loading an image. Returns null with no portrait.
 * Problems with the file are described in `warnings` and never stop a load.
 * @returns {null|{name, key, label, formLabel, portrait, thumb, expressions, labels, size, scale, yOffset, tags, forms, warnings}}
 */
export function normaliseArt(key, listing = {}, file = null) {
  const files = listing.files ?? [];
  const warnings = [];
  const hasFile = files.some((f) => f.toLowerCase() === "vn-stage.json");
  let data = null;
  if (file && typeof file === "object" && !Array.isArray(file)) {
    data = file;
    if (data.format !== ART_FORMAT) {
      warnings.push(data.format == null ? "vn-stage.json has no format number; reading it as format 1"
        : `vn-stage.json is format ${JSON.stringify(data.format)}, which this module doesn't know; reading what it can`);
    }
  } else if (hasFile || file) {
    warnings.push("vn-stage.json couldn't be read; using the folder alone");
  }
  data ??= {};

  const text = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const named = (v) => { const t = text(v); return t && files.includes(t) && isImage(t) ? t : null; };

  const portraitFile = named(data.portrait) ?? pickImage(files, "portrait");
  if (!portraitFile) return null;
  const at = (f) => `${key}/${f}`;

  const folderName = key.split("/").pop();
  const isForm = key.includes("/forms/");
  const formLabel = isForm ? (text(data.label) ?? humanise(folderName)) : null;
  const label = isForm ? `${listing.parentLabel ?? familyOf(key)} · ${formLabel}` : (text(data.label) ?? folderName);

  // Expressions: the file's order first, then the rest by file name; neutral is always the portrait.
  const found = new Map(); // stem → file name, the preferred image type winning
  for (const f of listing.expressions ?? []) {
    const stem = stemOf(f);
    if (!isImage(f) || stem.toLowerCase() === "neutral") continue;
    const rank = (x) => IMAGE_EXTENSIONS.indexOf(extensionOf(x));
    if (!found.has(stem) || rank(f) < rank(found.get(stem))) found.set(stem, f);
  }
  for (const [stem, f] of [...found].sort((x, y) => x[1].localeCompare(y[1]))) { found.delete(stem); found.set(stem, f); }
  const listed = data.expressions && typeof data.expressions === "object" && !Array.isArray(data.expressions) ? data.expressions : {};
  const order = [...Object.keys(listed).filter((n) => found.has(n)), ...[...found.keys()].filter((n) => !Object.hasOwn(listed, n))];
  const expressions = { neutral: at(portraitFile) };
  const labels = { neutral: "Neutral" };
  for (const n of order) {
    expressions[n] = `${key}/expressions/${found.get(n)}`;
    labels[n] = text(Object.hasOwn(listed, n) ? listed[n] : null) ?? humanise(n);
  }

  let size = "medium";
  if (data.size != null) {
    if (ART_SIZES.includes(data.size)) size = data.size;
    else warnings.push(`size ${JSON.stringify(data.size)} isn't one of ${ART_SIZES.join(", ")}; using medium`);
  }
  let scale = 1;
  if (data.scale != null) {
    if (typeof data.scale === "number" && Number.isFinite(data.scale) && data.scale > 0) scale = data.scale;
    else warnings.push(`scale ${JSON.stringify(data.scale)} isn't a positive number; using 1`);
  }
  let yOffset = 0;
  if (data.yOffset != null) {
    if (typeof data.yOffset === "number" && Number.isFinite(data.yOffset)) yOffset = data.yOffset;
    else warnings.push(`yOffset ${JSON.stringify(data.yOffset)} isn't a number; using 0`);
  }

  return {
    name: key,
    key,
    label,
    formLabel,
    portrait: at(portraitFile),
    thumb: at(named(data.avatar) ?? pickImage(files, "avatar") ?? portraitFile),
    expressions,
    labels,
    size,
    scale,
    yOffset,
    // `tags`, and `groups` (the field's older name), read as one list.
    tags: [...new Set([data.tags, data.groups].flatMap((list) => (Array.isArray(list) ? list : []))
      .filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim()))],
    forms: isForm ? [] : [...(listing.forms ?? [])].sort((a, b) => a.localeCompare(b)).map((f) => `${key}/forms/${f}`),
    warnings,
  };
}

/** The character a key belongs to: "Mira Voss/forms/corrupted" → "Mira Voss". */
export function familyOf(key) {
  const i = key.indexOf("/forms/");
  return i === -1 ? key : key.slice(0, i);
}

/** The forms a user may see in the menu: all of them for the GM, for others only those not locked (`forms`: [{ key, … }], `locked`: art keys). */
export function visibleForms(forms, locked, { isGM = false } = {}) {
  return isGM ? forms : forms.filter((f) => !(locked ?? []).includes(f.key));
}

/** `locked` (art keys) with `key` locked or opened, as a new array; a missing list counts as empty. */
export function toggleLock(locked, key, on) {
  const rest = (locked ?? []).filter((k) => k !== key);
  return on ? [...rest, key] : rest;
}

/* -------------------------------------------- */
/*  Scale and drop                              */
/* -------------------------------------------- */

/** How tall a character with no VN art stands, as a multiple of the frame height. */
export const FALLBACK_SCALE = 0.5;

/** The art's own scale and drop (`art`: normaliseArt's shape, or null for no art). */
export function artDefaults(art) {
  return { scale: art ? art.scale : FALLBACK_SCALE, yOffset: art?.yOffset ?? 0 };
}

/**
 * A character's scale and drop on the stage: the world's Adjust values where
 * set, else the art's own. Adjust holds the actual values, not a change to the art's.
 */
export function placementOf(prefs = {}, art = null) {
  const own = artDefaults(art);
  return { scale: prefs.scale ?? own.scale, yOffset: prefs.yOffset ?? own.yOffset };
}

/**
 * Prefs from before Adjust held the actual values (schema 2): its scale was a
 * factor on the art's and its drop was added to the art's. Values that come
 * out the same as the art's own are dropped, so the art's own apply.
 */
export function absolutePrefs(prefs, art) {
  const own = artDefaults(art);
  const next = { ...prefs };
  delete next.scale;
  delete next.yOffset;
  const scale = Math.round(own.scale * (prefs.scale ?? 1) * 10000) / 10000;
  const yOffset = Math.round((own.yOffset + (prefs.yOffset ?? 0)) * 10000) / 10000;
  if (Math.abs(scale - own.scale) > 1e-6) next.scale = scale;
  if (Math.abs(yOffset - own.yOffset) > 1e-6) next.yOffset = yOffset;
  return next;
}

/* -------------------------------------------- */
/*  Tags                                        */
/* -------------------------------------------- */

/**
 * A tag's characters: the ones whose art names it (`index`: [{ name, tags }]),
 * plus ones added by hand, minus ones removed by hand (a removal wins over a name in the art).
 */
export function tagMembers(id, index, { add = [], remove = [] } = {}) {
  const names = new Set(index.filter((a) => a.tags.includes(id)).map((a) => a.name));
  for (const n of add) names.add(n);
  for (const n of remove) names.delete(n);
  return [...names];
}

/**
 * The tags that exist: a tag exists while something carries it (a character, a
 * single background, a folder added by hand or a preset), so there are no empty
 * tags to clean up. `stored` is the tags setting, `presetTags` every preset's
 * tag ids. Returns [{ id, label }] by label.
 */
export function liveTags(stored, index, presetTags = []) {
  const ids = new Set([...Object.keys(stored), ...presetTags]);
  for (const art of index) for (const t of art.tags) ids.add(t);
  const inPreset = new Set(presetTags);
  return [...ids]
    .filter((id) => {
      const g = stored[id];
      if (g?.deleted) return false;
      return inPreset.has(id) || !!g?.images?.length || !!g?.folders?.length || tagMembers(id, index, g).length > 0;
    })
    .map((id) => ({ id, label: stored[id]?.label || id }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

/** What was typed in a tag field, as names: split at commas, trimmed, no blanks or repeats. */
export function splitTagText(text) {
  return [...new Set(String(text ?? "").split(",").map((t) => t.trim()).filter(Boolean))];
}

/** The tag a typed name means: one whose label or id matches (case doesn't matter), or null for a new tag. `tags`: [{ id, label }]. */
export function matchTag(name, tags) {
  const q = name.trim().toLowerCase();
  return tags.find((t) => t.label.toLowerCase() === q)?.id ?? tags.find((t) => t.id.toLowerCase() === q)?.id ?? null;
}

/**
 * Stored data from before tags (schema 3), renamed: groups become tags with
 * everything they held, presets' `groups` become `tags`, and so does each
 * entry of the saved art index. The folder pattern moves over unless a new one
 * is already set. Nothing is dropped.
 */
export function groupsToTags({ groups = {}, tags = {}, groupFolders = "", tagFolders = "", presets = {}, artIndex = {} } = {}) {
  const clone = (v) => JSON.parse(JSON.stringify(v ?? {}));
  const nextPresets = clone(presets);
  for (const p of Object.values(nextPresets)) {
    p.tags ??= p.groups ?? [];
    delete p.groups;
  }
  const nextIndex = clone(artIndex);
  for (const a of Object.values(nextIndex.art ?? {})) {
    a.tags ??= a.groups ?? [];
    delete a.groups;
  }
  return {
    tags: { ...clone(groups), ...clone(tags) },
    tagFolders: tagFolders.trim() ? tagFolders : groupFolders,
    presets: nextPresets,
    artIndex: nextIndex,
  };
}

/** The Recent list after using `used` (newest first), at most `max` long. */
export function mergeRecent(used, before, max) {
  return [...used, ...before.filter((n) => !used.includes(n))].slice(0, max);
}

/* -------------------------------------------- */
/*  Clusters and dropping on the stage          */
/* -------------------------------------------- */

/*
 * Each cast entry stands in a cluster: `cluster` counts from 0, left to right,
 * with no gaps, and each cluster's members are stored left to right. A cluster
 * exists only while someone stands in it: when its last member leaves it goes,
 * and the clusters to its right move down one.
 */

/** The cast with its clusters numbered 0, 1, 2… in their order, and grouped by cluster (a new array; order within a cluster kept). */
export function compactClusters(cast) {
  const numbers = [...new Set(cast.map((e) => e.cluster ?? 0))].sort((a, b) => a - b);
  return cast.map((e) => ({ ...e, cluster: numbers.indexOf(e.cluster ?? 0) })).sort((a, b) => a.cluster - b.cluster);
}

/** How many clusters a compacted cast has. */
export function clusterCount(cast) {
  return new Set(cast.map((e) => e.cluster)).size;
}

/**
 * The cast without the entries being moved (`ids`: one id or a list),
 * compacted. Drop targets and moves are counted on this, so where a marker
 * shows and where the character lands always agree.
 */
export function castWithout(cast, ids) {
  const skip = new Set([ids ?? []].flat());
  return compactClusters(cast.filter((e) => !skip.has(e.id)));
}

/**
 * The cast with `entries` (in order) placed at a target: { cluster, index,
 * newCluster }, counted without them (castWithout). `index` is the place in
 * the cluster, from the left; null puts them at its right end. `newCluster`
 * starts a cluster at that number, moving the ones from there on up one.
 * `cluster` equal to the count starts a cluster at the right edge.
 */
export function placeEntries(cast, entries, { cluster, index = null, newCluster = false }) {
  let rest = castWithout(cast, entries.map((e) => e.id));
  const count = clusterCount(rest);
  if (!Number.isInteger(cluster) || cluster < 0 || cluster > count) {
    throw new Error(`VN Stage | There's no cluster ${cluster} (there are ${count}, counted from 0).`);
  }
  if (newCluster) rest = rest.map((e) => (e.cluster >= cluster ? { ...e, cluster: e.cluster + 1 } : e));
  const members = rest.filter((e) => e.cluster === cluster);
  const before = index === null ? null : members[index];
  const at = before ? rest.indexOf(before)
    : members.length ? rest.indexOf(members.at(-1)) + 1
      : rest.filter((e) => e.cluster < cluster).length;
  rest.splice(at, 0, ...entries.map((e) => ({ ...e, cluster })));
  return compactClusters(rest);
}

/**
 * A cluster number from the console API's `cluster` or its older `side`:
 * "left" is the leftmost cluster, "right" the rightmost (with `newCluster`, a
 * new one past it). `count` is the number of clusters.
 */
export function resolveCluster({ cluster = null, side = null, newCluster = false }, count) {
  if (cluster != null && side != null) throw new Error("VN Stage | Give a cluster or a side, not both.");
  if (side === "left") return 0;
  if (side === "right") return newCluster ? count : Math.max(count - 1, 0);
  if (side != null) throw new Error(`VN Stage | Unknown side "${side}".`);
  return cluster ?? 0;
}

/**
 * Where to join a cluster from the Cast list: at its end nearest the middle of
 * the stage. null is the right end (for a cluster left of the middle, or in
 * it), 0 the left end.
 */
export function innerIndex(cluster, count) {
  return cluster <= (count - 1) / 2 ? null : 0;
}

/**
 * Where the Cast list's Left or Right joins a stage of `count` clusters: the
 * leftmost or rightmost cluster at its end nearest the middle; with one
 * cluster, Left at its left end and Right at its right end.
 */
export function joinIndex(side, count) {
  if (count === 1) return side === "left" ? 0 : null;
  return innerIndex(side === "left" ? 0 : count - 1, count);
}

/**
 * A target in the numbers the cast shows (getCast, status(): every entry
 * counted, the movers too) turned into the one placeEntries takes, counted
 * without the entries `ids`. Clusters only the movers stand in go while they
 * move, so later ones move down; a mover's own cluster, asked for again, is
 * a new one in its place. `index` is the place the movers end up at, from
 * the left.
 */
export function targetFromShown(cast, ids, { cluster, index = null, newCluster = false }) {
  const skip = new Set([ids ?? []].flat());
  const all = compactClusters(cast);
  const count = clusterCount(all);
  if (!Number.isInteger(cluster) || cluster < 0 || cluster > count) {
    throw new Error(`VN Stage | There's no cluster ${cluster} (there are ${count}, counted from 0).`);
  }
  const stays = (e) => !skip.has(e.id);
  let gone = 0;
  for (let c = 0; c < cluster; c++) if (!all.some((e) => e.cluster === c && stays(e))) gone++;
  const members = all.filter((e) => e.cluster === cluster);
  if (newCluster || !members.some(stays)) return { cluster: cluster - gone, index: null, newCluster: true };
  return { cluster: cluster - gone, index, newCluster: false };
}

/**
 * Where the Cast list's ‹ or › (`dir` -1 or 1) moves the entries `ids` (one
 * cluster's members): into the neighbouring cluster, at its near end; past the
 * edge, into a new cluster there. Alone at the edge, there's nowhere to go: null.
 * The target is counted without them, as placeEntries wants.
 */
export function neighbourTarget(cast, ids, dir) {
  const skip = new Set([ids].flat());
  const all = compactClusters(cast);
  const moving = all.filter((e) => skip.has(e.id));
  if (!moving.length) return null;
  const c = moving[0].cluster;
  const count = clusterCount(all);
  const others = all.some((e) => e.cluster === c && !skip.has(e.id));
  const near = (n) => ({ cluster: n, index: dir > 0 ? 0 : null, newCluster: false });
  if (others) {
    // Their cluster stays where it is.
    if (c + dir < 0) return { cluster: 0, index: null, newCluster: true };
    if (c + dir >= count) return { cluster: count, index: null, newCluster: true };
    return near(c + dir);
  }
  // Their cluster goes with them, so the clusters to its right move down one.
  if (dir < 0) return c === 0 ? null : near(c - 1);
  return c === count - 1 ? null : near(c);
}

/**
 * Draw order within a cluster: 0 stands in front. A cluster left of the
 * middle puts its leftmost member in front, one right of the middle its
 * rightmost; the cluster in the exact middle (a lone one, say) its leftmost.
 */
export function frontRank(i, n, cluster, count) {
  return cluster > (count - 1) / 2 ? n - 1 - i : i;
}

/**
 * A cast from before schema 3, with sides, in clusters: the left side is
 * cluster 0 and the right side cluster 1. The right side stood from the right
 * edge inward, so its entries are reversed to run left to right. A right side
 * alone becomes cluster 0. Entries that already have a cluster keep it.
 */
export function clustersFromSides(cast) {
  if (!cast.some((e) => "side" in e || !("cluster" in e))) return cast;
  const toCluster = (e) => {
    if ("cluster" in e) return e;
    const n = e.side === "right" ? 1 : 0;
    const out = Object.fromEntries(Object.entries(e).map(([k, v]) => (k === "side" ? ["cluster", n] : [k, v])));
    out.cluster = n;
    return out;
  };
  const right = cast.filter((e) => !("cluster" in e) && e.side === "right");
  const rest = cast.filter((e) => !right.includes(e));
  return compactClusters([...rest, ...right.reverse()].map(toCluster));
}

/**
 * Where a drop at frame x would put a character, given each cluster's centres
 * left to right (frame pixels; counted without whoever is being moved, and no
 * cluster empty): { cluster, index, newCluster, x }, as placeEntries takes it,
 * with x where the marker goes.
 *
 *   Near a cluster or inside it, the drop joins it. Well clear of every
 *   cluster, between two or past the outermost (at least `EDGE` from the frame
 *   edge, always reachable), it starts a new cluster there.
 */
export function dropSlot(x, clusters, frameWidth) {
  const gap = 0.06 * frameWidth;
  const EDGE = 0.05 * frameWidth;
  if (!clusters.length) return { cluster: 0, index: 0, newCluster: true, x: frameWidth / 2 };
  const k = clusters.length;
  const first = clusters[0][0], last = clusters.at(-1).at(-1);
  const leftCut = Math.max(first - gap, EDGE), rightCut = Math.min(last + gap, frameWidth - EDGE);
  if (x < leftCut) return { cluster: 0, index: 0, newCluster: true, x: leftCut / 2 };
  if (x > rightCut) return { cluster: k, index: 0, newCluster: true, x: (rightCut + frameWidth) / 2 };
  if (x < first) return { cluster: 0, index: 0, newCluster: false, x: (leftCut + first) / 2 };
  if (x > last) return { cluster: k - 1, index: clusters.at(-1).length, newCluster: false, x: (last + rightCut) / 2 };
  for (let c = 0; c < k; c++) {
    const list = clusters[c];
    if (x <= list.at(-1)) {
      const index = list.filter((v) => v < x).length;
      const prev = list[index - 1], next = list[index];
      return { cluster: c, index, newCluster: false, x: prev !== undefined ? (prev + next) / 2 : next };
    }
    const a = list.at(-1), b = clusters[c + 1][0];
    if (x >= b) continue;
    const j = Math.min(gap, (b - a) / 3);
    if (x <= a + j) return { cluster: c, index: list.length, newCluster: false, x: a + j / 2 };
    if (x >= b - j) return { cluster: c + 1, index: 0, newCluster: false, x: b - j / 2 };
    return { cluster: c + 1, index: 0, newCluster: true, x: (a + b) / 2 };
  }
  return { cluster: k - 1, index: clusters.at(-1).length, newCluster: false, x: last }; // not reached
}

/**
 * The band across the top of the frame, as a share of its height, where
 * dropping a dragged portrait takes the character off the stage. It ends above
 * the drop markers and well above the face guide, so a move never removes.
 */
export const REMOVE_BAND = 0.3;

/** Is this frame point (frame pixels) in the remove band? Points outside the frame aren't. */
export function inRemoveBand(x, y, frameWidth, frameHeight) {
  return x >= 0 && x <= frameWidth && y >= 0 && y < REMOVE_BAND * frameHeight;
}

/* -------------------------------------------- */
/*  Moves                                       */
/* -------------------------------------------- */

/** The box `p` of the way from `from` to `to` (0 to 1; boxes are `{x, y, w, h}`: centre and size). */
export function tweenBox(from, to, p) {
  const at = (k) => (p === 1 ? to[k] : from[k] + (to[k] - from[k]) * p);
  return { x: at("x"), y: at("y"), w: at("w"), h: at("h") };
}

/** Are two boxes the same to within `tol` pixels on every side and size? */
export function sameBox(a, b, tol = 0.5) {
  return ["x", "y", "w", "h"].every((k) => Math.abs(a[k] - b[k]) <= tol);
}

/** Should a tile update jump instead of slide? Only when it was sent as instant (Adjust's changes) and moves or resizes the tile. */
export function snapsBox(changes, instant) {
  return !!instant && ["x", "y", "width", "height"].some((k) => k in changes);
}

/* -------------------------------------------- */
/*  Shadows                                     */
/* -------------------------------------------- */

/**
 * How the portrait shadow looks on this screen, or null for none. `strength`
 * is how dark it is (0 to 1); `scale` is the view's zoom, so the shadow keeps
 * its size against the portrait. `look` is SHADOW (constants.js): offset and
 * blur in frame pixels. The result is in screen pixels, with the padding the
 * filter needs so neither the shift nor the blur is cut off.
 */
export function shadowLook({ on, strength, scale }, look) {
  if (!on || !(strength > 0)) return null;
  const shiftX = look.x * scale, shiftY = look.y * scale, blur = look.blur * scale;
  return {
    alpha: Math.min(strength, 1),
    shiftX, shiftY, blur,
    padding: Math.ceil(Math.max(Math.abs(shiftX), Math.abs(shiftY)) + 2 * blur + 1),
  };
}
