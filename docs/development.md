# VN Stage: development notes

For people changing the module's code or building on it from another module or a macro. How to use the module is in the [README](../README.md); the art format is in [art-format.md](art-format.md).

## Working copy

This repository is the module folder. For development, Foundry loads it through a symlink:

```bash
ln -s "<path to this folder>" "<Foundry data folder>/Data/modules/vn-stage"
```

## Console API

`VNStage` (also `game.modules.get("vn-stage").api`). GM only where it changes anything.

| Area | Functions |
|---|---|
| Stage | `isStage`, `makeStage`, `unmakeStage`, `setBackground(src)`, `currentBackground` |
| Cast | `getCast`, `addToCast({ name, actorUuid, cluster, index, newCluster })`, `addParty(cluster, { index, newCluster })`, `removeParty`, `partyCluster`, `setCast`, `removeFromCast(id)`, `moveToCluster(id, cluster, { index, newCluster })`, `clearCast`, `setFlip`, `layout` |
| Art | `artIndex`, `characterArt(key)`, `clearArtCache` |
| Expressions and forms | `setExpression(castId, key)`, `setForm(castId, artKey)` (refused for players when the form is locked), `resetAllExpressions`, `currentExpression` |
| Presets | `listPresets(tagId)`, `savePreset(name)`, `loadPreset(id)`, `deletePreset`, `updatePreset`, `renamePreset`, `setPresetTags` |
| Tags | `listTags`, `getTag`, `memberNames`, `createTag`, `addFolder`, `addMember`, `tagFolders`, `stageTag`, `setStageTag` |
| Windows | `openWindow()`, `openTags()` |
| View | `toggleViewLock()` (GM only: lock your view to the stage), `viewLocked()` |
| Debugging | `status()`: what the module sees on this screen |

**Clusters in the API:** `cluster` counts from 0, left to right, as `getCast` and `status()` show it. A number equal to the count starts a new cluster at the right edge, and `newCluster: true` starts one at that number, moving the rest up. `index` is the place in the cluster from the left (leave it out for the right end). `addParty` gathers every party member there as one block.

**Actors with the same name:** `addToCast({ name })` links the one actor with that name. With several, it warns and adds the art alone, so pass `actorUuid`.

