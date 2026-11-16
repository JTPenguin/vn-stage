import { artKeyOf, prefsKeyOf, characterArt } from "./art.js";
import { MODULE, FRAME, SIZE_CHOICES, faceGuide } from "./constants.js";
import { getCast, characterPrefs, setPrefs, displayName } from "./cast.js";
import { placements } from "./layout.js";
import { artDefaults, placementOf } from "./rules.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Adjust one character's scale and height on the stage. While it's open, the GM's
 * screen shows the face guide: two lines across the frame where every face should
 * start and end. It's only a drawing to line art up against.
 * The window shows the actual scale and drop: the art file's own until changed.
 * Changes are saved per character, so they apply on every stage.
 */
export class AdjustWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["vn-stage", "vn-adjust"],
    window: { icon: "fa-solid fa-sliders" },
    position: { width: 340, height: "auto" },
    actions: {
      reset: AdjustWindow.#onReset,
      done: AdjustWindow.#onDone,
    },
  };

  static PARTS = { main: { template: `modules/${MODULE}/templates/adjust.hbs` } };

  static #open = null;

  /** Open for the cast entry `castId` on the viewed stage (one at a time). */
  static async open(castId) {
    const entry = getCast().find((e) => e.id === castId);
    if (!entry) return;
    const key = (await artKeyOf(entry)) ?? entry.name;
    AdjustWindow.#open?.close();
    AdjustWindow.#open = new AdjustWindow({ entry, key, prefsKey: await prefsKeyOf(entry) });
    return AdjustWindow.#open.render({ force: true });
  }

  /** `key`: the character's art key. `prefsKey`: what its saved choices are kept under (the art key, or the actor for one without art). */
  constructor({ entry, key, prefsKey = key, ...options }) {
    super({ id: `vn-stage-adjust-${entry.id}`, ...options });
    this.entry = entry;
    this.key = key;
    this.prefsKey = prefsKey;
    this.#save = foundry.utils.debounce((patch) => setPrefs(this.prefsKey, patch), 120);
  }

  #save;
  /** The art file's own scale and drop, so a value equal to it saves as no choice. */
  #own = artDefaults(null);
  #onLayout = null;

  get title() {
    return `Adjust: ${displayName(this.entry)}`;
  }

  async _prepareContext() {
    const p = characterPrefs(this.prefsKey);
    const art = await characterArt(this.key);
    this.#own = artDefaults(art);
    const place = placementOf(p, art);
    const placed = placements.get(this.entry.id);
    const auto = placed?.size?.auto;
    const from = { sheet: "from the sheet", art: "from the art", default: "default" }[auto?.source] ?? "";
    return {
      scale: Math.round(place.scale * 10000) / 10000,
      yOffset: Math.round(place.yOffset * 10000) / 100, // % of the frame height
      autoLabel: auto ? `Auto: ${SIZE_CHOICES[auto.key] ?? auto.key} (${from})` : "Auto",
      flying: !!p.flying,
      sizes: Object.entries(SIZE_CHOICES).map(([key, label]) => ({ key, label, selected: p.size === key })),
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    // Each slider and its number box drive each other; changes save as you drag.
    for (const name of ["scale", "yOffset"]) {
      const inputs = this.element.querySelectorAll(`[name=${name}]`);
      for (const input of inputs) {
        input.addEventListener("input", () => {
          for (const other of inputs) if (other !== input) other.value = input.value;
          this.#save(this.#readForm());
        });
      }
    }
    this.element.querySelector("select[name=size]")?.addEventListener("change", (event) => {
      setPrefs(this.prefsKey, { size: event.target.value || null });
    });
    this.element.querySelector("input[name=flying]")?.addEventListener("change", (event) => {
      setPrefs(this.prefsKey, { flying: event.target.checked || null });
    });
    if (!this.#onLayout) {
      this.#onLayout = Hooks.on(`${MODULE}.layout`, () => drawGuide(this.entry.id));
    }
    drawGuide(this.entry.id);
  }

  #readForm() {
    const val = (name) => Number(this.element.querySelector(`input[type=number][name=${name}]`).value);
    const scale = val("scale") || this.#own.scale;
    const yOffset = Math.round((val("yOffset") || 0) * 100) / 10000;
    // The art's own value is saved as no choice, so a later art file still applies.
    const same = (a, b) => Math.abs(a - b) < 1e-6;
    return {
      scale: same(scale, this.#own.scale) ? null : scale,
      yOffset: same(yOffset, this.#own.yOffset) ? null : yOffset,
    };
  }

  _onClose(options) {
    super._onClose(options);
    if (this.#onLayout) Hooks.off(`${MODULE}.layout`, this.#onLayout);
    this.#onLayout = null;
    clearGuide();
    if (AdjustWindow.#open === this) AdjustWindow.#open = null;
  }

  static async #onReset() {
    await setPrefs(this.prefsKey, { scale: null, yOffset: null }); // back to the art file's own scale and height
    this.render();
  }

  static #onDone() {
    this.close();
  }
}

/* -------------------------------------------- */
/*  Face guide (GM's screen only, drawing only) */
/* -------------------------------------------- */

let guide = null;

function drawGuide(castId) {
  if (!canvas.ready) return;
  if (!guide || guide.destroyed) {
    guide = new PIXI.Container();
    guide.eventMode = "none";
    canvas.interface.addChild(guide);
  }
  guide.removeChildren().forEach((c) => c.destroy());
  const { sceneX = 0, sceneY = 0 } = canvas.dimensions;
  const placed = placements.get(castId);
  const lines = faceGuide(placed?.size?.scale ?? 1, placed?.zoom ?? 1);
  const top = sceneY + lines.top * FRAME.height;
  const bottom = sceneY + lines.bottom * FRAME.height;

  const g = new PIXI.Graphics();
  g.lineStyle(4, 0x4fd1ff, 0.9);
  for (const y of [top, bottom]) {
    g.moveTo(sceneX, y);
    g.lineTo(sceneX + FRAME.width, y);
  }
  guide.addChild(g);

  const style = { fontFamily: "Signika, sans-serif", fontSize: 28, fill: 0x4fd1ff, stroke: 0x000000, strokeThickness: 4 };
  const size = SIZE_CHOICES[placed?.size?.key] ?? "Medium";
  for (const [y, text] of [[top, `Top of face (${size})`], [bottom, "Chin"]]) {
    const label = new PIXI.Text(text, style);
    label.position.set(sceneX + 16, y - label.height - 4);
    guide.addChild(label);
  }
}

function clearGuide() {
  if (guide && !guide.destroyed) guide.destroy({ children: true });
  guide = null;
}
