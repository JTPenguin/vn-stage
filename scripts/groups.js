import { MODULE } from "./constants.js";

/**
 * Groups: everything needed to run one scenario, location or arc. A group has a
 * label, any number of background folders, and its characters. Members are the
 * characters whose manifest `groups` tags name it, plus ones added by hand,
 * minus ones removed by hand (a removal wins over a tag). Stored in a world
 * setting; each stage remembers its group in a scene flag.
 *
 * The menu always offers two built-ins, which aren't stored groups:
 * ALL (everyone, the stage's own background folder) and RECENT.
 */

export const ALL = "";
export const RECENT = "__recent";
const RECENT_MAX = 24;

function stored() {
  return foundry.utils.deepClone(game.settings.get(MODULE, "groups"));
}

async function save(all) {
  await game.settings.set(MODULE, "groups", all);
}

function requireGM() {
  if (!game.user.isGM) throw new Error("VN Stage | Only the GM can change groups.");
}

function blank() {
  return { label: null, folders: [], add: [], remove: [] };
}

/** Every group, from the settings and the art's tags, sorted by label. `index` is the art index. */
export function listGroups(index) {
  const all = stored();
  const ids = new Set(Object.keys(all));
  for (const art of index) for (const tag of art.groups) ids.add(tag);
  return [...ids]
    .filter((id) => !all[id]?.deleted)
    .map((id) => ({ id, label: all[id]?.label || id, folders: all[id]?.folders ?? [] }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

export function getGroup(id) {
  if (!id || id === RECENT) return null;
  const g = stored()[id];
  if (g?.deleted) return null;
  return { id, ...blank(), ...g, label: g?.label || id };
}

/** Names of a group's characters (art index entries for RECENT and ALL too). */
export function memberNames(id, index) {
  if (id === ALL) return index.map((a) => a.name);
  if (id === RECENT) return game.settings.get(MODULE, "recent").names ?? [];
  const g = getGroup(id);
  if (!g) return [];
  const names = new Set(index.filter((a) => a.groups.includes(id)).map((a) => a.name));
  for (const n of g.add) names.add(n);
  for (const n of g.remove) names.delete(n);
  return [...names];
}

async function change(id, fn) {
  requireGM();
  const all = stored();
  all[id] = { ...blank(), ...all[id] };
  delete all[id].deleted;
  fn(all[id]);
  await save(all);
}

/** A new hand-made group. Returns its id (the name), or the existing one's. */
export async function createGroup(name) {
  const id = name.trim();
  if (!id || id === RECENT) throw new Error("VN Stage | A group needs a name.");
  await change(id, () => {});
  return id;
}

export function renameGroup(id, label) {
  return change(id, (g) => { g.label = label.trim() || null; });
}

/** Delete a group's settings. A tagged group stays hidden until it's created again. */
export async function deleteGroup(id) {
  requireGM();
  const all = stored();
  all[id] = { deleted: true };
  await save(all);
}

export function addFolder(id, folder) {
  return change(id, (g) => { if (!g.folders.includes(folder)) g.folders.push(folder); });
}

export function removeFolder(id, folder) {
  return change(id, (g) => { g.folders = g.folders.filter((f) => f !== folder); });
}

export function addMember(id, name) {
  return change(id, (g) => {
    g.remove = g.remove.filter((n) => n !== name);
    if (!g.add.includes(name)) g.add.push(name);
  });
}

export function removeMember(id, name) {
  return change(id, (g) => {
    g.add = g.add.filter((n) => n !== name);
    if (!g.remove.includes(name)) g.remove.push(name);
  });
}

/** The stage's group (ALL when it has none, or its group was deleted). */
export function stageGroup(scene = canvas.scene) {
  const id = scene?.getFlag(MODULE, "group") ?? ALL;
  return id === RECENT || id === ALL || getGroup(id) ? id : ALL;
}

export async function setStageGroup(id, scene = canvas.scene) {
  requireGM();
  return scene.setFlag(MODULE, "group", id ?? ALL);
}

/** Note a character as used, for the Recent group. */
export async function noteRecent(name) {
  if (!game.user.isGM) return;
  const names = (game.settings.get(MODULE, "recent").names ?? []).filter((n) => n !== name);
  names.unshift(name);
  await game.settings.set(MODULE, "recent", { names: names.slice(0, RECENT_MAX) });
}