**Hooks it calls:** `vn-stage.layout(scene, placements)` after each layout (each portrait's box and `cluster`, for other modules); `vn-stage.tagFolders(tag, folders)` to let modules add a tag's automatic folders.

## Stored data

Change any of these only with a step in `scripts/migrate.js` (bump `SCHEMA`), so stored data is upgraded once and the code reads one form.

| Where | Key | Holds |
|---|---|---|
| World setting | `artRoot`, `safetyBackground`, `tagFolders` | The settings above |
| World setting | `portraitShadow`, `portraitShadowStrength` | The shadow settings above: on or off, and how dark (0 to 1) |
| World setting | `schema` | The last data upgrade run (migrate.js) |
| World setting | `tags` | `{ [id]: { label, folders, images, add, remove, hideAuto, deleted } }`; characters also come from the art's `tags`. A tag is listed only while something carries it |
| World setting | `groups`, `groupFolders` | From before tags. Read once by the schema 4 upgrade, then left alone |
| World setting | `presets` | `{ [id]: { name, tags, background, cast, saved } }`; cast entries carry `cluster` like the scene's, and may carry `partyMember` and `form` |
| World setting | `recent` | `{ names }`: art keys, newest first (24) |
| World setting | `artIndex` | `{ root, scanned, art: { [key]: art } }`: the art folder as the GM's screen last scanned it (paths relative to `root`), so players read art without browsing files. Rescanned every time the world loads, when the Art folder setting changes, and by the Stage window's refresh button |
| World setting | `characterPrefs` | `{ [art key]: { flip, scale, yOffset, size, flying } }`; an actor without art uses `actor:<id>` as its key. `scale` and `yOffset` are the actual values and replace the art file's; absent means the file's |
| Client setting | `collapsed` | Which Background folder strips this GM collapsed in the Stage window |
| Client setting | `windowTab`, `windowSize` | The Stage window tab this GM last used (`cast`, `background` or `presets`), and the window's last `{ width, height }` |
| Client setting | `gmViewLock` | Whether this GM's view is locked to the stage like the players' |
| Scene flag | `stage` | `{ version }`: the scene is a stage |
| Scene flag | `cast` | `[{ id, name, actorUuid, cluster, expression?, form? }]` by cluster (from 0, no gaps), each cluster left to right (`expression` and `form` only for art without an actor) |
| Scene flag | `partyOrder` | Actor ids, the order the party last stood in |
| Scene flag | `tag`, `backgroundFolder`, `preset` | The tag the stage shows, its last-browsed folder, and the preset last loaded or saved |
| Actor flag | `expression`, `form`, `art`, `lockedForms` | The actor's expression and form (follow them to every stage), its VN art… link, and the forms players can't switch to (art keys; the GM still can) |
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
| Click and drag a portrait: the character menu opens, the drag moves them (or, dropped in the red band across the top, takes them off the stage), and Foundry's selection box doesn't appear | Our window-level `pointerdown` listener (capture phase) runs before the canvas's own | `interact.js` |
| Add, remove and swap: portraits fade, backgrounds crossfade | Stand-in `PrimarySpriteMesh`es added to `canvas.primary` (`sortDirty`), and the `refreshTile` hook scaling `tile.mesh.alpha` | `fades.js` (turns itself off on error; look for a console warning) |
| Drag a character to another cluster, or load a preset that keeps some of the cast: portraits slide and scale to their new places. Drag an Adjust slider: they jump | The `refreshTile` hook running after `Tile#_refreshPosition` and `_refreshSize`, then writing `tile.mesh.position` and `PrimarySpriteMesh#resize`; the mesh being kept across redraws (`PrimaryCanvasGroup.addTile`); custom update options (`{ "vn-stage": { instant: true } }`) reaching every client's `updateTile` hook before the refresh | `fades.js` (turns itself off on error; look for a console warning) |
| Put two characters on stage: each has a soft shadow. Add or remove one: the shadow fades with them. Zoom (GM, view unlocked): the shadow keeps its size against the portrait | A custom `PIXI.Filter` (with `PIXI.BlurFilter`) on each portrait's `tile.mesh`: `PrimarySpriteMesh`'s filter rendering, `FilterSystem#applyFilter`, `getFilterTexture`, the `inputSize` uniform, and `canvas.stage.scale` | `shadows.js` (turns itself off on error; look for a console warning) |
| Drag a portrait: it dims while dragged | Setting `tile.mesh.alpha` until the next `refreshState` | `interact.js` |
| Right-click a Cast tile: the menu opens above the Stage window | `ApplicationV2._maxZ` (internal), with the open windows' z-index as a fallback | `interact.js` (`topZ`) |
| As a player, try to pan or zoom: the view stays fitted | Shadowing `canvas.pan` and `canvas.animatePan` | `view.js` |
| Make stage on a new scene: the safety-net background shows | `scene.initialLevel` and the Level's `background.src` (v14 Levels) | `stage.js` |
| Click a portrait's see-through edge: nothing happens | `PrimarySpriteMesh#containsCanvasPoint(point, alpha)` | `interact.js` (`portraitAt`) |

## Keys to keep stable

Saved choices (Flip, size, height), tags, Recent and VN art… links are keyed by the art folder's name under the art root (`Rahadin`, `Rahadin/forms/corrupted`). Form locks too. **Renaming a character's art folder loses them**; renaming actors is safe.

## Conventions

- **No build step.** Plain ES modules, CSS and Handlebars templates, loaded by Foundry as they are.
- **No `manifest` or `download` URL** in `module.json`, so Foundry's updater can never overwrite the working copy. `tools/build-zip.mjs` writes both into the released `module.json` only.
- **Versioning:** bump `version` in `module.json`, move the `CHANGELOG.md` entries under the new version, and tag the release (`v0.3.0`).
- **Releases:** pushing a `v*` tag runs `.github/workflows/release.yml`. It runs the checks, builds the zip and publishes a GitHub release with `vn-stage.zip` and `module.json`. The steps are at the top of that file. To build the zip locally: `ELECTRON_RUN_AS_NODE=1 ~/foundryvtt/foundryvtt tools/build-zip.mjs`.
