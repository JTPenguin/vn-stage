---
title: "Drop shadows behind portraits"
kind: feature
status: ready
waits_on: Claude
priority: 🔼
blocked_by: []
source: "Justin's request, 2026-10-25"
added: 2026-10-25
updated: 2026-10-30
---
# Drop shadows behind portraits

Add a drop shadow behind the VN portraits on the stage, so each character lifts off the background.

**Decision (Justin, 2026-10-30):** one world setting for every portrait: on or off, plus a strength. No per-character override.

**Next step:** draw the shadow on each client (a PIXI filter on the portrait meshes, or a stand-in mesh like `fades.js` uses), then pick the default strength with Justin in Foundry. Add a row to the README's "After a Foundry update" table if it relies on PIXI internals.
