import { MODULE } from "./constants.js";
import { artRoot } from "./settings.js";
import { formsOf, familyOf } from "./rules.js";

export { formsOf, familyOf };

/**
 * Character art by convention: `<art root>/<key>/` holds `portrait.webp`
 * (neutral), `expressions/<name>.webp` and `manifest.json`. A key is a folder
 * under the art root: a character ("Rahadin") or one of its forms
 * ("Rahadin/forms/corrupted"). Paths are kept decoded (as Foundry stores them)
 * and encoded only for fetch.
 *
 * Saved choices (flip, scale, height, size) and group membership belong to the
 * key, not to an actor, so renaming an actor loses nothing.
 */

const manifests = new Map(); // name → Promise<object|null>
let index = null;            // Promise<Art[]>

/** Forget everything read so far (the art folder changed, or new art arrived). */
export function clearArtCache() {
  manifests.clear();
  index = null;
}

export function artPath(name, file) {
  return `${artRoot()}${name}/${file}`;
}

function readManifest(name) {
  if (!artRoot()) return Promise.resolve(null);
  if (!manifests.has(name)) {
    manifests.set(name, fetch(encodeURI(artPath(name, "manifest.json")))
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null));
  }
  return manifests.get(name);
}

/**
 * The art for one character, or null if there's no manifest.
 * @returns {Promise<{name, portrait, thumb, frame, facePx, adjust, size, expressions}|null>}
 */
export async function characterArt(name) {
  const m = (await readManifest(name)) ?? (await inlineForm(name));
  const portrait = m?.files?.portrait;
  if (!portrait) return null;
  const vn = m.vn_size ?? {};
  const expressions = { neutral: artPath(name, portrait) };
  for (const [key, file] of Object.entries(m.files.expressions ?? {})) expressions[key] = artPath(name, file);
  const form = m.form_of;
  return {
    name,
    key: name,
    label: form ? `${form.character} · ${form.label ?? form.form}` : (m.character ?? name),
    portrait: expressions.neutral,
    thumb: artPath(name, m.files.avatar ?? portrait),
    frame: vn.frame ?? null,
    facePx: vn.face_px ?? null,
    faceBox: vn.face_box ?? null,
    adjust: vn.adjust ?? 1,
    size: vn.size ?? null,
    groups: Array.isArray(m.groups) ? m.groups : [],
    expressions,
  };
}

/**
 * A form folder with no manifest of its own: its entry in the parent's
 * `forms` lists the files (relative to the parent), and it shares the parent's
 * VN sizing (a pixel pass over the parent's art keeps the face boxes).
 */
async function inlineForm(key) {
  const i = key.lastIndexOf("/forms/");
  if (i === -1) return null;
  const parent = key.slice(0, i);
  const pm = await readManifest(parent);
  const folder = key.slice(parent.length + 1);
  const form = formsOf(pm).find((f) => f.folder === folder);
  if (!form?.files?.portrait) return null;
  const local = (file) => (file.startsWith(`${folder}/`) ? file.slice(folder.length + 1) : `../`.repeat(folder.split("/").length) + file);
  const expressions = Object.fromEntries(Object.entries(form.files.expressions ?? {}).map(([k, f]) => [k, local(f)]));
  return {
    character: pm.character,
    form_of: { character: pm.character ?? parent, label: form.label, form: form.form },
    files: { portrait: local(form.files.portrait), avatar: form.files.avatar ? local(form.files.avatar) : undefined, expressions },
    vn_size: form.vn_size ?? pm.vn_size,
    groups: form.groups ?? pm.groups,
  };
}

/** Every character and form in the art folder that has a VN portrait, by key. GM only (it browses the folder). */
export function artIndex({ refresh = false } = {}) {
  if (refresh) clearArtCache();
  index ??= buildIndex();
  return index;
}

async function buildIndex() {
  const root = artRoot();
  if (!root) return [];
  const FilePicker = foundry.applications.apps.FilePicker.implementation;
  let dirs = [];
  try {
    ({ dirs } = await FilePicker.browse("data", root));
  } catch (err) {
    console.warn(`VN Stage | Can't browse the art folder ${root}`, err);
    return [];
  }
  const names = dirs.map((d) => decodeURIComponent(d.replace(/\/$/, "").split("/").pop()))
    .filter((n) => !n.startsWith("_"));
  // Each character, and each of its forms that has a VN portrait of its own.
  const keys = [...names];
  for (const name of names) {
    try {
      for (const f of formsOf(await readManifest(name))) keys.push(`${name}/${f.folder}`);
    } catch (err) {
      console.warn(`VN Stage | Can't read the forms of ${name}`, err);
    }
  }
  // One unreadable manifest leaves that character out, never the whole list.
  const arts = await Promise.all(keys.map((k) => characterArt(k).catch((err) => {
    console.warn(`VN Stage | Can't read the art for ${k}`, err);
    return null;
  })));
  return arts.filter(Boolean).sort((a, b) => a.label.localeCompare(b.label));
}

function decode(path) {
  try { return decodeURIComponent(path); } catch { return path; }
}

/**
 * The art key an image path belongs to: the deepest folder under the art root,
 * from the image upward, that has a VN portrait. A form with only combat art
 * ("Rahadin/forms/twin-scimitars/token-combat.webp") gives its character's key.
 */
export async function artKeyFromPath(path) {
  const root = artRoot();
  if (!root || !path) return null;
  const src = decode(path);
  if (!src.startsWith(root)) return null;
  const folders = src.slice(root.length).split("/").slice(0, -1);
  for (let n = folders.length; n > 0; n--) {
    const key = folders.slice(0, n).join("/");
    if (await characterArt(key)) return key;
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
 * first (labelled "Base"): [{ key, label, thumb }]. A combat-only form has no VN
 * portrait, so it isn't offered.
 */
export async function formsFor(key) {
  const root = familyOf(key);
  const keys = [root, ...formsOf(await readManifest(root)).map((f) => `${root}/${f.folder}`)];
  const out = [];
  for (const k of keys) {
    const art = await characterArt(k).catch(() => null);
    if (art) out.push({ key: k, label: k === root ? "Base" : (art.label.split(" · ").pop() ?? art.label), thumb: art.thumb, portrait: art.portrait });
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
 * `actorArt`'s key without asking the server about names that have no art:
 * `keys` is the set of art index keys. For listing every world actor (GM).
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
