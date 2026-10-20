import { MODULE, PART } from "./constants.js";
import { characterArt } from "./art.js";
import { getCast, resolveCast } from "./cast.js";
import { layout } from "./layout.js";
import { isStage } from "./stage.js";

/**
 * Expressions. A character linked to an actor keeps theirs on the actor (a flag),
 * so it follows them to every stage and the actor's owners can change it: players
 * can't edit tiles, but they can edit their own actor. The active GM's screen sees
 * the change and re-lays out the stage. A character without an actor keeps it on
 * its cast entry (GM only). "neutral" is the portrait itself.
 */

export const NEUTRAL = "neutral";

/** The expression a cast entry shows. */
export function currentExpression(entry) {
  const actor = entry.actorUuid ? fromUuidSync(entry.actorUuid) : null;
  return (actor ? actor.getFlag(MODULE, "expression") : entry.expression) || NEUTRAL;
}

/** Can this user change the entry's expression? */
export function canChange(entry, user = game.user) {
  if (user.isGM) return true;
  const actor = entry.actorUuid ? fromUuidSync(entry.actorUuid) : null;
  return !!actor?.testUserPermission(user, "OWNER");
}

export async function setExpression(castId, key, { scene = canvas.scene } = {}) {
  const entry = resolveCast(scene).find((e) => e.id === castId);
  if (!entry || !canChange(entry)) return;
  const actor = entry.actorUuid ? fromUuidSync(entry.actorUuid) : null;
  if (actor) {
    if (key === NEUTRAL) return actor.unsetFlag(MODULE, "expression");
    return actor.setFlag(MODULE, "expression", key);
  }
  if (!game.user.isGM) return;
  const cast = getCast(scene);
  const raw = cast.find((e) => e.id === castId);
  if (!raw) return;
  if (key === NEUTRAL) delete raw.expression;
  else raw.expression = key;
  await scene.setFlag(MODULE, "cast", cast);
  return layout(scene);
}

/** Everyone back to neutral: every actor's saved expression and every stage's cast entries. GM only. */
export async function resetAllExpressions() {
  if (!game.user.isGM) return;
  for (const actor of game.actors) {
    if (actor.getFlag(MODULE, "expression")) await actor.unsetFlag(MODULE, "expression");
  }
  for (const scene of game.scenes) {
    if (!isStage(scene)) continue;
    const cast = getCast(scene);
    if (!cast.some((e) => e.expression)) continue;
    for (const e of cast) delete e.expression;
    await scene.setFlag(MODULE, "cast", cast);
  }
  await layout(canvas.scene);
  ui.notifications.info("VN Stage | Everyone is back to neutral.");
}

/** Only one GM relays players' changes, so two GMs never write the same tiles. */
export function isRelayGM() {
  return game.user.isGM && (game.users.activeGM ?? game.user) === game.user;
}

/** Load every expression of everyone on the stage, so a change shows at once. Every screen. */
export async function preloadStage(scene = canvas.scene) {
  if (!isStage(scene)) return;
  const srcs = [];
  for (const e of resolveCast(scene)) {
    const art = await characterArt(e.name);
    if (art) srcs.push(...Object.values(art.expressions));
  }
  await Promise.all(srcs.map((src) => foundry.canvas.loadTexture(src).catch(() => null)));
}

/* -------------------------------------------- */
/*  Clicking a portrait: the expression strip   */
/* -------------------------------------------- */

const CLICK_MOVE = 6;   // pixels: more than this is a drag, not a click
const CLICK_TIME = 600; // ms
const ALPHA = 0.5;      // transparent parts of a portrait don't count as a click
let down = null;
let strip = null;

export function startClicks() {
  const view = canvas.app?.view;
  if (!view) return;
  view.addEventListener("pointerdown", onDown);
  view.addEventListener("pointerup", onUp);
}

export function stopClicks() {
  const view = canvas.app?.view;
  view?.removeEventListener("pointerdown", onDown);
  view?.removeEventListener("pointerup", onUp);
  closeStrip();
}

