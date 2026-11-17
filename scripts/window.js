import { MODULE } from "./constants.js";
import { artIndex } from "./art.js";
import { getCast, findEntry, removeParty, clearCast, partyEntryIds, removeFromCast, hasParty } from "./cast.js";
import { setWindowDrag } from "./interact.js";
import { openCastMenu } from "./menu.js";
import { castEntryFor, partyRow, castLists, rowContext, presetRows, backgroundStrips } from "./window-data.js";
import { getPreset, savePreset, loadPreset, deletePreset, findPresetByName, updatePreset, renamePreset, setPresetTag, stagePreset } from "./presets.js";
import { isStage, makeStage, setBackground, currentBackground, pickBackground, clearFolderCache, decodePath } from "./stage.js";
import { ALL, RECENT, UNTAGGED, listTags, getTag, stageTag, setStageTag, addImage, removeImage, addMember, removeFolder } from "./tags.js";
import { TagsWindow, pickTagFolder } from "./tags-window.js";
import { tagItemLabel, avatarsThatFit } from "./rules.js";
import { TagEditor } from "./tag-editor.js";
import { askName, confirm, esc } from "./dialogs.js";
import { resetAllExpressions } from "./expressions.js";
import { gmViewLock, toggleGmViewLock } from "./view.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const DEFAULT_SIZE = { width: 560, height: 480 };
const TAB_IDS = ["cast", "background", "presets"];

/** The size this GM last left the window at, or the default. */
function savedSize() {
  const saved = game.settings.get(MODULE, "windowSize");
  return saved?.width && saved?.height ? { width: saved.width, height: saved.height } : { ...DEFAULT_SIZE };
}

/**
 * The Stage window: the GM's controls for running the stage being viewed (tag,
 * presets, background, cast). Right-click a character, a preset or a background
 * for Tags… (tag-editor.js); whole tags are managed in Manage tags
 * (tags-window.js). Characters on stage are worked on the stage itself (interact.js).
 */
