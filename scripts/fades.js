import { MODULE, PART } from "./constants.js";
import { tweenBox, sameBox, snapsBox } from "./rules.js";

/**
 * Fades and moves, drawn by every screen for itself; no document changes. A
 * portrait (or the bottom shade) fades in when its tile is created and out when
 * it's deleted; a new background crossfades over the old one, and so does a
 * portrait switching form (its tile's `key` flag changes). Expression changes
 * stay instant. Loading a preset replaces the whole cast, so it crossfades too.
 * Off for viewers who ask their system for reduced motion.
 *
 * Fading in: the tile is drawn as usual, and `refreshTile` scales its mesh's
 * alpha by a factor that rises to 1. Fading out: Foundry is about to destroy the
 * mesh when `deleteTile` runs, so a copy of it takes its place and fades away.
 *
 * Moving: when a portrait or shade tile's place or size changes, `refreshTile`
 * (right after Foundry has jumped the mesh to the new box) puts the mesh back
 * where it was and slides it to the new box. Only `tile.mesh` is written, so a
 * filter on it moves with it. Changes from the Adjust window come with the
 * update option `{ [MODULE]: { instant: true } }` (layout.js) and jump instead:
 * Adjust is for setting up, not for moves in play.
 *
 * This leans on Foundry's drawing internals (see the README's update checklist),
 * so every hook is guarded: the first error turns fades and moves off for the session,
 * and changes simply show at once.
 */

const PORTRAIT_MS = 350;
const BACKGROUND_MS = 600;
const MOVE_MS = 400;
// Foundry scales a tile's `sort` down by a million (the cast's 100, 99, 98… become 0.000100, 0.000099…), so a stand-in goes half a step above its tile.
const JUST_ABOVE = 5e-7;

const FADES_IN = new Set([PART.PORTRAIT, PART.SHADE]);
const pending = new Set(); // tile ids created, waiting to be drawn
const fadingIn = new Map(); // tile id → current alpha factor
const drawn = new Map();    // tile id → resolve(), for a background waiting for its new image
const ghosts = new Set();   // stand-ins on screen, removed when their fade ends

const MOVES = new Set([PART.PORTRAIT, PART.SHADE]);
const shown = new Map();  // tile id → the box on screen, { x, y, w, h }: centre and size in canvas pixels
const moving = new Map(); // tile id → the box it's moving to
const snaps = new Set();  // tile ids whose next change of box jumps (sent as instant)

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
      if (!broken) console.warn("VN Stage | Fades and moves turned off after an error (changes will show at once)", err);
      broken = true;
      pending.clear();
      fadingIn.clear();
      for (const resolve of drawn.values()) resolve();
      drawn.clear();
      for (const g of ghosts) if (!g.destroyed) g.destroy({ texture: false, baseTexture: false });
      ghosts.clear();
      endMoves();
      shown.clear();
      snaps.clear();
      // Anything caught mid-fade or mid-move goes back to full view, where its document says.
      for (const t of canvas.tiles?.placeables ?? []) t.renderFlags.set({ refreshState: true, refreshTransform: true });
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

  // Foundry has just put the mesh at the document's box: from the box on screen, slide there instead.
  Hooks.on("refreshTile", guarded((tile, flags) => {
    const id = tile.document.id;
    if (!MOVES.has(part(tile.document)) || !tile.mesh) return;
    const boxChanged = flags.refreshPosition || flags.refreshSize;
    if (!boxChanged && !moving.has(id)) return;
    const { x, y, width: w, height: h } = tile.document;
    const target = { x, y, w, h };
    const from = shown.get(id);
    // Not drawn before (it fades in where it stands), sent as instant, or no motion wanted: jump.
    if ((boxChanged && snaps.delete(id)) || !from || reduced()) {
      if (endMove(id)) apply(tile, target);
      shown.set(id, target);
      return;
    }
    const goal = moving.get(id) ?? from;
    if (sameBox(goal, target)) {
      // The same move goes on (a redraw or flip mid-move): keep the box on screen.
      if (moving.has(id)) apply(tile, from);
      return;
    }
    move(tile, from, target, moving.has(id));
    apply(tile, from);
  }));

  // An update sent as instant (Adjust) arrives on every screen before the tile's refresh.
  Hooks.on("updateTile", guarded((doc, changes, options) => {
    if (MOVES.has(part(doc)) && snapsBox(changes, options?.[MODULE]?.instant)) snaps.add(doc.id);
  }));

  Hooks.on("deleteTile", guarded((doc) => {
    endMove(doc.id);
    shown.delete(doc.id);
    snaps.delete(doc.id);
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
    endMoves();
    shown.clear();
    snaps.clear();
  });
}

/** Slide a tile's mesh from one box to another. A move that replaces one under way eases out, so it doesn't stall first. */
function move(tile, from, to, retarget) {
  const id = tile.document.id;
  const state = { p: 0 };
  moving.set(id, to);
  const tick = guarded(() => {
    if (tile.destroyed || broken) return;
    const box = tweenBox(from, to, state.p);
    shown.set(id, box);
    apply(tile, box);
  });
  foundry.canvas.animation.CanvasAnimation.animate([{ parent: state, attribute: "p", to: 1 }], {
    name: `${MODULE}.move.${id}`, duration: MOVE_MS, ontick: tick,
    easing: retarget ? (t) => 1 - (1 - t) ** 2 : "easeInOutCosine",
  }).then((done) => {
    // Ended early or replaced by a newer move: that one owns the stores now.
    if (!done) return;
    moving.delete(id);
    shown.set(id, to);
  });
}

/** Stop a tile's move where it is; true if one was under way. */
function endMove(id) {
  if (!moving.delete(id)) return false;
  foundry.canvas.animation.CanvasAnimation.terminateAnimation(`${MODULE}.move.${id}`);
  return true;
}

function endMoves() {
  for (const id of [...moving.keys()]) endMove(id);
}

/** Show a tile's mesh at a box, as Foundry's `_refreshPosition` and `_refreshSize` would. Skipped while a redraw has no image yet. */
function apply(tile, box) {
  const mesh = tile.mesh;
  if (!mesh || mesh.destroyed || mesh.texture === PIXI.Texture.EMPTY) return;
  const { fit, scaleX, scaleY } = tile.document.texture;
  mesh.position.set(box.x, box.y);
  mesh.resize(box.w, box.h, { fit, scaleX, scaleY });
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
