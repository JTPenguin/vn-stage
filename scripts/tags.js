import { MODULE } from "./constants.js";
import { folderExists, folderOf } from "./stage.js";
import { artList } from "./art.js";
import { tagMembers, liveTags, matchTag, mergeRecent } from "./rules.js";

/**
 * Tags: one name that pulls together everything for a scenario, a location or
 * a recurring cast. A character, a single background, a background folder or a
 * preset can carry any number of tags (presets name their own; see presets.js).
 * A tag's characters are the ones whose art's `tags` names it, plus ones tagged
 * by hand, minus ones untagged by hand (that wins over a name in the art's
 * file). Its folders are the ones added by hand plus its automatic folders (the
 * "Tag background folders" pattern, and any a module adds with the
 * `vn-stage.tagFolders` hook) that exist, minus ones removed by hand.
 *
 * A tag exists while something carries it; an empty one isn't listed. Stored in
 * a world setting; each stage remembers the tag it shows in a scene flag.
 *
 * The menu always offers three built-ins, which aren't stored tags: ALL
 * (everyone, the stage's own background folder), RECENT and UNTAGGED.
 */

export const ALL = "";
export const RECENT = "__recent";
export const UNTAGGED = "__untagged";
const RECENT_MAX = 24;

const isBuiltIn = (id) => !id || id === RECENT || id === UNTAGGED;

function stored() {
  return foundry.utils.deepClone(game.settings.get(MODULE, "tags"));
}

async function save(all) {
  await game.settings.set(MODULE, "tags", all);
}

function requireGM() {
  if (!game.user.isGM) throw new Error("VN Stage | Only the GM can change tags.");
}

function blank() {
  return { label: null, folders: [], images: [], add: [], remove: [], hideAuto: [] };
}

/** Every preset's tag ids (read from the setting, so this file needn't import presets.js). */
function presetTagIds() {
  return Object.values(game.settings.get(MODULE, "presets")).flatMap((p) => p.tags ?? []);
}

/** Every tag something carries, sorted by label: [{ id, label }]. */
export function listTags() {
  return liveTags(game.settings.get(MODULE, "tags"), artList(), presetTagIds());
}

/** A listed tag with everything stored on it, or null. */
export function getTag(id) {
  if (isBuiltIn(id) || !listTags().some((t) => t.id === id)) return null;
  const g = stored()[id];
  return { id, ...blank(), ...g, label: g?.label || id };
}

/** Names (art keys) of a tag's characters; of everyone, the recent ones or the untagged ones for the built-ins. */
export function memberNames(id) {
  const index = artList();
  if (id === ALL) return index.map((a) => a.name);
  if (id === RECENT) return game.settings.get(MODULE, "recent").names ?? [];
  if (id === UNTAGGED) {
    const tagged = new Set(listTags().flatMap((t) => memberNames(t.id)));
    return index.filter((a) => !a.key.includes("/forms/") && !tagged.has(a.name)).map((a) => a.name);
  }
  const g = stored()[id];
  return g?.deleted ? [] : tagMembers(id, index, g);
}

/** The tags a character (art key) has: [{ id, label, fromArt }]. `fromArt`: its art's file names the tag. */
export function characterTags(key) {
  const art = artList().find((a) => a.name === key);
  return listTags().filter((t) => memberNames(t.id).includes(key))
    .map((t) => ({ ...t, fromArt: !!art?.tags.includes(t.id) }));
}

async function change(id, fn) {
  requireGM();
  const all = stored();
  all[id] = { ...blank(), ...all[id] };
  delete all[id].deleted;
  fn(all[id]);
  await save(all);
}

/**
 * The id of the tag a typed name means: a listed tag with that label or id
 * (case doesn't matter), or a new tag named as typed. A tag that was deleted or
 * had emptied out starts again under the typed name.
 */
export async function tagNamed(name) {
  requireGM();
  const text = name.trim();
  if (!text || text.startsWith("__")) throw new Error("VN Stage | A tag needs a name.");
  const live = matchTag(text, listTags());
  if (live) return live;
  const all = stored();
  const id = Object.keys(all).find((k) => k.toLowerCase() === text.toLowerCase()) ?? text;
  if (all[id]?.label || all[id]?.deleted) {
    all[id] = { ...blank(), ...all[id], label: null };
    delete all[id].deleted;
    await save(all);
  }
  return id;
}

/** For the console and other modules: a tag's id from its name. It's listed once something carries it. */
export function createTag(name) {
  return tagNamed(name);
}

/** Give a tag a new label; its id stays (art files and folders know it by that). False when another tag has the name. */
export async function renameTag(id, label) {
  const text = label.trim();
  const other = matchTag(text, listTags().filter((t) => t.id !== id));
  if (!text || other) return false;
  await change(id, (g) => { g.label = text === id ? null : text; });
  return true;
}

/** Delete a tag; what carried it stays. A tag named in the art stays hidden until it's typed again. (Presets drop it in presets.js.) */
export async function deleteTag(id) {
  requireGM();
  const all = stored();
  if (artList().some((a) => a.tags.includes(id))) all[id] = { deleted: true };
  else delete all[id];
  await save(all);
}

