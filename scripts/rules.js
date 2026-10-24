/**
 * The module's rules that need no Foundry: plain data in, plain data out. Kept
 * apart so tools/test.mjs can check them outside Foundry. (The layout's
 * arithmetic lives in arrange.js for the same reason.) Nothing here imports
 * anything.
 */

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
 * stage an empty party has nobody to show, so the entry goes.
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
  const entryOf = (a, side) => ({ name: a.name, actorUuid: a.uuid, side });
  const out = [];
  let anchor = null; // where newcomers go: { at (index in out), side }
  for (const e of saved) {
    if (isOldPartyEntry(e)) {
      for (const a of orderMembers(members, e.order)) {
        if (placed.has(a.uuid)) continue;
        out.push(entryOf(a, e.side));
        placed.add(a.uuid);
      }
      continue;
    }
    if (!e.partyMember) { out.push(e); continue; }
    if (here.has(e.actorUuid)) {
      const { partyMember: _p, ...rest } = e;
      out.push(rest);
      anchor = { at: out.length, side: e.side };
    } else anchor ??= { at: out.length, side: e.side };
  }
  if (anchor) out.splice(anchor.at, 0, ...members.filter((a) => !placed.has(a.uuid)).map((a) => entryOf(a, anchor.side)));
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
 * @returns {null|{name, key, label, formLabel, portrait, thumb, expressions, labels, size, scale, yOffset, groups, forms, warnings}}
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
    groups: Array.isArray(data.groups) ? data.groups.filter((g) => typeof g === "string" && g.trim()).map((g) => g.trim()) : [],
    forms: isForm ? [] : [...(listing.forms ?? [])].sort((a, b) => a.localeCompare(b)).map((f) => `${key}/forms/${f}`),
    warnings,
  };
}

/** The character a key belongs to: "Mira Voss/forms/corrupted" → "Mira Voss". */
export function familyOf(key) {
  const i = key.indexOf("/forms/");
  return i === -1 ? key : key.slice(0, i);
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
/*  Groups                                      */
/* -------------------------------------------- */

/**
 * A group's members: characters whose art names it (`index`: [{ name, groups }]),
 * plus ones added by hand, minus ones removed by hand (a removal wins over a name in the art).
 */
export function groupMembers(id, index, { add = [], remove = [] } = {}) {
  const names = new Set(index.filter((a) => a.groups.includes(id)).map((a) => a.name));
  for (const n of add) names.add(n);
  for (const n of remove) names.delete(n);
  return [...names];
}

/** The Recent list after using `used` (newest first), at most `max` long. */
export function mergeRecent(used, before, max) {
  return [...used, ...before.filter((n) => !used.includes(n))].slice(0, max);
}

/* -------------------------------------------- */
/*  Dropping on the stage                       */
/* -------------------------------------------- */

/**
 * Where a drop at frame x would put a character, given each side's centres in
 * standing order (frame pixels): { side, index, x } with x where the marker goes.
 * The sides divide halfway between the two clusters, or in the middle of the
 * usable width (the frame less the sidebar share) when one side is empty, or
 * past the last character of a crowded side if that lies beyond the middle.
 */
export function dropSlot(x, left, right, frameWidth, sidebar) {
  const gap = 0.06 * frameWidth;
  const middle = (frameWidth * (1 - sidebar)) / 2;
  // A lone crowded side keeps its territory: the divide moves out past its last character.
  // The far edge always stays reachable as the other side.
  const reach = (b) => Math.min(Math.max(b, 0.5 * gap), 2 * middle - 0.5 * gap);
  const boundary = reach(left.length && right.length ? (Math.max(...left) + Math.min(...right)) / 2
    : left.length ? Math.max(middle, Math.max(...left) + gap)
    : right.length ? Math.min(middle, Math.min(...right) - gap)
    : middle);
  const side = x < boundary ? "left" : "right";
  const list = side === "left" ? left : right;
  // Standing order runs from the outer edge: left to right on the left, right to left on the right.
  const inward = side === "left" ? (c) => c < x : (c) => c > x;
  const index = list.filter(inward).length;
  const prev = list[index - 1], next = list[index];
  const step = side === "left" ? gap : -gap;
  const mx = prev !== undefined && next !== undefined ? (prev + next) / 2
    : prev !== undefined ? prev + step : next !== undefined ? next - step
    : emptySideX(side, side === "left" ? right : left, middle * 2, boundary, gap);
  return { side, index, x: mx };
}

/**
 * Where the marker sits for a drop on an empty side: the mirror of the other
 * side's outermost character (else a quarter in from that edge of the usable
 * width), kept clear of the divide so it never lies short of the other side's
 * own end-of-row marker.
 */
function emptySideX(side, other, usable, boundary, gap) {
  const mirror = other.length
    ? usable - (side === "left" ? Math.max(...other) : Math.min(...other))
    : usable * (side === "left" ? 0.25 : 0.75);
  return side === "left"
    ? Math.max(0, Math.min(mirror, boundary - gap))
    : Math.min(usable, Math.max(mirror, boundary + gap));
}
