---
title: "Remove a character from the stage by dragging it to the top area"
kind: feature
status: ready
waits_on: Claude
priority: 🔼
blocked_by: [drag-drop-over-side-panel]
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

**Open detail for the build plan:** the band's height. Start with the space above the face guide's top (`faceGuide`), with a minimum height so it is easy to hit with small portraits. Tune it in Foundry.

**Works with:** dragging the whole party should remove every member at once, as the party's cluster button does.

**Builds on:** the drag-path fix, which touches the same code in `scripts/interact.js`.

**Next step:** Claude writes a build plan after the drag bug is fixed.
