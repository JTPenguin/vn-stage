import { MODULE } from "./constants.js";
import { artRoot } from "./settings.js";
import { normaliseArt, familyOf, stable } from "./rules.js";

export { familyOf };

/**
 * Character art by convention (docs/art-format.md): `<art root>/<key>/` holds
 * `portrait.*`, an optional `expressions/` folder and `vn-stage.json`. A key is
 * a folder under the art root: a character ("Mira Voss") or one of its forms
 * ("Mira Voss/forms/corrupted"). Paths are kept decoded (as Foundry stores
 * them) and encoded only for fetch.
 *
 * Only the GM's screen reads folders (`scanArt`). It saves what it finds as the
 * world setting `artIndex`: { root, scanned, art: { [key]: <normaliseArt shape> } }
 * with paths relative to `root`. Every screen reads art from that setting, so
 * players never browse folders. Saved choices (flip, scale, height, size) and
 * group membership belong to the key, not to an actor, so renaming an actor
 * loses nothing.
 */

let memo = null; // { source: the setting's value, root, byKey: Map, list: Art[] }

/** Forget what was read from the setting (the index changed). */
export function clearArtCache() {
  memo = null;
}

function loaded() {
  const source = game.settings.get(MODULE, "artIndex");
  if (memo?.source === source) return memo;
  const root = source?.root ?? "";
  const withRoot = (p) => `${root}${p}`;
  const list = Object.values(source?.art ?? {}).map((a) => ({
    ...a,
    portrait: withRoot(a.portrait),
    thumb: withRoot(a.thumb),
    expressions: Object.fromEntries(Object.entries(a.expressions).map(([k, p]) => [k, withRoot(p)])),
  })).sort((a, b) => a.label.localeCompare(b.label));
  memo = { source, root, byKey: new Map(list.map((a) => [a.key, a])), list };
  return memo;
}

/**
 * The art for one character or form, or null if it has none.
 * @returns {Promise<{name, key, label, formLabel, portrait, thumb, expressions, labels, size, scale, yOffset, groups, forms}|null>}
 */
export async function characterArt(name) {
  return loaded().byKey.get(name) ?? null;
}

/** Every character and form that has a VN portrait, by label. Every screen reads the saved index; `refresh` (GM) scans the folders first. */
export async function artIndex({ refresh = false } = {}) {
  if (refresh && game.user.isGM) await scanArt();
  return loaded().list;
}

/* -------------------------------------------- */
/*  Scanning the art folder (GM)                */
/* -------------------------------------------- */

const decode = (path) => { try { return decodeURIComponent(path); } catch { return path; } };
const baseName = (path) => decode(path.replace(/\/$/, "")).split("/").pop();

/** The file and folder names directly inside `folder` (an empty listing if it can't be browsed). */
async function browse(folder) {
  const FilePicker = foundry.applications.apps.FilePicker.implementation;
  try {
    const { files, dirs } = await FilePicker.browse("data", folder);
    return { files: files.map(baseName), dirs: dirs.map(baseName) };
  } catch {
    return { files: [], dirs: [] };
  }
}

