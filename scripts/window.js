import { MODULE } from "./constants.js";
import { artIndex, artKeyOf } from "./art.js";
import { getCast, resolveCast, addToCast, addParty, removeFromCast, hasParty, PARTY_LABEL } from "./cast.js";
import { setWindowDrag } from "./interact.js";
import { listPresets, savePreset, loadPreset, deletePreset, findPresetByName } from "./presets.js";
import {
  isStage, makeStage, setBackground, currentBackground, pickBackground, backgroundFolder,
  folderImages, backgroundLabel, decodePath,
} from "./stage.js";
import {
  ALL, RECENT, listGroups, getGroup, memberNames, createGroup, renameGroup, deleteGroup,
  addFolder, removeFolder, addMember, removeMember, stageGroup, setStageGroup,
} from "./groups.js";
import { safetyBackground } from "./settings.js";
import { resetAllExpressions } from "./expressions.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

/**
 * The Stage window: the GM's controls for the stage being viewed (group, presets,
 * background, cast). Characters on stage are worked on the stage itself (interact.js).
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
      resetExpressions: StageWindow.#onResetExpressions,
      addParty: StageWindow.#onAddParty,
      savePreset: StageWindow.#onSavePreset,
      loadPreset: StageWindow.#onLoadPreset,
      deletePreset: StageWindow.#onDeletePreset,
    },
  };

  static PARTS = { main: { template: `modules/${MODULE}/templates/stage-window.hbs`, scrollable: [".vn-cast-list"] } };

  static #instance = null;

  /** The group being edited in the window (Edit group mode), or null. The character menu offers "Add to group" then. */
  static get editingGroup() {
    const app = this.#instance;
    return app?.rendered && app.#editing ? stageGroup() : null;
  }

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
  #entryByKey = new Map(); // art key → the cast entry standing on stage with it (from the last render)

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
    const resolved = resolveCast(scene);
    // Who stands on stage, by art key (an actor may use art under another name).
    const keyed = await Promise.all(resolved.map(async (e) => ({ e, key: (await artKeyOf(e)) ?? e.name })));
    const onStage = new Set(keyed.map((k) => k.key));
    this.#entryByKey = new Map(keyed.filter((k) => !k.e.partyOf).map((k) => [k.key, k.e]));
    const partyEntry = cast.find((e) => e.party);

    // The Cast list: the group's members, Recent in its order, or everyone.
    const byName = new Map(index.map((a) => [a.name, a]));
    let names;
    if (editing && this.#showEveryone) names = index.map((a) => a.name);
    else names = memberNames(selected, index);
    let list = names.map((n) => byName.get(n)).filter(Boolean);
    if (selected !== RECENT) list.sort((a, b) => a.label.localeCompare(b.label));

    return {
      ...context,
      editing,
      showEveryone: this.#showEveryone,
      groups: listGroups(index).map((g) => ({ ...g, selected: g.id === selected })),
      allSelected: selected === ALL,
      recentSelected: selected === RECENT,
      group,
      bg: await backgroundStrips(scene, group, collapsed),
      party: hasParty() ? { label: PARTY_LABEL, side: partyEntry?.side ?? null } : null,
      presets: listPresets(group?.id ?? null).map((p) => ({ ...p, groupLabel: group ? null : (p.group ? getGroup(p.group)?.label ?? p.group : null) })),
      cast: list.map((a) => {
        const here = keyed.filter((k) => k.key === a.key);
        const side = here.find((k) => !k.e.partyOf)?.e.side ?? null;
        const inParty = !side && here.some((k) => k.e.partyOf);
        return {
          name: a.key, label: a.label, thumb: a.thumb, onStage: onStage.has(a.key),
          search: `${a.label} ${a.key}`.toLowerCase(), member: members.has(a.key),
          left: side === "left", right: side === "right", inParty,
        };
      }),
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

    // Drag a Cast row (or The Party) onto the stage to put them where they're dropped.
    for (const li of this.element.querySelectorAll(".vn-cast-list li[draggable]")) {
      li.addEventListener("dragstart", (event) => {
        const party = li.hasAttribute("data-party");
        const entry = party ? getCast().find((e) => e.party) : this.#entryByKey.get(li.dataset.name);
        const data = party ? { type: "VNStageParty" } : { type: "VNStageCast", name: entry?.name ?? li.dataset.name, actorUuid: entry?.actorUuid ?? null };
        if (entry) data.ignore = entry.id;
        event.dataTransfer.setData("text/plain", JSON.stringify(data));
        event.dataTransfer.effectAllowed = "copyMove";
        setWindowDrag({ ignore: entry?.id ?? null });
      });
      li.addEventListener("dragend", () => setWindowDrag(null));
    }

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

  /** Left / Right toggles: turn on to put the character there (or move them), turn the lit one off to remove them. */
  static async #onAdd(_event, target) {
    const name = target.closest("[data-name]").dataset.name;
    const entry = await castEntryFor(name);
    if (entry?.side === target.dataset.side) await removeFromCast(entry.id);
    else if (entry) await addToCast({ name: entry.name, actorUuid: entry.actorUuid, side: target.dataset.side });
    else await addToCast({ name, side: target.dataset.side });
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

  static async #onResetExpressions() {
    await resetAllExpressions();
  }

  /** The Party's Left / Right toggles, the same way. */
  static async #onAddParty(_event, target) {
    const entry = getCast().find((e) => e.party);
    if (entry?.side === target.dataset.side) await removeFromCast(entry.id);
    else await addParty(target.dataset.side);
  }


  static async #onSavePreset() {
    const group = getGroup(stageGroup());
    const name = await askName(group ? `Save preset in ${group.label}` : "Save preset", "");
    if (!name) return;
    if (findPresetByName(name, group?.id ?? null)) {
      const ok = await DialogV2.confirm({
        window: { title: "Replace preset" },
        content: `<p>Replace the preset <strong>${foundry.utils.escapeHTML(name)}</strong> with what's on stage now?</p>`,
        rejectClose: false,
      });
      if (!ok) return;
    }
    await savePreset(name);
    ui.notifications.info(`VN Stage | Saved preset "${name}".`);
  }

  static async #onLoadPreset(_event, target) {
    await loadPreset(target.closest("[data-preset]").dataset.preset);
  }

  static async #onDeletePreset(_event, target) {
    const row = target.closest("[data-preset]");
    const ok = await DialogV2.confirm({
      window: { title: "Delete preset" },
      content: `<p>Delete the preset <strong>${foundry.utils.escapeHTML(row.dataset.name)}</strong>?</p>`,
      rejectClose: false,
    });
    if (ok) await deletePreset(row.dataset.preset);
  }

  static #onToggleEveryone() {
    this.#showEveryone = !this.#showEveryone;
    this.render();
  }
}

/** The cast entry (not The Party) standing on the stage with this art key, or null. */
async function castEntryFor(key) {
  for (const e of getCast()) {
    if (!e.party && ((await artKeyOf(e)) ?? e.name) === key) return e;
  }
  return null;
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
