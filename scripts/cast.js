import { MODULE } from "./constants.js";
import { noteRecent } from "./tags.js";
import { baseArtKeyOf } from "./art.js";
import { takePending } from "./pending.js";
import { orderMembers, compactClusters, clustersFromSides, clusterCount, castWithout, placeEntries, resolveCluster, innerIndex, joinIndex, targetFromShown, isEntryFor } from "./rules.js";

/**
 * The cast is the source of truth for who stands on a stage: a scene flag
 * listing each character in standing order. Portrait tiles are drawn from it
 * by `layout`, which the GM's screen runs whenever its own change to a cast
 * flag lands (module.js), so nothing here calls it.
 *
 * Entry: { id, name, actorUuid|null, cluster }. An entry with an actor is that
 * actor's, whatever it's called: `name` is only a label, and two actors with
 * one name are two characters. Art alone (no actor) goes by `name`, its art
 * key. Each actor, and each art alone, stands on a stage once. Characters stand in one or
 * more clusters across the stage: `cluster` counts from 0, left to right, and
 * each cluster's members are listed left to right (the rules are in rules.js).
 * The console API still takes `side: "left"|"right"` for the leftmost and
 * rightmost cluster. Party members are ordinary entries; The Party is only a
 * shortcut that adds, gathers or removes all of the system's party members
 * (PF2e's party actor) at once. Each stage remembers the order its party
 * members last stood in (scene flag `partyOrder`, actor ids), for the next time
 * they're added together.
 *
 * Older stages had one entry for the whole party, { id, party: true, side, order },
 * and sides instead of clusters; migrate.js upgrades them once.
 */

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
function memberEntry(actor, cluster, id = foundry.utils.randomID()) {
  return { id, name: actor.name, actorUuid: actor.uuid, cluster };
}

/**
 * The cast (a copy). Older stored forms are upgraded once by migrate.js; only
 * a scene imported later with sides still on it is read in clusters here.
 */
export function getCast(scene = canvas.scene) {
  return compactClusters(clustersFromSides(foundry.utils.deepClone(scene?.getFlag(MODULE, "cast") ?? [])));
}

/** A character's entry in the cast: their actor's, or for art alone (no actor) the art-only entry with that name. */
export function findEntry(cast, who) {
  return cast.find((e) => isEntryFor(e, who)) ?? null;
}

/**
 * The actor a bare name stands for (the console: `addToCast({ name })`): the
 * one world actor with that name. With several, none: the name alone can't
 * say which, so it goes on as art alone.
 */
function actorNamed(name) {
  const found = game.actors.filter((a) => a.name === name && a.type !== "party");
  if (found.length > 1) console.warn(`VN Stage | ${found.length} actors are called "${name}"; pass actorUuid to say which. Added as art alone.`);
  return found.length === 1 ? found[0].uuid : null;
}

