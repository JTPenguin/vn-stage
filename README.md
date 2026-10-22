# VN Stage

A private Foundry VTT module for visual-novel scenes on a native Foundry scene: portraits on the left and right, expressions players can change, and swappable static backgrounds. Not tied to any campaign; the Wayfinder Chronicles Landing builds on it.

**Private. Not for distribution.**

## Requirements

- Foundry VTT 14

## Install (development)

This repository is the module folder. Foundry loads it through a symlink:

```bash
ln -s "/home/justin/Projects/Wayfinder Chronicles/Module/vn-stage" ~/.local/share/FoundryVTT/Data/modules/vn-stage
```

## Settings (world)

- **Art folder:** one subfolder per character, named as the character, holding `portrait.webp` (neutral), `expressions/` and `manifest.json`.
- **Safety-net background:** set once as the scene's own background when it becomes a stage. The background shown during play is a tile above it, because changing a scene's own background redraws the canvas on every screen.

## Console API (0.0.x)

`VNStage` (also `game.modules.get("vn-stage").api`):

- `makeStage()`: turn the viewed scene into a stage (2560 × 1440, gridless, no vision).
- `setBackground(src)`: show an image as the stage background.
- `status()`: what the module sees on this screen.

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

The plan lives in the Wayfinder Chronicles vault: `_Claude/E3 Brief.md`.
