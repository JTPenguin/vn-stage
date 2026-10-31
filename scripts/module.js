/**
 * VN Stage: visual-novel scenes on a native Foundry scene.
 *
 * GM actions write the cast flag and tiles, which Foundry syncs to everyone.
 * Every client fits its view to the stage frame; players' view is locked, and a GM can lock theirs.
 */
import { MODULE } from "./constants.js";
import { registerSettings } from "./settings.js";
import { isStage, makeStage, unmakeStage, setBackground, currentBackground } from "./stage.js";
import { getCast, addToCast, addParty, removeParty, partySide, partyEntryIds, setCast, removeFromCast, switchSide, moveInSide, clearCast, setFlip } from "./cast.js";
import { artIndex, characterArt, clearArtCache, scanArt, scanArtIfStale } from "./art.js";
import { layout, lastArrangement } from "./layout.js";
import { listGroups, getGroup, memberNames, createGroup, addFolder, addMember, groupFolders, stageGroup, setStageGroup } from "./groups.js";
import { startView, stopView, viewLocked, viewFitted, toggleGmViewLock, refitView } from "./view.js";
import { StageWindow } from "./window.js";
import { GroupsWindow } from "./groups-window.js";
import { listPresets, savePreset, loadPreset, deletePreset, updatePreset, renamePreset, setPresetGroups } from "./presets.js";
import { setExpression, setForm, resetAllExpressions, currentExpression, preloadStage, isRelayGM } from "./expressions.js";
import { startClicks, stopClicks, dropTarget, setWindowDrag } from "./interact.js";
import { registerFades } from "./fades.js";
import { migrate, migrationPending } from "./migrate.js";

Hooks.once("init", () => {
  registerSettings({
    onArtRootChange: () => { if (game.user.isGM && (game.users.activeGM ?? game.user) === game.user) scanArt(); },
    onGmViewLockChange: () => { if (canvas.ready) startView(); StageWindow.refresh(); },
  });
  // Open the Stage window from the keyboard (GM). No key by default; set one in Configure Controls.
  game.keybindings.register(MODULE, "openWindow", {
    name: "VNSTAGE.Keybindings.OpenWindow.Name",
    hint: "VNSTAGE.Keybindings.OpenWindow.Hint",
    editable: [],
    restricted: true,
    onDown: () => {
      StageWindow.open();
      return true;
    },
  });
  // Lock the GM's own view to the stage, like the players' (GM). No key by default.
  game.keybindings.register(MODULE, "lockView", {
    name: "VNSTAGE.Keybindings.LockView.Name",
    hint: "VNSTAGE.Keybindings.LockView.Hint",
    editable: [],
    restricted: true,
    onDown: async () => {
      const locked = await toggleGmViewLock();
      const note = canvas.ready && isStage() ? "" : " (Takes effect on a stage.)";
      ui.notifications.info(`VN Stage | ${locked ? "View locked to the stage." : "View unlocked."}${note}`);
      return true;
    },
  });
  registerFades();
  foundry.applications.handlebars.loadTemplates({
    "vn-stage.bg": `modules/${MODULE}/templates/stage-bg.hbs`,
    "vn-stage.cast-row": `modules/${MODULE}/templates/cast-row.hbs`,
  });
  const api = {
    isStage, makeStage, unmakeStage, setBackground, currentBackground,
    getCast, addToCast, addParty, removeParty, partySide, setCast, removeFromCast, switchSide, moveInSide, clearCast, setFlip,
    artIndex, characterArt, clearArtCache, layout,
    setExpression, setForm, resetAllExpressions, currentExpression,
    listPresets, savePreset, loadPreset, deletePreset, updatePreset, renamePreset, setPresetGroups,
    listGroups, getGroup, memberNames, createGroup, addFolder, addMember, groupFolders, stageGroup, setStageGroup,
    toggleViewLock: toggleGmViewLock, viewLocked,
    openWindow: () => StageWindow.open(),
    openGroups: (groupId) => GroupsWindow.open(groupId),
    status,
  };
  game.modules.get(MODULE).api = api;
  globalThis.VNStage = api;
});

// One-time upgrades of stored data (migrate.js), by the active GM once Foundry is ready.
Hooks.once("ready", async () => {
  await migrate();
  await scanArtIfStale();
});

// The Stage window's button, in the token controls (the GM's usual layer).
Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM || !controls.tokens) return;
  controls.tokens.tools.vnStage = {
    name: "vnStage",
    order: 99,
    title: "VN Stage",
    icon: "fa-solid fa-masks-theater",
    button: true,
    onChange: () => StageWindow.open(),
  };
});

Hooks.on("canvasReady", () => {
  startView();
  startClicks();
  preloadStage();
  StageWindow.refresh();
  // Catch up on anything that changed while this stage wasn't viewed (a flip, new art). One GM is enough.
  // Before a data upgrade has run (the first draw comes before "ready"), migrate() lays out instead.
  if (isRelayGM() && isStage() && !migrationPending()) layout(canvas.scene);
});
Hooks.on("canvasTearDown", () => {
  stopView();
  stopClicks();
});

