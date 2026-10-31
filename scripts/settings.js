import { MODULE } from "./constants.js";

/**
 * `onArtRootChange` runs when the art folder changes (module.js passes the art cache's clear, so this file needs no import of art.js).
 * `onGmViewLockChange` runs when this GM locks or unlocks their view.
 */
export function registerSettings({ onArtRootChange = () => {}, onGmViewLockChange = () => {} } = {}) {
  game.settings.register(MODULE, "artRoot", {
    name: "VNSTAGE.Settings.ArtRoot.Name",
    hint: "VNSTAGE.Settings.ArtRoot.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "",
    filePicker: "folder",
    onChange: () => onArtRootChange(),
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

  // The last one-time data upgrade run in this world (migrate.js).
  game.settings.register(MODULE, "schema", {
    scope: "world",
    config: false,
    type: Number,
    default: 0,
  });

  // The scanned art folder (art.js): { root, scanned, art: { [key]: art } }. Only a GM writes it; everyone reads art from it.
  game.settings.register(MODULE, "artIndex", {
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });

  // Groups: { [id]: { label, folders: [], images: [], add: [], remove: [], hideAuto: [], deleted } }. Members also come from the art's `groups`.
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

  // This GM's view is locked to the stage like the players' (this machine only).
  game.settings.register(MODULE, "gmViewLock", {
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
    onChange: () => onGmViewLockChange(),
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
