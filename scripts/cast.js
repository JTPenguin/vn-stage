import { MODULE } from "./constants.js";
import { layout } from "./layout.js";
import { noteRecent } from "./groups.js";

/**
 * The cast is the source of truth for who stands on a stage: a scene flag
 * listing each character in standing order. Portrait tiles are drawn from it
 * by `layout`, so every change here ends with a layout.
 *
 * Entry: { id, name, actorUuid|null, side: "left"|"right" }
 */

export const SIDES = ["left", "right"];

export function getCast(scene = canvas.scene) {
  return foundry.utils.deepClone(scene?.getFlag(MODULE, "cast") ?? []);
}

async function saveCast(scene, cast) {
  await scene.setFlag(MODULE, "cast", cast);
  return layout(scene);
}

function requireGM() {
  if (!game.user.isGM) throw new Error("VN Stage | Only the GM can change the cast.");
}

/**
 * Put a character on the stage. Already there? They move to `side` instead.
 * A world actor with the same name is linked, so its owners control it.
 */
export async function addToCast({ name, actorUuid = null, side = "left", scene = canvas.scene }) {
  requireGM();
  if (!SIDES.includes(side)) throw new Error(`VN Stage | Unknown side "${side}".`);
  actorUuid ??= game.actors.getName(name)?.uuid ?? null;
  const cast = getCast(scene);
  const existing = cast.find((e) => (actorUuid && e.actorUuid === actorUuid) || e.name === name);
  if (existing) {
    if (existing.side === side) return;
    cast.splice(cast.indexOf(existing), 1);
    cast.push({ ...existing, side });
  } else {
    cast.push({ id: foundry.utils.randomID(), name, actorUuid, side });
  }
  await noteRecent(name);
  return saveCast(scene, cast);
}

export async function removeFromCast(id, { scene = canvas.scene } = {}) {
  requireGM();
  return saveCast(scene, getCast(scene).filter((e) => e.id !== id));
}

/** Move a character to the other side, at the back of it. */
export async function switchSide(id, { scene = canvas.scene } = {}) {
  requireGM();
  const cast = getCast(scene);
  const entry = cast.find((e) => e.id === id);
  if (!entry) return;
  cast.splice(cast.indexOf(entry), 1);
  cast.push({ ...entry, side: entry.side === "left" ? "right" : "left" });
  return saveCast(scene, cast);
}

/** Move a character one place forward (-1) or back (+1) within their side. */
export async function moveInSide(id, step, { scene = canvas.scene } = {}) {
  requireGM();
  const cast = getCast(scene);
  const entry = cast.find((e) => e.id === id);
  if (!entry) return;
  const side = cast.filter((e) => e.side === entry.side);
  const other = side[side.indexOf(entry) + step];
  if (!other) return;
  const i = cast.indexOf(entry), j = cast.indexOf(other);
  [cast[i], cast[j]] = [cast[j], cast[i]];
  return saveCast(scene, cast);
}

export async function clearCast({ scene = canvas.scene } = {}) {
  requireGM();
  return saveCast(scene, []);
}

/** Per-character choices that follow them to every stage (a world setting, by name). */
export function characterPrefs(name) {
  return game.settings.get(MODULE, "characterPrefs")[name] ?? {};
}

export function setFlip(name, flip) {
  return setPrefs(name, { flip: !!flip });
}

/**
 * Change a character's saved choices: `flip`, `scale` (a factor on top of the
 * face sizing) and `yOffset` (share of the frame height; positive is lower).
 */
export async function setPrefs(name, patch) {
  requireGM();
  const all = foundry.utils.deepClone(game.settings.get(MODULE, "characterPrefs"));
  all[name] = { ...all[name], ...patch };
  await game.settings.set(MODULE, "characterPrefs", all);
  // Re-lay out the viewed stage; others pick it up the next time they're laid out.
  return layout(canvas.scene);
}
