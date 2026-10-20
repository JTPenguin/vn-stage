import { FRAME } from "./constants.js";
import { isStage } from "./stage.js";

/**
 * Fit every screen to the stage frame. Players can't pan or zoom away from it:
 * their canvas's pan methods are shadowed while a stage is up. The GM is fitted
 * once and stays free to move around and edit.
 */
let unlockView = null;
let fitted = false;

/** Is this screen currently fitted to a stage? */
export function viewFitted() {
  return fitted;
}

export function startView() {
  stopView();
  if (!isStage()) return;
  fitted = true;
  const proto = Object.getPrototypeOf(canvas);
  if (!game.user.isGM) {
    canvas.pan = function () { return proto.pan.call(this, fitView()); };
    canvas.animatePan = async function () { return proto.pan.call(this, fitView()); };
    unlockView = () => { delete canvas.pan; delete canvas.animatePan; };
    window.addEventListener("resize", refit);
  }
  proto.pan.call(canvas, fitView());
}

export function stopView() {
  fitted = false;
  unlockView?.();
  unlockView = null;
  window.removeEventListener("resize", refit);
}

export function viewLocked() {
  return !!unlockView;
}

function refit() {
  if (canvas.ready) canvas.pan();
}

/** Cover the screen with the frame, centred. */
function fitView() {
  const [sw, sh] = canvas.screenDimensions;
  const { sceneX = 0, sceneY = 0 } = canvas.dimensions;
  const scale = Math.max(sw / FRAME.width, sh / FRAME.height);
  return { x: sceneX + FRAME.width / 2, y: sceneY + FRAME.height / 2, scale };
}
