# VN Stage

A Foundry VTT module (v14) for visual-novel scenes on a native Foundry scene. Every campaign Justin runs uses it, and it is shared privately with friends' tables. See `README.md` for settings and the console API.

## Checks

- Tests: `ELECTRON_RUN_AS_NODE=1 ~/foundryvtt/foundryvtt tools/test.mjs`
- Load check: `ELECTRON_RUN_AS_NODE=1 ~/foundryvtt/foundryvtt tools/check-load.mjs`
- Items: `python3 "/home/justin/Projects/Character Art Pipeline/infra/items.py" --dir=items check`
- The pre-commit gate (`.githooks/pre-commit`, enabled by `git config core.hooksPath .githooks`) runs the two JS checks when `scripts/`, `tools/`, `lang/` or `module.json` is staged, and the items check when `items/` is staged. Skip once with `git commit --no-verify`.
- Node isn't installed; Foundry's Electron runs the JavaScript.

## Work

Open work lives in `items/`, tracked as `~/.claude/CLAUDE.md` describes. `ITEMS.base` shows it in Obsidian.

Shared rules are in `~/.claude/CLAUDE.md`.
