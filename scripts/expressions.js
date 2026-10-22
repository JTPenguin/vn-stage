import { MODULE } from "./constants.js";
import { characterArt, artKeyOf, baseArtKeyOf, formsFor } from "./art.js";
import { getCast } from "./cast.js";
import { isStage } from "./stage.js";
import { pendingFor, setPending } from "./pending.js";

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
  const entry = getCast(scene).find((e) => e.id === castId);
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
  return scene.setFlag(MODULE, "cast", cast); // the stage re-lays out when it lands (module.js)
}

/**
 * Switch a cast entry to one of its character's forms (an art key), the same
 * way as expressions: on the actor when there is one (its owners may), else on
 * the cast entry (GM). Choosing the entry's base art clears the choice. The
 * expression carries over when the form has it, otherwise it shows neutral.
 */
export async function setForm(castId, key, { scene = canvas.scene } = {}) {
  const entry = getCast(scene).find((e) => e.id === castId);
  if (!entry || !canChange(entry)) return;
  const base = (await baseArtKeyOf(entry)) ?? entry.name;
  const value = key === base ? null : key;
  const actor = entry.actorUuid ? fromUuidSync(entry.actorUuid) : null;
  if (actor) return value ? actor.setFlag(MODULE, "form", value) : actor.unsetFlag(MODULE, "form");
  if (!game.user.isGM) return;
  const cast = getCast(scene);
  const raw = cast.find((e) => e.id === castId);
  if (!raw) return;
  if (value) raw.form = value;
  else delete raw.form;
  return scene.setFlag(MODULE, "cast", cast);
}

/**
 * A stand-in cast entry for a character who isn't on the stage (the Cast list's
 * menu), so the menu reads their form and expression the same way: from their
 * actor, or for art alone from what was chosen off stage.
 */
export function offstageEntry(name, actorUuid = null) {
  return { id: null, name, actorUuid, offstage: true, ...(actorUuid ? {} : pendingFor(name)) };
}

/** The menu's form choice, on stage or off. Off stage: on the actor, or remembered for art alone. GM. */
export async function chooseForm(entry, key) {
  if (!entry.offstage) return setForm(entry.id, key);
  if (!game.user.isGM) return;
  const base = (await baseArtKeyOf(entry)) ?? entry.name;
  const value = key === base ? null : key;
  const actor = entry.actorUuid ? fromUuidSync(entry.actorUuid) : null;
  if (actor) return value ? actor.setFlag(MODULE, "form", value) : actor.unsetFlag(MODULE, "form");
  setPending(entry.name, { form: value });
}

/** The menu's expression choice, on stage or off. */
export async function chooseExpression(entry, key) {
  if (!entry.offstage) return setExpression(entry.id, key);
  if (!game.user.isGM) return;
  const actor = entry.actorUuid ? fromUuidSync(entry.actorUuid) : null;
  const value = key === NEUTRAL ? null : key;
  if (actor) return value ? actor.setFlag(MODULE, "expression", value) : actor.unsetFlag(MODULE, "expression");
  setPending(entry.name, { expression: value });
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
  for (const e of getCast(scene)) {
    const key = (await artKeyOf(e)) ?? e.name;
    const art = await characterArt(key);
    if (art) srcs.push(...Object.values(art.expressions));
    // Each other form's portrait too, so switching form shows at once.
    for (const f of await formsFor(key)) if (f.key !== key) srcs.push(f.portrait);
  }
  await Promise.all(srcs.map((src) => foundry.canvas.loadTexture(src).catch(() => null)));
}
