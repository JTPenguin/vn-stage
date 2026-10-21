import { MODULE } from "./constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * A checklist window: tick the things that should be in (characters for a
 * group, a character's or a preset's groups). Every "+ Add…" and "Groups…" in
 * the module uses it, so they all work the same way.
 *
 *   const ids = await PickList.choose({ title, items: [{ id, label, thumb?, icon?, note?, checked? }] });
 *   // the ticked ids, or null when cancelled
 *
 * `extra` adds a button on the left ({ label, icon, run }); `run` returns new
 * items to add (ticked), for "New group…".
 */
export class PickList extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["vn-stage", "vn-pick"],
    window: { icon: "fa-solid fa-list-check", resizable: true },
    position: { width: 380, height: "auto" },
    actions: {
      ok: PickList.#onOk,
      cancel: PickList.#onCancel,
      extra: PickList.#onExtra,
    },
  };

  static PARTS = { main: { template: `modules/${MODULE}/templates/pick-list.hbs`, scrollable: [".vn-pick-list"] } };

  static choose(options) {
    return new Promise((resolve) => new PickList({ ...options, resolve }).render({ force: true }));
  }

  #o;
  #items;
  #filter = "";
  #done = false;

  constructor({ title, items, hint = null, ok = "Save", empty = "Nothing to choose.", extra = null, resolve }) {
    super({ window: { title } });
    this.#o = { hint, ok, empty, extra, resolve };
    this.#items = items.map((i) => ({ ...i, search: `${i.label} ${i.note ?? ""}`.toLowerCase() }));
  }

  async _prepareContext() {
    const { hint, ok, empty, extra } = this.#o;
    return { hint, ok, empty, extra, items: this.#items, search: this.#items.length > 8 };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const input = this.element.querySelector("input[name=filter]");
    input?.addEventListener("input", () => {
      this.#filter = input.value.trim().toLowerCase();
      for (const li of this.element.querySelectorAll(".vn-pick-list [data-search]")) {
        li.hidden = !!this.#filter && !li.dataset.search.includes(this.#filter);
      }
    });
    input?.focus();
    // Keep ticks across re-renders (after "New group…").
    for (const box of this.element.querySelectorAll("input[name=pick]")) {
      box.addEventListener("change", () => {
        const item = this.#items.find((i) => i.id === box.value);
        if (item) item.checked = box.checked;
      });
    }
  }

  #finish(value) {
    if (this.#done) return;
    this.#done = true;
    this.#o.resolve(value);
  }

  static #onOk() {
    this.#finish(this.#items.filter((i) => i.checked).map((i) => i.id));
    this.close();
  }

  static #onCancel() {
    this.close();
  }

  static async #onExtra() {
    const added = await this.#o.extra?.run();
    if (!added?.length) return;
    for (const item of added) {
      const have = this.#items.find((i) => i.id === item.id);
      if (have) have.checked = true;
      else this.#items.push({ ...item, checked: true, search: item.label.toLowerCase() });
    }
    this.render();
  }

  _onClose(options) {
    super._onClose(options);
    this.#finish(null);
  }
}
