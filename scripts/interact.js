import { MODULE, PART, FRAME, faceGuide } from "./constants.js";
import { getCast, moveEntry, displayName } from "./cast.js";
import { placements } from "./layout.js";
import { canChange } from "./expressions.js";
import { isStage } from "./stage.js";
import { dropSlot, castWithout } from "./rules.js";
import { openMenu, closeMenu } from "./menu.js";

/**
 * Working on the stage itself. Dragging a portrait moves the character within
 * its cluster, to another one or into a new one (GM); clicking one opens its character menu
 * (menu.js) for anyone who may change it, double-clicking opens its character sheet; hovering shows the GM its name.
 */

const CLICK_MOVE = 6;   // pixels: more than this is a drag, not a click
const CLICK_TIME = 600; // ms
const DOUBLE_TIME = 400; // ms between two clicks on the same portrait
const ALPHA = 0.5;      // transparent parts of a portrait don't count as a click
let press = null;       // the press that started on a portrait: { x, y, t, entry, tile, dragging }
let hoverFrame = null;
let lastClick = null;   // the previous click on a portrait: { id, t }

/*
 * Foundry's canvas library listens for presses on the canvas in the capture
 * phase. Ours sits on the window, which comes first, so a press that starts on a
 * portrait is ours alone: Foundry never starts its own selection box or drag.
 * Presses anywhere else behave as normal.
 */
export function startClicks() {
  window.addEventListener("pointerdown", onDown, true);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("keydown", onDragKey, true);
  canvas.app?.view?.addEventListener("dragover", onDragOver);
  canvas.app?.view?.addEventListener("dragleave", clearMarker);
  canvas.app?.view?.addEventListener("pointerleave", clearHover);
}

export function stopClicks() {
  window.removeEventListener("pointerdown", onDown, true);
  window.removeEventListener("pointermove", onMove);
  window.removeEventListener("pointerup", onUp);
  window.removeEventListener("keydown", onDragKey, true);
  canvas.app?.view?.removeEventListener("dragover", onDragOver);
  canvas.app?.view?.removeEventListener("dragleave", clearMarker);
  canvas.app?.view?.removeEventListener("pointerleave", clearHover);
  cancelDrag();
  clearHover();
  closeMenu();
}

function onDown(event) {
  if (event.button !== 0 || event.target !== canvas.app?.view || !isStage()) return;
  const tile = portraitAt(event.clientX, event.clientY);
  if (!tile) return closeMenu();
  const entry = getCast().find((e) => e.id === tile.document.getFlag(MODULE, "castId"));
  if (!entry) return;
  event.stopImmediatePropagation();
  event.preventDefault();
  press = { x: event.clientX, y: event.clientY, t: performance.now(), entry, tile, dragging: false };
}

function onMove(event) {
  if (!press) return hover(event);
  if (!game.user.isGM) return;
  if (!press.dragging) {
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) <= CLICK_MOVE) return;
    startDrag();
  }
  moveGhost(event.clientX, event.clientY);
  showMarker(dropTarget(event.clientX, event.clientY, press.entry.id));
}

async function onUp(event) {
  const p = press;
  press = null;
  if (!p || event.button !== 0) return;
  if (p.dragging) {
    const target = dropTarget(event.clientX, event.clientY, p.entry.id);
    endDrag(p);
    if (target) await moveEntry(p.entry.id, target);
    return;
  }
  if (performance.now() - p.t > CLICK_TIME) return;
  const now = performance.now();
  if (lastClick?.id === p.entry.id && now - lastClick.t < DOUBLE_TIME) {
    lastClick = null;
    closeMenu();
    return openSheet(p.entry);
  }
  lastClick = { id: p.entry.id, t: now };
  if (canChange(p.entry)) openMenu(p.entry, event.clientX, event.clientY);
}

/** Double-clicking a portrait opens the character sheet of its actor, for anyone who may see it. */
async function openSheet(entry) {
  const actor = entry.actorUuid ? await fromUuid(entry.actorUuid) : null;
  if (actor?.testUserPermission(game.user, "LIMITED")) actor.sheet.render(true);
}

