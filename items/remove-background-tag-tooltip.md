---
title: Remove the tag list from background and preset tooltips
kind: feature
status: proposed
waits_on: Justin
blocked_by: []
source: Justin's words, 2026-11-16
added: 2026-11-16
updated: 2026-11-16
priority: 🔼
---
# Remove the tag list from background and preset tooltips

Take the "Tags: …" line out of the hover text on background thumbnails and on preset chips.

**Today:** each background's hover text is its name plus a "Tags: A, B" line. `backgroundStrips` in `scripts/window-data.js` builds it with `tagLine(tagsOf(src))`. Preset chips get the same line from `tagLine(p.tags…)` (`scripts/window-data.js`, around line 131).

**Scope (Justin, 2026-11-16):** backgrounds and presets both.

**Presets done (2026-11-16):** preset rows no longer have any hover text ([[presets-as-grid]]), so only the background half is left.

**Next step:** Justin says go. Then drop the `tagLine` part from both tooltips, and check the Background strip's and the preset chips' hover text in the Stage window.
