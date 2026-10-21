import { MODULE } from "./constants.js";
import { artIndex, indexedActorKey } from "./art.js";
import { getCast, addToCast, addParty, removeParty, partySide, partyMembers, removeFromCast, hasParty, PARTY_LABEL } from "./cast.js";
import { setWindowDrag, openCastMenu } from "./interact.js";
import {
  listPresets, getPreset, savePreset, loadPreset, deletePreset, findPresetByName, updatePreset, renamePreset, stagePreset,
} from "./presets.js";
import {
  isStage, makeStage, setBackground, currentBackground, pickBackground, backgroundFolder,
  folderImages, backgroundLabel, decodePath, isVideo, clearFolderCache,
} from "./stage.js";
import { ALL, RECENT, listGroups, getGroup, groupFolders, memberNames, stageGroup, setStageGroup } from "./groups.js";
import { GroupsWindow, folderLabel, choosePresetGroups, chooseImageGroups } from "./groups-window.js";
import { askName, confirm, esc } from "./dialogs.js";
import { safetyBackground } from "./settings.js";
import { resetAllExpressions } from "./expressions.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * The Stage window: the GM's controls for running the stage being viewed (group,
 * presets, background, cast). What a group holds is managed in the Groups window
 * (groups-window.js); characters on stage are worked on the stage itself (interact.js).
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
      manageGroups: StageWindow.#onManageGroups,
      resetExpressions: StageWindow.#onResetExpressions,
      addParty: StageWindow.#onAddParty,
      savePreset: StageWindow.#onSavePreset,
      loadPreset: StageWindow.#onLoadPreset,
      updatePreset: StageWindow.#onUpdatePreset,
    },
  };

  static PARTS = { main: { template: `modules/${MODULE}/templates/stage-window.hbs`, scrollable: [".vn-cast-list", ".vn-bg-scroll"] } };

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
  #groupLabel = null;
  #rows = new Map(); // Cast row id → its row (from the last render): who it adds, and their entry on stage

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
    this.#groupLabel = group?.label ?? (selected === RECENT ? "Recent" : null);

    const presets = presetRows(scene, group);

    // The Cast list: the group's members (Recent in its order, or everyone);
    // everyone else is listed after them, shown only while searching.
    const rows = await castRows(index, getCast(scene));
    this.#rows = new Map(rows.map((r) => [r.row, r]));
    const members = memberNames(selected, index);
    const inGroup = new Set(members);
    const byLabel = (a, b) => a.label.localeCompare(b.label);
    const mine = rows.filter((r) => inGroup.has(r.key));
    if (selected === RECENT) mine.sort((a, b) => members.indexOf(a.key) - members.indexOf(b.key) || byLabel(a, b));
    else mine.sort(byLabel);
    const others = selected === ALL ? [] : rows.filter((r) => !inGroup.has(r.key)).sort(byLabel);

    return {
      ...context,
      groups: listGroups(index).map((g) => ({ ...g, selected: g.id === selected })),
      allSelected: selected === ALL,
      recentSelected: selected === RECENT,
      group,
      bg: await backgroundStrips(scene, group, collapsed),
      party: hasParty() ? { label: PARTY_LABEL, side: partySide(scene), onStage: partyOnStage(scene) } : null,
      presets,
      changedPreset: presets.find((p) => p.changed) ?? null,
      cast: mine.map(rowContext),
      others: others.map(rowContext),
      emptyCast: selected === ALL
        ? "No characters found. Set the art folder in the module settings."
        : selected === RECENT ? "Nobody yet: characters you put on a stage appear here."
          : "Nobody in this group yet. Add characters in Manage groups, or tag them in the art pipeline.",
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

    // Video backgrounds: the thumbnail plays while hovered, then rewinds to its first frame.
    for (const video of this.element.querySelectorAll(".vn-bg-choice video")) {
      const button = video.closest(".vn-bg-choice");
      button.addEventListener("mouseenter", () => video.play().catch(() => {}));
      button.addEventListener("mouseleave", () => { video.pause(); video.currentTime = 0; });
    }

    // Right-click a background: Groups… (which groups offer it).
    for (const button of this.element.querySelectorAll(".vn-bg-choice")) {
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        chooseImageGroups(button.dataset.src);
      });
    }

    // Drag a Cast row (or The Party) onto the stage to put them where they're dropped.
    for (const li of this.element.querySelectorAll(".vn-cast-list li[draggable]")) {
      li.addEventListener("dragstart", (event) => {
        const party = li.hasAttribute("data-party");
        const row = this.#rows.get(li.dataset.row);
        // What's being moved is left out when working out the drop point: the character, or every party member on stage.
        const ignore = party ? partyEntryIds() : row?.entry?.id ?? null;
        const data = party ? { type: "VNStageParty" } : { type: "VNStageCast", name: row?.name, actorUuid: row?.actorUuid ?? null };
        if (ignore) data.ignore = ignore;
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
          if (row) openCastMenu(row.key, row.entry, event.clientX, event.clientY);
        });
      }
    }

    this.element.querySelector("select[name=group]")?.addEventListener("change", (event) => setStageGroup(event.target.value));
  }

  /** The preset menu: right-click a preset chip. Made once; the window's element outlives its renders. */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    const ContextMenu = foundry.applications.ux.ContextMenu.implementation;
    const row = (target) => target.closest("[data-preset]");
    const items = [
      { label: "Update from stage", icon: "fa-solid fa-floppy-disk", onClick: (_e, t) => StageWindow.#updatePreset(row(t).dataset.preset) },
      { label: "Rename…", icon: "fa-solid fa-pen", onClick: (_e, t) => StageWindow.#renamePreset(row(t).dataset.preset) },
      { label: "Groups…", icon: "fa-solid fa-layer-group", onClick: (_e, t) => choosePresetGroups(row(t).dataset.preset) },
      { label: "Delete", icon: "fa-solid fa-trash", onClick: (_e, t) => StageWindow.#deletePreset(row(t).dataset.preset) },
    ];
    new ContextMenu(this.element, ".vn-preset-list li[data-preset]", items, { jQuery: false, fixed: true });
  }

  /** Searching filters the group's rows and brings in matching rows from outside it, under a divider. */
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

  static async #onMakeStage() {
    await makeStage();
  }

  static async #onBrowseBackground() {
    const FilePicker = foundry.applications.apps.FilePicker.implementation;
    const grouped = !!getGroup(stageGroup());
    new FilePicker({
      type: "imagevideo",
      current: currentBackground() ?? "",
      callback: (path) => pickBackground(path, { keepFolder: grouped }),
    }).render({ force: true });
  }

  static async #onSetBackground(_event, target) {
    await setBackground(target.dataset.src);
  }

  /** Left / Right toggles: turn on to put the character there (or move them), turn the lit one off to remove them. */
  static async #onAdd(_event, target) {
    const row = this.#rows.get(target.closest("[data-row]").dataset.row);
    if (!row) return;
    const side = target.dataset.side;
    const entry = castEntryFor(row);
    if (entry?.side === side) await removeFromCast(entry.id);
    else await addToCast({ name: entry?.name ?? row.name, actorUuid: row.actorUuid, side });
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
    GroupsWindow.refresh();
  }

  static #onManageGroups() {
    GroupsWindow.open(stageGroup());
  }

  static async #onResetExpressions() {
    await resetAllExpressions();
  }

  /** The Party's Left / Right toggles: put every member on that side; the lit one (all of them there) takes them all off. */
  static async #onAddParty(_event, target) {
    if (partySide() === target.dataset.side) await removeParty();
    else await addParty(target.dataset.side);
  }

  static async #onSavePreset() {
    const group = getGroup(stageGroup());
    const name = await askName(group ? `Save preset in ${group.label}` : "Save preset", "");
    if (!name) return;
    if (findPresetByName(name, group?.id ?? null)) {
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
    const ok = await confirm("Delete preset", `Delete the preset <strong>${esc(preset.name)}</strong>? It leaves every group.`);
    if (ok) await deletePreset(id);
  }
}

