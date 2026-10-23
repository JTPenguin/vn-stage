import { MODULE } from "./constants.js";
import { folderExists } from "./stage.js";
import { groupMembers, mergeRecent } from "./rules.js";

/**
 * Groups: everything needed to run one scenario, location or arc. A group has a
 * label, any number of background folders and single backgrounds, its characters and its presets
 * (presets name their groups; see presets.js). Members are the characters whose
 * art's `groups` names it, plus ones added by hand, minus ones removed by
 * hand (a removal wins over a name in the art's file). Folders are the ones added by hand plus its
 * automatic folders (the "Group background folders" pattern, and any a module
 * adds with the `vn-stage.groupFolders` hook) that exist, minus ones removed by
 * hand. Stored in a world setting; each stage remembers its group in a scene flag.
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
  return { label: null, folders: [], images: [], add: [], remove: [], hideAuto: [] };
}

/** Every group, from the settings and the art's group names, sorted by label. `index` is the art index. */
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
  return g ? groupMembers(id, index, g) : [];
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

/** Delete a group's settings. A group named in the art stays hidden until it's created again. */
export async function deleteGroup(id) {
  requireGM();
  const all = stored();
  all[id] = { deleted: true };
  await save(all);
}

/** Folders a group finds by itself, whether or not they exist: the setting's pattern, then any a module adds. */
export function autoFolderCandidates(id) {
  const out = [];
  const pattern = game.settings.get(MODULE, "groupFolders").trim();
  if (pattern) out.push(pattern.replaceAll("{group}", id));
  // Another module can add folders for a group: Hooks.on("vn-stage.groupFolders", (group, folders) => folders.push(…)).
  Hooks.callAll("vn-stage.groupFolders", { id, label: getGroup(id)?.label ?? id }, out);
  return [...new Set(out.map((f) => (f.endsWith("/") ? f : `${f}/`)))];
}

/**
 * A group's background folders, in order: its automatic folders that exist and
 * weren't removed, then the ones added by hand. `auto` marks the first kind.
 */
export async function groupFolders(id) {
  const g = getGroup(id);
  if (!g) return [];
  const auto = [];
  for (const folder of autoFolderCandidates(id)) {
    if (!g.hideAuto.includes(folder) && !g.folders.includes(folder) && (await folderExists(folder))) auto.push({ folder, auto: true });
  }
  return [...auto, ...g.folders.map((folder) => ({ folder, auto: false }))];
}

export function addFolder(id, folder) {
  return change(id, (g) => {
    g.hideAuto = g.hideAuto.filter((f) => f !== folder);
    if (!g.folders.includes(folder) && !autoFolderCandidates(id).includes(folder)) g.folders.push(folder);
  });
}

/**
 * Remove a folder from a group. A folder added by hand just goes (if it's also
 * an automatic folder, that one shows again); an automatic folder stays hidden
 * until it's added again.
 */
export function removeFolder(id, folder) {
  return change(id, (g) => {
    if (g.folders.includes(folder)) g.folders = g.folders.filter((f) => f !== folder);
    else if (autoFolderCandidates(id).includes(folder) && !g.hideAuto.includes(folder)) g.hideAuto.push(folder);
  });
}

/** Single backgrounds (images or videos) a group holds besides its folders. */
export function addImage(id, src) {
  return change(id, (g) => { if (!g.images.includes(src)) g.images.push(src); });
}

export function removeImage(id, src) {
  return change(id, (g) => { g.images = g.images.filter((i) => i !== src); });
}

/** Put one single background in exactly these groups (a background's Groups… list). */
export async function setImageGroups(src, ids, index) {
  requireGM();
  const all = stored();
  for (const g of listGroups(index)) {
    const e = (all[g.id] = { ...blank(), ...all[g.id] });
    delete e.deleted;
    const has = e.images.includes(src);
    if (ids.includes(g.id) && !has) e.images.push(src);
    else if (!ids.includes(g.id) && has) e.images = e.images.filter((i) => i !== src);
  }
  await save(all);
}

export function addMember(id, name) {
  return addMembers(id, [name]);
}

export function addMembers(id, names) {
  return change(id, (g) => {
    g.remove = g.remove.filter((n) => !names.includes(n));
    for (const name of names) if (!g.add.includes(name)) g.add.push(name);
  });
}

export function removeMember(id, name) {
  return change(id, (g) => {
    g.add = g.add.filter((n) => n !== name);
    if (!g.remove.includes(name)) g.remove.push(name);
  });
}

/** Is `name` a member because its art's vn-stage.json names the group (so removing it only hides it here)? */
export function isTagged(id, name, index) {
  return !!index.find((a) => a.name === name)?.groups.includes(id);
}

/** Put one character in exactly these groups (the character's Groups… list). */
export async function setCharacterGroups(name, ids, index) {
  requireGM();
  const all = stored();
  for (const g of listGroups(index)) {
    const want = ids.includes(g.id);
    if (want === memberNames(g.id, index).includes(name)) continue;
    const e = (all[g.id] = { ...blank(), ...all[g.id] });
    delete e.deleted;
    if (want) {
      e.remove = e.remove.filter((n) => n !== name);
      if (!e.add.includes(name)) e.add.push(name);
    } else {
      e.add = e.add.filter((n) => n !== name);
      if (!e.remove.includes(name)) e.remove.push(name);
    }
  }
  await save(all);
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

/** Note characters as used, for the Recent group: one name or several (the first ends up newest). One write. */
export async function noteRecent(names) {
  if (!game.user.isGM) return;
  const used = [names].flat().filter(Boolean);
  if (!used.length) return;
  const before = game.settings.get(MODULE, "recent").names ?? [];
  const next = mergeRecent(used, before, RECENT_MAX);
  if (next.join("\n") === before.slice(0, RECENT_MAX).join("\n")) return;
  await game.settings.set(MODULE, "recent", { names: next });
}
