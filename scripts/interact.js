import { MODULE, PART, FRAME, LAYOUT } from "./constants.js";
import { characterArt, artIndex } from "./art.js";
import { getCast, resolveCast, characterPrefs, setFlip, removeFromCast, addParty, moveEntry, PARTY_LABEL } from "./cast.js";
import { placements } from "./layout.js";
import { canChange, currentExpression, setExpression } from "./expressions.js";
import { getGroup, stageGroup, memberNames, addMember } from "./groups.js";
import { isStage } from "./stage.js";
import { AdjustWindow } from "./adjust.js";
import { StageWindow } from "./window.js";

/**
 * Working on the stage itself. Dragging a portrait moves the character (or The
 * Party) within its side or to the other one. Clicking a portrait opens its character menu:
 * the expressions, and for the GM a row of actions (Flip, Adjust, Remove, Add to
 * group while editing one; for a party member, The Party's sides and Remove
 * party). Players get the expressions of characters they own, nothing else.
 */

const CLICK_MOVE = 6;   // pixels: more than this is a drag, not a click
const CLICK_TIME = 600; // ms
const ALPHA = 0.5;      // transparent parts of a portrait don't count as a click
let press = null;       // the press that started on a portrait: { x, y, t, entry, tile, dragging }
let menu = null;
let hoverFrame = null;

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
  const entry = resolveCast().find((e) => e.id === tile.document.getFlag(MODULE, "castId"));
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
  showMarker(dropTarget(event.clientX, event.clientY, rawId(press.entry)));
}

async function onUp(event) {
  const p = press;
  press = null;
  if (!p || event.button !== 0) return;
  if (p.dragging) {
    const target = dropTarget(event.clientX, event.clientY, rawId(p.entry));
    endDrag(p);
    if (target) await moveEntry(rawId(p.entry), target.side, target.index);
    return;
  }
  if (performance.now() - p.t > CLICK_TIME) return;
  if (canChange(p.entry)) openMenu(p.entry, event.clientX, event.clientY);
}

