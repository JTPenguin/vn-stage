# VN Stage

A Foundry VTT module for visual-novel scenes on a native Foundry scene: portraits on the left and right, expressions players can change, and swappable static backgrounds. Not tied to any campaign.

Shared privately with friends' tables; not published.

## Requirements

- Foundry VTT 14

## Install from a zip

1. Unzip `vn-stage-<version>.zip` into `<Foundry data folder>/Data/modules/`. You should end up with `Data/modules/vn-stage/module.json`.
2. Restart Foundry, then turn on **VN Stage** under **Manage Modules** in your world.
3. In **Configure Settings → VN Stage**, set the **Art folder** to the folder that holds your character folders. [docs/art-format.md](docs/art-format.md) explains the layout.

## Install (development)

This repository is the module folder. Foundry loads it through a symlink:

```bash
ln -s "<path to this folder>" "<Foundry data folder>/Data/modules/vn-stage"
```

## Settings (world)

- **Art folder:** one subfolder per character, with a `portrait` image and, if you like, `expressions/`, `forms/` and a `vn-stage.json`. The whole format, including how art is sized, is in [docs/art-format.md](docs/art-format.md).
- **Safety-net background:** set once as the scene's own background when it becomes a stage. The background shown during play is a tile above it, because changing a scene's own background redraws the canvas on every screen.
- **Group background folders:** a folder every group finds its backgrounds in by itself, when it exists; `{group}` stands for the group's name (`scenes/{group}/`). Other modules can add folders with the `vn-stage.groupFolders` hook.

## Console API

`VNStage` (also `game.modules.get("vn-stage").api`). GM only where it changes anything.

| Area | Functions |
|---|---|
| Stage | `isStage`, `makeStage`, `unmakeStage`, `setBackground(src)`, `currentBackground` |
| Cast | `getCast`, `addToCast({ name, actorUuid, side, index })`, `addParty(side, { index })`, `removeParty`, `partySide`, `setCast`, `removeFromCast(id)`, `switchSide`, `moveInSide`, `clearCast`, `setFlip`, `layout` |
| Art | `artIndex`, `characterArt(key)`, `clearArtCache` |
| Expressions and forms | `setExpression(castId, key)`, `setForm(castId, artKey)`, `resetAllExpressions`, `currentExpression` |
| Presets | `listPresets(groupId)`, `savePreset(name)`, `loadPreset(id)`, `deletePreset`, `updatePreset`, `renamePreset`, `setPresetGroups` |
| Groups | `listGroups`, `getGroup`, `memberNames`, `createGroup`, `addFolder`, `addMember`, `groupFolders`, `stageGroup`, `setStageGroup` |
| Windows | `openWindow()`, `openGroups(groupId)` |
| Debugging | `status()`: what the module sees on this screen |

**Hooks it calls:** `vn-stage.layout(scene, placements)` after each layout (each portrait's box, for other modules); `vn-stage.groupFolders(group, folders)` to let modules add a group's automatic folders.

## Stored data

Change any of these only with a step in `scripts/migrate.js` (bump `SCHEMA`), so stored data is upgraded once and the code reads one form.

| Where | Key | Holds |
|---|---|---|
| World setting | `artRoot`, `safetyBackground`, `groupFolders` | The settings above |
| World setting | `schema` | The last data upgrade run (migrate.js) |
| World setting | `groups` | `{ [id]: { label, folders, images, add, remove, hideAuto, deleted } }`; members also come from the art's `groups` |
| World setting | `presets` | `{ [id]: { name, groups, background, cast, saved } }`; cast entries may carry `partyMember` and `form` |
| World setting | `recent` | `{ names }`: art keys, newest first (24) |
| World setting | `artIndex` | `{ root, scanned, art: { [key]: art } }`: the art folder as the GM's screen last scanned it (paths relative to `root`), so players read art without browsing files. Rescanned every time the world loads, when the Art folder setting changes, and by the Stage window's refresh button |
| World setting | `characterPrefs` | `{ [art key]: { flip, scale, yOffset, size, flying } }`. `scale` and `yOffset` are the actual values and replace the art file's; absent means the file's |
| Client setting | `collapsed` | Which Stage window sections and folder strips this GM collapsed |
| Scene flag | `stage` | `{ version }`: the scene is a stage |
| Scene flag | `cast` | `[{ id, name, actorUuid, side, expression?, form? }]` in standing order (`expression` and `form` only for art without an actor) |
| Scene flag | `partyOrder` | Actor ids, the order the party last stood in |
| Scene flag | `group`, `backgroundFolder`, `preset` | The stage's group, its last-browsed folder, and the preset last loaded or saved |
| Actor flag | `expression`, `form`, `art` | The actor's expression and form (follow them to every stage), and its VN art… link |
| Tile flag | `part`, and for portraits `castId`, `name`, `key`, `fallback`; for the shade `shade` | What the module drew (`background`, `portrait`, `shade`) |

## Checks

Run both before handing a change to Foundry.

- **Load check:** loads every script with stand-ins for Foundry's globals. Catches clashing names, broken imports and import cycles, which a syntax check misses.

  ```bash
  ELECTRON_RUN_AS_NODE=1 ~/foundryvtt/foundryvtt tools/check-load.mjs
  ```

- **Tests:** the rules that need no Foundry (`scripts/rules.js`, the layout arithmetic in `scripts/arrange.js`), with Node's test runner. New rules that can live without Foundry go in `rules.js`, with a test.

  ```bash
  ELECTRON_RUN_AS_NODE=1 ~/foundryvtt/foundryvtt tools/test.mjs
  ```

## After a Foundry update

These rely on Foundry or PIXI behaviour that isn't a promised API. Check each on a stage after updating Foundry:

| What to try | What it relies on | Where |
|---|---|---|
| Click and drag a portrait: the character menu opens, the drag moves them, and Foundry's selection box doesn't appear | Our window-level `pointerdown` listener (capture phase) runs before the canvas's own | `interact.js` |
| Add, remove and swap: portraits fade, backgrounds crossfade | Stand-in `PrimarySpriteMesh`es added to `canvas.primary` (`sortDirty`), and the `refreshTile` hook scaling `tile.mesh.alpha` | `fades.js` (turns itself off on error; look for a console warning) |
| Drag a portrait: it dims while dragged | Setting `tile.mesh.alpha` until the next `refreshState` | `interact.js` |
| Right-click a Cast row: the menu opens above the Stage window | `ApplicationV2._maxZ` (internal), with the open windows' z-index as a fallback | `interact.js` (`topZ`) |
| As a player, try to pan or zoom: the view stays fitted | Shadowing `canvas.pan` and `canvas.animatePan` | `view.js` |
| Make stage on a new scene: the safety-net background shows | `scene.initialLevel` and the Level's `background.src` (v14 Levels) | `stage.js` |
| Click a portrait's see-through edge: nothing happens | `PrimarySpriteMesh#containsCanvasPoint(point, alpha)` | `interact.js` (`portraitAt`) |

## Keys to keep stable

Saved choices (Flip, size, height), group memberships, Recent and VN art… links are keyed by the art folder's name under the art root (`Rahadin`, `Rahadin/forms/corrupted`). **Renaming a character's art folder loses them**; renaming actors is safe.

## Conventions

- **No build step.** Plain ES modules, CSS and Handlebars templates, loaded by Foundry as they are.
- **No `manifest` or `download` URL** in `module.json`, so Foundry's updater can never overwrite the working copy.
- **Versioning:** bump `version` in `module.json`, add a `CHANGELOG.md` entry, and tag releases (`v0.1.0`).

## Design

The art format is in [docs/art-format.md](docs/art-format.md).
