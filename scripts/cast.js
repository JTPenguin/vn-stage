import { MODULE } from "./constants.js";
import { layout } from "./layout.js";
import { noteRecent } from "./groups.js";
import { artKeyOf } from "./art.js";

/**
 * The cast is the source of truth for who stands on a stage: a scene flag
 * listing each character in standing order. Portrait tiles are drawn from it
 * by `layout`, so every change here ends with a layout.
 *
 * Entry: { id, name, actorUuid|null, side: "left"|"right" }, or The Party:
 * { id, party: true, side: "left"|"right", order: [actor ids] }, which stands
 * for the system's party members (PF2e's party actor) whenever the stage is
 * drawn, in `order` (members not in it stand at the back, by name).
 */

export const SIDES = ["left", "right"];
export const PARTY_LABEL = "The Party";

/** Party member types shown on the stage: PCs and NPCs travelling with them (familiars stay off). */
const PARTY_TYPES = ["character", "npc"];

/** The party's characters and NPCs, if the system has a party (PF2e). */
export function partyMembers() {
  const members = game.actors.party?.members ?? [];
  return members.filter((a) => a && PARTY_TYPES.includes(a.type));
}

export function hasParty() {
  return !!game.actors.party;
}

/**
 * The cast with The Party expanded into its members, in standing order. A member's
 * id is "<party entry id>.<actor id>", so tiles, expressions and adjustments can
 * find them; `partyOf` names the party entry.
 */
export function resolveCast(scene = canvas.scene) {
  const out = [];
  const cast = getCast(scene);
  // A party member stands with The Party only, never twice (for example after joining the party while on stage).
  const inParty = cast.some((e) => e.party) ? new Set(partyMembers().map((a) => a.uuid)) : new Set();
  for (const e of cast) {
    if (!e.party) {
      if (!e.actorUuid || !inParty.has(e.actorUuid)) out.push(e);
      continue;
    }
    for (const actor of orderedMembers(e.order)) {
      out.push({ id: `${e.id}.${actor.id}`, name: actor.name, actorUuid: actor.uuid, side: e.side, partyOf: e.id });
    }
  }
  return out;
}

/** The name to show for a cast entry: its actor's current name, or its own. */
export function displayName(entry) {
  return (entry.actorUuid && fromUuidSync(entry.actorUuid)?.name) || entry.name;
}

/** Link an actor to an art key (VN art…), or clear the link with null so it's found automatically again. GM only. */
export async function setActorArt(actorUuid, key) {
  requireGM();
  const actor = fromUuidSync(actorUuid);
  if (!actor) return;
  if (key) return actor.setFlag(MODULE, "art", key);
  return actor.unsetFlag(MODULE, "art");
}

/** The party's characters in a party entry's standing order; new members at the back, by name. */
function orderedMembers(order = []) {
  const rank = (a) => { const i = order.indexOf(a.id); return i === -1 ? Infinity : i; };
  return partyMembers()
    .map((a, i) => ({ a, i }))
    .sort((x, y) => rank(x.a) - rank(y.a) || x.i - y.i)
    .map(({ a }) => a);
}

/** Set the party's standing order on this stage (actor ids, outer edge first). */
export async function setPartyOrder(actorIds, { scene = canvas.scene } = {}) {
  requireGM();
  const cast = getCast(scene);
  const entry = cast.find((e) => e.party);
  if (!entry) return;
  entry.order = actorIds;
  return saveCast(scene, cast);
}

export function getCast(scene = canvas.scene) {
  const cast = foundry.utils.deepClone(scene?.getFlag(MODULE, "cast") ?? []);
  // The Party's old "whole width" side (removed 2026-10-20) reads as the left: alone, a side is centred anyway.
  for (const e of cast) if (!SIDES.includes(e.side)) e.side = "left";
  return cast;
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
export async function addToCast({ name, actorUuid = null, side = "left", index = null, scene = canvas.scene }) {
  requireGM();
  if (!SIDES.includes(side)) throw new Error(`VN Stage | Unknown side "${side}".`);
  actorUuid ??= game.actors.getName(name)?.uuid ?? null;
  const cast = getCast(scene);
  if (actorUuid && cast.some((e) => e.party) && partyMembers().some((a) => a.uuid === actorUuid)) {
    ui.notifications.info(`VN Stage | ${name} is already on stage with ${PARTY_LABEL}.`);
    return;
  }
  const existing = cast.find((e) => (actorUuid && e.actorUuid === actorUuid) || e.name === name);
  if (existing) {
    if (existing.side === side && index === null) return;
    cast.splice(cast.indexOf(existing), 1);
    insertAt(cast, { ...existing, side }, index);
  } else {
    insertAt(cast, { id: foundry.utils.randomID(), name, actorUuid, side }, index);
  }
  await noteRecent((await artKeyOf({ name, actorUuid })) ?? name);
  return saveCast(scene, cast);
}

/** Put The Party on the stage (or move it): left or right; `index` places it within a side. */
export async function addParty(side = "left", { index = null, scene = canvas.scene } = {}) {
  requireGM();
  if (!SIDES.includes(side)) throw new Error(`VN Stage | Unknown side "${side}".`);
  // Party members standing on their own join The Party instead.
  const members = new Set(partyMembers().map((a) => a.uuid));
  const cast = getCast(scene).filter((e) => e.party || !e.actorUuid || !members.has(e.actorUuid));
  const existing = cast.find((e) => e.party);
  if (existing) {
    if (existing.side === side && index === null) return;
    cast.splice(cast.indexOf(existing), 1);
    insertAt(cast, { ...existing, side }, index);
  } else {
    insertAt(cast, { id: foundry.utils.randomID(), party: true, side }, index);
  }
  return saveCast(scene, cast);
}

/**
 * Put `entry` into `cast` at standing position `index` on its side (0 is the
 * outer edge, in front); null or past the end puts it at the back of the side.
 */
function insertAt(cast, entry, index) {
  const side = cast.filter((e) => e.side === entry.side);
  const before = index === null ? null : side[index];
  if (before) cast.splice(cast.indexOf(before), 0, entry);
  else cast.push(entry);
}

/** Move a cast entry (a character or The Party) to `side`, at standing position `index`. */
export async function moveEntry(id, side, index, { scene = canvas.scene } = {}) {
  requireGM();
  const cast = getCast(scene);
  const entry = cast.find((e) => e.id === id);
  if (!entry) return;
  cast.splice(cast.indexOf(entry), 1);
  insertAt(cast, { ...entry, side }, index);
  return saveCast(scene, cast);
}

/** Replace the whole cast (a preset). Entries get new ids. */
export async function setCast(entries, { scene = canvas.scene } = {}) {
  requireGM();
  const cast = entries.map((e) => ({ ...foundry.utils.deepClone(e), id: foundry.utils.randomID() }));
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
