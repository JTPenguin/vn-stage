import { MODULE } from "./constants.js";
import { artList } from "./art.js";
import { decodePath, backgroundFolder } from "./stage.js";
import {
  ALL, listTags, getTag, memberNames, tagNamed, renameTag, deleteTag, copyTagInto, tagFolders,
  addFolder, removeFolder, retagStages,
} from "./tags.js";
import { listPresets, replacePresetTag } from "./presets.js";
import { askName, askChoice, confirm, esc } from "./dialogs.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Manage tags: every tag with what it holds, and what can only be done to a
 * tag as a whole: rename it, merge it into another, delete it, and set its
 * background folders. Tagging itself is done on the things (the tag window,
 * tag-editor.js).
 */
export class TagsWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vn-stage-tags",
    classes: ["vn-stage", "vn-tags"],
    window: { title: "VN Stage Tags", icon: "fa-solid fa-tags", resizable: true },
    position: { width: 460, height: 480 },
    actions: {
      renameTag: TagsWindow.#onRename,
      mergeTag: TagsWindow.#onMerge,
      deleteTag: TagsWindow.#onDelete,
      addFolder: TagsWindow.#onAddFolder,
      removeFolder: TagsWindow.#onRemoveFolder,
      newFromFolder: TagsWindow.#onNewFromFolder,
    },
  };

  static PARTS = { main: { template: `modules/${MODULE}/templates/tags-window.hbs`, scrollable: [".vn-tags-list"] } };

  static #instance = null;

  static open() {
    this.#instance ??= new TagsWindow();
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

  async _prepareContext() {
    const known = new Set(artList().map((a) => a.name));
    const count = (n, one, many = `${one}s`) => (n ? `${n} ${n === 1 ? one : many}` : null);
    const tags = await Promise.all(listTags().map(async (t) => {
      const folders = (await tagFolders(t.id)).map((f) => ({ ...f, label: folderLabel(f.folder) }));
      const summary = [
        count(memberNames(t.id).filter((n) => known.has(n)).length, "character"),
        count(getTag(t.id)?.images.length ?? 0, "background"),
        count(listPresets(t.id).length, "preset"),
      ].filter(Boolean).join(" · ");
      return { ...t, renamed: t.label !== t.id, folders, summary };
    }));
    return { tags, canMerge: tags.length > 1 };
  }

  static #tagOf(target) {
    return getTag(target.closest("[data-tag]").dataset.tag);
  }

  static async #onRename(_event, target) {
    const tag = TagsWindow.#tagOf(target);
    if (!tag) return;
    const label = await askName("Rename tag", tag.label);
    if (!label || label === tag.label) return;
    if (!(await renameTag(tag.id, label))) ui.notifications.warn(`VN Stage | Another tag is called "${label}". Use Merge to join the two.`);
  }

  /** Everything with this tag gets another tag instead, and this one goes. */
  static async #onMerge(_event, target) {
    const tag = TagsWindow.#tagOf(target);
    if (!tag) return;
    const into = await askChoice(`Merge ${tag.label} into…`, listTags().filter((t) => t.id !== tag.id), "Merge");
    if (!into || !getTag(into) || !getTag(tag.id)) return;
    await copyTagInto(tag.id, into);
    await replacePresetTag(tag.id, into);
    await retagStages(tag.id, into);
    await deleteTag(tag.id);
  }

  static async #onDelete(_event, target) {
    const tag = TagsWindow.#tagOf(target);
    if (!tag) return;
    const ok = await confirm("Delete tag", `Delete the tag <strong>${esc(tag.label)}</strong>? Its characters, backgrounds and presets stay; only the tag goes.`);
    if (!ok) return;
    await replacePresetTag(tag.id);
    await deleteTag(tag.id);
    await retagStages(tag.id, ALL);
  }

  static #pickFolder(id, current) {
    const FilePicker = foundry.applications.apps.FilePicker.implementation;
    new FilePicker({
      type: "folder",
      current: current ?? backgroundFolder() ?? "",
      callback: (path) => {
        let folder = decodePath(path);
        if (!folder.endsWith("/")) folder += "/";
        return addFolder(id, folder);
      },
    }).render({ force: true });
  }

  static #onAddFolder(_event, target) {
    const tag = TagsWindow.#tagOf(target);
    if (tag) TagsWindow.#pickFolder(tag.id, tag.folders.at(-1));
  }

  static async #onRemoveFolder(_event, target) {
    const tag = TagsWindow.#tagOf(target);
    if (tag) await removeFolder(tag.id, target.closest("[data-folder]").dataset.folder);
  }

  /** A tag that starts with a folder of backgrounds (a tag is listed once something has it, so the folder comes with the name). */
  static async #onNewFromFolder() {
    const name = await askName("New tag from a folder", "", "Choose folder…");
    if (name) TagsWindow.#pickFolder(await tagNamed(name));
  }
}

/** ".../scenarios/99-1/scenes/" → "99-1/scenes". */
export function folderLabel(folder) {
  return folder.replace(/\/$/, "").split("/").slice(-2).join("/");
}
