import { MODULE, FRAME, SIZE_CHOICES, faceGuide } from "./constants.js";
import { resolveCast, characterPrefs, setPrefs } from "./cast.js";
import { placements } from "./layout.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Adjust one character's scale and height on the stage. While it's open, the GM's
 * screen shows the face guide: two lines across the frame where every face should
 * start and end, and a box around this character's face as it stands now.
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
  static open(castId) {
    const entry = resolveCast().find((e) => e.id === castId);
    if (!entry) return;
    AdjustWindow.#open?.close();
    AdjustWindow.#open = new AdjustWindow({ entry });
    return AdjustWindow.#open.render({ force: true });
  }

  constructor({ entry, ...options }) {
    super({ id: `vn-stage-adjust-${entry.id}`, ...options });
    this.entry = entry;
    this.#save = foundry.utils.debounce((patch) => setPrefs(this.entry.name, patch), 120);
  }

  #save;
  #onLayout = null;

  get title() {
    return `Adjust: ${this.entry.name}`;
  }

  async _prepareContext() {
    const p = characterPrefs(this.entry.name);
    const placed = placements.get(this.entry.id);
    const auto = placed?.size?.auto;
    const from = { sheet: "from the sheet", manifest: "from the art", default: "default" }[auto?.source] ?? "";
    return {
      scale: p.scale ?? 1,
      yOffset: Math.round((p.yOffset ?? 0) * 1000) / 10, // % of the frame height
      measured: !!placed?.face,
      autoLabel: auto ? `Auto: ${SIZE_CHOICES[auto.key] ?? auto.key} (${from})` : "Auto",
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
      setPrefs(this.entry.name, { size: event.target.value || null });
    });
    if (!this.#onLayout) {
      this.#onLayout = Hooks.on(`${MODULE}.layout`, () => drawGuide(this.entry.id));
    }
    drawGuide(this.entry.id);
  }

  #readForm() {
    const val = (name) => Number(this.element.querySelector(`input[type=number][name=${name}]`).value);
    return { scale: val("scale") || 1, yOffset: (val("yOffset") || 0) / 100 };
  }

  _onClose(options) {
    super._onClose(options);
    if (this.#onLayout) Hooks.off(`${MODULE}.layout`, this.#onLayout);
    this.#onLayout = null;
    clearGuide();
    if (AdjustWindow.#open === this) AdjustWindow.#open = null;
  }

  static async #onReset() {
    await setPrefs(this.entry.name, { scale: 1, yOffset: 0 });
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
  const lines = faceGuide(placed?.size?.scale);
  const top = sceneY + lines.top * FRAME.height;
  const bottom = sceneY + lines.bottom * FRAME.height;

  const g = new PIXI.Graphics();
  g.lineStyle(4, 0x4fd1ff, 0.9);
  for (const y of [top, bottom]) {
    g.moveTo(sceneX, y);
    g.lineTo(sceneX + FRAME.width, y);
  }
  const face = placed?.face;
  if (face) {
    g.lineStyle(3, 0xffc23d, 0.95);
    g.drawRect(sceneX + face.x, sceneY + face.y, face.width, face.height);
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
