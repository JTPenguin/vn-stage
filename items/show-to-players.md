---
title: "Show to players and back"
kind: feature
status: ready
waits_on: Claude
priority: ⏬
blocked_by: []
source: "Justin's ideas backlog, 2026-10-21 (moved here 2026-10-24)"
added: 2026-10-24
updated: 2026-10-30
---
# Show to players and back

Two Stage window buttons: one moves everyone onto the stage, and one sends them back to where they were, such as the battle map.

**Decisions (Justin, 2026-10-30):**
- **Show:** remember the scene that is active now, then activate this stage. Activating a scene moves every player to it.
- **Back:** re-activate the remembered scene, and forget it.
- **One shared "previous scene"** for the world, not one per player. Store it as a scene flag on the stage (add a row to the stored-data table in docs/development.md).
- Grey out **Show** when the stage is already active, and **Back** when nothing is remembered or that scene no longer exists.
