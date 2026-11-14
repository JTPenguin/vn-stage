---
title: "Drag drop over the side panel leaves a stuck marker and name"
kind: work
status: ready
waits_on: Claude
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

**Fix:**
1. Listen for `pointerup` and `pointercancel` in the capture phase, so a release anywhere ends the drag.
2. A release outside the stage frame (`dropTarget` returns null) cancels the drag.
3. `startDrag` removes any leftover ghost and marker first, as a safety net.
4. Add a test for the cancel path if `tools/test.mjs` can reach it.

**Check in Foundry, as GM:** release over the side panel, then click a character on the canvas. The marker and name are gone and the character hasn't moved. Then drag normally and confirm drops still land.
