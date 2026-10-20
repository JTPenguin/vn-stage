import { MODULE, FRAME, PART, FACE, SIZE, LAYOUT, faceGuide } from "./constants.js";
import { arrange, clusterCentres } from "./arrange.js";
import { characterArt } from "./art.js";
import { resolveCast, characterPrefs } from "./cast.js";
import { isStage } from "./stage.js";
import { currentExpression } from "./expressions.js";

/** Every face is drawn this tall (frame pixels), before size and per-character scale. */
const TARGET_FACE = FACE * FRAME.height;

/** Height of a fallback image (no VN art), as a share of the frame. */
const FALLBACK_HEIGHT = 0.5 * FRAME.height;


let queue = Promise.resolve();

/** The latest placements on the viewed stage, by cast id (for the face guide). */
export const placements = new Map();

/** The latest zoom, crowding and buffer share on the viewed stage (for the console and the guide). */
export const lastArrangement = { zoom: 1, crowding: 0, buffers: 1 };

/**
 * Draw the stage's cast as portrait tiles: create, update or delete tiles so
 * they match the cast flag. GM only; Foundry syncs the tiles to everyone.
 * Calls run one at a time so quick clicks can't race each other.
 */
export function layout(scene = canvas.scene) {
  queue = queue.then(() => doLayout(scene)).catch((err) => console.error("VN Stage | Layout failed", err));
  return queue;
}

async function doLayout(scene) {
  if (!game.user.isGM || !isStage(scene)) return;
  const cast = resolveCast(scene);
  const sides = {};
  for (const side of ["left", "right"]) {
    sides[side] = await Promise.all(cast.filter((e) => e.side === side).map(measure));
  }
  const widths = Object.fromEntries(Object.entries(sides).map(([k, items]) => [k, items.map((m) => m.width)]));
  const { zoom, crowding, buffers, regions } = arrange(widths, FRAME.width, LAYOUT);
  const placed = [];
  for (const [side, items] of Object.entries(sides)) {
    const centres = clusterCentres(side, items.map((m) => m.width * zoom), regions[side], LAYOUT.step, LAYOUT.roomyStep);
    items.forEach((m, i) => placed.push(finish(m, centres[i], i, zoom)));
  }
  if (scene.id === canvas.scene?.id) {
    placements.clear();
    for (const p of placed) placements.set(p.entry.id, p);
    Object.assign(lastArrangement, { zoom, crowding, buffers });
  }

  const tiles = scene.tiles.filter((t) => t.getFlag(MODULE, "part") === PART.PORTRAIT);
  const byId = new Map(tiles.map((t) => [t.getFlag(MODULE, "castId"), t]));
  const create = [], update = [];
  for (const p of placed) {
    const data = tileData(p);
    const tile = byId.get(p.entry.id);
    byId.delete(p.entry.id);
    if (!tile) create.push(data);
    else if (changed(tile, data)) update.push({ _id: tile.id, ...data });
  }
  const remove = [...byId.values()].map((t) => t.id);

  // The bottom shade: only while zoomed-out portraits have lifted their cut-off edges into view.
  const shadeWanted = shadeTiles(placed);
  for (const tile of scene.tiles.filter((t) => t.getFlag(MODULE, "part") === PART.SHADE)) {
    const key = tile.getFlag(MODULE, "shade");
    const data = shadeWanted.get(key);
    shadeWanted.delete(key);
    if (!data) remove.push(tile.id);
    else if (tile.y !== data.y || tile.height !== data.height) update.push({ _id: tile.id, ...data });
  }
  create.push(...shadeWanted.values());

  if (remove.length) await scene.deleteEmbeddedDocuments("Tile", remove);
  if (update.length) await scene.updateEmbeddedDocuments("Tile", update);
  if (create.length) await scene.createEmbeddedDocuments("Tile", create);

  Hooks.callAll(`${MODULE}.layout`, scene, placed.map(({ entry, box, fallback }) => ({
    id: entry.id, name: entry.name, actorUuid: entry.actorUuid, side: entry.side, box, fallback,
  })));
}

/**
 * The bottom shade as tile data by key ("fade", "solid"): a fade that ends at
 * the highest cut-off edge in view, and solid shade from there to the bottom.
 * Empty when no edge shows (a stage at full size).
 */
function shadeTiles(placed) {
  const out = new Map();
  const cut = Math.min(FRAME.height, ...placed.filter((p) => !p.fallback).map((p) => p.box.y + p.box.height));
  if (cut >= FRAME.height - 1) return out;
  const { sceneX = 0, sceneY = 0 } = canvas.dimensions ?? {};
  const fade = LAYOUT.shadeFade * FRAME.height;
  const tile = (key, top, bottom) => out.set(key, {
    name: `VN Stage shade (${key})`,
    texture: { src: `modules/${MODULE}/assets/shade-${key}.webp`, anchorX: 0.5, anchorY: 0.5, fit: "fill" },
    x: Math.round(sceneX + FRAME.width / 2),
    y: Math.round(sceneY + (top + bottom) / 2),
    width: FRAME.width,
    height: Math.round(bottom - top),
    sort: 1000,
    locked: true,
    flags: { [MODULE]: { part: PART.SHADE, shade: key } },
  });
  tile("fade", cut - fade, cut + 2);
  if (cut + 2 < FRAME.height) tile("solid", cut + 2, FRAME.height);
  return out;
}

