---
title: "Drag drop over the side panel leaves a stuck marker and name"
kind: work
status: done
waits_on: none
outcome: "Fixed in cf28bcc and checked in Foundry 2026-11-13: a release over the sidebar, a click after it, a normal drop and a blur mid-drag all behave."
priority: ⏫
blocked_by: []
source: "Justin's bug report, 2026-10-30; details from the code and Justin, 2026-11-13"
added: 2026-10-30
updated: 2026-11-13
---
# Drag drop over the side panel leaves a stuck marker and name

Two faults in the same drag path.

**Steps to reproduce:**
1. Click and drag a character.
2. Release the mouse button while the cursor is over Foundry's side panel.

**Expected (Justin, 2026-11-13):** the drag cancels cleanly, as with Escape. The character stays where they stood, and the marker and name clear.

**Actual:** the character doesn't drop. Then:
1. Clicking a character on the canvas leaves the drop marker on screen. It stays until the next drag and drop.
2. The character's name also stays on screen. It seems to persist until Foundry is reloaded.

**Cause, from the code (`scripts/interact.js`):**
- `onUp` listens on `window` in the bubble phase. A release over the side panel never reaches it, most likely because the sidebar stops the event, so `endDrag` never runs and `press` stays set with `dragging: true`.
- The stuck "name" is the drag ghost (`.vn-drag-ghost`, which shows the character's name), not the hover label. The next drag's `startDrag` makes a new ghost and overwrites the `ghost` variable without removing the old one. The old ghost is left in the page until reload.
- The marker is only cleared in `endDrag`, so it lasts until the next completed drag. This matches the report.

**Built and checked (2026-11-13):**
- Moves and releases are caught in the capture phase, so the sidebar can't swallow them. `pointercancel` and the window losing focus also cancel a drag.
- A release outside the stage frame cancels: the character stays put.
- A new press ends any drag still running first, and a new drag removes any leftover name.
- Tests (85) and the load check pass.

**Checked in Foundry (test world, as GM, in the browser pane):**
1. Release over the open sidebar: the name, the marker and the dimming clear at once, and the cast is unchanged.
2. A click on a portrait afterwards opens the character menu, with nothing left behind.
3. A normal drop into the other cluster lands, and the marker and name clear.
4. A blur mid-drag (simulated with a window `blur` event) clears everything, and the later release does nothing.
