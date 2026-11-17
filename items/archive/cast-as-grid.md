---
title: "Cast as a grid instead of a list"
kind: feature
status: done
waits_on: none
outcome: "Done: the Cast tab is a grid of square tiles. Checked in Foundry by Justin, 2026-11-16."
blocked_by: []
source: "Justin's words, 2026-11-16"
added: 2026-11-16
updated: 2026-11-16
---
# Cast as a grid instead of a list

Show the Stage window's Cast tab as a grid of tiles instead of a list of rows.

**Today:** the Cast tab lists each character as a row (`templates/stage-window.hbs`, `scripts/cast.js`). Right-clicking a Cast row opens its menu (see `README.md`).

**Today's row:** a 2rem thumb, the name, an optional note, up to 2 tag chips plus "+N", a "+" on hover (add to the selected tag) and a × when on stage ([cast-row.hbs](templates/cast-row.hbs), chip count `CHIPS` in [window-data.js:103](scripts/window-data.js:103)). The Party row comes first and lights up fully or partly ([stage-window.hbs:91](templates/stage-window.hbs:91)). With a tag picked, a divider splits that tag's characters from everyone else, who stay hidden until a search ([stage-window.hbs:101](templates/stage-window.hbs:101)).

**Code hooks:** drag, search and the row buttons find rows by `.vn-cast-list li[draggable]`, `[data-search]` and `[data-row]` ([window.js:211](scripts/window.js:211), [window.js:328](scripts/window.js:328), [window.js:377](scripts/window.js:377)), and `.vn-cast-list` is in `scrollable` ([window.js:65](scripts/window.js:65)). Tiles keep these hooks, so drag, search and the menu keep working.

**Model to follow:** the Background tab's grid of fixed 5.5rem tiles ([stage.css:21](styles/stage.css:21)). The window opens at 560 × 480 ([window.js:19](scripts/window.js:19)), so about 5 tiles fit across.

**Tile contents (Justin, 2026-11-16):** portrait, name, and tags.

**Clusters (Justin, 2026-11-16):** the grid does not show clusters. Each tile shows only whether the character is on the stage or not.

**Grid only (Justin, 2026-11-16):** the grid replaces the list. No list/grid toggle.

**Tile art (Justin, 2026-11-16):** the square headshot thumb the rows use today, made bigger.

**Tile size (Justin, 2026-11-16):** one fixed width, about 5.5rem, like the Background tab. No size slider.

**Party (Justin, 2026-11-16):** the first tile in the grid, with the users icon, lit fully or partly as today.

**Tags (Justin, 2026-11-16):** one clickable tag chip, then "+N" with the rest in its hover text.

**On stage (Justin, 2026-11-16):** on-stage tiles get the coloured accent border. Tiles not on stage are lightly faded as a whole.

**Buttons (Justin, 2026-11-16):** × and + sit as small buttons over the image's top corner, shown on hover.

**Name and note (Justin, 2026-11-16):** the name is one line, cut with "…". The full name and the note go in the tile's hover text. This holds for same-name actors too: hover text is enough to tell two "Guard" tiles apart.

**Others divider (Justin, 2026-11-16):** a full-width heading, with the others in their own grid below it, hidden until a search as today.

**Built (2026-11-16):** one grid in `.vn-cast-list`, so drag, search and the tag drop work unchanged. Tiles are in [cast-row.hbs](templates/cast-row.hbs); the Party tile is in [stage-window.hbs](templates/stage-window.hbs); `rowContext` builds the hover text and `CHIPS` is 1 ([window-data.js](scripts/window-data.js)); the styles are at the top of [stage.css](styles/stage.css). The divider and the empty note span the grid. Tests and the load check pass.
