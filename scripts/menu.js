import { characterArt, artKeyOf, baseArtKeyOf, prefsKeyOf, formsFor, lockedForms } from "./art.js";
import { visibleForms } from "./rules.js";
import { ArtPicker } from "./art-picker.js";
import { characterPrefs, setFlip, removeFromCast, displayName } from "./cast.js";
import { currentExpression, chooseExpression, chooseForm, setFormLocked, offstageEntry } from "./expressions.js";
import { AdjustWindow } from "./adjust.js";
import { TagEditor } from "./tag-editor.js";

/**
 * The character menu: clicking a portrait on the stage (interact.js), or
 * right-clicking a Cast row (the Stage window). The character's forms (when it
 * has more than one), its expressions, and for the GM a row of actions (Flip,
 * Adjust, VN art…, Tags…, Remove). The GM locks or opens a form by
 * right-clicking it; players don't see locked forms. Players get the forms and expressions of
 * characters they own, nothing else. Off stage, the forms and expressions
 * they'll arrive with, plus Flip and Tags….
 */

let menu = null;
let lockWrite = Promise.resolve(); // lock writes go one at a time, so each reads the flag after the last landed
let closes = 0; // counts closeMenu calls, so a menu still being built when it's closed isn't shown

/* -------------------------------------------- */
/*  The character menu                          */
/* -------------------------------------------- */

/**
 * The character menu for a Cast row (GM). On stage, the same menu as clicking
 * the portrait. Off stage, the forms and expressions they'll arrive with, plus
 * Flip and Tags….
 */
export function openCastMenu(row, clientX, clientY) {
  return openMenu(row.entry ?? offstageEntry(row.name, row.actorUuid), clientX, clientY);
}

/**
 * `entry` is the cast entry on stage, or a stand-in for a character who isn't
 * (`offstage`). The menu works on the form shown (its expressions, Flip,
 * Adjust); Tags… always works on the character.
 */
export async function openMenu(entry, clientX, clientY) {
  closeMenu();
  const mine = closes;
  const onStage = !entry.offstage;
  const key = (await artKeyOf(entry)) ?? entry.name;
  const baseKey = (await baseArtKeyOf(entry)) ?? entry.name;
  const art = await characterArt(key);
  const expressions = Object.keys(art?.expressions ?? {});
  const locked = lockedForms(entry);
  const forms = visibleForms(await formsFor(key), locked, { isGM: game.user.isGM });
  const name = entry.actorUuid ? displayName(entry) : (await characterArt(baseKey))?.label ?? entry.name;
  const actions = game.user.isGM ? await gmActions(onStage ? entry : null, await prefsKeyOf(entry), baseKey) : [];
  if (expressions.length < 2 && !forms.some((f) => f.key !== key) && !actions.length) return;
  const current = currentExpression(entry);
  if (mine !== closes) return;

  const el = document.createElement("div");
  el.className = "vn-character-menu";
  el.setAttribute("role", "menu");
  el.innerHTML = `<div class="vn-menu-name">${esc(name)}${onStage ? "" : ' <span class="vn-menu-note">· arrives like this</span>'}</div>`;

  // Shown while there's an open form besides the current one.
  if (forms.some((f) => f.key !== key)) {
    const list = document.createElement("div");
    list.className = "vn-form-list";
    for (const f of forms) {
      const button = menuButton(`vn-form${f.key === key ? " current" : ""}`,
        `<img src="${esc(encodeURI(f.thumb))}" alt=""><span class="vn-form-label">${esc(f.label)}</span>`,
        () => chooseForm(entry, f.key));
      button.dataset.tooltip = f.label;
      if (game.user.isGM && entry.actorUuid) lockable(button, entry.actorUuid, f.key, f.label, locked.includes(f.key));
      list.append(button);
    }
    el.append(list);
  }

  if (expressions.length >= 2) {
    const list = document.createElement("div");
    list.className = "vn-expression-list";
    for (const key of expressions) {
      list.append(menuButton(`vn-expression${key === current ? " current" : ""}`,
        esc(art.labels[key] ?? key), () => chooseExpression(entry, key)));
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

  el.style.zIndex = String(topZ() + 1);
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

/** The GM's row: what this character (or party member) can have done to them. Off stage (no `entry`), only Flip and Tags…. */
async function gmActions(entry, key, baseKey) {
  const flip = !!characterPrefs(key).flip;
  const actions = [{ label: "Flip", icon: "fa-solid fa-left-right", active: flip, run: () => setFlip(key, !flip) }];
  if (entry) actions.push({ label: "Adjust size and height", icon: "fa-solid fa-sliders", run: () => AdjustWindow.open(entry.id) });
  if (entry?.actorUuid) {
    actions.push({ label: "VN art…: which character's art this actor uses", icon: "fa-solid fa-image-portrait", run: () => ArtPicker.open(entry.actorUuid) });
  }
  actions.push({ label: "Tags…", icon: "fa-solid fa-tags", run: () => TagEditor.open({ kind: "character", key: baseKey }) });
  if (!entry) return actions;
  actions.push("|", { label: "Remove from the stage", icon: "fa-solid fa-xmark", run: () => removeFromCast(entry.id) });
  return actions;
}

/** The GM's right-click on a form button locks or opens it. It changes in place: the menu stays open. */
function lockable(button, actorUuid, formKey, label, locked) {
  const show = (on) => {
    button.classList.toggle("locked", on);
    button.dataset.tooltip = on ? `${label}: locked, players can't switch to it. Right-click to open` : `${label}. Right-click to lock`;
  };
  show(locked);
  button.addEventListener("contextmenu", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const on = !button.classList.contains("locked");
    show(on);
    lockWrite = lockWrite.then(() => setFormLocked(actorUuid, formKey, on)).catch(() => show(!on));
    await lockWrite;
  });
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

/**
 * Above every window (the Stage window's Cast rows open the menu too). Foundry
 * raises each window it opens past the last; its counter is internal
 * (ApplicationV2._maxZ), so the open windows' own layers are checked as well.
 */
function topZ() {
  const windows = [...document.querySelectorAll(".application, .app, .window-app")]
    .map((w) => Number(getComputedStyle(w).zIndex) || 0);
  return Math.max(100, foundry.applications.api.ApplicationV2?._maxZ ?? 0, ...windows);
}

export function closeMenu() {
  closes++;
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
