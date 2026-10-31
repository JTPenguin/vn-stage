---
title: "Smooth transitions when characters move"
kind: feature
status: ready
waits_on: Claude
priority: 🔼
blocked_by: []
source: "Justin's request, 2026-10-26"
added: 2026-10-26
updated: 2026-10-30
---
# Smooth transitions when characters move

When something changes a character's size or position, the character slides and scales to its new place instead of jumping. Examples: loading a preset, adding or removing a character, or moving a character to another side.

**Decision (Justin, 2026-10-30):** one fixed duration for every move, about 400 ms (close to the fades). No setting, and presets can't change it.

**Where:** portraits are tiles that `layout.js` updates. Animate each client's mesh from the old box to the new one when the tile updates, alongside the alpha handling in `fades.js`, and keep the same turn-off-on-error guard.

**Related:** [[reveal]] and [[stage-areas]] both rely on this to look good.