// The sidebar opened or closed: once it has finished sliding, re-fit a locked view to the space left.
Hooks.on("collapseSidebar", () => {
  const content = document.getElementById("sidebar-content");
  const refit = () => { if (viewLocked()) refitView(); };
  const stop = () => {
    content?.removeEventListener("transitionend", done);
    clearTimeout(early);
    clearTimeout(cap);
  };
  const done = (event) => {
    if (event.propertyName !== "margin-right") return;
    stop();
    refit();
  };
  content?.addEventListener("transitionend", done);
  // In case the slide doesn't run (no transition, hidden window). A slow slide still ends
  // with a refit, so the listener stays until it does or the cap runs out.
  const early = setTimeout(refit, 300);
  const cap = setTimeout(stop, 1000);
});

// Stage or cast flags changed. A cast change is laid out by the GM who made it
// (on any stage, viewed or not); the viewed stage's screens catch up.
Hooks.on("updateScene", (scene, changes, _options, userId) => {
  if (!foundry.utils.hasProperty(changes, `flags.${MODULE}`)) return;
  const castChanged = foundry.utils.hasProperty(changes, `flags.${MODULE}.cast`);
  if (castChanged && userId === game.user.id && game.user.isGM) layout(scene);
  if (scene.id !== canvas.scene?.id) return;
  if (isStage(scene) !== viewFitted()) startView(); // became, or stopped being, a stage
  if (castChanged) preloadStage(scene);
  StageWindow.refresh();
});

// A saved expression changed on an actor (a player's choice, or the GM's): the
// active GM's screen redraws the viewed stage. Other stages catch up when viewed.
Hooks.on("updateActor", (actor, changes) => {
  if (!isStage()) return;
  // The party's membership changed: The Party's row in the Stage window shows who's on stage.
  if (actor === game.actors.party && foundry.utils.hasProperty(changes, "system.details.members")) return StageWindow.refresh();
  if (!foundry.utils.hasProperty(changes, `flags.${MODULE}`)) return;
  const onStage = getCast().some((e) => e.actorUuid === actor.uuid);
  if (!onStage) return;
  if (isRelayGM()) layout(canvas.scene);
  StageWindow.refresh();
});

// The background tile changed, or tiles came and went.
for (const hook of ["createTile", "updateTile", "deleteTile"]) {
  Hooks.on(hook, (tile) => { if (tile.parent?.id === canvas.scene?.id) StageWindow.refresh(); });
}

// A world setting saved for the first time is created, not updated, so both count.
Hooks.on("createSetting", (setting, _options, userId) => onSettingChanged(setting, userId));
Hooks.on("updateSetting", (setting, _changes, _options, userId) => onSettingChanged(setting, userId));

function onSettingChanged(setting, userId) {
  const keys = ["characterPrefs", "groups", "recent", "presets", "groupFolders", "artIndex"].map((k) => `${MODULE}.${k}`);
  if (!keys.includes(setting.key)) return;
  if (setting.key === `${MODULE}.artIndex`) {
    clearArtCache();
    preloadStage();
    if (userId === game.user.id && game.user.isGM && isStage()) layout(canvas.scene);
  }
  // Flip, size or height changed by this GM: the viewed stage re-lays out.
  if (setting.key === `${MODULE}.characterPrefs` && userId === game.user.id && game.user.isGM && isStage()) layout(canvas.scene);
  StageWindow.refresh();
  GroupsWindow.refresh();
}

// GM shortcut: drop an actor on the left or right half of a stage.
// GM: drop an actor or the party (sidebar), a Cast row or The Party (Stage window) where it should stand.
Hooks.on("dropCanvasData", (_canvas, data, event) => {
  if (!game.user.isGM || !isStage() || !["Actor", "VNStageCast", "VNStageParty"].includes(data.type)) return;
  const actor = data.type === "Actor" ? fromUuidSync(data.uuid) : null;
  const isPartyActor = actor?.isOfType?.("party") || actor?.type === "party";
  // The party (from the window or the sidebar) leaves its members on stage out when working out the drop point.
  const target = dropTarget(event.clientX, event.clientY, isPartyActor ? partyEntryIds() : data.ignore ?? null);
  setWindowDrag(null);
  if (!target) return false;
  const { side, index } = target;
  if (data.type === "VNStageParty") addParty(side, { index });
  else if (data.type === "VNStageCast") addToCast({ name: data.name, actorUuid: data.actorUuid ?? null, side, index });
  // The party actor itself (PF2e) puts every member there, not a token or a character.
  else if (isPartyActor) addParty(side, { index });
  else if (actor) addToCast({ name: actor.name, actorUuid: actor.uuid, side, index });
  return false; // no token
});

/** For the console during testing. */
function status() {
  return {
    scene: canvas.scene?.name,
    stage: isStage(),
    background: currentBackground(),
    cast: getCast(),
    arrangement: { ...lastArrangement },
    viewLocked: viewLocked(),
    view: { x: canvas.stage.pivot.x, y: canvas.stage.pivot.y, scale: canvas.stage.scale.x },
  };
}
