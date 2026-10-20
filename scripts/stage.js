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
  if (tile) return tile.update({ "texture.src": src });

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
    flags: { [MODULE]: { part: PART.BACKGROUND } },
  }]);
  return doc;
}
