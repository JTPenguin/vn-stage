import { MODULE } from "./constants.js";
import { characterArt, artKeyOf, baseArtKeyOf, formsFor } from "./art.js";
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

/**
 * Switch a cast entry to one of its character's forms (an art key), the same
 * way as expressions: on the actor when there is one (its owners may), else on
 * the cast entry (GM). Choosing the entry's base art clears the choice. The
 * expression carries over when the form has it, otherwise it shows neutral.
 */
export async function setForm(castId, key, { scene = canvas.scene } = {}) {
  const entry = resolveCast(scene).find((e) => e.id === castId);
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
    const key = (await artKeyOf(e)) ?? e.name;
    const art = await characterArt(key);
    if (art) srcs.push(...Object.values(art.expressions));
    // Each other form's portrait too, so switching form shows at once.
    for (const f of await formsFor(key)) if (f.key !== key) srcs.push(f.portrait);
  }
  await Promise.all(srcs.map((src) => foundry.canvas.loadTexture(src).catch(() => null)));
}
