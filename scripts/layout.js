import { MODULE, FRAME, PART, FACE, SIZE, LAYOUT, faceGuide } from "./constants.js";
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
  for (const side of ["left", "right", "full"]) {
    sides[side] = await Promise.all(cast.filter((e) => e.side === side).map(measure));
  }
  const placed = [];
  for (const [side, items] of Object.entries(sides)) {
    const centres = clusterCentres(side, items, sides);
    items.forEach((m, i) => placed.push(finish(m, centres[i], i)));
  }
  if (scene.id === canvas.scene?.id) {
    placements.clear();
    for (const p of placed) placements.set(p.entry.id, p);
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

  if (remove.length) await scene.deleteEmbeddedDocuments("Tile", remove);
  if (update.length) await scene.updateEmbeddedDocuments("Tile", update);
  if (create.length) await scene.createEmbeddedDocuments("Tile", create);

  Hooks.callAll(`${MODULE}.layout`, scene, placed.map(({ entry, box, fallback }) => ({
    id: entry.id, name: entry.name, actorUuid: entry.actorUuid, side: entry.side, box, fallback,
  })));
}

/**
 * Centres (frame x) for one side's characters, first-placed first. Each side is a
 * tight cluster: neighbours overlap, and the cluster squeezes only if it runs out
 * of room. With both sides in use, each cluster sits at its own outer edge; with
 * one side in use, that side has the whole width and its cluster is centred.
 * The Party at full width is centred with wider spacing. The right edge stays
 * clear for Foundry's sidebar.
 */
function clusterCentres(side, items, sides) {
  if (!items.length) return [];
  const W = FRAME.width;
  const start = LAYOUT.pad * W;
  const end = W * (1 - LAYOUT.sidebar) - LAYOUT.pad * W;
  const mid = (start + end) / 2;
  const both = sides.left.length > 0 && sides.right.length > 0;

  let region, anchor;
  if (side === "full" || !both) [region, anchor] = [[start, end], "centre"];
  else if (side === "left") [region, anchor] = [[start, mid - (LAYOUT.centreGap * W) / 2], "start"];
  else [region, anchor] = [[mid + (LAYOUT.centreGap * W) / 2, end], "end"];
  const room = region[1] - region[0];

  // Offsets of each centre from the cluster's outer edge.
  const factor = side === "full" ? LAYOUT.fullStep : LAYOUT.step;
  const steps = items.slice(1).map((m, i) => (factor * (items[i].width + m.width)) / 2);
  const ends = items[0].width / 2 + items.at(-1).width / 2;
  const total = steps.reduce((a, b) => a + b, 0);
  const squeeze = total > 0 && ends + total > room ? Math.max(0, room - ends) / total : 1;
  const offsets = [items[0].width / 2];
  for (const s of steps) offsets.push(offsets.at(-1) + s * squeeze);
  const extent = offsets.at(-1) + items.at(-1).width / 2;

  // The left side (and full width) runs left to right; the right side runs right to left.
  const inset = anchor === "centre" ? Math.max(0, (room - extent) / 2) : 0;
  return side === "right"
    ? offsets.map((o) => region[1] - inset - o)
    : offsets.map((o) => region[0] + inset + o);
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
function finish({ entry, art, prefs, size, src, width, height, k, fallback }, cx, i) {
  // Start from the head box: the face's top sits on the guide for this size,
  // unless that would lift the cut-off bottom edge into view; then (and with no
  // face measurement) the image stands on the bottom edge.
  const standing = FRAME.height - height;
  const aligned = art?.faceBox && k ? faceGuide(size.scale).top * FRAME.height - art.faceBox[1] * k : standing;
  const base = Math.max(aligned, standing);
  const y = base + (prefs.yOffset ?? 0) * FRAME.height;
  const box = { x: cx - width / 2, y, width, height };
  const flip = !!prefs.flip;
  return { entry, src, box, sort: 100 - i, flip, fallback, size, face: faceBox(art, box, k, flip) };
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
