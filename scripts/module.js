/**
 * VN Stage: visual-novel scenes on a native Foundry scene.
 *
 * GM actions write tiles and flags, which Foundry syncs to everyone.
 * Every client fits its view to the stage frame; players' view is locked.
 */
import { MODULE } from "./constants.js";
import { registerSettings } from "./settings.js";
import { isStage, makeStage, unmakeStage, setBackground, currentBackground } from "./stage.js";
import { startView, stopView, viewLocked } from "./view.js";

Hooks.once("init", () => {
  registerSettings();
  const api = { isStage, makeStage, unmakeStage, setBackground, currentBackground, status };
  game.modules.get(MODULE).api = api;
  globalThis.VNStage = api;
});

Hooks.on("canvasReady", () => startView());
Hooks.on("canvasTearDown", () => stopView());

// Stage flag added, changed or removed on the scene being viewed.
Hooks.on("updateScene", (scene, changes) => {
  if (scene.id !== canvas.scene?.id) return;
  if (foundry.utils.hasProperty(changes, `flags.${MODULE}`)) startView();
});

/** For the console during testing. */
function status() {
  return {
    scene: canvas.scene?.name,
    stage: isStage(),
    background: currentBackground(),
    viewLocked: viewLocked(),
    view: { x: canvas.stage.pivot.x, y: canvas.stage.pivot.y, scale: canvas.stage.scale.x },
  };
}