export class StageWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vn-stage-window",
    classes: ["vn-stage"],
    window: { title: "VN Stage", icon: "fa-solid fa-masks-theater", resizable: true },
    position: { ...DEFAULT_SIZE },
    actions: {
      makeStage: StageWindow.#onMakeStage,
      browseBackground: StageWindow.#onBrowseBackground,
      setBackground: StageWindow.#onSetBackground,
      remove: StageWindow.#onRemove,
      refreshCast: StageWindow.#onRefreshCast,
      toggleFolder: StageWindow.#onToggleFolder,
      manageTags: StageWindow.#onManageTags,
      pickTag: StageWindow.#onPickTag,
      resetExpressions: StageWindow.#onResetExpressions,
      clearStage: StageWindow.#onClearStage,
      removeParty: StageWindow.#onRemoveParty,
      savePreset: StageWindow.#onSavePreset,
      loadPreset: StageWindow.#onLoadPreset,
      toggleViewLock: StageWindow.#onToggleViewLock,
      addBackgroundToTag: StageWindow.#onAddBackgroundToTag,
      addFolderToTag: StageWindow.#onAddFolderToTag,
      removeFolderFromTag: StageWindow.#onRemoveFolderFromTag,
      addRowToTag: StageWindow.#onAddRowToTag,
    },
  };

  /** One tab per section. The open tab is remembered per GM. */
  static TABS = { main: { tabs: TAB_IDS.map((id) => ({ id })), initial: "cast" } };

  static PARTS = { main: { template: `modules/${MODULE}/templates/stage-window.hbs`, scrollable: [".vn-cast-list", ".vn-bg-scroll", ".vn-preset-list"] } };

  static #instance = null;

  static open() {
    if (!this.#instance) {
      this.#instance = new StageWindow({ position: savedSize() });
      const tab = game.settings.get(MODULE, "windowTab");
      this.#instance.tabGroups.main = TAB_IDS.includes(tab) ? tab : "cast";
    }
    return this.#instance.render({ force: true });
  }

  static #refreshTimer = null;

  /**
   * Re-render if open (the cast, background, tags or scene changed). One
   * change to the stage fires a hook per tile, so calls within 50 ms make one render.
   */
  static refresh() {
    clearTimeout(this.#refreshTimer);
    this.#refreshTimer = setTimeout(() => {
      if (this.#instance?.rendered) this.#instance.render();
    }, 50);
  }

  #filter = "";
  #tagLabel = null;
  #rows = new Map(); // Cast row id → its row (from the last render): who it adds, and their entry on stage
  #dragRow = null; // the Cast row being dragged, while it is
  #sizeTimer = null;
  #facesObserver = null; // refits the preset rows' avatars when the list's width changes
  #namesObserver = null; // rechecks which background names are cut short when a strip's width changes

  get title() {
    return this.#tagLabel ? `VN Stage · ${this.#tagLabel}` : "VN Stage";
  }

  async _prepareContext() {
    const scene = canvas.scene;
    const stage = isStage(scene);
    const collapsed = game.settings.get(MODULE, "collapsed");
    const context = { sceneName: scene?.name ?? "", stage, filter: this.#filter, tabs: this._prepareTabs("main") };
    this.#tagLabel = null;
    if (!stage) return context;

    const index = await artIndex();
    const selected = stageTag(scene);
    const tag = getTag(selected);
    this.#tagLabel = tag?.label ?? (selected === RECENT ? "Recent" : selected === UNTAGGED ? "Untagged" : null);

    const presets = await presetRows(index, scene, selected);

    // The Cast list: the characters with the tag, then everyone else (shown only while searching).
    const { rows, mine, others } = await castLists(index, scene, selected);
    this.#rows = new Map(rows.map((r) => [r.row, r]));

    return {
      ...context,
      tags: listTags().map((t) => ({ ...t, selected: t.id === selected })),
      allSelected: selected === ALL,
      recentSelected: selected === RECENT,
      untaggedSelected: selected === UNTAGGED,
      tag,
      bg: await backgroundStrips(scene, selected, collapsed),
      party: hasParty() ? partyRow(scene) : null,
      presets,
      anyoneOnStage: getCast(scene).length > 0,
      cast: mine.map(rowContext),
      others: others.map(rowContext),
      emptyCast: selected === ALL
        ? "No characters found. Set the art folder in the module settings."
        : selected === RECENT ? "Nobody yet: characters you put on a stage appear here."
          : selected === UNTAGGED ? "Every character has a tag."
            : "Nobody has this tag yet. Search for a character, then right-click them and choose Tags….",
      emptyPresets: tag ? "No presets have this tag yet. Save the stage with Save as preset."
        : selected === UNTAGGED ? "Every preset has a tag." : "No presets yet. Save the stage with Save as preset.",
      outsideLabel: tag ? "Not tagged " + tag.label : selected === UNTAGGED ? "Tagged" : "Not recent",
      addRowLabel: tag ? tagItemLabel(true, tag.label) : null,
      addBackgroundLabel: tag ? `Add a background to ${tag.label}` : null,
    };
  }

  /** A lock button in the header, before the close button: lock the GM's own view to the stage. */
  _getFrameButtons(options) {
    return [
      ...super._getFrameButtons(options),
      { icon: "fa-solid fa-lock-open", label: "VNSTAGE.Window.LockView", action: "toggleViewLock" },
    ];
  }

  /** Remember the open tab for next time. */
  changeTab(tab, group, options = {}) {
    super.changeTab(tab, group, options);
    if (group === "main" && TAB_IDS.includes(tab) && game.settings.get(MODULE, "windowTab") !== tab) {
      game.settings.set(MODULE, "windowTab", tab);
    }
  }

  /** Remember the window's size (saved once the GM stops resizing). */
  _onPosition(position) {
    super._onPosition(position);
    if (this.minimized || !this.rendered) return;
    const { width, height } = position;
    if (!(width > 0 && height > 0)) return;
    clearTimeout(this.#sizeTimer);
    this.#sizeTimer = setTimeout(() => {
      const was = game.settings.get(MODULE, "windowSize");
      if (was?.width === width && was?.height === height) return;
      game.settings.set(MODULE, "windowSize", { width, height });
    }, 300);
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const title = this.window?.title;
    if (title) title.textContent = this.title;

    // The lock button shows whether the view is locked now.
    const lock = this.window?.header?.querySelector("[data-action=toggleViewLock]");
    if (lock) {
      const locked = gmViewLock();
      const label = game.i18n.localize(locked ? "VNSTAGE.Window.UnlockView" : "VNSTAGE.Window.LockView");
      lock.classList.toggle("fa-lock", locked);
      lock.classList.toggle("fa-lock-open", !locked);
      lock.classList.toggle("active", locked);
      lock.setAttribute("aria-pressed", String(locked));
      lock.setAttribute("aria-label", label);
      lock.dataset.tooltip = label;
    }


    const input = this.element.querySelector("input[name=filter]");
    input?.addEventListener("input", () => {
      this.#filter = input.value;
      this.#applyFilter();
    });
    this.#applyFilter();

    // Preset rows show as many avatars as fit, then +N; again whenever the list's width changes (a resize, or its tab opening).
    this.#facesObserver?.disconnect();
    const presetList = this.element.querySelector(".vn-preset-list");
    if (presetList) {
      this.#fitFaces(presetList);
      this.#facesObserver = new ResizeObserver(() => this.#fitFaces(presetList));
      this.#facesObserver.observe(presetList);
    }

    // Background names under the thumbnails: a cut-short name shows in full on hover; again whenever a strip's width changes (a resize, its tab or folder opening).
    this.#namesObserver?.disconnect();
    const strips = this.element.querySelectorAll(".vn-bg-strip");
    this.#fitNames();
    this.#namesObserver = new ResizeObserver(() => this.#fitNames());
    for (const strip of strips) this.#namesObserver.observe(strip);

    // Video backgrounds (and presets' video backgrounds): the thumbnail plays while hovered, then rewinds to its first frame.
    for (const video of this.element.querySelectorAll(".vn-bg-choice video, .vn-preset-row video")) {
      const button = video.closest(".vn-bg-choice, .vn-preset-row");
      button.addEventListener("mouseenter", () => video.play().catch(() => {}));
      button.addEventListener("mouseleave", () => { video.pause(); video.currentTime = 0; });
    }

    // Drag a Cast row (or The Party) onto the stage to put them where they're dropped.
    for (const li of this.element.querySelectorAll(".vn-cast-list li[draggable]")) {
      li.addEventListener("dragstart", (event) => {
        const party = li.hasAttribute("data-party");
        const row = this.#rows.get(li.dataset.row);
        // What's being moved is left out when working out the drop point: the character (found as the drop finds them), or every party member on stage.
        const data = party ? { type: "VNStageParty" } : { type: "VNStageCast", name: row?.name, actorUuid: row?.actorUuid ?? null };
        const ignore = party ? partyEntryIds() : findEntry(getCast(), data)?.id ?? null;
        event.dataTransfer.setData("text/plain", JSON.stringify(data));
        event.dataTransfer.effectAllowed = "copyMove";
        setWindowDrag({ ignore });
        this.#dragRow = party ? null : li;
      });
      li.addEventListener("dragend", () => {
        setWindowDrag(null);
        this.#dragRow = null;
        this.element.querySelector(".vn-cast-list")?.classList.remove("vn-drop-tag");
      });
      // Right-click a character's row: the same character menu as on the stage.
      if (!li.hasAttribute("data-party")) {
        li.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          const row = this.#rows.get(li.dataset.row);
          if (row) openCastMenu(row, event.clientX, event.clientY);
        });
      }
    }

    this.#listenForTagDrop();

    this.element.querySelector("select[name=tag]")?.addEventListener("change", (event) => setStageTag(event.target.value));
  }

  /**
   * The right-click menus for presets and backgrounds (the Cast rows' is the
   * character menu, menu.js). Made once; the window's element outlives its
   * renders. Each offers Tags…, and Remove from the selected tag when that can
   * be done here; labels naming the tag are getters, read as the menu opens.
   */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    const ContextMenu = foundry.applications.ux.ContextMenu.implementation;
    const tag = () => getTag(stageTag());
    const removeLabel = () => tagItemLabel(false, tag()?.label ?? "");

    const row = (target) => target.closest("[data-preset]");
    const presetItems = [
      { label: "Update from stage", icon: "fa-solid fa-floppy-disk", onClick: (_e, t) => StageWindow.#updatePreset(row(t).dataset.preset) },
      { label: "Rename…", icon: "fa-solid fa-pen", onClick: (_e, t) => StageWindow.#renamePreset(row(t).dataset.preset) },
      { label: "Tags…", icon: "fa-solid fa-tags", onClick: (_e, t) => TagEditor.open({ kind: "preset", id: row(t).dataset.preset }) },
      {
        get label() { return removeLabel(); }, icon: "fa-solid fa-minus",
        visible: (t) => !!tag() && !!getPreset(row(t).dataset.preset)?.tags.includes(tag().id),
        onClick: (_e, t) => setPresetTag(row(t).dataset.preset, tag()?.id, false),
      },
      { label: "Delete", icon: "fa-solid fa-trash", onClick: (_e, t) => StageWindow.#deletePreset(row(t).dataset.preset) },
    ];
    new ContextMenu(this.element, ".vn-preset-list li[data-preset]", presetItems, { jQuery: false, fixed: true });

    // A background's data-tag-item says what it offers for the tag (backgroundStrips).
    const bgItems = [
      { label: "Tags…", icon: "fa-solid fa-tags", onClick: (_e, t) => TagEditor.open({ kind: "image", src: t.dataset.src }) },
      {
        get label() { return removeLabel(); }, icon: "fa-solid fa-minus",
        visible: (t) => !!tag() && t.dataset.tagItem === "remove",
        onClick: (_e, t) => { const id = tag()?.id; if (id) return removeImage(id, t.dataset.src); },
      },
      {
        get label() { return `In ${tag()?.label ?? ""} through its folder: Manage tags…`; }, icon: "fa-solid fa-folder",
        visible: (t) => !!tag() && t.dataset.tagItem === "folder",
        onClick: () => TagsWindow.open(),
      },
    ];
    new ContextMenu(this.element, ".vn-bg-choice", bgItems, { jQuery: false, fixed: true });
  }

  /**
   * Drag a Cast row from outside the tag (shown while searching) up above the
   * divider to add them to the tag. Dropping on the stage works as before.
   */
  #listenForTagDrop() {
    const list = this.element.querySelector(".vn-cast-list");
    const divider = list?.querySelector(".vn-cast-divider");
    if (!list || !divider) return;
    const over = (event) => {
      const li = this.#dragRow;
      return !!li && li.classList.contains("outside") && !divider.hidden && !!getTag(stageTag())
        && event.clientY < divider.getBoundingClientRect().top;
    };
    list.addEventListener("dragover", (event) => {
      const on = over(event);
      list.classList.toggle("vn-drop-tag", on);
      if (!on) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    });
    list.addEventListener("dragleave", (event) => {
      if (!list.contains(event.relatedTarget)) list.classList.remove("vn-drop-tag");
    });
    list.addEventListener("drop", async (event) => {
      list.classList.remove("vn-drop-tag");
      if (!over(event)) return;
      event.preventDefault();
      await this.#addRowToTag(this.#dragRow.dataset.row);
    });
  }

  /** Add a Cast row's character to the selected tag. */
  async #addRowToTag(rowId) {
    const tag = getTag(stageTag());
    const row = this.#rows.get(rowId);
    if (tag && row) await addMember(tag.id, row.key);
  }

  /** Searching filters the tag's rows and brings in matching rows from outside it, under a divider. */
  _onClose(options) {
    super._onClose(options);
    this.#facesObserver?.disconnect();
    this.#facesObserver = null;
    this.#namesObserver?.disconnect();
    this.#namesObserver = null;
  }

  /** Give each background a hover text with its full name, only where the name under its thumbnail is cut short. */
  #fitNames() {
    for (const name of this.element.querySelectorAll(".vn-bg-name")) {
      if (!name.clientWidth) continue; // hidden (its tab or folder is closed); the observer checks it once it shows
      const button = name.closest(".vn-bg-choice");
      if (name.scrollWidth > name.clientWidth) button.dataset.tooltip = esc(name.textContent);
      else delete button.dataset.tooltip;
    }
  }

  /** Trim each preset row's avatars to its width, counting the rest in a "+N" that names them on hover. */
  #fitFaces(list) {
    for (const row of list.querySelectorAll(".vn-preset-faces")) {
      const width = row.clientWidth;
      if (!width) continue; // its tab is hidden; the observer fits it once it shows
      const faces = [...row.querySelectorAll(".vn-face:not(.vn-face-more)")];
      const more = row.querySelector(".vn-face-more");
      for (const f of faces) f.hidden = false;
      const size = faces[0]?.offsetWidth ?? 0;
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const shown = size ? avatarsThatFit(faces.length, width, size, gap) : faces.length;
      faces.forEach((f, i) => { f.hidden = i >= shown; });
      const rest = faces.slice(shown);
      more.hidden = !rest.length;
      more.textContent = rest.length ? `+${rest.length}` : "";
      if (rest.length) more.dataset.tooltip = rest.map((f) => esc(f.dataset.name)).join("<br>");
      else delete more.dataset.tooltip;
    }
  }

  #applyFilter() {
    const q = this.#filter.trim().toLowerCase();
    let outside = 0;
    for (const li of this.element.querySelectorAll(".vn-cast-list [data-search]")) {
      const match = !q || li.dataset.search.includes(q);
      const other = li.classList.contains("outside");
      li.hidden = other ? !q || !match : !match;
      if (other && !li.hidden) outside++;
    }
    const divider = this.element.querySelector(".vn-cast-divider");
    if (divider) divider.hidden = !outside;
  }

  static async #onToggleViewLock() {
    game.tooltip.deactivate(); // so the hover label doesn't show the old state
    await toggleGmViewLock();
  }

  static async #onMakeStage() {
    await makeStage();
  }

  static async #onBrowseBackground() {
    const FilePicker = foundry.applications.apps.FilePicker.implementation;
    const tagged = !!getTag(stageTag());
    new FilePicker({
      type: "imagevideo",
      current: currentBackground() ?? "",
      callback: (path) => pickBackground(path, { keepFolder: tagged }),
    }).render({ force: true });
  }

  /** +: pick a background and add it to the selected tag. The stage doesn't change; Browse… is for that. */
  static #onAddBackgroundToTag() {
    const tag = getTag(stageTag());
    if (!tag) return;
    const FilePicker = foundry.applications.apps.FilePicker.implementation;
    new FilePicker({
      type: "imagevideo",
      current: tag.images.at(-1) ?? currentBackground() ?? "",
      callback: (path) => addImage(tag.id, decodePath(path)),
    }).render({ force: true });
  }

  /** Add folder…: pick a folder of backgrounds and add it to the selected tag. */
  static #onAddFolderToTag() {
    const tag = getTag(stageTag());
    if (tag) pickTagFolder(tag.id, tag.folders.at(-1));
  }
  /** The × on a folder heading: takes that folder off the current tag, as Manage tags does. */
  static async #onRemoveFolderFromTag(_event, target) {
    const tag = getTag(stageTag());
    if (tag) await removeFolder(tag.id, target.closest("[data-folder]").dataset.folder);
  }

  /** The + on a Cast row from outside the tag. */
  static async #onAddRowToTag(_event, target) {
    await this.#addRowToTag(target.closest("[data-row]").dataset.row);
  }

  static async #onSetBackground(_event, target) {
    await setBackground(target.dataset.src);
  }

  /** On stage, ×: take the character off. */
  static async #onRemove(_event, target) {
    const row = this.#rows.get(target.closest("[data-row]").dataset.row);
    const entry = row && castEntryFor(row);
    if (entry) await removeFromCast(entry.id);
  }

  /** Collapse or expand one folder's images in the Background tab, remembered on this machine. */
  static async #onToggleFolder(_event, target) {
    const strip = target.closest("[data-folder]");
    const collapsed = strip.classList.toggle("collapsed");
    const all = { ...game.settings.get(MODULE, "collapsed"), [`folder:${strip.dataset.folder}`]: collapsed };
    await game.settings.set(MODULE, "collapsed", all);
  }

  static async #onRefreshCast() {
    clearFolderCache();
    await artIndex({ refresh: true });
    this.render();
    TagsWindow.refresh();
    TagEditor.refresh();
  }

  static #onManageTags() {
    TagsWindow.open();
  }

  /** A tag chip on a Cast row: show that tag. */
  static async #onPickTag(_event, target) {
    await setStageTag(target.dataset.tag);
  }

  /** Everyone off this stage at once (they fade out), after asking. Load a preset to bring a scene back. */
  static async #onClearStage() {
    const ok = await confirm("Clear the stage", "Take everyone off the stage?");
    if (!ok) return;
    await clearCast();
  }

  static async #onResetExpressions() {
    await resetAllExpressions();
  }

  /** The Party's ×: take every member off. */
  static async #onRemoveParty() {
    await removeParty();
  }

  static async #onSavePreset() {
    const tag = getTag(stageTag());
    const name = await askName(tag ? `Save preset tagged ${tag.label}` : "Save preset", "");
    if (!name) return;
    if (findPresetByName(name, tag?.id ?? null)) {
      const ok = await confirm("Replace preset", `Replace the preset <strong>${esc(name)}</strong> with what's on stage now?`);
      if (!ok) return;
    }
    await savePreset(name);
    ui.notifications.info(`VN Stage | Saved preset "${name}".`);
  }

  static async #onLoadPreset(_event, target) {
    await loadPreset(target.closest("[data-preset]").dataset.preset);
  }

  /** Save the stage over a preset. The loaded one saves at once; any other asks first, naming it. */
  static async #updatePreset(id) {
    const preset = getPreset(id);
    if (!preset) return;
    if (stagePreset()?.id !== id) {
      const ok = await confirm("Update preset", `Save what's on stage now over the preset <strong>${esc(preset.name)}</strong>? It isn't the one loaded.`);
      if (!ok) return;
    }
    await updatePreset(id);
    ui.notifications.info(`VN Stage | Updated preset "${preset.name}".`);
  }

  static async #renamePreset(id) {
    const preset = getPreset(id);
    if (!preset) return;
    const name = await askName("Rename preset", preset.name);
    if (name) await renamePreset(id, name);
  }

  static async #deletePreset(id) {
    const preset = getPreset(id);
    if (!preset) return;
    const ok = await confirm("Delete preset", `Delete the preset <strong>${esc(preset.name)}</strong>?`);
    if (ok) await deletePreset(id);
  }
}
