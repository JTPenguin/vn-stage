---
title: "Let the GM lock their canvas like the players"
kind: feature
status: done
waits_on: none
priority: ⏫
blocked_by: []
source: "Justin's list, 2026-10-30"
added: 2026-10-30
updated: 2026-10-30
outcome: "Built in 9ec1568: a header lock button and a Lock my view keybinding toggle the client setting gmViewLock. Justin checked it in Foundry on 2026-10-30."
---
# Let the GM lock their canvas like the players

A toggle that locks the GM's own canvas, the same way players' canvases are locked: the view stays fitted to the stage frame and ignores pans, drags and zooms. The GM can then work on the stage without moving the view by accident.

**Decisions (Justin, 2026-10-30):**
- **A separate toggle** for the GM only. Players stay always locked, as now.
- **Two ways to toggle it:** a lock button in the VN Stage window header, and a keybinding (registered beside `openWindow` in `module.js`). Show a short notification when the key toggles it.
- **Remembered per GM:** a client setting.

**Where:** `view.js` already shadows `canvas.pan` and `canvas.animatePan` for players and re-fits on window resize. Apply the same lock to the GM while the toggle is on, and lift it when it goes off. Turning it on re-fits the view at once.

**Related:** [[resize-canvas-for-sidebar]] re-fits the GM on sidebar toggles only while this lock is on.