/** Give `into` everything `from` holds: its characters, single backgrounds and folders (automatic ones too). `from` is left as it was. */
export async function copyTagInto(from, into) {
  const names = memberNames(from);
  const images = getTag(from)?.images ?? [];
  const folders = (await tagFolders(from)).map((f) => f.folder);
  const have = new Set(memberNames(into));
  const auto = autoFolderCandidates(into);
  await change(into, (g) => {
    g.remove = g.remove.filter((n) => !names.includes(n));
    for (const n of names) if (!have.has(n) && !g.add.includes(n)) g.add.push(n);
    for (const src of images) if (!g.images.includes(src)) g.images.push(src);
    for (const f of folders) {
      g.hideAuto = g.hideAuto.filter((h) => h !== f);
      if (!g.folders.includes(f) && !auto.includes(f)) g.folders.push(f);
    }
  });
}

/** Folders a tag finds by itself, whether or not they exist: the setting's pattern, then any a module adds. */
export function autoFolderCandidates(id) {
  const out = [];
  const pattern = game.settings.get(MODULE, "tagFolders").trim();
  // {group} is the pattern's older spelling.
  if (pattern) out.push(pattern.replaceAll("{tag}", id).replaceAll("{group}", id));
  // Another module can add folders for a tag: Hooks.on("vn-stage.tagFolders", (tag, folders) => folders.push(…)).
  Hooks.callAll("vn-stage.tagFolders", { id, label: stored()[id]?.label || id }, out);
  return [...new Set(out.map((f) => (f.endsWith("/") ? f : `${f}/`)))];
}

/**
 * A tag's background folders, in order: its automatic folders that exist and
 * weren't removed, then the ones added by hand. `auto` marks the first kind.
 */
export async function tagFolders(id) {
  const g = getTag(id);
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
 * Remove a folder from a tag. A folder added by hand just goes (if it's also
 * an automatic folder, that one shows again); an automatic folder stays hidden
 * until it's added again.
 */
export function removeFolder(id, folder) {
  return change(id, (g) => {
    if (g.folders.includes(folder)) g.folders = g.folders.filter((f) => f !== folder);
    else if (autoFolderCandidates(id).includes(folder) && !g.hideAuto.includes(folder)) g.hideAuto.push(folder);
  });
}

/** Tag a single background (an image or video). */
export function addImage(id, src) {
  return change(id, (g) => { if (!g.images.includes(src)) g.images.push(src); });
}

export function removeImage(id, src) {
  return change(id, (g) => { g.images = g.images.filter((i) => i !== src); });
}

/**
 * Which tags each background has, worked out once for a render:
 * `tagsOf(src)` gives [{ id, label, viaFolder }], the tags on the background
 * itself first, then the ones it has through a tagged folder.
 */
export async function backgroundTags() {
  const tags = listTags();
  const all = stored();
  const byFolder = new Map();
  for (const t of tags) {
    for (const { folder } of await tagFolders(t.id)) byFolder.set(folder, [...(byFolder.get(folder) ?? []), t]);
  }
  return (src) => {
    const own = tags.filter((t) => all[t.id]?.images?.includes(src));
    const via = (byFolder.get(folderOf(src)) ?? []).filter((t) => !own.includes(t));
    return [...own.map((t) => ({ ...t, viaFolder: false })), ...via.map((t) => ({ ...t, viaFolder: true }))];
  };
}

/** Tag a character (art key). */
export function addMember(id, name) {
  return change(id, (g) => {
    g.remove = g.remove.filter((n) => n !== name);
    if (!g.add.includes(name) && !artList().find((a) => a.name === name)?.tags.includes(id)) g.add.push(name);
  });
}

/** Untag a character. One whose art's file names the tag is only hidden from it here. */
export function removeMember(id, name) {
  return change(id, (g) => {
    g.add = g.add.filter((n) => n !== name);
    if (!g.remove.includes(name) && artList().find((a) => a.name === name)?.tags.includes(id)) g.remove.push(name);
  });
}

/** The tag a stage shows (ALL when it has none, or its tag is gone). */
export function stageTag(scene = canvas.scene) {
  const id = scene?.getFlag(MODULE, "tag") ?? ALL;
  return isBuiltIn(id) || getTag(id) ? id : ALL;
}

export async function setStageTag(id, scene = canvas.scene) {
  requireGM();
  return scene.setFlag(MODULE, "tag", id ?? ALL);
}

/** Every stage showing tag `from` shows `to` instead (a merged or deleted tag). */
export async function retagStages(from, to = ALL) {
  requireGM();
  for (const scene of game.scenes) {
    if (scene.getFlag(MODULE, "tag") === from) await scene.setFlag(MODULE, "tag", to);
  }
}

/** Note characters as used, for the Recent list: one name or several (the first ends up newest). One write. */
export async function noteRecent(names) {
  if (!game.user.isGM) return;
  const used = [names].flat().filter(Boolean);
  if (!used.length) return;
  const before = game.settings.get(MODULE, "recent").names ?? [];
  const next = mergeRecent(used, before, RECENT_MAX);
  if (next.join("\n") === before.slice(0, RECENT_MAX).join("\n")) return;
  await game.settings.set(MODULE, "recent", { names: next });
}