/** The cast entry a portrait belongs to: a party member moves The Party. */
function rawId(entry) {
  return entry.partyOf ?? entry.id;
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
  // Dim the character (or the whole party) on this screen while it's dragged.
  const id = rawId(press.entry);
  dimmed = canvas.tiles.placeables.filter((t) => {
    const castId = t.document.getFlag(MODULE, "castId");
    return castId === id || castId?.startsWith(`${id}.`);
  });
  for (const t of dimmed) if (t.mesh) t.mesh.alpha = 0.35;
  ghost = document.createElement("div");
  ghost.className = "vn-drag-ghost";
  ghost.textContent = press.entry.partyOf ? PARTY_LABEL : press.entry.name;
  document.body.append(ghost);
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
 * Where a drop at this point would put a character: { side, index, x } (x is
 * where the marker goes, in frame pixels), or null outside the frame. `ignore`
 * is the cast entry being moved, left out of the count.
 */
export function dropTarget(clientX, clientY, ignore = null) {
  const point = canvas.canvasCoordinatesFromClient({ x: clientX, y: clientY });
  const { sceneX = 0, sceneY = 0 } = canvas.dimensions;
  const x = point.x - sceneX, y = point.y - sceneY;
  if (x < 0 || y < 0 || x > FRAME.width || y > FRAME.height) return null;

  // Each cast entry's centre on the stage (The Party's: its members' average).
  const centres = new Map();
  for (const p of placements.values()) {
    const id = p.entry.partyOf ?? p.entry.id;
    if (id === ignore) continue;
    const c = centres.get(id) ?? { side: p.entry.side, sum: 0, n: 0 };
    c.sum += p.box.x + p.box.width / 2;
    c.n += 1;
    centres.set(id, c);
  }
  const order = getCast().filter((e) => e.id !== ignore && centres.has(e.id));
  const sideOf = (s) => order.filter((e) => e.side === s).map((e) => centres.get(e.id).sum / centres.get(e.id).n);
  const left = sideOf("left"), right = sideOf("right");

  // Which side: the gap between the two clusters, or the middle of the usable width.
  const boundary = left.length && right.length
    ? (Math.max(...left) + Math.min(...right)) / 2
    : (FRAME.width * (1 - LAYOUT.sidebar)) / 2;
  const side = x < boundary ? "left" : "right";
  const list = side === "left" ? left : right;
  // Standing order runs from the outer edge: left to right on the left, right to left on the right.
  const inward = side === "left" ? (c) => c < x : (c) => c > x;
  const index = list.filter(inward).length;
  const prev = list[index - 1], next = list[index];
  const gap = 0.06 * FRAME.width * (side === "left" ? 1 : -1);
  const mx = prev !== undefined && next !== undefined ? (prev + next) / 2
    : prev !== undefined ? prev + gap : next !== undefined ? next - gap : x;
  return { side, index, x: mx };
}

/** A vertical line on the GM's screen where a drop would land. */
function showMarker(target) {
  if (!target) return clearMarker();
  if (!marker || marker.destroyed) {
    marker = new PIXI.Graphics();
    marker.eventMode = "none";
    canvas.interface.addChild(marker);
  }
  const { sceneX = 0, sceneY = 0 } = canvas.dimensions;
  marker.clear();
  marker.lineStyle(8, 0xe0a64a, 0.9);
  marker.moveTo(sceneX + target.x, sceneY + 0.4 * FRAME.height);
  marker.lineTo(sceneX + target.x, sceneY + FRAME.height);
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
    hoverLabel.textContent = p.entry.name;
    // Centred above the face (or the top of the image), in screen pixels.
    const { sceneX = 0, sceneY = 0 } = canvas.dimensions;
    const top = p.face ? p.face.y : p.box.y;
    const cx = p.face ? p.face.x + p.face.width / 2 : p.box.x + p.box.width / 2;
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

/* -------------------------------------------- */
/*  The character menu                          */
/* -------------------------------------------- */

async function openMenu(entry, clientX, clientY) {
  closeMenu();
  const art = await characterArt(entry.name);
  const expressions = Object.entries(art?.expressions ?? {});
  const actions = game.user.isGM ? await gmActions(entry) : [];
  if (expressions.length < 2 && !actions.length) return;
  const current = currentExpression(entry);

  const el = document.createElement("div");
  el.className = "vn-character-menu";
  el.setAttribute("role", "menu");
  el.innerHTML = `<div class="vn-menu-name">${esc(entry.name)}</div>`;

  if (expressions.length >= 2) {
    const list = document.createElement("div");
    list.className = "vn-expression-list";
    for (const [key, src] of expressions) {
      const button = menuButton(`vn-expression${key === current ? " current" : ""}`,
        `<span class="vn-expression-face"></span><span class="vn-expression-label">${esc(label(key))}</span>`,
        () => setExpression(entry.id, key));
      faceThumb(button.querySelector(".vn-expression-face"), src, art);
      list.append(button);
    }
    el.append(list);
  }

  if (actions.length) {
    const row = document.createElement("div");
    row.className = "vn-menu-actions";
    for (const a of actions) {
      if (a === "|") {
        row.append(Object.assign(document.createElement("span"), { className: "vn-menu-divider" }));
        continue;
      }
      const button = menuButton(`vn-menu-action${a.active ? " active" : ""}`, `<i class="${a.icon}"></i>`, a.run);
      button.dataset.tooltip = a.label;
      button.setAttribute("aria-label", a.label);
      row.append(button);
    }
    el.append(row);
  }

  document.body.append(el);
  // Beside the pointer, kept on screen.
  const { width, height } = el.getBoundingClientRect();
  el.style.left = `${Math.min(Math.max(8, clientX + 16), window.innerWidth - width - 8)}px`;
  el.style.top = `${Math.min(Math.max(8, clientY - height / 2), window.innerHeight - height - 8)}px`;

  menu = el;
  setTimeout(() => {
    document.addEventListener("pointerdown", onOutside, true);
    document.addEventListener("keydown", onKey, true);
  });
}

/** The GM's row: what this character (or party member) can have done to them. */
async function gmActions(entry) {
  const flip = !!characterPrefs(entry.name).flip;
  const actions = [
    { label: "Flip", icon: "fa-solid fa-left-right", active: flip, run: () => setFlip(entry.name, !flip) },
    { label: "Adjust size and height", icon: "fa-solid fa-sliders", run: () => AdjustWindow.open(entry.id) },
  ];
  const groupId = StageWindow.editingGroup;
  if (groupId && getGroup(groupId)) {
    const members = memberNames(groupId, await artIndex());
    if (!members.includes(entry.name)) {
      actions.push({ label: `Add to ${getGroup(groupId).label}`, icon: "fa-solid fa-user-plus", run: () => addMember(groupId, entry.name) });
    }
  }
  if (entry.partyOf) {
    const side = resolveCast().find((e) => e.id === entry.id)?.side;
    actions.push("|",
      { label: "The Party: left", icon: "fa-solid fa-arrow-left", active: side === "left", run: () => addParty("left") },
      { label: "The Party: right", icon: "fa-solid fa-arrow-right", active: side === "right", run: () => addParty("right") },
      { label: "Remove The Party", icon: "fa-solid fa-users-slash", run: () => removeFromCast(entry.partyOf) });
  } else {
    actions.push("|", { label: "Remove from the stage", icon: "fa-solid fa-xmark", run: () => removeFromCast(entry.id) });
  }
  return actions;
}

function menuButton(className, html, run) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.setAttribute("role", "menuitem");
  button.innerHTML = html;
  button.addEventListener("click", async () => {
    closeMenu();
    await run();
  });
  return button;
}

export function closeMenu() {
  menu?.remove();
  menu = null;
  document.removeEventListener("pointerdown", onOutside, true);
  document.removeEventListener("keydown", onKey, true);
}

function onOutside(event) {
  if (menu && !menu.contains(event.target)) closeMenu();
}

function onKey(event) {
  if (event.key === "Escape") closeMenu();
}

function esc(text) {
  return foundry.utils.escapeHTML(text);
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
