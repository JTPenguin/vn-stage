import { MODULE, FRAME, PART } from "./constants.js";
import { safetyBackground } from "./settings.js";

/** Is `scene` a stage? */
export function isStage(scene = canvas.scene) {
  return !!scene?.getFlag(MODULE, "stage");
}

function requireGM() {
  if (!game.user.isGM) throw new Error("VN Stage | Only the GM can change a stage.");
}

/**
 * Turn `scene` into a stage: the fixed frame, gridless, no vision. The safety-net
 * background goes on the scene's own Level once, here, because any later change
 * to a Level background redraws the canvas on every screen. During play the
 * background is a tile above it (`setBackground`).
 */
export async function makeStage({ scene = canvas.scene } = {}) {
  requireGM();
  if (!scene) throw new Error("VN Stage | No scene to make a stage.");

  await scene.update({
    width: FRAME.width,
    height: FRAME.height,
    padding: 0,
    "grid.type": CONST.GRID_TYPES.GRIDLESS,
    tokenVision: false,
    [`flags.${MODULE}.stage`]: { version: 1 },
  });

  const safety = safetyBackground();
  const level = scene.initialLevel;
  if (safety && level && level.background?.src !== safety) {
    await scene.updateEmbeddedDocuments("Level", [{ _id: level.id, "background.src": safety }]);
  }

  if (!backgroundTile(scene)) {
    const first = safety || level?.background?.src;
    if (first) await setBackground(first, { scene });
  }
  ui.notifications.info(`VN Stage | "${scene.name}" is now a stage.`);
  return scene;
}

/** Stop treating `scene` as a stage. Its tiles stay. */
export async function unmakeStage({ scene = canvas.scene } = {}) {
  requireGM();
  return scene?.unsetFlag(MODULE, "stage");
}

/** The stage's background tile document, if it has one. */
export function backgroundTile(scene = canvas.scene) {
  return scene?.tiles.find((t) => t.getFlag(MODULE, "part") === PART.BACKGROUND) ?? null;
}

/** The background image currently shown on the stage. */
export function currentBackground(scene = canvas.scene) {
  return backgroundTile(scene)?.texture.src ?? scene?.initialLevel?.background?.src ?? null;
}

/**
 * Show `src` as the stage background: a locked tile under everything, filling
 * the frame with `cover` fit, so any image shape fills it without stretching.
 * Swapping it only changes this tile; the canvas isn't redrawn.
 */
export async function setBackground(src, { scene = canvas.scene } = {}) {
  requireGM();
  if (!isStage(scene)) throw new Error("VN Stage | Not a stage. Make it a stage first.");
  const tile = backgroundTile(scene);
  // A video background loops silently on every screen (Foundry's tile video settings).
  const video = { loop: true, autoplay: true, volume: 0 };
  if (tile) return tile.update({ "texture.src": src, video });

  // In v14 a tile's x and y are its anchor point, the centre by default.
  const { sceneX = 0, sceneY = 0 } = scene.dimensions ?? {};
  const [doc] = await scene.createEmbeddedDocuments("Tile", [{
    name: "VN Stage background",
    texture: { src, fit: "cover", anchorX: 0.5, anchorY: 0.5 },
    x: sceneX + FRAME.width / 2,
    y: sceneY + FRAME.height / 2,
    width: FRAME.width,
    height: FRAME.height,
    sort: -1000,
    locked: true,
    video,
    flags: { [MODULE]: { part: PART.BACKGROUND } },
  }]);
  return doc;
}

/* -------------------------------------------- */
/*  Background folder: quick swaps in a session */
/* -------------------------------------------- */

const IMAGE = /\.(webp|png|jpe?g|avif|gif|webm|mp4|m4v|ogv)$/i;
const VIDEO = /\.(webm|mp4|m4v|ogv)$/i;

/** Is this background a video (it loops, silent)? */
export function isVideo(path) {
  return VIDEO.test(path ?? "");
}
const folderCache = new Map(); // folder → Promise<string[]|null>

/** Folder part of a path, with its trailing slash. */
export function folderOf(path) {
  return path.slice(0, path.lastIndexOf("/") + 1);
}

/** Paths are kept decoded, as Foundry stores them; the file browser hands back encoded ones. */
export function decodePath(path) {
  try { return decodeURIComponent(path); } catch { return path; }
}

/** The folder whose images the Stage window offers as quick swaps, or null. */
export function backgroundFolder(scene = canvas.scene) {
  return scene?.getFlag(MODULE, "backgroundFolder") ?? null;
}

/**
 * Show a background picked in the file browser. Its folder becomes the stage's
 * quick-swap folder, except the default background's folder (the Lodge's also
 * holds its old layer images), so the scenario's scenes stay on offer.
 */
export async function pickBackground(path, { scene = canvas.scene, keepFolder = false } = {}) {
  requireGM();
  const src = decodePath(path);
  await setBackground(src, { scene });
  if (keepFolder) return; // a stage showing a tag keeps the tag's folders
  const folder = folderOf(src);
  const safety = safetyBackground();
  if (!folder || folder === (safety && folderOf(safety))) return;
  folderCache.delete(folder); // re-read: new art may have arrived
  if (folder !== backgroundFolder(scene)) await scene.setFlag(MODULE, "backgroundFolder", folder);
}

/** Browse `folder` once (GM only): its files, or null when it can't be read (it doesn't exist). */
function browse(folder) {
  if (!folderCache.has(folder)) {
    const FilePicker = foundry.applications.apps.FilePicker.implementation;
    folderCache.set(folder, FilePicker.browse("data", folder)
      .then(({ files }) => files.map(decodePath))
      .catch(() => null)); // kept, so a missing folder isn't asked for again until Refresh
  }
  return folderCache.get(folder);
}

/** Does `folder` exist? (A tag's automatic folder is only offered when it does.) */
export async function folderExists(folder) {
  return !!folder && (await browse(folder)) !== null;
}

/** The images and videos in `folder`, sorted by name (GM only: it browses the folder). */
export async function folderImages(folder) {
  if (!folder) return [];
  const files = await browse(folder);
  if (files === null) console.warn(`VN Stage | Can't browse ${folder}`);
  return (files ?? []).filter((f) => IMAGE.test(f)).sort((a, b) => a.localeCompare(b));
}

/** Forget what was read from the folders (new art may have arrived). */
export function clearFolderCache() {
  folderCache.clear();
}

/** "…/02 Absalom Docks.webp" → "Absalom Docks". */
export function backgroundLabel(path) {
  const file = path.split("/").pop().replace(IMAGE, "");
  return file.replace(/^\d+[\s._-]+/, "") || file;
}
