---
title: Show presets as a list of rows with thumbnails
kind: feature
status: done
waits_on: none
outcome: "Done: the Presets tab is a list of rows with a background thumb, the name and avatars cut to fit with +N. Checked in Foundry by Justin, 2026-11-16."
blocked_by: []
source: Justin's words, 2026-11-16; interview with Justin, 2026-11-16
added: 2026-11-16
updated: 2026-11-16
priority: ⏫
---
# Show presets as a list of rows with thumbnails

Replace the preset chips with a list. Each row shows the preset's background as a thumbnail, its name, and who is in it. The item began as a grid like the Cast and Background tabs (see [[cast-as-grid]]); Justin chose a list instead, because a row has room for the cast.

**Today:** each preset is a pill button with a play icon, the name and an amber "changed" dot, in a wrapping flex list ([stage-window.hbs:35](../../templates/stage-window.hbs), [stage.css:93](../../styles/stage.css)). `presetRows` builds each chip's hover text: the name, a "Tags: …" line, "The stage has changed since it was loaded" when that applies, and "Click to load · right-click for more" ([window-data.js:124](../../scripts/window-data.js)). The right-click menu is bound to `.vn-preset-list li[data-preset]` ([window.js:265](../../scripts/window.js)), and `.vn-preset-list` is in `scrollable` ([window.js:64](../../scripts/window.js)).

**Preset data:** a preset stores `background` (an image or video path, or null) and `cast` entries with `actorUuid`, the art key and `partyMember` on party entries ([presets.js:56](../../scripts/presets.js)). Avatars can use the same art thumbs as the Cast tiles (`thumb` in [window-data.js:80](../../scripts/window-data.js)). When a preset loads, its party entries are re-fitted to the current party (`fitPartyCast`, [presets.js:162](../../scripts/presets.js)), so the saved party members can differ from who appears.

**Model to copy:** the Background tab's tiles for the thumbnail: 16:9, `object-fit: cover`, a `<video>` for video backgrounds, and the accent border for the current one ([stage.css:20-25](../../styles/stage.css)).

**List, not grid (Justin, 2026-11-16):** presets show as a list of rows, one preset per row.

**Row layout (Justin, 2026-11-16):** a 16:9 background thumb on the left, about 5.5rem wide. Beside it, the name on top and the cast avatars in a line below.

**Party (Justin, 2026-11-16):** one Party avatar with the users icon stands for the whole party, as on the Cast tab's Party tile. NPCs get one avatar each.

**Avatar count (Justin, 2026-11-16):** show as many avatars as fit in the row's width, then "+N" for the rest. The count changes with the window size.

**Avatar names (Justin, 2026-11-16):** each avatar shows the character's name in its hover text.

**No background (Justin, 2026-11-16):** a plain panel with a faint image icon in the thumb's place. The name and avatars still show.

**Carried over:** the loaded preset is highlighted and keeps the amber "changed" dot, whose hover text says the stage has changed ([[update-preset-from-context-menu]]). Click loads the preset. Right-click keeps today's menu, including Update from stage.

**Related:** [[tab-action-rows]] puts **Save as preset** in this tab's action row. [[remove-background-tag-tooltip]] removes the "Tags: …" line from the same preset hover text.

**Built (2026-11-16):** each preset is a row button in `.vn-preset-list`, so click-to-load and the right-click menu work unchanged. `presetRows` builds the row data, including each avatar's thumb from the art index (the form the preset saved, if it has art) and its live actor name ([window-data.js](../../scripts/window-data.js)). `presetFaces` picks one Party avatar plus everyone else, and `avatarsThatFit` sets the +N count ([rules.js](../../scripts/rules.js)). After each render, and whenever a ResizeObserver sees the list's width change, `#fitFaces` hides the avatars that don't fit and fills the +N, whose hover text names them ([window.js](../../scripts/window.js)). Video thumbs play on hover. The row markup is in [stage-window.hbs](../../templates/stage-window.hbs), the styles under "The Party and presets" in [stage.css](../../styles/stage.css). New tests for both rules; 98 tests and the load check pass. Not yet run in Foundry.

**No row tooltip (Justin, 2026-11-16):** the row has no hover text. It blocked the avatars' own tooltips, and the name is already on the row. "The stage has changed since it was loaded" now sits on the amber dot itself. This also drops the preset half of [[remove-background-tag-tooltip]].

**Hover inside the row:** Foundry's stylesheet turns off pointer events for everything inside a button (`button > *`, inherited), so the avatars, the amber dot and the no-background icon turn them back on in [stage.css](../../styles/stage.css). Clicks on them still reach the row.

**Flicker:** the fit runs in `_onRender`, before the browser paints, so the full set of avatars should never show first. Part of the Foundry check.

**Check in Foundry (Justin):** in the Presets tab, look at a few presets: one with a large cast (avatars stop at the row's edge with +N, and +N names the rest on hover), one with a video background (plays on hover), one with no background (the faint image icon), and one with party members (one Party avatar). Resize the window narrower and wider and watch the +N change. Load a preset and change the stage to see the highlight and the amber dot. Hover over an avatar to see its name, and over the amber dot for its line. Right-click a row for the menu.

**Checked:** Justin checked it in Foundry and closed it, 2026-11-16.
