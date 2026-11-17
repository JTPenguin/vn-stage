import { MODULE, FRAME } from "./constants.js";
import { isStage } from "./stage.js";
import { locksView, fitFrame, cssEase, transitionMs } from "./rules.js";

/** The name of the sidebar glide in CanvasAnimation, so a new one replaces it and a re-fit can stop it. */
const GLIDE = `${MODULE}.sidebarGlide`;
/** Foundry's sidebar slide (margin-right 250ms ease), if its style can't be read. */
const SLIDE_MS = 250;

/**
 * Fit every screen to the stage frame. Players can't pan or zoom away from it:
 * their canvas's pan methods are shadowed while a stage is up. The GM is fitted
 * once and stays free to move around and edit, unless they lock their view too.
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
  if (locksView({ isGM: game.user.isGM, gmLock: gmViewLock() })) {
    canvas.pan = function () { return proto.pan.call(this, fitView()); };
    canvas.animatePan = async function () { return proto.pan.call(this, fitView()); };
    unlockView = () => { delete canvas.pan; delete canvas.animatePan; };
    window.addEventListener("resize", refitView);
  }
  proto.pan.call(canvas, fitView());
}

export function stopView() {
  CanvasAnimation.terminateAnimation(GLIDE);
  fitted = false;
  unlockView?.();
  unlockView = null;
  window.removeEventListener("resize", refitView);
}

/** Are the pan methods shadowed right now (a player's view, or a GM's who locked theirs, on a stage)? */
export function viewLocked() {
  return !!unlockView;
}

/** Has this GM chosen to lock their view to the stage? (Players are always locked; this is false for them.) */
export function gmViewLock() {
  return !!game.user?.isGM && !!game.settings.get(MODULE, "gmViewLock");
}

/** Lock or unlock this GM's view (the setting's change re-fits it). Returns the new value. */
export async function toggleGmViewLock() {
  const lock = !gmViewLock();
  await game.settings.set(MODULE, "gmViewLock", lock);
  return lock;
}

/** Jump a locked view to its fit (a window resize, the lock turned on). Stops a sidebar glide first. */
export function refitView() {
  CanvasAnimation.terminateAnimation(GLIDE);
  if (canvas.ready) canvas.pan();
}

/**
 * The sidebar opened or closed: glide a locked view to its new fit while the panel slides,
 * with the slide's length and curve. A second toggle mid-glide starts again from where the view is.
 */
export function glideView() {
  if (!viewLocked() || !canvas.ready) return;
  const to = fitView();
  const content = document.getElementById("sidebar-content");
  const style = content ? getComputedStyle(content) : null;
  const duration = transitionMs("margin-right", style?.transitionProperty, style?.transitionDuration, SLIDE_MS);
  const proto = Object.getPrototypeOf(canvas);
  if (!(duration > 0)) {
    CanvasAnimation.terminateAnimation(GLIDE);
    proto.pan.call(canvas, to);
    return;
  }
  // The pan methods are shadowed to jump, so tween by hand and pan through the prototype.
  const position = { ...canvas.scene._viewPosition };
  CanvasAnimation.animate([
    { parent: position, attribute: "x", to: to.x },
    { parent: position, attribute: "y", to: to.y },
    { parent: position, attribute: "scale", to: to.scale },
  ], {
    name: GLIDE, duration, easing: cssEase,
    ontick: () => proto.pan.call(canvas, position),
  });
}

/**
 * Width of Foundry's sidebar panel on screen once it has finished sliding, or 0 while it is
 * collapsed. The slide moves the panel but never resizes it, and an open panel ends at the
 * window's right edge, so its own width is the answer even mid-slide. The tab strip beside it
 * is left out, so it overlaps the frame like the controls on the left.
 */
function sidebarWidth() {
  const el = ui.sidebar?.expanded ? document.getElementById("sidebar-content") : null;
  const rect = el?.isConnected ? el.getBoundingClientRect() : null;
  return rect?.width > 0 ? rect.width : 0;
}

/** Cover the screen with the frame, or fit it beside an open sidebar (see fitFrame). */
function fitView() {
  const [sw, sh] = canvas.screenDimensions;
  const { sceneX = 0, sceneY = 0 } = canvas.dimensions;
  const { x, y, scale } = fitFrame(sw, sh, sidebarWidth(), FRAME.width, FRAME.height);
  // Foundry clamps the zoom to its minimum, which can sit above the fit beside an open sidebar.
  // canvas.dimensions is rebuilt on every window resize, so this lasts until the next one.
  canvas.dimensions.scale.min = Math.min(canvas.dimensions.scale.min, scale);
  return { x: sceneX + x, y: sceneY + y, scale };
}
