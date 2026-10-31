---
title: "Presets on the hotbar"
kind: feature
status: ready
waits_on: Claude
priority: ⏬
blocked_by: []
source: "Justin's ideas backlog, 2026-10-21 (moved here 2026-10-24)"
added: 2026-10-24
updated: 2026-10-30
---
# Presets on the hotbar

Drag a preset chip onto the macro bar to load it with one key press, without opening the Stage window.

**Decisions (Justin, 2026-10-30):**
- **Dragging a chip** onto the hotbar makes a script macro that calls `VNStage.loadPreset(<id>)`, named after the preset.
- **Pressing it** loads the preset onto the scene the GM is viewing, if it's a stage. Otherwise it shows a warning and does nothing.
- **GM only.** The macro warns a player and does nothing.
- If the preset was deleted, the macro warns that it's gone.
