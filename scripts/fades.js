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
 *
 * This leans on Foundry's drawing internals (see the README's update checklist),
 * so every hook is guarded: the first error turns fades off for the session,
 * and changes simply show at once.
 */

const PORTRAIT_MS = 350;
const BACKGROUND_MS = 600;
// Foundry scales a tile's `sort` down by a million (the cast's 100, 99, 98… become 0.000100, 0.000099…), so a stand-in goes half a step above its tile.
const JUST_ABOVE = 5e-7;

const FADES_IN = new Set([PART.PORTRAIT, PART.SHADE]);
const pending = new Set(); // tile ids created, waiting to be drawn
const fadingIn = new Map(); // tile id → current alpha factor
const drawn = new Map();    // tile id → resolve(), for a background waiting for its new image
const ghosts = new Set();   // stand-ins on screen, removed when their fade ends

function part(doc) {
  return doc.getFlag(MODULE, "part");
}

let broken = false; // set by the first error: fades stay off until reload

function reduced() {
  return broken || matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A hook handler that turns fades off instead of throwing, and leaves nothing half faded. */
function guarded(fn) {
  return (...args) => {
    try {
      return fn(...args);
    } catch (err) {
      if (!broken) console.warn("VN Stage | Fades turned off after an error (changes will show at once)", err);
      broken = true;
      pending.clear();
      fadingIn.clear();
      for (const resolve of drawn.values()) resolve();
      drawn.clear();
      for (const g of ghosts) if (!g.destroyed) g.destroy({ texture: false, baseTexture: false });
      ghosts.clear();
      // Anything caught mid-fade goes back to full view.
      for (const t of canvas.tiles?.placeables ?? []) t.renderFlags.set({ refreshState: true });
    }
  };
}

function onStage(doc) {
  return doc.parent?.id === canvas.scene?.id;
}

export function registerFades() {
  Hooks.on("createTile", guarded((doc) => {
    if (onStage(doc) && FADES_IN.has(part(doc)) && !reduced()) pending.add(doc.id);
  }));

  Hooks.on("drawTile", guarded((tile) => {
    const id = tile.document.id;
    drawn.get(id)?.();
    drawn.delete(id);
    if (!pending.delete(id) || !tile.mesh) return;
    tile.mesh.alpha = 0;
    fadeIn(tile);
  }));

  Hooks.on("refreshTile", guarded((tile) => {
    const f = fadingIn.get(tile.document.id);
    if (f !== undefined && tile.mesh) tile.mesh.alpha *= f;
  }));

  Hooks.on("deleteTile", guarded((doc) => {
    pending.delete(doc.id);
    fadingIn.delete(doc.id);
    // A form-switch ghost waiting for this tile to redraw never gets its turn (the tile is gone): let it fade now.
    drawn.get(doc.id)?.();
    drawn.delete(doc.id);
    const mesh = doc.object?.mesh;
    if (!mesh || !FADES_IN.has(part(doc)) || reduced()) return;
    fadeOut(ghostOf(mesh), PORTRAIT_MS);
  }));

  // A background change, or a portrait's new form: the old image stays on top until the new one is drawn, then fades away.
  Hooks.on("updateTile", guarded((doc, changes) => {
    if (!foundry.utils.hasProperty(changes, "texture.src") || reduced()) return;
    const background = part(doc) === PART.BACKGROUND;
    const newForm = part(doc) === PART.PORTRAIT && foundry.utils.hasProperty(changes, `flags.${MODULE}.key`);
    if (!background && !newForm) return;
    const mesh = doc.object?.mesh;
    if (!mesh?.texture || mesh.texture === PIXI.Texture.EMPTY) return;
    const ghost = ghostOf(mesh, JUST_ABOVE);
    const ready = new Promise((resolve) => {
      drawn.set(doc.id, resolve);
      setTimeout(resolve, 5000); // never leave the old image up if the new one fails to load
    });
    ready.then(guarded(() => fadeOut(ghost, background ? BACKGROUND_MS : PORTRAIT_MS)));
  }));

  Hooks.on("canvasTearDown", () => {
    pending.clear();
    fadingIn.clear();
    drawn.clear();
    ghosts.clear(); // the canvas destroys them with everything else
  });
}

function fadeIn(tile) {
  const id = tile.document.id;
  const state = { f: 0 };
  fadingIn.set(id, 0);
  const tick = guarded(() => {
    if (tile.destroyed || broken) return;
    fadingIn.set(id, state.f);
    tile.renderFlags.set({ refreshState: true });
  });
  foundry.canvas.animation.CanvasAnimation.animate([{ parent: state, attribute: "f", to: 1 }], {
    name: `${MODULE}.fadeIn.${id}`, duration: PORTRAIT_MS, easing: "easeInOutCosine", ontick: tick,
  }).finally(() => {
    fadingIn.delete(id);
    if (!tile.destroyed) tile.renderFlags.set({ refreshState: true });
  });
}

/** A stand-in for a mesh that's about to go: same image, place and depth (`sortBump` puts it just above, in Foundry's scaled sort units). */
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
  ghosts.add(ghost);
  return ghost;
}

function fadeOut(ghost, duration) {
  if (ghost.destroyed) return;
  foundry.canvas.animation.CanvasAnimation.animate([{ parent: ghost, attribute: "alpha", to: 0 }], {
    context: ghost, duration, easing: "easeInOutCosine",
  }).finally(() => {
    // The image belongs to Foundry's texture cache (or the new tile), so it stays.
    ghosts.delete(ghost);
    if (!ghost.destroyed) ghost.destroy({ texture: false, baseTexture: false });
  });
}