/** The front-most portrait whose visible pixels are under the pointer. */
export function portraitAt(clientX, clientY) {
  const point = canvas.canvasCoordinatesFromClient({ x: clientX, y: clientY });
  const portraits = canvas.tiles.placeables
    .filter((t) => t.document.getFlag(MODULE, "part") === PART.PORTRAIT && t.mesh && !t.document.hidden)
    .sort((a, b) => b.document.sort - a.document.sort);
  return portraits.find((t) => t.mesh.containsCanvasPoint(point, ALPHA)) ?? null;
}

/* -------------------------------------------- */
/*  Dragging to move (GM, drawing only)         */
/* -------------------------------------------- */

let ghost = null;
let marker = null;
let dimmed = [];

function startDrag() {
  press.dragging = true;
  closeMenu();
  clearHover();
  ghost = document.createElement("div");
  ghost.className = "vn-drag-ghost";
  document.body.append(ghost);
  showMoving();
}

/** Dim the character being moved, on this screen. */
function showMoving() {
  const id = press.entry.id;
  dimmed = canvas.tiles.placeables.filter((t) => t.document.getFlag(MODULE, "castId") === id);
  for (const t of dimmed) if (t.mesh) t.mesh.alpha = 0.35;
  ghost.textContent = displayName(press.entry);
}

function moveGhost(x, y) {
  if (ghost) Object.assign(ghost.style, { left: `${x + 14}px`, top: `${y + 14}px` });
}

function endDrag() {
  for (const t of dimmed) if (!t.destroyed) t.renderFlags.set({ refreshState: true }); // Foundry resets the alpha
  dimmed = [];
  ghost?.remove();
  ghost = null;
  clearMarker();
}

function cancelDrag() {
  if (press?.dragging) endDrag();
  press = null;
}

function onDragKey(event) {
  if (event.key === "Escape" && press?.dragging) {
    event.stopPropagation();
    cancelDrag();
  }
}

/**
 * Where a drop at this point would put a character: { cluster, index,
 * newCluster, x, kind, dir }, or null outside the frame. The first three are
 * what moveEntry takes, counted without whoever is moved; x is where the marker
 * goes, in frame pixels. `kind` is "same" (staying in their cluster, or joining
 * one from outside the stage), "other" (into another cluster, `dir` -1 or 1
 * pointing there) or "new" (starting a cluster). `ignore` is the cast entry
 * being moved (or a list of them, for the party).
 */
export function dropTarget(clientX, clientY, ignore = null) {
  const point = canvas.canvasCoordinatesFromClient({ x: clientX, y: clientY });
  const { sceneX = 0, sceneY = 0 } = canvas.dimensions;
  const x = point.x - sceneX, y = point.y - sceneY;
  if (x < 0 || y < 0 || x > FRAME.width || y > FRAME.height) return null;

  // Each character's centre on the stage, by cluster, counted without whoever is moved (as the move is).
  const skip = new Set([ignore ?? []].flat());
  const centreOf = new Map([...placements.values()].map((p) => [p.entry.id, p.box.x + p.box.width / 2]));
  const cast = getCast();
  const clusters = [];
  for (const e of castWithout(cast, [...skip])) {
    if (centreOf.has(e.id)) (clusters[e.cluster] ??= []).push(centreOf.get(e.id));
  }
  const slot = dropSlot(x, clusters.filter(Boolean), FRAME.width);

  // Back where they stand (a lone character's cluster goes while they're moved, so a new one in its place is the same).
  const moving = cast.filter((e) => skip.has(e.id));
  const from = moving[0]?.cluster;
  const together = moving.length > 0 && moving.every((e) => e.cluster === from);
  const alone = together && !cast.some((e) => e.cluster === from && !skip.has(e.id));
  const same = !moving.length ? !slot.newCluster
    : together && slot.cluster === from && slot.newCluster === alone;
  const kind = same ? "same" : slot.newCluster ? "new" : "other";
  const now = moving.map((e) => centreOf.get(e.id)).filter((c) => c !== undefined);
  const dir = now.length && slot.x < now.reduce((a, b) => a + b, 0) / now.length ? -1 : 1;
  return { ...slot, kind, dir };
}

