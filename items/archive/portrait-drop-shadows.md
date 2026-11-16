---
title: Drop shadows behind portraits
kind: feature
status: done
waits_on: none
outcome: "Built 2026-10-30; marked done by Justin. Every portrait casts a soft shadow, drawn on each screen, with two world settings: Portrait shadows and Shadow strength."
priority: 🔼
blocked_by: []
source: Justin's request, 2026-10-25
added: 2026-10-25
updated: 2026-11-16
---
# Drop shadows behind portraits

Add a drop shadow behind the VN portraits on the stage, so each character lifts off the background.

**Decision (Justin, 2026-10-30):** one world setting for every portrait: on or off, plus a strength. No per-character override.

**Next step:** draw the shadow on each client (a PIXI filter on the portrait meshes, or a stand-in mesh like `fades.js` uses), then pick the default strength with Justin in Foundry. Add a row to the README's "After a Foundry update" table if it relies on PIXI internals.

**Built (2026-10-30), waiting on Justin's check in Foundry:**
1. Pick the default strength with the slider in the module settings. Try 0.3, 0.5 and 0.7 on a light and a dark background, then set `SHADOW.strength` in `scripts/constants.js`.
2. Judge the shadow's size and direction (`x: 0, y: 10, blur: 24` in `SHADOW`): straight down and soft, or leaning to one side?
3. Add, remove and swap a character: the shadow fades in and out with them. A form switch shows no double-dark patch.
4. Change an expression: the shadow follows the new shape.
5. On players' screens and the GM's, the shadow is the same size relative to the portrait. Zooming in and out on an unlocked GM view never cuts off its edges, except for one frame at most.
6. Turn the setting off and on, and move the slider: every connected screen updates without a reload.
7. Put 10 or more portraits on the slowest machine at the table: no noticeable frame drop. If frames drop, lower the blur quality in `shadows.js`.
8. On a hi-DPI screen, portraits stay sharp. Clicking the shadow beside a portrait does nothing.
9. A character who moves or scales takes their shadow along.
