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

## Conventions

- **No build step.** Plain ES modules, CSS and Handlebars templates, loaded by Foundry as they are.
- **No `manifest` or `download` URL** in `module.json`, so Foundry's updater can never overwrite the working copy.
- **Versioning:** bump `version` in `module.json`, add a `CHANGELOG.md` entry, and tag releases (`v0.1.0`).

## Design

The plan lives in the Wayfinder Chronicles vault: `_Claude/E3 Brief.md`.
