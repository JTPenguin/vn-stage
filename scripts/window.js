import { MODULE } from "./constants.js";
import { artIndex, characterArt } from "./art.js";
import { getCast, addToCast, removeFromCast, switchSide, moveInSide, characterPrefs, setFlip } from "./cast.js";
import { isStage, makeStage, setBackground, currentBackground, pickBackground, backgroundFolder, folderImages, backgroundLabel } from "./stage.js";
import { safetyBackground } from "./settings.js";
import { AdjustWindow } from "./adjust.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** The Stage window: every GM control for the stage being viewed, in one place. */
export class StageWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vn-stage-window",
    classes: ["vn-stage"],
    window: { title: "VN Stage", icon: "fa-solid fa-masks-theater", resizable: true },
    position: { width: 560, height: 720 },
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
    },
  };

  static PARTS = { main: { template: `modules/${MODULE}/templates/stage-window.hbs`, scrollable: [".vn-cast-list"] } };

  static #instance = null;

  static open() {
    this.#instance ??= new StageWindow();
    return this.#instance.render({ force: true });
  }

  /** Re-render if open (the cast, background or scene changed). */
  static refresh() {
    if (this.#instance?.rendered) this.#instance.render();
  }

  #filter = "";

  async _prepareContext() {
    const scene = canvas.scene;
    const stage = isStage(scene);
    const context = { sceneName: scene?.name ?? "", stage, filter: this.#filter };
    if (!stage) return context;

    const cast = getCast(scene);
    const rows = await Promise.all(cast.map(async (e) => {
      const art = await characterArt(e.name);
      const actor = e.actorUuid ? fromUuidSync(e.actorUuid) : null;
      return {
        id: e.id, name: e.name, side: e.side,
        thumb: art?.thumb ?? actor?.img ?? "icons/svg/mystery-man.svg",
        fallback: !art,
        flip: !!characterPrefs(e.name).flip,
      };
    }));
    const side = (s) => rows.filter((r) => r.side === s).map((r, i, all) => ({ ...r, first: i === 0, last: i === all.length - 1 }));
    const onStage = new Set(cast.map((e) => e.name));
    const index = await artIndex();

    return {
      ...context,
      background: currentBackground(scene),
      backgrounds: await backgroundChoices(scene),
      left: side("left"),
      right: side("right"),
      cast: index.map((a) => ({ name: a.name, thumb: a.thumb, onStage: onStage.has(a.name), search: a.name.toLowerCase() })),
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const input = this.element.querySelector("input[name=filter]");
    input?.addEventListener("input", () => {
      this.#filter = input.value;
      this.#applyFilter();
    });
    this.#applyFilter();
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
    new FilePicker({
      type: "image",
      current: currentBackground() ?? "",
      callback: (path) => pickBackground(path),
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

  static async #onRefreshCast() {
    await artIndex({ refresh: true });
    this.render();
  }
}

/** The quick-swap strip: the default background pinned first, then the stage's folder. */
async function backgroundChoices(scene) {
  const current = currentBackground(scene);
  const safety = safetyBackground();
  const folder = backgroundFolder(scene);
  const images = (await folderImages(folder)).filter((src) => src !== safety);
  const choices = images.map((src) => ({ src, label: backgroundLabel(src) }));
  if (safety) choices.unshift({ src: safety, label: "Default background", pinned: true });
  const same = (a, b) => !!a && !!b && safeDecode(a) === safeDecode(b);
  for (const c of choices) c.current = same(c.src, current);
  return { choices, folder };
}

function safeDecode(path) {
  try { return decodeURIComponent(path); } catch { return path; }
}
