import { MODULE } from "./constants.js";
import { artList } from "./art.js";
import { backgroundLabel } from "./stage.js";
import { listTags, characterTags, backgroundTags, tagNamed, addMember, removeMember, addImage, removeImage, getTag } from "./tags.js";
import { getPreset, setPresetTag } from "./presets.js";
import { splitTagText } from "./rules.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * The tag window: one thing's tags as chips (× takes one off), and a field to
 * type more. Tags… on a character, a preset or a background opens it. There is
 * one window: it stays open and turns to whatever Tags… is chosen on next.
 * Every change saves at once.
 *
 *   TagEditor.open({ kind: "character", key })   // an art key; a form's tags are its character's
 *   TagEditor.open({ kind: "preset", id })
 *   TagEditor.open({ kind: "image", src })       // a single background
 */
export class TagEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vn-stage-tag-editor",
    classes: ["vn-stage", "vn-tag-editor"],
    window: { title: "Tags", icon: "fa-solid fa-tags" },
    position: { width: 340, height: "auto" },
    actions: { removeTag: TagEditor.#onRemoveTag },
  };

  static PARTS = { main: { template: `modules/${MODULE}/templates/tag-editor.hbs` } };

  static #instance = null;

  static open(target) {
    this.#instance ??= new TagEditor();
    this.#instance.#target = target;
    this.#instance.#focus = true;
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

  #target = null;
  #name = "";
  #focus = false; // put the cursor in the field after the next render (the window was opened, or a tag was typed)
  #adding = Promise.resolve(); // typed tags are saved one after another

  get title() {
    return this.#name ? `Tags: ${this.#name}` : "Tags";
  }

  async _prepareContext() {
    const t = this.#target;
    let chips = null;
    if (t?.kind === "character") {
      this.#name = artList().find((a) => a.key === t.key)?.label ?? t.key;
      chips = characterTags(t.key).map((c) => ({
        ...c, removable: true,
        note: c.fromArt ? "art file" : null,
        tooltip: c.fromArt ? "Named in the character's vn-stage.json. × only hides them from this tag here." : null,
      }));
    } else if (t?.kind === "preset") {
      const preset = getPreset(t.id);
      this.#name = preset?.name ?? "";
      if (preset) chips = preset.tags.map((id) => getTag(id)).filter(Boolean).map((c) => ({ id: c.id, label: c.label, removable: true }));
    } else if (t?.kind === "image") {
      this.#name = backgroundLabel(t.src);
      chips = (await backgroundTags())(t.src).map((c) => ({
        ...c, removable: !c.viaFolder,
        note: c.viaFolder ? "from folder" : null,
        tooltip: c.viaFolder ? "Its folder has this tag. Folders are set in Manage tags." : null,
      }));
    }
    if (!chips) return { gone: true };
    const have = new Set(chips.map((c) => c.id));
    return { chips, suggestions: listTags().filter((tag) => !have.has(tag.id)) };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const title = this.window?.title;
    if (title) title.textContent = this.title;

    const input = this.element.querySelector("input[name=tag]");
    if (!input) return;
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this.close();
      } else if (event.key === "Enter") {
        event.preventDefault();
        const names = splitTagText(input.value);
        input.value = "";
        if (names.length) this.#add(names);
      }
    });
    if (this.#focus) input.focus();
    this.#focus = false;
  }

  /** Tag the thing with each typed name (an existing tag, or a new one). */
  #add(names) {
    const target = this.#target;
    this.#adding = this.#adding.then(async () => {
      for (const name of names) await TagEditor.#set(target, await tagNamed(name), true);
    }).catch((err) => {
      console.error("VN Stage | Couldn't add the tag", err);
      ui.notifications.warn("VN Stage | Couldn't add that tag. See the console.");
    }).then(() => {
      this.#focus = true;
      this.render();
    });
    return this.#adding;
  }

  static #set(target, id, on) {
    if (target.kind === "character") return on ? addMember(id, target.key) : removeMember(id, target.key);
    if (target.kind === "preset") return setPresetTag(target.id, id, on);
    return on ? addImage(id, target.src) : removeImage(id, target.src);
  }

  static async #onRemoveTag(_event, button) {
    await TagEditor.#set(this.#target, button.closest("[data-tag]").dataset.tag, false);
    this.render();
  }
}
