import { artRoot } from "./settings.js";

/**
 * Character art by convention: `<art root>/<Name>/` holds `portrait.webp`
 * (neutral), `expressions/<name>.webp` and `manifest.json`. Paths are kept
 * decoded (as Foundry stores them) and encoded only for fetch.
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
  return {
    name,
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

/** Every character in the art folder that has a VN portrait, by name. GM only (it browses the folder). */
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
  const arts = await Promise.all(names.map(characterArt));
  return arts.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
}