/**
 * A vertical line on the GM's screen where a drop would land: solid within the
 * same cluster, dashed with an arrow into another, dashed with a "+" for a new one.
 */
function showMarker(target) {
  if (!target) return clearMarker();
  if (!marker || marker.destroyed) {
    marker = new PIXI.Graphics();
    marker.eventMode = "none";
    canvas.interface.addChild(marker);
  }
  const { sceneX = 0, sceneY = 0 } = canvas.dimensions;
  marker.clear();
  const top = sceneY + 0.4 * FRAME.height, bottom = sceneY + FRAME.height;
  const mx = sceneX + target.x;
  marker.lineStyle(8, 0xe0a64a, 0.9);
  if (target.kind === "same") {
    marker.moveTo(mx, top);
    marker.lineTo(mx, bottom);
    return;
  }
  const dash = 36, space = 24, head = 44;
  for (let y = top; y < bottom; y += dash + space) {
    marker.moveTo(mx, y);
    marker.lineTo(mx, Math.min(y + dash, bottom));
  }
  if (target.kind === "new") {
    // A new cluster: a "+" above the line.
    marker.moveTo(mx - head * 0.6, top - head);
    marker.lineTo(mx + head * 0.6, top - head);
    marker.moveTo(mx, top - head * 1.6);
    marker.lineTo(mx, top - head * 0.4);
    return;
  }
  // Into another cluster: an arrow at the top pointing the way they go.
  const dir = target.dir;
  marker.moveTo(mx - dir * head * 0.6, top - head);
  marker.lineTo(mx + dir * head * 0.6, top);
  marker.lineTo(mx - dir * head * 0.6, top + head);
}

function clearMarker() {
  if (marker && !marker.destroyed) marker.destroy();
  marker = null;
}

/** Something dragged over the stage from outside (a Cast row, an actor): show where it would land. */
function onDragOver(event) {
  if (!game.user.isGM || !isStage()) return;
  showMarker(dropTarget(event.clientX, event.clientY, draggingFromWindow?.ignore ?? null));
}

/** Set by the Stage window while one of its Cast rows is dragged. */
export let draggingFromWindow = null;
export function setWindowDrag(value) {
  draggingFromWindow = value;
  if (!value) clearMarker();
}

/* -------------------------------------------- */
/*  Hover: the name above the head (GM only)    */
/* -------------------------------------------- */

let hoverLabel = null;

function hover(event) {
  if (!game.user.isGM || event.target !== canvas.app?.view || !isStage()) return clearHover();
  if (hoverFrame) return;
  const { clientX, clientY } = event;
  hoverFrame = requestAnimationFrame(() => {
    hoverFrame = null;
    const tile = portraitAt(clientX, clientY);
    const p = tile && placements.get(tile.document.getFlag(MODULE, "castId"));
    if (!p) return clearHover();
    canvas.app.view.style.cursor = "pointer";
    hoverLabel ??= Object.assign(document.createElement("div"), { className: "vn-hover-name" });
    if (!hoverLabel.isConnected) document.body.append(hoverLabel);
    hoverLabel.textContent = displayName(p.entry);
    // Centred above the top of the face guide (or the top of the image, without art), in screen pixels.
    const { sceneX = 0, sceneY = 0 } = canvas.dimensions;
    const top = p.fallback ? p.box.y : faceGuide(p.size.scale, p.zoom).top * FRAME.height;
    const cx = p.box.x + p.box.width / 2;
    const screen = canvas.stage.worldTransform.apply({ x: sceneX + cx, y: sceneY + top });
    Object.assign(hoverLabel.style, { left: `${screen.x}px`, top: `${screen.y - 8}px` });
  });
}

function clearHover() {
  if (hoverFrame) cancelAnimationFrame(hoverFrame);
  hoverFrame = null;
  hoverLabel?.remove();
  if (canvas.app?.view) canvas.app.view.style.cursor = "";
}