/** The cast entry (not The Party) a row's toggles work on: its actor's, or for art alone, the art-only entry. */
function castEntryFor(row) {
  return getCast().find((e) => (row.actorUuid ? e.actorUuid === row.actorUuid : !e.actorUuid && e.name === row.key)) ?? null;
}

/** The cast entry ids of the party members on stage. */
export function partyEntryIds(scene = canvas.scene) {
  const members = new Set(partyMembers().map((a) => a.uuid));
  return getCast(scene).filter((e) => members.has(e.actorUuid)).map((e) => e.id);
}

/** Is any party member on stage? (The Party's row lights up a little, even when they're split.) */
function partyOnStage(scene) {
  return partyEntryIds(scene).length > 0;
}

/**
 * Everyone the Cast list can offer: one row per world actor with VN art (so it
 * goes on stage linked, and its owners control its expression; several actors
 * can share one character's art), and one per character no actor uses (or that
 * stands on stage without an actor); forms have no rows of their own. Each row
 * knows its cast entry on stage.
 */
async function castRows(index, resolved) {
  const byKey = new Map(index.map((a) => [a.key, a]));
  const keys = new Set(byKey.keys());
  const rows = [];
  const usedKeys = new Set();
  for (const actor of game.actors) {
    if (actor.type === "party") continue;
    const key = await indexedActorKey(actor, keys);
    const art = key && byKey.get(key);
    if (!art) continue;
    usedKeys.add(key);
    rows.push({ row: actor.uuid, key, name: actor.name, actorUuid: actor.uuid, label: actor.name, note: art.label !== actor.name ? art.label : null, thumb: art.thumb });
  }
  const artOnlyOnStage = new Set(resolved.filter((e) => !e.actorUuid).map((e) => e.name));
  for (const art of index) {
    if (usedKeys.has(art.key) && !artOnlyOnStage.has(art.key)) continue;
    // Forms are switched from the character menu, so they get no row of their own (unless one stands on stage as art alone).
    if (art.key.includes("/forms/") && !artOnlyOnStage.has(art.key)) continue;
    rows.push({ row: `art:${art.key}`, key: art.key, name: art.key, actorUuid: null, label: art.label, note: usedKeys.has(art.key) ? "art only" : null, thumb: art.thumb });
  }
  for (const r of rows) {
    r.entry = resolved.find((e) => (r.actorUuid ? e.actorUuid === r.actorUuid : !e.actorUuid && e.name === r.key)) ?? null;
    r.side = r.entry?.side ?? null;
  }
  return rows;
}

