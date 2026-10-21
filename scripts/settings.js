import { MODULE } from "./constants.js";
import { clearArtCache } from "./art.js";

export function registerSettings() {
  game.settings.register(MODULE, "artRoot", {
    name: "VNSTAGE.Settings.ArtRoot.Name",
    hint: "VNSTAGE.Settings.ArtRoot.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "",
    filePicker: "folder",
    onChange: () => clearArtCache(),
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

  // A folder each group finds its backgrounds in by itself; {group} is the group's name.
  game.settings.register(MODULE, "groupFolders", {
    name: "VNSTAGE.Settings.GroupFolders.Name",
    hint: "VNSTAGE.Settings.GroupFolders.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "",
  });

  // Groups: { [id]: { label, folders: [], images: [], add: [], remove: [], hideAuto: [], deleted } }. Members also come from manifest tags.
  game.settings.register(MODULE, "groups", {
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });

  // Characters put on a stage lately, newest first (the Recent group): { names: [] }.
  game.settings.register(MODULE, "recent", {
    scope: "world",
    config: false,
    type: Object,
    default: { names: [] },
  });

  // Presets: { [id]: { name, groups: [], background, cast, saved } } (older ones have `group`, one id or null).
  game.settings.register(MODULE, "presets", {
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });

  // Which Stage window sections this GM has collapsed (this machine only).
  game.settings.register(MODULE, "collapsed", {
    scope: "client",
    config: false,
    type: Object,
    default: {},
  });

  // Per-character choices that follow them to every stage, by name (e.g. { "Ambrus Valsin": { flip: true } }).
  game.settings.register(MODULE, "characterPrefs", {
    scope: "world",
    config: false,
    type: Object,
    default: {},
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
