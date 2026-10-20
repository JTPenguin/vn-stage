/**
 * VN Stage: visual-novel scenes on a native Foundry scene.
 *
 * GM actions write the cast flag and tiles, which Foundry syncs to everyone.
 * Every client fits its view to the stage frame; players' view is locked.
 */
import { MODULE } from "./constants.js";
import { registerSettings } from "./settings.js";
import { isStage, makeStage, unmakeStage, setBackground, currentBackground } from "./stage.js";
import { getCast, resolveCast, addToCast, addParty, setCast, removeFromCast, switchSide, moveInSide, clearCast, setFlip } from "./cast.js";
import { artIndex, characterArt, clearArtCache } from "./art.js";
import { layout, lastArrangement } from "./layout.js";
import { listGroups, getGroup, memberNames, createGroup, addFolder, addMember, stageGroup, setStageGroup } from "./groups.js";
import { startView, stopView, viewLocked, viewFitted } from "./view.js";
import { StageWindow } from "./window.js";
import { listPresets, savePreset, loadPreset, deletePreset } from "./presets.js";
import { setExpression, resetAllExpressions, currentExpression, preloadStage, isRelayGM } from "./expressions.js";
import { startClicks, stopClicks, dropTarget, setWindowDrag } from "./interact.js";

Hooks.once("init", () => {
  registerSettings();
  foundry.applications.handlebars.loadTemplates({
    "vn-stage.bg": `modules/${MODULE}/templates/stage-bg.hbs`,
  });
  const api = {
    isStage, makeStage, unmakeStage, setBackground, currentBackground,
    getCast, resolveCast, addToCast, addParty, setCast, removeFromCast, switchSide, moveInSide, clearCast, setFlip,
    artIndex, characterArt, clearArtCache, layout,
    setExpression, resetAllExpressions, currentExpression,
    listPresets, savePreset, loadPreset, deletePreset,
    listGroups, getGroup, memberNames, createGroup, addFolder, addMember, stageGroup, setStageGroup,
    openWindow: () => StageWindow.open(),
    status,
  };
  game.modules.get(MODULE).api = api;
  globalThis.VNStage = api;
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
  // Catch up on anything that changed while this stage wasn't viewed (a flip, new art).
  if (game.user.isGM && isStage()) layout(canvas.scene);
});
Hooks.on("canvasTearDown", () => {
  stopView();
  stopClicks();
});

// Stage or cast flags changed on the scene being viewed.
Hooks.on("updateScene", (scene, changes) => {
  if (scene.id !== canvas.scene?.id) return;
  if (!foundry.utils.hasProperty(changes, `flags.${MODULE}`)) return;
  if (isStage(scene) !== viewFitted()) startView(); // became, or stopped being, a stage
  if (foundry.utils.hasProperty(changes, `flags.${MODULE}.cast`)) preloadStage(scene);
  StageWindow.refresh();
});

// A saved expression changed on an actor (a player's choice, or the GM's): the
// active GM's screen redraws the viewed stage. Other stages catch up when viewed.
Hooks.on("updateActor", (actor, changes) => {
  if (!isStage()) return;
  // The party's membership changed: a stage with The Party on it redraws.
  if (actor === game.actors.party && foundry.utils.hasProperty(changes, "system.details.members")) {
    if (!getCast().some((e) => e.party)) return;
    if (isRelayGM()) layout(canvas.scene);
    return StageWindow.refresh();
  }
  if (!foundry.utils.hasProperty(changes, `flags.${MODULE}`)) return;
  const onStage = resolveCast().some((e) => e.actorUuid === actor.uuid);
  if (!onStage) return;
  if (isRelayGM()) layout(canvas.scene);
  StageWindow.refresh();
});

// The background tile changed, or tiles came and went.
for (const hook of ["createTile", "updateTile", "deleteTile"]) {
  Hooks.on(hook, (tile) => { if (tile.parent?.id === canvas.scene?.id) StageWindow.refresh(); });
}

Hooks.on("updateSetting", (setting) => {
  const keys = ["characterPrefs", "groups", "recent", "presets"].map((k) => `${MODULE}.${k}`);
  if (keys.includes(setting.key)) StageWindow.refresh();
});

// GM shortcut: drop an actor on the left or right half of a stage.
// GM: drop an actor (sidebar), a Cast row or The Party (Stage window) where it should stand.
Hooks.on("dropCanvasData", (_canvas, data, event) => {
  if (!game.user.isGM || !isStage() || !["Actor", "VNStageCast", "VNStageParty"].includes(data.type)) return;
  const target = dropTarget(event.clientX, event.clientY, data.ignore ?? null);
  setWindowDrag(null);
  if (!target) return false;
  const { side, index } = target;
  if (data.type === "VNStageParty") addParty(side, { index });
  else if (data.type === "VNStageCast") addToCast({ name: data.name, side, index });
  else {
    const actor = fromUuidSync(data.uuid);
    if (actor) addToCast({ name: actor.name, actorUuid: actor.uuid, side, index });
  }
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
