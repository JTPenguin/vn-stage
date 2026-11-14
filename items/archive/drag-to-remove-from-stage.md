---
title: "Remove a character from the stage by dragging it to the top area"
kind: feature
status: done
waits_on: none
outcome: "Built and checked in Foundry 2026-11-13: dropping a portrait in the top 30% of the stage takes the character off; the band lights red while hovered."
priority: 🔼
blocked_by: []
source: "Justin's request, 2026-10-31; details settled with Justin, 2026-11-13"
added: 2026-10-31
updated: 2026-11-13
---
# Remove a character from the stage by dragging it to the top area

Let the GM take a character off the stage by dragging them up to the top area of the stage.

**Decisions (Justin, 2026-11-13):**
- **Trigger zone:** a band across the top of the stage frame, above the faces.
- **Effect:** the character leaves the stage only (`removeFromCast`). They stay in the Cast list, as with the cluster toggle.
- **Feedback:** while the pointer is over the band, the drop marker changes to a distinct "remove" look, so the GM knows before releasing.
- A release outside the frame still cancels (see [[drag-drop-over-side-panel]]), so a slip over the sidebar never removes anyone.

**Built (2026-11-13):**
- The band is the top 30% of the stage frame (`REMOVE_BAND` in `scripts/rules.js`). It ends above the drop markers (which start at 40%) and above every face guide (the largest starts near 50%). Change the one constant to tune it.
- While a dragged portrait is over the band, the band lights red with a white cross, and the floating name reads "Take <name> off the stage". Moving back down restores the normal marker.
- Dropping there calls `removeFromCast`. A release beside the frame (the sidebar) still cancels.
- Only portrait drags on the stage use the band. Rows dragged in from the Cast list or the sidebar are unaffected. Each party member's portrait is removed on its own; the Cast list's party button still removes the whole party.
- Test: `the remove band` in `tools/test.mjs` (86 tests pass).

**Checked in Foundry (test world, as GM):**
1. Dragging into the band lit it red with the cross and changed the name (screenshot taken).
2. Moving back out restored the normal name, and Escape cancelled cleanly.
3. A real drop in the band took Test PC A off the stage. The band and the name cleared, and Test PC B stayed.

**Tune in play:** if 30% feels too tall or too short, change `REMOVE_BAND`.
