import { MODULE } from "./constants.js";
import { noteRecent } from "./groups.js";
import { baseArtKeyOf } from "./art.js";
import { takePending } from "./pending.js";
import { orderMembers } from "./rules.js";

/**
 * The cast is the source of truth for who stands on a stage: a scene flag
 * listing each character in standing order. Portrait tiles are drawn from it
 * by `layout`, which the GM's screen runs whenever its own change to a cast
 * flag lands (module.js), so nothing here calls it.
 *
 * Entry: { id, name, actorUuid|null, side: "left"|"right" }. Party members are
 * ordinary entries; The Party is only a shortcut that adds, gathers or removes
 * all of the system's party members (PF2e's party actor) at once. Each stage
 * remembers the order its party members last stood in (scene flag `partyOrder`,
 * actor ids), for the next time they're added together.
 *
 * Older stages had one entry for the whole party, { id, party: true, side, order };
 * migrate.js turns it into its members once.
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

/** The party's members in this stage's remembered order (actor ids, `order` for old entries); the rest after, as the system lists them. */
export function orderedMembers(order = []) {
  return orderMembers(partyMembers(), order);
}

/** An entry for one party member. */
function memberEntry(actor, side, id = foundry.utils.randomID()) {
  return { id, name: actor.name, actorUuid: actor.uuid, side };
}

/** The cast (a copy). Older stored forms are upgraded once by migrate.js, not here. */
export function getCast(scene = canvas.scene) {
  return foundry.utils.deepClone(scene?.getFlag(MODULE, "cast") ?? []);
}

/** Save the cast, remembering the order its party members stand in. */
async function saveCast(scene, cast) {
  const members = new Set(partyMembers().map((a) => a.uuid));
  const standing = cast.filter((e) => members.has(e.actorUuid)).map((e) => fromUuidSync(e.actorUuid)?.id).filter(Boolean);
  const before = scene.getFlag(MODULE, "partyOrder") ?? [];
  const partyOrder = [...standing, ...before.filter((id) => !standing.includes(id))];
  return scene.update({ [`flags.${MODULE}.cast`]: cast, [`flags.${MODULE}.partyOrder`]: partyOrder });
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
  const existing = cast.find((e) => (actorUuid && e.actorUuid === actorUuid) || e.name === name);
  if (existing) {
    if (existing.side === side && index === null) return;
    cast.splice(cast.indexOf(existing), 1);
    insertAt(cast, { ...existing, side }, index);
  } else {
    // Art alone arrives with any form or expression chosen for it off stage.
    const chosen = actorUuid ? {} : takePending(name);
    insertAt(cast, { id: foundry.utils.randomID(), name, actorUuid, side, ...chosen }, index);
  }
  await noteRecent((await baseArtKeyOf({ name, actorUuid })) ?? name);
  return saveCast(scene, cast);
}

/**
 * Put every party member on `side`. With no `index` (the Cast list's toggle),
 * members already there stay where they stand and the rest join at the back.
 * With an `index` (a drop on the stage), they all gather there, together.
 * Either way they come in the stage's remembered order.
 */
export async function addParty(side = "left", { index = null, scene = canvas.scene } = {}) {
  requireGM();
  if (!SIDES.includes(side)) throw new Error(`VN Stage | Unknown side "${side}".`);
  const members = orderedMembers(scene.getFlag(MODULE, "partyOrder") ?? []);
  if (!members.length) return ui.notifications.info(`VN Stage | ${PARTY_LABEL} has nobody in it.`);
  const cast = getCast(scene);
  const entryOf = (a) => cast.find((e) => e.actorUuid === a.uuid);
  const moving = index === null ? members.filter((a) => entryOf(a)?.side !== side) : members;
  const entries = moving.map((a) => ({ ...(entryOf(a) ?? memberEntry(a, side)), side }));
  const ids = new Set(entries.map((e) => e.id));
  const rest = cast.filter((e) => !ids.has(e.id));
  // Insert them one after another, from the drop point (or the back of the side).
  let at = index;
  for (const e of entries) {
    insertAt(rest, e, at);
    if (at !== null) at++;
  }
  const keys = await Promise.all(moving.map(async (a) => (await baseArtKeyOf({ name: a.name, actorUuid: a.uuid })) ?? a.name));
  await noteRecent(keys);
  return saveCast(scene, rest);
}

/** Take every party member off the stage. */
export async function removeParty({ scene = canvas.scene } = {}) {
  requireGM();
  const members = new Set(partyMembers().map((a) => a.uuid));
  return saveCast(scene, getCast(scene).filter((e) => !members.has(e.actorUuid)));
}

/** The cast entry ids of the party members on stage (left out when working out where the party is dropped). */
export function partyEntryIds(scene = canvas.scene) {
  const members = new Set(partyMembers().map((a) => a.uuid));
  return getCast(scene).filter((e) => members.has(e.actorUuid)).map((e) => e.id);
}

/** Where the party stands: "left" or "right" when every member is on stage on that side, otherwise null. */
export function partySide(scene = canvas.scene) {
  const members = partyMembers();
  if (!members.length) return null;
  const cast = getCast(scene);
  const sides = new Set(members.map((a) => cast.find((e) => e.actorUuid === a.uuid)?.side ?? null));
  return sides.size === 1 && !sides.has(null) ? [...sides][0] : null;
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

/** Replace the whole cast (a preset). New characters get new ids; ones already on stage keep theirs. */
export async function setCast(entries, { scene = canvas.scene } = {}) {
  requireGM();
  // A character already on stage keeps their id, so their tile is updated in place instead of replaced (no fade out and in).
  const spare = getCast(scene);
  const same = (a, b) => (a.actorUuid ? a.actorUuid === b.actorUuid : !b.actorUuid && a.name === b.name);
  const cast = entries.map((e) => {
    const old = spare.findIndex((o) => same(o, e));
    const id = old >= 0 ? spare.splice(old, 1)[0].id : foundry.utils.randomID();
    return { ...foundry.utils.deepClone(e), id };
  });
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
 * Change a character's saved choices: `flip`, `size`, `scale` (multiple of the
 * frame height, before creature size) and `yOffset` (share of the frame height;
 * positive is lower). Scale and yOffset replace the art file's own; null clears
 * a choice, so the art's own applies again.
 */
export async function setPrefs(name, patch) {
  requireGM();
  const all = foundry.utils.deepClone(game.settings.get(MODULE, "characterPrefs"));
  all[name] = { ...all[name], ...patch };
  for (const [k, v] of Object.entries(patch)) if (v === null) delete all[name][k];
  // The viewed stage re-lays out when the setting lands (module.js); others catch up when next viewed.
  return game.settings.set(MODULE, "characterPrefs", all);
}