/** One character's image and size, before they're placed. */
async function measure(entry) {
  const actor = entry.actorUuid ? fromUuidSync(entry.actorUuid) : null;
  const art = await characterArt(entry.name);
  const prefs = characterPrefs(entry.name);
  const size = sizeOf(prefs, actor, art);
  const scale = size.scale * (prefs.scale ?? 1);

  let src, width, height, k = null, fallback = false;
  if (art?.facePx && art.frame) {
    src = art.expressions[currentExpression(entry)] ?? art.portrait;
    k = (TARGET_FACE / art.facePx) * (art.adjust ?? 1) * scale;
    [width, height] = [art.frame[0] * k, art.frame[1] * k];
  } else {
    fallback = true;
    src = art?.portrait ?? actor?.img ?? "icons/svg/mystery-man.svg";
    const tex = await foundry.canvas.loadTexture(src).catch(() => null);
    height = FALLBACK_HEIGHT * scale;
    width = tex?.width ? (height * tex.width) / tex.height : height * (2 / 3);
  }

  return { entry, art, prefs, size, src, width, height, k, fallback };
}

/** Where one character stands: box (frame pixels) and draw order; first-placed in front. */
function finish({ entry, art, prefs, size, src, width, height, k, fallback }, cx, i, zoom = 1) {
  // At full size, start from the head box: the face's top sits on the guide for
  // this size, unless that would lift the cut-off bottom edge into view; then
  // (and with no face measurement) the image stands on the bottom edge.
  const standing = FRAME.height - height;
  const fb = art?.faceBox && k ? art.faceBox : null;
  const aligned = fb ? faceGuide(size.scale).top * FRAME.height - fb[1] * k : standing;
  let y = Math.max(aligned, standing) + (prefs.yOffset ?? 0) * FRAME.height;

  // Zoomed out with everyone else when the stage is crowded (arrange.js): around
  // the face's centre, so faces stay where they stood and bodies shrink upward
  // (the bottom shade hides the edges that rise). No face: stay on the ground.
  if (zoom !== 1) {
    const pivot = fb ? y + (fb[1] + fb[3] / 2) * k : y + height;
    y = pivot - (pivot - y) * zoom;
    width *= zoom;
    height *= zoom;
    k *= zoom;
  }
  const box = { x: cx - width / 2, y, width, height };
  const flip = !!prefs.flip;
  return { entry, src, box, sort: 100 - i, flip, fallback, size, zoom, face: faceBox(art, box, k, flip) };
}

/** A character's creature size: the Adjust window's choice, then the sheet, then the manifest. */
export function sizeOf(prefs, actor, art) {
  const auto = actor?.system?.traits?.size?.value
    ? { key: actor.system.traits.size.value, source: "sheet" }
    : art?.size ? { key: art.size, source: "manifest" } : { key: "med", source: "default" };
  const chosen = prefs.size ? { key: prefs.size, source: "chosen" } : auto;
  return { ...chosen, scale: SIZE[chosen.key] ?? 1, auto };
}

/** The face (forehead to chin) in frame pixels, from the manifest's face box, or null. */
function faceBox(art, box, k, flip) {
  const fb = art?.faceBox;
  if (!fb || !k) return null;
  const [fx, fy, fw, fh] = fb;
  const x = flip ? box.x + box.width - (fx + fw) * k : box.x + fx * k;
  return { x, y: box.y + fy * k, width: fw * k, height: fh * k };
}

function tileData({ entry, src, box, sort, flip, fallback }) {
  const { sceneX = 0, sceneY = 0 } = canvas.dimensions ?? {};
  // In v14 a tile's x and y are its anchor point, the centre here.
  return {
    name: `VN Stage: ${entry.name}`,
    texture: { src, anchorX: 0.5, anchorY: 0.5, scaleX: flip ? -1 : 1, fit: "fill" },
    x: Math.round(sceneX + box.x + box.width / 2),
    y: Math.round(sceneY + box.y + box.height / 2),
    width: Math.round(box.width),
    height: Math.round(box.height),
    sort,
    locked: true,
    flags: { [MODULE]: { part: PART.PORTRAIT, castId: entry.id, name: entry.name, fallback } },
  };
}

function changed(tile, data) {
  const t = tile.texture;
  return t.src !== data.texture.src || t.scaleX !== data.texture.scaleX
    || tile.x !== data.x || tile.y !== data.y || tile.width !== data.width || tile.height !== data.height
    || tile.sort !== data.sort || tile.getFlag(MODULE, "fallback") !== data.flags[MODULE].fallback;
}