function onDown(event) {
  down = event.button === 0 ? { x: event.clientX, y: event.clientY, t: performance.now() } : null;
}

function onUp(event) {
  const start = down;
  down = null;
  if (!start || event.button !== 0 || !isStage()) return;
  if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_MOVE) return;
  if (performance.now() - start.t > CLICK_TIME) return;
  const tile = portraitAt(event.clientX, event.clientY);
  if (!tile) return closeStrip();
  const entry = resolveCast().find((e) => e.id === tile.document.getFlag(MODULE, "castId"));
  if (entry && canChange(entry)) openStrip(entry, event.clientX, event.clientY);
}

/** The front-most portrait whose visible pixels are under the pointer. */
function portraitAt(clientX, clientY) {
  const point = canvas.canvasCoordinatesFromClient({ x: clientX, y: clientY });
  const portraits = canvas.tiles.placeables
    .filter((t) => t.document.getFlag(MODULE, "part") === PART.PORTRAIT && t.mesh && !t.document.hidden)
    .sort((a, b) => b.document.sort - a.document.sort);
  return portraits.find((t) => t.mesh.containsCanvasPoint(point, ALPHA)) ?? null;
}

async function openStrip(entry, clientX, clientY) {
  closeStrip();
  const art = await characterArt(entry.name);
  if (!art || Object.keys(art.expressions).length < 2) return;
  const current = currentExpression(entry);

  const el = document.createElement("div");
  el.className = "vn-expression-strip";
  el.setAttribute("role", "menu");
  el.innerHTML = `<div class="vn-expression-name">${foundry.utils.escapeHTML(entry.name)}</div><div class="vn-expression-list"></div>`;
  const list = el.querySelector(".vn-expression-list");
  for (const [key, src] of Object.entries(art.expressions)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `vn-expression${key === current ? " current" : ""}`;
    button.dataset.key = key;
    button.setAttribute("role", "menuitem");
    button.innerHTML = `<span class="vn-expression-face"></span><span class="vn-expression-label">${foundry.utils.escapeHTML(label(key))}</span>`;
    faceThumb(button.querySelector(".vn-expression-face"), src, art);
    button.addEventListener("click", async () => {
      closeStrip();
      await setExpression(entry.id, key);
    });
    list.append(button);
  }
  document.body.append(el);

  // Beside the pointer, kept on screen.
  const { width, height } = el.getBoundingClientRect();
  const x = Math.min(Math.max(8, clientX + 16), window.innerWidth - width - 8);
  const y = Math.min(Math.max(8, clientY - height / 2), window.innerHeight - height - 8);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  strip = el;
  setTimeout(() => {
    document.addEventListener("pointerdown", onOutside, true);
    document.addEventListener("keydown", onKey, true);
  });
}

export function closeStrip() {
  strip?.remove();
  strip = null;
  document.removeEventListener("pointerdown", onOutside, true);
  document.removeEventListener("keydown", onKey, true);
}

function onOutside(event) {
  if (strip && !strip.contains(event.target)) closeStrip();
}

function onKey(event) {
  if (event.key === "Escape") closeStrip();
}

function label(key) {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * A head-and-shoulders thumbnail: the face box (the same in every expression,
 * since they're painted on the portrait) zoomed into a square.
 */
function faceThumb(el, src, art) {
  const size = 60; // matches .vn-expression-face
  el.style.backgroundImage = `url("${encodeURI(src)}")`;
  const [fw, fh] = art.frame ?? [960, 1440];
  const box = art.faceBox;
  if (!box) {
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center top";
    return;
  }
  const [x, y, w, h] = box;
  const side = Math.max(w, h) * 1.8;
  const cx = x + w / 2, cy = y + h / 2;
  const k = size / side;
  el.style.backgroundSize = `${fw * k}px ${fh * k}px`;
  el.style.backgroundPosition = `${-(cx - side / 2) * k}px ${-(cy - side / 2) * k}px`;
}
