import { MODULE } from "./constants.js";
import { artIndex, characterArt } from "./art.js";
import { getCast, addToCast, removeFromCast, switchSide, moveInSide, characterPrefs, setFlip } from "./cast.js";
import {
  isStage, makeStage, setBackground, currentBackground, pickBackground, backgroundFolder,
  folderImages, backgroundLabel, decodePath,
} from "./stage.js";
import {
  ALL, RECENT, listGroups, getGroup, memberNames, createGroup, renameGroup, deleteGroup,
  addFolder, removeFolder, addMember, removeMember, stageGroup, setStageGroup,
} from "./groups.js";
import { safetyBackground } from "./settings.js";
import { AdjustWindow } from "./adjust.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

/** The Stage window: every GM control for the stage being viewed, in one place. */
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
      remove: StageWindow.#onRemove,
      switchSide: StageWindow.#onSwitchSide,
      forward: StageWindow.#onForward,
      back: StageWindow.#onBack,
      flip: StageWindow.#onFlip,
      adjust: StageWindow.#onAdjust,
      refreshCast: StageWindow.#onRefreshCast,
      toggleSection: StageWindow.#onToggleSection,
      toggleFolder: StageWindow.#onToggleFolder,
      newGroup: StageWindow.#onNewGroup,
      editGroup: StageWindow.#onEditGroup,
      doneEditing: StageWindow.#onDoneEditing,
      renameGroup: StageWindow.#onRenameGroup,
      deleteGroup: StageWindow.#onDeleteGroup,
      addFolder: StageWindow.#onAddFolder,
      removeFolder: StageWindow.#onRemoveFolder,
      addMember: StageWindow.#onAddMember,
      removeMember: StageWindow.#onRemoveMember,
      toggleEveryone: StageWindow.#onToggleEveryone,
    },
  };

  static PARTS = { main: { template: `modules/${MODULE}/templates/stage-window.hbs`, scrollable: [".vn-cast-list"] } };

  static #instance = null;

  static open() {
    this.#instance ??= new StageWindow();
    return this.#instance.render({ force: true });
  }

  /** Re-render if open (the cast, background, groups or scene changed). */
  static refresh() {
    if (this.#instance?.rendered) this.#instance.render();
  }

  #filter = "";
  #editing = false;      // Edit group mode: the rarely used group controls
  #showEveryone = false; // in Edit group mode, list everyone, not just members
  #groupLabel = null;

  get title() {
    return this.#groupLabel ? `VN Stage · ${this.#groupLabel}` : "VN Stage";
  }

  async _prepareContext() {
    const scene = canvas.scene;
    const stage = isStage(scene);
    const collapsed = game.settings.get(MODULE, "collapsed");
    const context = { sceneName: scene?.name ?? "", stage, filter: this.#filter, collapsed };
    this.#groupLabel = null;
    if (!stage) return context;

    const index = await artIndex();
    const selected = stageGroup(scene);
    const group = getGroup(selected);
    if (!group) this.#editing = false;
    const editing = this.#editing;
    this.#groupLabel = group?.label ?? (selected === RECENT ? "Recent" : null);

    const members = new Set(group ? memberNames(group.id, index) : []);
    const cast = getCast(scene);
    const rows = await Promise.all(cast.map(async (e) => {
      const art = await characterArt(e.name);
      const actor = e.actorUuid ? fromUuidSync(e.actorUuid) : null;
      return {
        id: e.id, name: e.name, side: e.side,
        thumb: art?.thumb ?? actor?.img ?? "icons/svg/mystery-man.svg",
        fallback: !art,
        flip: !!characterPrefs(e.name).flip,
        inGroup: members.has(e.name),
      };
    }));
    const side = (s) => rows.filter((r) => r.side === s).map((r, i, all) => ({ ...r, first: i === 0, last: i === all.length - 1 }));
    const onStage = new Set(cast.map((e) => e.name));

    // The Cast list: the group's members, Recent in its order, or everyone.
    const byName = new Map(index.map((a) => [a.name, a]));
    let names;
    if (editing && this.#showEveryone) names = index.map((a) => a.name);
    else names = memberNames(selected, index);
    let list = names.map((n) => byName.get(n)).filter(Boolean);
    if (selected !== RECENT) list.sort((a, b) => a.name.localeCompare(b.name));

    return {
      ...context,
      editing,
      showEveryone: this.#showEveryone,
      groups: listGroups(index).map((g) => ({ ...g, selected: g.id === selected })),
      allSelected: selected === ALL,
      recentSelected: selected === RECENT,
      group,
      bg: await backgroundStrips(scene, group, collapsed),
      left: side("left"),
      right: side("right"),
      cast: list.map((a) => ({
        name: a.name, thumb: a.thumb, onStage: onStage.has(a.name), search: a.name.toLowerCase(), member: members.has(a.name),
      })),
      emptyCast: selected === ALL
        ? "No characters found. Set the art folder in the module settings."
        : selected === RECENT ? "Nobody yet: characters you put on a stage appear here."
          : "Nobody in this group yet. Use Edit group to add characters, or tag them in the art pipeline.",
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const title = this.window?.title;
    if (title) title.textContent = this.title;

    const input = this.element.querySelector("input[name=filter]");
    input?.addEventListener("input", () => {
      this.#filter = input.value;
      this.#applyFilter();
    });
    this.#applyFilter();

    this.element.querySelector("select[name=group]")?.addEventListener("change", async (event) => {
      this.#editing = false;
      this.#showEveryone = false;
      await setStageGroup(event.target.value);
    });
  }

  #applyFilter() {
    const q = this.#filter.trim().toLowerCase();
    for (const li of this.element.querySelectorAll(".vn-cast-list [data-search]")) {
      li.hidden = !!q && !li.dataset.search.includes(q);
    }
  }

  static async #onMakeStage() {
    await makeStage();
  }

  static async #onBrowseBackground() {
    const FilePicker = foundry.applications.apps.FilePicker.implementation;
    const grouped = !!getGroup(stageGroup());
    new FilePicker({
      type: "image",
      current: currentBackground() ?? "",
      callback: (path) => pickBackground(path, { keepFolder: grouped }),
    }).render({ force: true });
  }

  static async #onSetBackground(_event, target) {
    await setBackground(target.dataset.src);
  }

  static async #onAdd(_event, target) {
    await addToCast({ name: target.closest("[data-name]").dataset.name, side: target.dataset.side });
  }

  static async #onRemove(_event, target) {
    await removeFromCast(target.closest("[data-id]").dataset.id);
  }

  static async #onSwitchSide(_event, target) {
    await switchSide(target.closest("[data-id]").dataset.id);
  }

  static async #onForward(_event, target) {
    await moveInSide(target.closest("[data-id]").dataset.id, -1);
  }

  static async #onBack(_event, target) {
    await moveInSide(target.closest("[data-id]").dataset.id, 1);
  }

  static async #onFlip(_event, target) {
    const name = target.closest("[data-name]").dataset.name;
    await setFlip(name, !characterPrefs(name).flip);
  }

  static #onAdjust(_event, target) {
    AdjustWindow.open(target.closest("[data-id]").dataset.id);
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
    await artIndex({ refresh: true });
    this.render();
  }

  /* ---------------------------------------- */
  /*  Groups                                  */
  /* ---------------------------------------- */

  static async #onNewGroup() {
    const name = await askName("New group", "");
    if (!name) return;
    const id = await createGroup(name);
    this.#editing = true;
    this.#showEveryone = false;
    await setStageGroup(id);
  }

  static #onEditGroup() {
    this.#editing = true;
    this.render();
  }

  static #onDoneEditing() {
    this.#editing = false;
    this.#showEveryone = false;
    this.render();
  }

  static async #onRenameGroup() {
    const group = getGroup(stageGroup());
    if (!group) return;
    const label = await askName("Rename group", group.label);
    if (label) await renameGroup(group.id, label);
  }

  static async #onDeleteGroup() {
    const group = getGroup(stageGroup());
    if (!group) return;
    const ok = await DialogV2.confirm({
      window: { title: "Delete group" },
      rejectClose: false,
      content: `<p>Delete the group <strong>${foundry.utils.escapeHTML(group.label)}</strong>? Its characters and folders stay; only the group goes.</p>`,
    });
    if (!ok) return;
    this.#editing = false;
    await deleteGroup(group.id);
    await setStageGroup(ALL);
  }

  static async #onAddFolder() {
    const group = getGroup(stageGroup());
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
    const group = getGroup(stageGroup());
    if (group) await removeFolder(group.id, target.closest("[data-folder]").dataset.folder);
  }

  static async #onAddMember(_event, target) {
    const group = getGroup(stageGroup());
    if (group) await addMember(group.id, target.closest("[data-name]").dataset.name);
  }

  static async #onRemoveMember(_event, target) {
    const group = getGroup(stageGroup());
    if (group) await removeMember(group.id, target.closest("[data-name]").dataset.name);
  }

  static #onToggleEveryone() {
    this.#showEveryone = !this.#showEveryone;
    this.render();
  }
}

