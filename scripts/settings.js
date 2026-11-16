import { MODULE, SHADOW } from "./constants.js";

/**
 * `onArtRootChange` runs when the art folder changes (module.js passes the art cache's clear, so this file needs no import of art.js).
 * `onGmViewLockChange` runs when this GM locks or unlocks their view.
 * `onShadowChange` runs when either portrait shadow setting changes.
 */
export function registerSettings({ onArtRootChange = () => {}, onGmViewLockChange = () => {}, onShadowChange = () => {} } = {}) {
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

  // A folder each tag finds its backgrounds in by itself; {tag} is the tag's name.
  game.settings.register(MODULE, "tagFolders", {
    name: "VNSTAGE.Settings.TagFolders.Name",
    hint: "VNSTAGE.Settings.TagFolders.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "",
  });

  // A soft shadow behind every portrait (shadows.js), and how dark it is.
  game.settings.register(MODULE, "portraitShadow", {
    name: "VNSTAGE.Settings.PortraitShadow.Name",
    hint: "VNSTAGE.Settings.PortraitShadow.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => onShadowChange(),
  });

  game.settings.register(MODULE, "portraitShadowStrength", {
    name: "VNSTAGE.Settings.PortraitShadowStrength.Name",
    hint: "VNSTAGE.Settings.PortraitShadowStrength.Hint",
    scope: "world",
    config: true,
    type: Number,
    range: { min: SHADOW.min, max: SHADOW.max, step: SHADOW.step },
    default: SHADOW.strength,
    onChange: () => onShadowChange(),
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

  // Tags: { [id]: { label, folders: [], images: [], add: [], remove: [], hideAuto: [], deleted } }. Characters also come from the art's `tags`.
  game.settings.register(MODULE, "tags", {
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });

  // From before tags (schema 3): read once by migrate.js, then left alone.
  game.settings.register(MODULE, "groups", { scope: "world", config: false, type: Object, default: {} });
  game.settings.register(MODULE, "groupFolders", { scope: "world", config: false, type: String, default: "" });

  // Characters put on a stage lately, newest first (the Recent list): { names: [] }.
  game.settings.register(MODULE, "recent", {
    scope: "world",
    config: false,
    type: Object,
    default: { names: [] },
  });

  // Presets: { [id]: { name, tags: [], background, cast, saved } }.
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

  // Which Background folder strips this GM has collapsed in the Stage window (this machine only).
  game.settings.register(MODULE, "collapsed", {
    scope: "client",
    config: false,
    type: Object,
    default: {},
  });

  // The tab the Stage window opens on: the last one this GM used (this machine only).
  game.settings.register(MODULE, "windowTab", {
    scope: "client",
    config: false,
    type: String,
    default: "cast",
  });

  // The Stage window's size, as this GM last left it (this machine only): { width, height }.
  game.settings.register(MODULE, "windowSize", {
    scope: "client",
    config: false,
    type: Object,
    default: {},
  });

  // Per-character choices that follow them to every stage, by art key, or "actor:<id>" for an actor without art (e.g. { "Ambrus Valsin": { flip: true } }).
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
