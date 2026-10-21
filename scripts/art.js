import { MODULE } from "./constants.js";
import { artRoot } from "./settings.js";

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
  const m = await readManifest(name);
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
    const forms = (await readManifest(name))?.forms ?? [];
    for (const f of forms) if (f.folder) keys.push(`${name}/${f.folder.replace(/\/$/, "")}`);
  }
  const arts = await Promise.all(keys.map(characterArt));
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
 * The art key for a cast entry. Art-only entries carry it as their name. An
 * actor's comes from, in order: the link set with VN art… (an actor flag), a
 * folder named like the actor, the actor's own images (portrait, token, ring
 * subject) when they live in the art folder. Null when nothing matches.
 */
export async function artKeyOf(entry) {
  if (!entry.actorUuid) return entry.name;
  const actor = fromUuidSync(entry.actorUuid);
  if (!actor) return entry.name;
  return (await actorArt(actor)).key;
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
