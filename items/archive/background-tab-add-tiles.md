---
title: Add a background or folder from the tag's Background tab, in place
kind: feature
status: done
waits_on: none
blocked_by: []
source: Justin's words, 2026-11-16; interview with Justin, 2026-11-16
added: 2026-11-16
updated: 2026-11-16
outcome: "Add and remove controls built into the Background tab's headings; checked by Justin in Foundry, 2026-11-16."
priority: 🔼
---
# Add a background or folder from the tag's Background tab, in place

Make the two "add" actions in a tag's Background tab look like part of the grid, not separate controls. Builds on [[add-background-or-folder-to-tag]], which is done.

- **Add a single background:** a heading-style "+ Add a background" button on the right of the "Single backgrounds" heading. Clicking it does what the add-background action does today.
- **Add a folder:** a small button sitting where the next folder heading would be. Clicking it does what the add-folder action does today.

**Today:** with a tag picked, the Background action row holds Browse…, **+** (`addBackgroundToTag`) and Add folder… (`addFolderToTag`) ([stage-window.hbs:60-67](../templates/stage-window.hbs)). The grid has two layouts: headed, when the tag has more than one strip, and flat with no headings, when it has one ([stage-window.hbs:70-83](../templates/stage-window.hbs), `showHeadings` in [window-data.js:198](../scripts/window-data.js)). The "Single backgrounds" strip exists only once the tag has a single image ([window-data.js:184-191](../scripts/window-data.js)). The "shown now" tile already uses a dashed border ([stage.css:187](../styles/stage.css)). An empty tag shows "No backgrounds have this tag yet…" ([stage-window.hbs:84](../templates/stage-window.hbs)). The click handlers are `#onAddBackgroundToTag` and `#onAddFolderToTag` in `scripts/window.js`.

**Add button on the heading (Justin, 2026-11-16):** "+ Add a background" sits inline with the "Single backgrounds" heading, aligned right, styled like a heading, like "+ Add folder…". This replaces the first plan, a ghost tile at the end of the strip: a tile could push onto a new row and make scrolling more likely.

**No single backgrounds yet (Justin, 2026-11-16):** a heading-style "+ Add a background" button takes the place of the "Single backgrounds" heading. It takes up about the space a heading would, not a full tile.

**Headings whenever a tag is picked (2026-11-16):** the add button needs a heading to sit on, so a tag's strips always show headings, even when its only strip is "Single backgrounds". The pinned tiles sit on their own row above them. The flat layout is now only for All, Recent and Untagged.

**Add folder (Justin, 2026-11-16):** a faint heading-style "+ Add folder…" line after the last strip. It shows in both layouts.

**Remove a folder (Justin, 2026-11-16):** each folder heading has a faint **×** on its right that takes the folder off the tag. It calls `removeFolder`, as the **×** in Manage tags does ([tags-window.js:108](../scripts/tags-window.js)): no confirmation, and an automatic folder is hidden rather than deleted. The "Single backgrounds" heading has no **×**; single backgrounds come off one at a time from their right-click menu.

**Action row (Justin, 2026-11-16):** remove **+** and Add folder… from the row. The row keeps only Browse… (and the folder path under All, Recent and Untagged).

**Empty tag (Justin, 2026-11-16):** drop the "No backgrounds have this tag yet…" text. The "+ Add a background" and "+ Add folder…" lines are enough.

**No tag picked:** unchanged. Under All, Recent and Untagged, neither control shows, as today.

**Done when:**
- A tag with single backgrounds shows "+ Add a background" on the right of the "Single backgrounds" heading; clicking it adds a picked file there and doesn't collapse the strip.
- A tag with no single backgrounds shows "+ Add a background" in the heading spot, and the headed layout.
- "+ Add folder…" ends the grid in both layouts and adds a folder strip.
- The **×** on a folder heading takes that folder off the tag.
- The action row shows only Browse… with a tag picked.
- An empty tag shows just the two controls.
- Tests and the load check pass, and Justin checks it in the Stage window.

**Built (2026-11-16):** `backgroundStrips` returns `singles` and `headed` (headings show whenever a tag is picked) and marks the singles strip, whose heading carries the add button. The ghost tile was built first, then replaced the same day at Justin's word. The heading-style buttons and the trimmed action row are in `templates/stage-window.hbs`; styles are in `styles/stage.css`. Tests (98) and the load check pass. The Background tab was rendered outside Foundry in five states (singles only, singles plus a folder, one folder and no singles, empty tag, no tag) and looked right. Not yet run in Foundry.

**Check in Foundry:** pick a tag with single backgrounds: "+ Add a background" sits on the right of its heading, adds a picked file there, and clicking it doesn't collapse the strip. A tag with only single backgrounds now shows that heading too. Pick a tag with only folders: "+ Add a background" sits above the first folder heading, and adding one moves it onto the new "Single backgrounds" heading. "+ Add folder…" ends the grid and adds a folder strip; the **×** on its heading takes it off again, without collapsing anything first. The action row shows only Browse…. An empty tag shows just the two lines. Under All, Recent and Untagged, none of them shows.

**Checked:** Justin checked it and closed it, 2026-11-16.
