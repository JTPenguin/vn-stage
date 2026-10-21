import { MODULE, PART } from "./constants.js";

/**
 * Fades, drawn by every screen for itself; no document changes. A portrait (or
 * the bottom shade) fades in when its tile is created and out when it's
 * deleted; a new background crossfades over the old one, and so does a
 * portrait switching form (its tile's `key` flag changes). Moves and expression
 * changes stay instant. Loading a preset replaces the whole cast, so it
 * crossfades too. Off for viewers who ask their system for reduced motion.
 *
 * Fading in: the tile is drawn as usual, and `refreshTile` scales its mesh's
 * alpha by a factor that rises to 1. Fading out: Foundry is about to destroy the
 * mesh when `deleteTile` runs, so a copy of it takes its place and fades away.
 */

const PORTRAIT_MS = 350;
const BACKGROUND_MS = 600;

const FADES_IN = new Set([PART.PORTRAIT, PART.SHADE]);
const pending = new Set(); // tile ids created, waiting to be drawn
const fadingIn = new Map(); // tile id → current alpha factor
const drawn = new Map();    // tile id → resolve(), for a background waiting for its new image

function part(doc) {
  return doc.getFlag(MODULE, "part");
}

function reduced() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function onStage(doc) {
  return doc.parent?.id === canvas.scene?.id;
}

export function registerFades() {
  Hooks.on("createTile", (doc) => {
    if (onStage(doc) && FADES_IN.has(part(doc)) && !reduced()) pending.add(doc.id);
  });

  Hooks.on("drawTile", (tile) => {
    const id = tile.document.id;
    drawn.get(id)?.();
    drawn.delete(id);
    if (!pending.delete(id) || !tile.mesh) return;
    tile.mesh.alpha = 0;
    fadeIn(tile);
  });

  Hooks.on("refreshTile", (tile) => {
    const f = fadingIn.get(tile.document.id);
    if (f !== undefined && tile.mesh) tile.mesh.alpha *= f;
  });

  Hooks.on("deleteTile", (doc) => {
    pending.delete(doc.id);
    fadingIn.delete(doc.id);
    const mesh = doc.object?.mesh;
    if (!mesh || !FADES_IN.has(part(doc)) || reduced()) return;
    fadeOut(ghostOf(mesh), PORTRAIT_MS);
  });

  // A background change, or a portrait's new form: the old image stays on top until the new one is drawn, then fades away.
  Hooks.on("updateTile", (doc, changes) => {
    if (!foundry.utils.hasProperty(changes, "texture.src") || reduced()) return;
    const background = part(doc) === PART.BACKGROUND;
    const newForm = part(doc) === PART.PORTRAIT && foundry.utils.hasProperty(changes, `flags.${MODULE}.key`);
    if (!background && !newForm) return;
    const mesh = doc.object?.mesh;
    if (!mesh?.texture || mesh.texture === PIXI.Texture.EMPTY) return;
    const ghost = ghostOf(mesh, background ? 1 : 0.5);
    const ready = new Promise((resolve) => {
      drawn.set(doc.id, resolve);
      setTimeout(resolve, 5000); // never leave the old image up if the new one fails to load
    });
    ready.then(() => fadeOut(ghost, background ? BACKGROUND_MS : PORTRAIT_MS));
  });

  Hooks.on("canvasTearDown", () => {
    pending.clear();
    fadingIn.clear();
    drawn.clear();
  });
}

function fadeIn(tile) {
  const id = tile.document.id;
  const state = { f: 0 };
  fadingIn.set(id, 0);
  const tick = () => {
    if (tile.destroyed) return;
    fadingIn.set(id, state.f);
    tile.renderFlags.set({ refreshState: true });
  };
  foundry.canvas.animation.CanvasAnimation.animate([{ parent: state, attribute: "f", to: 1 }], {
    name: `${MODULE}.fadeIn.${id}`, duration: PORTRAIT_MS, easing: "easeInOutCosine", ontick: tick,
  }).finally(() => {
    fadingIn.delete(id);
    if (!tile.destroyed) tile.renderFlags.set({ refreshState: true });
  });
}

/** A stand-in for a mesh that's about to go: same image, place and depth (`sortBump` puts it just above). */
function ghostOf(mesh, sortBump = 0) {
  const { PrimarySpriteMesh } = foundry.canvas.primary;
  const ghost = new PrimarySpriteMesh({ texture: mesh.texture, name: `${MODULE}.fade` });
  ghost.anchor.copyFrom(mesh.anchor);
  ghost.position.copyFrom(mesh.position);
  ghost.scale.copyFrom(mesh.scale);
  ghost.rotation = mesh.rotation;
  ghost.elevation = mesh.elevation;
  ghost.sortLayer = mesh.sortLayer;
  ghost.sort = mesh.sort + sortBump;
  ghost.zIndex = mesh.zIndex;
  ghost.tint = mesh.tint;
  ghost.alpha = mesh.alpha;
  ghost.eventMode = "none";
  canvas.primary.addChild(ghost);
  canvas.primary.sortDirty = true; // sort it in among the tiles, not on top of everything
  return ghost;
}

function fadeOut(ghost, duration) {
  if (ghost.destroyed) return;
  foundry.canvas.animation.CanvasAnimation.animate([{ parent: ghost, attribute: "alpha", to: 0 }], {
    context: ghost, duration, easing: "easeInOutCosine",
  }).finally(() => {
    // The image belongs to Foundry's texture cache (or the new tile), so it stays.
    if (!ghost.destroyed) ghost.destroy({ texture: false, baseTexture: false });
  });
}
