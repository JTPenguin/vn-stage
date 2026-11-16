---
title: Smooth transitions when characters move
kind: feature
status: done
waits_on: none
outcome: "Built 2026-10-30; marked done by Justin. Portraits slide and scale to their new places in about 0.4 s; Adjust changes still jump, and reduced motion turns it off."
priority: 🔼
blocked_by: []
source: Justin's request, 2026-10-26
added: 2026-10-26
updated: 2026-11-16
---
# Smooth transitions when characters move

When something changes a character's size or position, the character slides and scales to its new place instead of jumping. Examples: loading a preset, adding or removing a character, or moving a character to another side.

**Decision (Justin, 2026-10-30):** one fixed duration for every move, about 400 ms (close to the fades). No setting, and presets can't change it.

**Where:** portraits are tiles that `layout.js` updates. Animate each client's mesh from the old box to the new one when the tile updates, alongside the alpha handling in `fades.js`, and keep the same turn-off-on-error guard.

**Related:** [[reveal]] and [[stage-areas]] both rely on this to look good.

**Built (2026-10-30), waiting on Justin's check in Foundry.** Check it as a player and as the GM, on two screens if possible:
1. Switch a character's side: they slide across and resize in about 0.4 s, and the others close the gap.
2. Add a character to a busy side: they fade in at their place while the neighbours slide aside.
3. Remove one: they fade where they stand, and the rest slide together.
4. Load a preset that keeps two characters: the kept ones slide, the others crossfade.
5. Switch a side two or three times quickly: the portrait turns around smoothly, with no snapping back.
6. Drag the Adjust scale and height sliders, and change size or flying: portraits and the bottom shade jump straight to the new place, with no slide, and the blue face guide lines up. Then switch a side: that still slides.
7. Flip a character while they move: the flip is instant and the move carries on.
8. Add enough characters to zoom out: portraits shrink smoothly, and the bottom shade moves with them.
9. Switch to a form of a different size: the old image fades at the old place while the new one slides in.
10. With the OS "reduce motion" setting on, everything jumps as before.
