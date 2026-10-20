import { MODULE } from "./constants.js";

export function registerSettings() {
  game.settings.register(MODULE, "artRoot", {
    name: "VNSTAGE.Settings.ArtRoot.Name",
    hint: "VNSTAGE.Settings.ArtRoot.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "",
    filePicker: "folder",
  });

  game.settings.register(MODULE, "safetyBackground", {
    name: "VNSTAGE.Settings.SafetyBackground.Name",
    hint: "VNSTAGE.Settings.SafetyBackground.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "",
    filePicker: "image",
  });
}

/** The art root, always ending in a slash, or "" if unset. */
export function artRoot() {
  const root = game.settings.get(MODULE, "artRoot").trim();
  return root && !root.endsWith("/") ? `${root}/` : root;
}

export function safetyBackground() {
  return game.settings.get(MODULE, "safetyBackground").trim();
}