/** A one-field name dialog; resolves to the trimmed name, or null. */
async function askName(title, value) {
  const name = await DialogV2.prompt({
    window: { title },
    content: `<input type="text" name="name" value="${foundry.utils.escapeHTML(value ?? "")}" autofocus>`,
    ok: { label: "Save", callback: (_event, button) => button.form.elements.name.value },
    rejectClose: false,
  });
  return name?.trim() || null;
}

/**
 * The Background strips: the default background pinned first, then each of the
 * group's folders (with a heading when there's more than one, or while editing),
 * or the stage's own last-browsed folder when there's no group.
 */
async function backgroundStrips(scene, group, collapsed) {
  const current = currentBackground(scene);
  const safety = safetyBackground();
  const same = (a, b) => !!a && !!b && decodePath(a) === decodePath(b);
  const choice = (src, label, pinned = false) => ({ src, label, pinned, current: same(src, current) });

  const folders = group ? group.folders : [backgroundFolder(scene)].filter(Boolean);
  const strips = await Promise.all(folders.map(async (folder) => ({
    folder,
    heading: group ? folderLabel(folder) : null,
    collapsed: !!collapsed[`folder:${folder}`],
    choices: (await folderImages(folder)).filter((src) => !same(src, safety)).map((src) => choice(src, backgroundLabel(src))),
  })));
  const pinned = safety ? [choice(safety, "Default background", true)] : [];
  const showHeadings = !!group && strips.length > 1;
  for (const s of strips) s.showHeading = showHeadings;
  return { pinned, strips, folder: group ? null : folders[0] ?? null, grouped: !!group };
}

/** ".../scenarios/99-1/scenes/" → "99-1/scenes". */
function folderLabel(folder) {
  return folder.replace(/\/$/, "").split("/").slice(-2).join("/");
}