/** Save the cast, its clusters numbered without gaps, remembering the order its party members stand in. */
async function saveCast(scene, cast) {
  cast = compactClusters(cast);
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
 * Put a character on the stage, in `cluster` (or the older `side`) at place
 * `index` from the left (null: the cluster's right end); `newCluster` starts a
 * cluster there. Numbers are the ones the cast shows (getCast). Already in that
 * cluster, with no place given? Nothing changes. A drop or a ‹ › passes
 * `target` instead, counted without the character (placeEntries in rules.js).
 * With no `actorUuid` at all (the console), the one world actor with that name
 * is linked, so its owners control it; `actorUuid: null` means art alone.
 */
export async function addToCast({ name, actorUuid, cluster = null, side = null, index = null, newCluster = false, target = null, scene = canvas.scene }) {
  requireGM();
  if (actorUuid === undefined) actorUuid = actorNamed(name);
  const cast = getCast(scene);
  const existing = findEntry(cast, { name, actorUuid });
  if (!target) {
    const shown = resolveCluster({ cluster, side, newCluster }, clusterCount(cast));
    if (existing && index === null && !newCluster && shown === existing.cluster) return;
    target = targetFromShown(cast, existing ? [existing.id] : [], { cluster: shown, index, newCluster });
  }
  // Art alone arrives with any form or expression chosen for it off stage.
  const entry = existing ?? { id: foundry.utils.randomID(), name, actorUuid, ...(actorUuid ? {} : takePending(name)) };
  const next = placeEntries(cast, [entry], target);
  await noteRecent((await baseArtKeyOf({ name, actorUuid })) ?? name);
  return saveCast(scene, next);
}

/**
 * Put every party member in `cluster` (a number, or "left" / "right" for the
 * leftmost or rightmost), numbered as the cast shows (getCast). With no
 * `index` (the Cast list's toggle), members already there stay where they
 * stand and the rest join at its end nearest the middle (with one cluster,
 * Left joins at its left end). With an `index` or `newCluster`, or a drop's
 * `target` (counted without them), they all gather there as one block. Either
 * way they come in the stage's remembered order.
 */
export async function addParty(cluster = 0, { index = null, newCluster = false, target = null, scene = canvas.scene } = {}) {
  requireGM();
  const side = typeof cluster === "string" ? cluster : null;
  const number = side ? null : cluster;
  const members = orderedMembers(scene.getFlag(MODULE, "partyOrder") ?? []);
  if (!members.length) return ui.notifications.info(`VN Stage | ${PARTY_LABEL} has nobody in it.`);
  const cast = getCast(scene);
  const entryOf = (a) => cast.find((e) => e.actorUuid === a.uuid);
  const idsOf = (list) => list.map(entryOf).filter(Boolean).map((e) => e.id);
  let moving = members;
  if (!target && index === null && !newCluster) {
    const here = resolveCluster({ cluster: number, side }, clusterCount(cast));
    moving = members.filter((a) => entryOf(a)?.cluster !== here);
    // Counted without the members who move, the cluster may have a new number (or be a new one).
    const rest = castWithout(cast, idsOf(moving));
    const n = clusterCount(rest);
    const stays = cast.find((e) => e.cluster === here);
    const c = stays ? rest.find((e) => e.id === stays.id).cluster : n;
    target = { cluster: c, index: side && n === 1 ? joinIndex(side, n) : innerIndex(c, n), newCluster: !stays };
  } else if (!target) {
    const shown = resolveCluster({ cluster: number, side, newCluster }, clusterCount(cast));
    target = targetFromShown(cast, idsOf(members), { cluster: shown, index, newCluster });
  }
  const entries = moving.map((a) => entryOf(a) ?? memberEntry(a, target.cluster));
  const next = placeEntries(cast, entries, target);
  const keys = await Promise.all(moving.map(async (a) => (await baseArtKeyOf({ name: a.name, actorUuid: a.uuid })) ?? a.name));
  await noteRecent(keys);
  return saveCast(scene, next);
}

/** Take every party member off the stage. */
export async function removeParty({ scene = canvas.scene } = {}) {
  requireGM();
  const members = new Set(partyMembers().map((a) => a.uuid));
  return saveCast(scene, getCast(scene).filter((e) => !members.has(e.actorUuid)));
}

/** The cast entry ids of the party members on stage, in standing order (left out when working out where the party is dropped). */
export function partyEntryIds(scene = canvas.scene) {
  const members = new Set(partyMembers().map((a) => a.uuid));
  return getCast(scene).filter((e) => members.has(e.actorUuid)).map((e) => e.id);
}

/** Where the party stands: its cluster number when every member is on stage in one cluster, otherwise null. */
export function partyCluster(scene = canvas.scene) {
  const members = partyMembers();
  if (!members.length) return null;
  const cast = getCast(scene);
  const clusters = new Set(members.map((a) => cast.find((e) => e.actorUuid === a.uuid)?.cluster ?? null));
  return clusters.size === 1 && !clusters.has(null) ? [...clusters][0] : null;
}

/**
 * Move cast entries (one id, or several in order, such as the party's) to a
 * target: { cluster, index, newCluster }, counted without them (placeEntries in rules.js).
 */
export async function moveEntry(ids, target, { scene = canvas.scene } = {}) {
  requireGM();
  const cast = getCast(scene);
  const entries = [ids].flat().map((id) => cast.find((e) => e.id === id)).filter(Boolean);
  if (!entries.length) return;
  return saveCast(scene, placeEntries(cast, entries, target));
}

/**
 * Move a character to `cluster` (a number as the cast shows it, or "left" /
 * "right"), at place `index` from the left; `newCluster` starts one there.
 */
export async function moveToCluster(id, cluster, { index = null, newCluster = false, scene = canvas.scene } = {}) {
  requireGM();
  const side = typeof cluster === "string" ? cluster : null;
  const cast = getCast(scene);
  const shown = resolveCluster({ cluster: side ? null : cluster, side, newCluster }, clusterCount(cast));
  return moveEntry(id, targetFromShown(cast, id, { cluster: shown, index, newCluster }), { scene });
}

/** Replace the whole cast (a preset). New characters get new ids; ones already on stage keep theirs. */
export async function setCast(entries, { scene = canvas.scene } = {}) {
  requireGM();
  // A character already on stage keeps their id, so their tile is updated in place instead of replaced (no fade out and in).
  const spare = getCast(scene);
  const cast = entries.map((e) => {
    const old = spare.findIndex((o) => isEntryFor(o, e));
    const id = old >= 0 ? spare.splice(old, 1)[0].id : foundry.utils.randomID();
    return { ...foundry.utils.deepClone(e), id };
  });
  return saveCast(scene, cast);
}

export async function removeFromCast(id, { scene = canvas.scene } = {}) {
  requireGM();
  return saveCast(scene, getCast(scene).filter((e) => e.id !== id));
}

/**
 * The old switch between sides: from the leftmost cluster to the rightmost, at
 * its end nearest the middle (a new cluster at the right edge when there's only
 * one); from any other cluster to the end of the leftmost.
 */
export async function switchSide(id, { scene = canvas.scene } = {}) {
  requireGM();
  const cast = getCast(scene);
  const entry = cast.find((e) => e.id === id);
  if (!entry) return;
  const count = clusterCount(castWithout(cast, id));
  const target = entry.cluster !== 0 ? { cluster: 0, index: null }
    : clusterCount(cast) === 1 ? { cluster: count, newCluster: true }
      : { cluster: count - 1, index: innerIndex(count - 1, count) };
  return saveCast(scene, placeEntries(cast, [entry], target));
}

/** Move a character one place left (-1) or right (+1) within their cluster. */
export async function moveInCluster(id, step, { scene = canvas.scene } = {}) {
  requireGM();
  const cast = getCast(scene);
  const entry = cast.find((e) => e.id === id);
  if (!entry) return;
  const cluster = cast.filter((e) => e.cluster === entry.cluster);
  const other = cluster[cluster.indexOf(entry) + step];
  if (!other) return;
  const i = cast.indexOf(entry), j = cast.indexOf(other);
  [cast[i], cast[j]] = [cast[j], cast[i]];
  return saveCast(scene, cast);
}

export async function clearCast({ scene = canvas.scene } = {}) {
  requireGM();
  return saveCast(scene, []);
}

/**
 * Per-character choices that follow them to every stage: a world setting, by
 * the key `prefsKeyOf` (art.js) gives a cast entry: its art key, or for an
 * actor without art, "actor:<id>".
 */
export function characterPrefs(key) {
  return game.settings.get(MODULE, "characterPrefs")[key] ?? {};
}

export function setFlip(key, flip) {
  return setPrefs(key, { flip: !!flip });
}

/**
 * Change a character's saved choices: `flip`, `size`, `flying`, `scale` (multiple of the
 * frame height, before creature size) and `yOffset` (share of the frame height;
 * positive is lower). Scale and yOffset replace the art file's own; null clears
 * a choice, so the art's own applies again. `flying` keeps the character from
 * bringing up the bottom shade.
 */
export async function setPrefs(key, patch) {
  requireGM();
  const all = foundry.utils.deepClone(game.settings.get(MODULE, "characterPrefs"));
  all[key] = { ...all[key], ...patch };
  for (const [k, v] of Object.entries(patch)) if (v === null) delete all[key][k];
  // The viewed stage re-lays out when the setting lands (module.js); others catch up when next viewed.
  return game.settings.set(MODULE, "characterPrefs", all);
}
