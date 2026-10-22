import { MODULE } from "./constants.js";
import { artIndex } from "./art.js";
import { decodePath, backgroundFolder, backgroundLabel, currentBackground, folderOf, isVideo } from "./stage.js";
import {
  ALL, listGroups, getGroup, memberNames, createGroup, renameGroup, deleteGroup, groupFolders,
  addFolder, removeFolder, addImage, removeImage, setImageGroups, addMembers, removeMember, isTagged, stageGroup, setStageGroup, setCharacterGroups,
} from "./groups.js";
import { listPresets, getPreset, setPresetsInGroup, setPresetGroups, forgetGroup } from "./presets.js";
import { PickList } from "./pick-list.js";
import { askName, confirm, esc } from "./dialogs.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * The Groups window: what each group holds, managed the same way for all three
 * kinds of thing in it. Each section lists the group's characters, backgrounds
 * (folders and single images) or presets, × takes one out, and "+ Add…" brings more in.
 */
export class GroupsWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vn-stage-groups",
    classes: ["vn-stage", "vn-groups"],
    window: { title: "VN Stage Groups", icon: "fa-solid fa-layer-group", resizable: true },
    position: { width: 640, height: 620 },
    actions: {
      selectGroup: GroupsWindow.#onSelectGroup,
      newGroup: GroupsWindow.#onNewGroup,
      renameGroup: GroupsWindow.#onRenameGroup,
      deleteGroup: GroupsWindow.#onDeleteGroup,
      addMembers: GroupsWindow.#onAddMembers,
      removeMember: GroupsWindow.#onRemoveMember,
      addFolder: GroupsWindow.#onAddFolder,
      removeFolder: GroupsWindow.#onRemoveFolder,
      addImage: GroupsWindow.#onAddImage,
      removeImage: GroupsWindow.#onRemoveImage,
      addPresets: GroupsWindow.#onAddPresets,
      removePreset: GroupsWindow.#onRemovePreset,
    },
  };

  static PARTS = { main: { template: `modules/${MODULE}/templates/groups-window.hbs`, scrollable: [".vn-groups-list", ".vn-groups-detail"] } };

  static #instance = null;

  /** Open on `groupId` (default: the viewed stage's group, if it has one). */
  static open(groupId = null) {
    this.#instance ??= new GroupsWindow();
    const id = groupId ?? stageGroup();
    if (getGroup(id)) this.#instance.#selected = id;
    return this.#instance.render({ force: true });
  }

  static #refreshTimer = null;

  /** Re-render if open; calls within 50 ms make one render (see StageWindow.refresh). */
  static refresh() {
    clearTimeout(this.#refreshTimer);
    this.#refreshTimer = setTimeout(() => {
      if (this.#instance?.rendered) this.#instance.render();
    }, 50);
  }

  #selected = null;

  async _prepareContext() {
    const index = await artIndex();
    const groups = listGroups(index);
    if (!groups.some((g) => g.id === this.#selected)) this.#selected = groups[0]?.id ?? null;
    const group = getGroup(this.#selected);
    const context = { groups: groups.map((g) => ({ ...g, selected: g.id === this.#selected })), group };
    if (!group) return context;

    const byName = new Map(index.map((a) => [a.name, a]));
    const members = memberNames(group.id, index).map((n) => byName.get(n)).filter(Boolean)
      .map((a) => ({ name: a.name, label: a.label, thumb: a.thumb, tagged: isTagged(group.id, a.name, index) }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const folders = (await groupFolders(group.id)).map((f) => ({ ...f, label: folderLabel(f.folder) }));
    const images = group.images.map((src) => ({ src, label: backgroundLabel(src), video: isVideo(src) }));
    return { ...context, members, folders, images, presets: listPresets(group.id) };
  }

  static #onSelectGroup(_event, target) {
    this.#selected = target.dataset.group;
    this.render();
  }

  static async #onNewGroup() {
    const name = await askName("New group", "", "Create");
    if (!name) return;
    this.#selected = await createGroup(name);
    this.render();
  }

  static async #onRenameGroup() {
    const group = getGroup(this.#selected);
    if (!group) return;
    const label = await askName("Rename group", group.label);
    if (label) await renameGroup(group.id, label);
  }

  static async #onDeleteGroup() {
    const group = getGroup(this.#selected);
    if (!group) return;
    const ok = await confirm("Delete group", `Delete the group <strong>${esc(group.label)}</strong>? Its characters, folders and presets stay; only the group goes.`);
    if (!ok) return;
    const wasStage = canvas.scene && stageGroup() === group.id;
    await forgetGroup(group.id);
    await deleteGroup(group.id);
    if (wasStage) await setStageGroup(ALL);
    this.#selected = null;
    this.render();
  }

  static async #onAddMembers() {
    const group = getGroup(this.#selected);
    if (!group) return;
    const index = await artIndex();
    const members = new Set(memberNames(group.id, index));
    const items = index.filter((a) => !members.has(a.name))
      .map((a) => ({ id: a.name, label: a.label, thumb: a.thumb }));
    const names = await PickList.choose({
      title: `Add characters to ${group.label}`, items, ok: "Add",
      empty: "Everyone is in this group already.",
    });
    if (names?.length) await addMembers(group.id, names);
  }

  static async #onRemoveMember(_event, target) {
    if (getGroup(this.#selected)) await removeMember(this.#selected, target.closest("[data-name]").dataset.name);
  }

  static #onAddFolder() {
    const group = getGroup(this.#selected);
    if (!group) return;
    const FilePicker = foundry.applications.apps.FilePicker.implementation;
    new FilePicker({
      type: "folder",
      current: group.folders.at(-1) ?? backgroundFolder() ?? "",
      callback: (path) => {
        let folder = decodePath(path);
        if (!folder.endsWith("/")) folder += "/";
        return addFolder(group.id, folder);
      },
    }).render({ force: true });
  }

  static async #onRemoveFolder(_event, target) {
    if (getGroup(this.#selected)) await removeFolder(this.#selected, target.closest("[data-folder]").dataset.folder);
  }

  static #onAddImage() {
    const group = getGroup(this.#selected);
    if (!group) return;
    const FilePicker = foundry.applications.apps.FilePicker.implementation;
    const last = group.images.at(-1) ?? currentBackground();
    new FilePicker({
      type: "imagevideo",
      current: last ? folderOf(last) : "",
      callback: (path) => addImage(group.id, decodePath(path)),
    }).render({ force: true });
  }

  static async #onRemoveImage(_event, target) {
    if (getGroup(this.#selected)) await removeImage(this.#selected, target.closest("[data-src]").dataset.src);
  }

  static async #onAddPresets() {
    const group = getGroup(this.#selected);
    if (!group) return;
    const label = (id) => getGroup(id)?.label ?? id;
    const items = listPresets().filter((p) => !p.groups.includes(group.id))
      .map((p) => ({ id: p.id, label: p.name, icon: "fa-solid fa-play", note: p.groups.map(label).join(", ") || null }));
    const ids = await PickList.choose({
      title: `Add presets to ${group.label}`, items, ok: "Add",
      empty: "Every preset is in this group already. Save one from the Stage window.",
    });
    if (ids?.length) await setPresetsInGroup(ids, group.id, true);
  }

  static async #onRemovePreset(_event, target) {
    if (getGroup(this.#selected)) await setPresetsInGroup([target.closest("[data-preset]").dataset.preset], this.#selected, false);
  }
}

/** ".../scenarios/99-1/scenes/" → "99-1/scenes". */
export function folderLabel(folder) {
  return folder.replace(/\/$/, "").split("/").slice(-2).join("/");
}

/* -------------------------------------------- */
/*  Groups…: one character's or preset's groups */
/* -------------------------------------------- */

/** "New group…" in a Groups… list: create it and offer it ticked. */
const newGroupButton = {
  label: "New group…", icon: "fa-solid fa-plus",
  run: async () => {
    const name = await askName("New group", "", "Create");
    if (!name) return null;
    const id = await createGroup(name);
    return [{ id, label: getGroup(id)?.label ?? id }];
  },
};

/** Choose which groups a character (art key) is in. */
export async function chooseCharacterGroups(key, label) {
  const index = await artIndex();
  const items = listGroups(index).map((g) => ({
    id: g.id, label: g.label, checked: memberNames(g.id, index).includes(key),
    note: isTagged(g.id, key, index) ? "tag" : null,
  }));
  const ids = await PickList.choose({
    title: `Groups: ${label}`, items, extra: newGroupButton,
    hint: "Tick the groups this character belongs to. Unticking a tagged group only hides them from it.",
    empty: "No groups yet.",
  });
  if (ids) await setCharacterGroups(key, ids, await artIndex());
}

/** Choose which groups hold a single background. */
export async function chooseImageGroups(src) {
  const index = await artIndex();
  const groups = listGroups(index);
  const items = await Promise.all(groups.map(async (g) => {
    const group = getGroup(g.id);
    const viaFolder = (await groupFolders(g.id)).some((f) => f.folder === folderOf(src));
    return { id: g.id, label: g.label, checked: !!group?.images.includes(src), note: viaFolder ? "in its folder" : null };
  }));
  const ids = await PickList.choose({
    title: `Groups: ${backgroundLabel(src)}`, items, extra: newGroupButton,
    hint: "Tick the groups this background appears in. \"In its folder\" groups show it anyway, through one of their folders.",
    empty: "No groups yet.",
  });
  if (ids) await setImageGroups(src, ids, index);
}

/** Choose which groups a preset is in. */
export async function choosePresetGroups(id) {
  const preset = getPreset(id);
  if (!preset) return;
  const items = listGroups(await artIndex()).map((g) => ({ id: g.id, label: g.label, checked: preset.groups.includes(g.id) }));
  const ids = await PickList.choose({
    title: `Groups: ${preset.name}`, items, extra: newGroupButton,
    hint: "Tick the groups this preset appears in. Every preset also shows under All characters.",
    empty: "No groups yet.",
  });
  if (ids) await setPresetGroups(id, ids);
}
