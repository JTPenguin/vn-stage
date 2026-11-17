---
title: Remove the tag list from background and preset tooltips
kind: feature
status: done
waits_on: none
outcome: "Background thumbnails show their name underneath at a fixed 8rem width; hover text shows only for a cut-short name; the tag line is gone. Checked by Justin, 2026-11-16."
blocked_by: []
source: Justin's words, 2026-11-16; interview with Justin, 2026-11-16
added: 2026-11-16
updated: 2026-11-16
priority: 🔼
---
# Remove the tag list from background and preset tooltips

Take the "Tags: …" line out of the hover text on background thumbnails and on preset chips.

**Today:** each background's hover text is its name plus a "Tags: A, B" line. `backgroundStrips` in [scripts/window-data.js:175](../../scripts/window-data.js) builds it with `tagLine(tagsOf(src))`. The thumbnail itself prints no name ([templates/stage-bg.hbs](../../templates/stage-bg.hbs)), so the hover text is the only place the name shows. The name is also the button's `aria-label`.

**Scope (Justin, 2026-11-16):** backgrounds and presets both.

**Presets done (2026-11-16):** preset rows no longer have any hover text ([[presets-as-grid]]), so only the background half is left.

**Name under the thumbnail (Justin, 2026-11-16):** print each background's name under its thumbnail instead of relying on the hover text.

**Long names (Justin, 2026-11-16):** one line, cut short with an ellipsis. The hover text shows the full name only when the name is cut; otherwise there is no hover text. This is the same rule [[cast-tile-tooltip-only-when-needed]] proposes for Cast tiles, so the cut-off check could be shared.

**Where (Justin, 2026-11-16):** every thumbnail: all strips, the pinned default and the current background.

**Tags elsewhere (Justin, 2026-11-16):** not needed. The tag picker and the strip headings already say which tag you're browsing.

**Clean-up:** `tagLine` ([scripts/window-data.js:153](../../scripts/window-data.js)) has no other caller once the line goes, so remove it. The doc comment on `backgroundStrips` ("Each background names its tags in its hover text") needs updating too.

**Built (2026-11-16):** the name prints under each thumbnail ([templates/stage-bg.hbs](../../templates/stage-bg.hbs), `.vn-bg-name` in [styles/stage.css](../../styles/stage.css)). `#fitNames` in [scripts/window.js](../../scripts/window.js) sets the hover text only where the name is cut, and rechecks when a strip's width changes. `tagLine` is gone. The film icon on video thumbnails moved to the top right, so it doesn't cover the name. Tests and the load check pass.

**Size (Justin, 2026-11-16):** thumbnails were too small to tell apart and most names were cut. They are now a fixed 8rem wide (up from 5.5rem) and keep that size when the window resizes, like the Cast tiles.

**Checked:** Justin checked it in Foundry and closed it, 2026-11-16.