function rowContext(r) {
  return {
    row: r.row, label: r.label, note: r.note, thumb: r.thumb,
    onStage: !!r.entry,
    search: `${r.label} ${r.note ?? ""} ${r.key}`.toLowerCase(),
    left: r.side === "left", right: r.side === "right",
  };
}

/**
 * The Presets list: the group's presets (every preset under All characters and
 * Recent, labelled with their groups). The one last loaded or saved on this stage
 * is lit, and marked changed once the stage differs from it.
 */
function presetRows(scene, group) {
  const lit = stagePreset(scene);
  const label = (id) => getGroup(id)?.label ?? id;
  return listPresets(group?.id ?? null).map((p) => ({
    id: p.id,
    name: p.name,
    // Foundry shows tooltips as HTML, so the names are escaped.
    tooltip: [
      esc(p.name),
      group ? null : p.groups.length ? `Groups: ${esc(p.groups.map(label).join(", "))}` : null,
      lit?.id === p.id && lit.changed ? "The stage has changed since it was loaded" : null,
      "Click to load · right-click for more",
    ].filter(Boolean).join("<br>"),
    current: lit?.id === p.id,
    changed: lit?.id === p.id && lit.changed,
  }));
}

/**
 * The Background strips: the default background pinned first (and the one shown
 * now, when it's in no strip, so it can be added to a group), then the group's
 * single backgrounds and each of its folders, with a heading each when there's
 * more than one strip; or the stage's own last-browsed folder when there's no group.
 */
async function backgroundStrips(scene, group, collapsed) {
  const current = currentBackground(scene);
  const safety = safetyBackground();
  const same = (a, b) => !!a && !!b && decodePath(a) === decodePath(b);
  const choice = (src, label, pinned = false) => ({ src, label, pinned, video: isVideo(src), current: same(src, current) });

  const folders = group ? (await groupFolders(group.id)).map((f) => f.folder) : [backgroundFolder(scene)].filter(Boolean);
  const strips = await Promise.all(folders.map(async (folder) => ({
    folder,
    heading: group ? folderLabel(folder) : null,
    collapsed: !!collapsed[`folder:${folder}`],
    choices: (await folderImages(folder)).filter((src) => !same(src, safety)).map((src) => choice(src, backgroundLabel(src))),
  })));
  if (group?.images.length) {
    strips.unshift({
      folder: `images:${group.id}`,
      heading: "Single backgrounds",
      collapsed: !!collapsed[`folder:images:${group.id}`],
      choices: group.images.filter((src) => !same(src, safety)).map((src) => choice(src, backgroundLabel(src))),
    });
  }
  const pinned = safety ? [choice(safety, "Default background", true)] : [];
  const offered = strips.some((s) => s.choices.some((c) => c.current)) || same(current, safety);
  if (current && !offered) pinned.push({ ...choice(current, `${backgroundLabel(current)} (shown now; right-click to add it to a group)`), elsewhere: true });
  const showHeadings = !!group && strips.length > 1;
  for (const s of strips) s.showHeading = showHeadings;
  return { pinned, strips, folder: group ? null : folders[0] ?? null, grouped: !!group };
}
