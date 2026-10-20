import { MODULE, PART } from "./constants.js";
import { characterArt, artIndex } from "./art.js";
import { resolveCast, characterPrefs, setFlip, removeFromCast, addParty } from "./cast.js";
import { canChange, currentExpression, setExpression } from "./expressions.js";
import { getGroup, stageGroup, memberNames, addMember } from "./groups.js";
import { isStage } from "./stage.js";
import { AdjustWindow } from "./adjust.js";
import { StageWindow } from "./window.js";

/**
 * Working on the stage itself. Clicking a portrait opens its character menu:
 * the expressions, and for the GM a row of actions (Flip, Adjust, Remove, Add to
 * group while editing one; for a party member, The Party's sides and Remove
 * party). Players get the expressions of characters they own, nothing else.
 */

const CLICK_MOVE = 6;   // pixels: more than this is a drag, not a click
const CLICK_TIME = 600; // ms
const ALPHA = 0.5;      // transparent parts of a portrait don't count as a click
let down = null;
let menu = null;

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
  closeMenu();
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
  if (!tile) return closeMenu();
  const entry = resolveCast().find((e) => e.id === tile.document.getFlag(MODULE, "castId"));
  if (entry && canChange(entry)) openMenu(entry, event.clientX, event.clientY);
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
      { label: "The Party: whole width", icon: "fa-solid fa-arrows-left-right-to-line", active: side === "full", run: () => addParty("full") },
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