async function readFile(folder, files) {
  const name = files.find((f) => f.toLowerCase() === "vn-stage.json");
  if (!name) return null;
  try {
    const response = await fetch(encodeURI(`${folder}${name}`));
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

function warn(art) {
  for (const w of art.warnings) console.warn(`VN Stage | ${art.key}: ${w}`);
  const { warnings: _w, ...rest } = art;
  return rest;
}

/** One character and its forms, read from its folder: [art, ...forms] (empty with no portrait). */
async function scanCharacter(root, name) {
  const folder = `${root}${name}/`;
  const top = await browse(folder);
  const file = await readFile(folder, top.files);
  const expressions = top.dirs.includes("expressions") ? (await browse(`${folder}expressions/`)).files : [];
  const base = normaliseArt(name, { ...top, expressions }, file);
  if (!base) return [];

  const forms = [];
  if (top.dirs.includes("forms")) {
    for (const form of (await browse(`${folder}forms/`)).dirs.filter((d) => !d.startsWith("_"))) {
      const formFolder = `${folder}forms/${form}/`;
      const listing = await browse(formFolder);
      const formExpressions = listing.dirs.includes("expressions") ? (await browse(`${formFolder}expressions/`)).files : [];
      const art = normaliseArt(`${name}/forms/${form}`, { ...listing, expressions: formExpressions, parentLabel: base.label }, await readFile(formFolder, listing.files));
      if (art) forms.push(art);
    }
  }
  const art = normaliseArt(name, { ...top, expressions, forms: forms.map((f) => f.key.split("/").pop()) }, file);
  return [art, ...forms];
}

/**
 * Read the art folder and save the result as the `artIndex` setting (GM only;
 * one GM writes). Saves nothing when nothing changed.
 */
export async function scanArt() {
  if (!game.user.isGM) return;
  const root = artRoot();
  const art = {};
  if (root) {
    const { dirs } = await browse(root);
    const names = dirs.filter((d) => !d.startsWith("_")).sort();
    for (let i = 0; i < names.length; i += 8) {
      const found = await Promise.all(names.slice(i, i + 8).map((n) => scanCharacter(root, n).catch((err) => {
        console.warn(`VN Stage | Can't read the art for ${n}`, err);
        return [];
      })));
      for (const a of found.flat()) art[a.key] = warn(a);
    }
  }
  const before = game.settings.get(MODULE, "artIndex");
  if (before?.root === root && stable(before?.art ?? {}) === stable(art)) return;
  await game.settings.set(MODULE, "artIndex", { root, scanned: Date.now(), art });
}

/**
 * When the world loads (the active GM): scan if the index is empty, was built
 * from another folder, or the art folder's character folders differ from it.
 * New expressions in a known folder show up on the Stage window's refresh.
 */
export async function scanArtIfStale() {
  // One GM is enough: the active one.
  if (!game.user.isGM || (game.users.activeGM ?? game.user) !== game.user) return;
  const root = artRoot();
  const index = game.settings.get(MODULE, "artIndex");
  if (!root) return index?.root ? scanArt() : undefined;
  if (index?.root !== root || !Object.keys(index.art ?? {}).length) return scanArt();
  const known = new Set(Object.keys(index.art).map(familyOf));
  const { dirs } = await browse(root);
  const now = dirs.filter((d) => !d.startsWith("_"));
  const missing = now.some((d) => !known.has(d));
  // A folder that has no portrait is never indexed, so only a vanished one counts here.
  const gone = [...known].some((k) => !now.includes(k));
  if (missing || gone) return scanArt();
}

/* -------------------------------------------- */
/*  Which art a cast entry or actor uses        */
/* -------------------------------------------- */

/**
 * The art key an image path belongs to: the deepest folder under the art root,
 * from the image upward, that has a VN portrait. A form with only combat art
 * ("Mira Voss/forms/twin-blades/token-combat.webp") gives its character's key.
 */
export async function artKeyFromPath(path) {
  const { root, byKey } = loaded();
  if (!root || !path) return null;
  const src = decode(path);
  if (!src.startsWith(root)) return null;
  const folders = src.slice(root.length).split("/").slice(0, -1);
  for (let n = folders.length; n > 0; n--) {
    const key = folders.slice(0, n).join("/");
    if (byKey.has(key)) return key;
  }
  return null;
}

/**
 * The art key a cast entry shows: its base art (`baseArtKeyOf`), or the form
 * chosen for it (`chosenForm`) when that's another form of the same character
 * with a VN portrait.
 */
export async function artKeyOf(entry) {
  const base = await baseArtKeyOf(entry);
  const form = chosenForm(entry);
  if (!base || !form || form === base || familyOf(form) !== familyOf(base)) return base;
  return (await characterArt(form)) ? form : base;
}

/**
 * The art key a cast entry has before any form is chosen. Art-only entries
 * carry it as their name. An actor's comes from, in order: the link set with
 * VN art… (an actor flag), a folder named like the actor, the actor's own
 * images (portrait, token, ring subject) when they live in the art folder.
 * Null when nothing matches.
 */
export async function baseArtKeyOf(entry) {
  if (!entry.actorUuid) return entry.name;
  const actor = fromUuidSync(entry.actorUuid);
  if (!actor) return entry.name;
  return (await actorArt(actor)).key;
}

/**
 * The form chosen for a cast entry (an art key), or null for its base art. An
 * actor keeps it on the actor (a flag), so it follows them to every stage and
 * its owners can change it; art alone keeps it on its cast entry.
 */
export function chosenForm(entry) {
  const actor = entry.actorUuid ? fromUuidSync(entry.actorUuid) : null;
  return (actor ? actor.getFlag(MODULE, "form") : entry.form) ?? null;
}

/**
 * Every form of `key`'s character that has a VN portrait, the character itself
 * first (labelled "Base"): [{ key, label, thumb, portrait }].
 */
export async function formsFor(key) {
  const root = familyOf(key);
  const base = await characterArt(root);
  if (!base) return [];
  const out = [{ key: root, label: "Base", thumb: base.thumb, portrait: base.portrait }];
  for (const k of base.forms) {
    const art = await characterArt(k);
    if (art) out.push({ key: k, label: art.formLabel ?? art.label, thumb: art.thumb, portrait: art.portrait });
  }
  return out;
}

/** An actor's art key and where it came from: "linked", "name", "images", or null with no art. */
export async function actorArt(actor) {
  const linked = actor.getFlag(MODULE, "art");
  if (linked) return { key: linked, source: "linked" };
  return automaticArt(actor);
}

/** The key an actor would have without a VN art… link. */
export async function automaticArt(actor) {
  if (await characterArt(actor.name)) return { key: actor.name, source: "name" };
  const token = actor.prototypeToken;
  for (const src of [actor.img, token?.texture?.src, token?.ring?.subject?.texture]) {
    const key = await artKeyFromPath(src);
    if (key) return { key, source: "images" };
  }
  return { key: null, source: null };
}

/**
 * `actorArt`'s key for listing every world actor (GM): `keys` is the set of art
 * index keys.
 */
export async function indexedActorKey(actor, keys) {
  const linked = actor.getFlag(MODULE, "art");
  if (linked) return keys.has(linked) ? linked : null;
  if (keys.has(actor.name)) return actor.name;
  const token = actor.prototypeToken;
  for (const src of [actor.img, token?.texture?.src, token?.ring?.subject?.texture]) {
    const key = await artKeyFromPath(src);
    if (key) return key;
  }
  return null;
}
