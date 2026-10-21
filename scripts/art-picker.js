import { MODULE } from "./constants.js";
import { artIndex, characterArt, actorArt, automaticArt } from "./art.js";
import { setActorArt } from "./cast.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * VN art…: choose which character's (or form's) art an actor uses, for actors
 * whose name doesn't match a folder, several actors sharing one character, or
 * forms. The link is a flag on the actor, so it survives renaming it.
 * "Automatic" clears it: the actor is matched by name, then by its own images.
 */
export class ArtPicker extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["vn-stage", "vn-art-picker"],
    window: { icon: "fa-solid fa-image-portrait", resizable: true },
    position: { width: 420, height: 560 },
    actions: {
      choose: ArtPicker.#onChoose,
      automatic: ArtPicker.#onAutomatic,
    },
  };

  static PARTS = { main: { template: `modules/${MODULE}/templates/art-picker.hbs`, scrollable: [".vn-art-list"] } };

  static open(actorUuid) {
    const actor = fromUuidSync(actorUuid);
    if (!actor) return;
    return new ArtPicker({ actor }).render({ force: true });
  }

  constructor({ actor, ...options }) {
    super({ id: `vn-stage-art-${actor.id}`, ...options });
    this.actor = actor;
  }

  get title() {
    return `VN art: ${this.actor.name}`;
  }

  #filter = "";

  async _prepareContext() {
    const [index, now, auto] = await Promise.all([artIndex(), actorArt(this.actor), automaticArt(this.actor)]);
    const label = async (key) => (key ? (await characterArt(key))?.label ?? key : null);
    const from = { name: "its name", images: "its images" }[auto.source];
    return {
      filter: this.#filter,
      linked: now.source === "linked",
      currentLabel: await label(now.key),
      autoLabel: auto.key ? `${await label(auto.key)} (from ${from})` : "none found: the actor's own image",
      arts: index.map((a) => ({ key: a.key, label: a.label, thumb: a.thumb, current: a.key === now.key, search: `${a.label} ${a.key}`.toLowerCase() })),
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
    input?.focus();
  }

  #applyFilter() {
    const q = this.#filter.trim().toLowerCase();
    for (const li of this.element.querySelectorAll(".vn-art-list [data-search]")) {
      li.hidden = !!q && !li.dataset.search.includes(q);
    }
  }

  static async #onChoose(_event, target) {
    await setActorArt(this.actor.uuid, target.closest("[data-key]").dataset.key);
    this.close();
  }

  static async #onAutomatic() {
    await setActorArt(this.actor.uuid, null);
    this.close();
  }
}
