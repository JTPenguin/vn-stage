import { MODULE } from "./constants.js";
import { artIndex } from "./art.js";
import { getCast, findEntry, addToCast, addParty, removeParty, clearCast, partyEntryIds, removeFromCast, moveEntry, hasParty } from "./cast.js";
import { neighbourTarget, clusterCount, joinIndex } from "./rules.js";
import { setWindowDrag } from "./interact.js";
import { openCastMenu } from "./menu.js";
import { castEntryFor, partyRow, castLists, rowContext, presetRows, backgroundStrips } from "./window-data.js";
import { getPreset, savePreset, loadPreset, deletePreset, findPresetByName, updatePreset, renamePreset } from "./presets.js";
import { isStage, makeStage, setBackground, currentBackground, pickBackground, clearFolderCache } from "./stage.js";
import { ALL, RECENT, UNTAGGED, listTags, getTag, stageTag, setStageTag } from "./tags.js";
import { TagsWindow } from "./tags-window.js";
import { TagEditor } from "./tag-editor.js";
import { askName, confirm, esc } from "./dialogs.js";
import { resetAllExpressions } from "./expressions.js";
import { gmViewLock, toggleGmViewLock } from "./view.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

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
    position: { width: 560, height: 760 },
    actions: {
      makeStage: StageWindow.#onMakeStage,
      browseBackground: StageWindow.#onBrowseBackground,
      setBackground: StageWindow.#onSetBackground,
      add: StageWindow.#onAdd,
      move: StageWindow.#onMove,
      remove: StageWindow.#onRemove,
      refreshCast: StageWindow.#onRefreshCast,
      toggleSection: StageWindow.#onToggleSection,
      toggleFolder: StageWindow.#onToggleFolder,
      manageTags: StageWindow.#onManageTags,
      pickTag: StageWindow.#onPickTag,
      resetExpressions: StageWindow.#onResetExpressions,
      clearStage: StageWindow.#onClearStage,
      addParty: StageWindow.#onAddParty,
      moveParty: StageWindow.#onMoveParty,
      removeParty: StageWindow.#onRemoveParty,
      savePreset: StageWindow.#onSavePreset,
      loadPreset: StageWindow.#onLoadPreset,
      updatePreset: StageWindow.#onUpdatePreset,
      toggleViewLock: StageWindow.#onToggleViewLock,
    },
  };

  static PARTS = { main: { template: `modules/${MODULE}/templates/stage-window.hbs`, scrollable: [".vn-cast-list", ".vn-bg-scroll"] } };

  static #instance = null;

  static open() {
    this.#instance ??= new StageWindow();
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

  get title() {
    return this.#tagLabel ? `VN Stage · ${this.#tagLabel}` : "VN Stage";
  }

  async _prepareContext() {
    const scene = canvas.scene;
    const stage = isStage(scene);
    const collapsed = game.settings.get(MODULE, "collapsed");
    const context = { sceneName: scene?.name ?? "", stage, filter: this.#filter, collapsed };
    this.#tagLabel = null;
    if (!stage) return context;

    const index = await artIndex();
    const selected = stageTag(scene);
    const tag = getTag(selected);
    this.#tagLabel = tag?.label ?? (selected === RECENT ? "Recent" : selected === UNTAGGED ? "Untagged" : null);

    const presets = presetRows(scene, selected);

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
      changedPreset: presets.find((p) => p.changed) ?? null,
      anyoneOnStage: getCast(scene).length > 0,
      cast: mine.map(rowContext),
      others: others.map(rowContext),
      emptyCast: selected === ALL
        ? "No characters found. Set the art folder in the module settings."
        : selected === RECENT ? "Nobody yet: characters you put on a stage appear here."
          : selected === UNTAGGED ? "Every character has a tag."
            : "Nobody has this tag yet. Search for a character, then right-click them and choose Tags….",
      emptyPresets: tag ? "No presets have this tag yet. Save the stage with +."
        : selected === UNTAGGED ? "Every preset has a tag." : "No presets yet. Save the stage with +.",
      outsideLabel: tag ? "Not tagged " + tag.label : selected === UNTAGGED ? "Tagged" : "Not recent",
    };
  }

  /** A lock button in the header, before the close button: lock the GM's own view to the stage. */
  _getFrameButtons(options) {
    return [
      ...super._getFrameButtons(options),
      { icon: "fa-solid fa-lock-open", label: "VNSTAGE.Window.LockView", action: "toggleViewLock" },
    ];
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

    // Video backgrounds: the thumbnail plays while hovered, then rewinds to its first frame.
    for (const video of this.element.querySelectorAll(".vn-bg-choice video")) {
      const button = video.closest(".vn-bg-choice");
      button.addEventListener("mouseenter", () => video.play().catch(() => {}));
      button.addEventListener("mouseleave", () => { video.pause(); video.currentTime = 0; });
    }

    // Right-click a background: its tags.
    for (const button of this.element.querySelectorAll(".vn-bg-choice")) {
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        TagEditor.open({ kind: "image", src: button.dataset.src });
      });
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
      });
      li.addEventListener("dragend", () => setWindowDrag(null));
      // Right-click a character's row: the same character menu as on the stage.
      if (!li.hasAttribute("data-party")) {
        li.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          const row = this.#rows.get(li.dataset.row);
          if (row) openCastMenu(row, event.clientX, event.clientY);
        });
      }
    }

    this.element.querySelector("select[name=tag]")?.addEventListener("change", (event) => setStageTag(event.target.value));
  }

  /** The preset menu: right-click a preset chip. Made once; the window's element outlives its renders. */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    const ContextMenu = foundry.applications.ux.ContextMenu.implementation;
    const row = (target) => target.closest("[data-preset]");
    const items = [
      { label: "Update from stage", icon: "fa-solid fa-floppy-disk", onClick: (_e, t) => StageWindow.#updatePreset(row(t).dataset.preset) },
      { label: "Rename…", icon: "fa-solid fa-pen", onClick: (_e, t) => StageWindow.#renamePreset(row(t).dataset.preset) },
      { label: "Tags…", icon: "fa-solid fa-tags", onClick: (_e, t) => TagEditor.open({ kind: "preset", id: row(t).dataset.preset }) },
      { label: "Delete", icon: "fa-solid fa-trash", onClick: (_e, t) => StageWindow.#deletePreset(row(t).dataset.preset) },
    ];
    new ContextMenu(this.element, ".vn-preset-list li[data-preset]", items, { jQuery: false, fixed: true });
  }

  /** Searching filters the tag's rows and brings in matching rows from outside it, under a divider. */
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

  static async #onSetBackground(_event, target) {
    await setBackground(target.dataset.src);
  }

  /**
   * Off stage, Left / Right: join the leftmost or rightmost cluster at its end
   * nearest the middle (with one cluster, Left joins its left end and Right
   * its right end). Shift-click starts a new cluster at that edge.
   */
  static async #onAdd(event, target) {
    const row = this.#rows.get(target.closest("[data-row]").dataset.row);
    if (!row) return;
    const side = target.dataset.side;
    const entry = castEntryFor(row);
    const index = event.shiftKey ? null : joinIndex(side, clusterCount(getCast()));
    await addToCast({ name: entry?.name ?? row.name, actorUuid: row.actorUuid, side, index, newCluster: event.shiftKey });
  }

  /** On stage, ‹ / ›: into the neighbouring cluster, or a new one past the edge. */
  static async #onMove(_event, target) {
    const row = this.#rows.get(target.closest("[data-row]").dataset.row);
    const entry = row && castEntryFor(row);
    const to = entry && neighbourTarget(getCast(), entry.id, Number(target.dataset.dir));
    if (to) await moveEntry(entry.id, to);
  }

  /** On stage, the lit cluster number: take the character off. */
  static async #onRemove(_event, target) {
    const row = this.#rows.get(target.closest("[data-row]").dataset.row);
    const entry = row && castEntryFor(row);
    if (entry) await removeFromCast(entry.id);
  }

  /** Collapse or expand a section, remembered on this machine. Toggled in place, without a re-render. */
  static async #onToggleSection(_event, target) {
    const section = target.closest("[data-section]");
    const collapsed = section.classList.toggle("collapsed");
    const all = { ...game.settings.get(MODULE, "collapsed"), [section.dataset.section]: collapsed };
    await game.settings.set(MODULE, "collapsed", all);
  }

  /** Collapse or expand one folder's images in the Background strip (same memory as the sections). */
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

  /** Everyone off this stage at once (they fade out). Load a preset to bring a scene back. */
  static async #onClearStage() {
    await clearCast();
  }

  static async #onResetExpressions() {
    await resetAllExpressions();
  }

  /** The Party's Left / Right: gather every member in the leftmost or rightmost cluster (shift-click: a new cluster at that edge). */
  static async #onAddParty(event, target) {
    await addParty(target.dataset.side, { newCluster: event.shiftKey });
  }

  /** The Party's ‹ / ›, once they stand together: move them all into the neighbouring cluster, or a new one past the edge. */
  static async #onMoveParty(_event, target) {
    const ids = partyEntryIds();
    const to = neighbourTarget(getCast(), ids, Number(target.dataset.dir));
    if (to) await moveEntry(ids, to);
  }

  /** The Party's lit cluster number: take them all off. */
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

  static async #onUpdatePreset(_event, target) {
    await StageWindow.#updatePreset(target.dataset.preset);
  }

  static async #updatePreset(id) {
    const preset = getPreset(id);
    if (!preset) return;
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
