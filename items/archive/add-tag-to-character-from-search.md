---
title: "Add the current tag to a character from search"
kind: feature
status: done
waits_on: none
priority: ⏫
blocked_by: []
source: "Justin's ideas, 2026-11-16; options picked in an interview the same day"
added: 2026-11-16
updated: 2026-11-16
outcome: "Built in 4f6356f; Justin checked it in Foundry on 2026-11-16."
---
# Add the current tag to a character from search

When the Stage window's search brings up a character outside the current tag, make it quick to add them to the tag.

## Why

Searching shows matching characters from outside the tag under a "Not tagged [tag]" divider (`#applyFilter` in `window.js`, rows with the `outside` class). Today the only way to tag one is right-click, then **Tags…**, then type the tag in the editor.

## What Justin chose

All three ways, each only for rows outside the tag, and only when a real tag is selected:

| Way | How it works |
|---|---|
| **Right-click menu** | **Add to [tag]** is the first item in the character menu. |
| **Hover button** | A **+** appears on an outside row when the pointer is over it. One click adds them to the tag. |
| **Drag** | Drag an outside row up above the divider, into the tagged list, to add them. |

## How it could work

- **Menu:** `openCastMenu` in `menu.js` builds the menu from `gmActions`. Pass the current tag and whether the row is outside it, and add the item there. Under [[right-click-menus-consistent]] the same menu also offers **Remove from [tag]** for rows inside the tag.
- **Hover +:** add the button to `templates/cast-row.hbs` for outside rows, with an action in `window.js` that calls `addMember(tagId, row.key)`. Check that it doesn't fight the row's other buttons, such as × on a character on stage.
- **Drag:** Cast rows are already draggable, for dropping onto the stage. Add a `dragover` and `drop` listener on the tagged part of `.vn-cast-list` that reads the `VNStageCast` data and calls `addMember`. Dropping on the stage must work as before. Highlight the tagged list while a row is over it.
- **Key:** use the character's base art key (`baseArtKeyOf`), as `Tags…` does, so a form tags its character.
- **After adding:** the row moves above the divider on the next render. Keep the search text so the GM can add the next one.

## Done when

- Searching under a tag, each of the three ways adds an outside character to the tag, and the row moves up into the tagged list.
- None of them show under All, Recent or Untagged.
- Dragging a row onto the stage still puts them on the stage.
- Tests and the load check pass, and Justin checks it in the Stage window with a search.

## Related

- [[add-background-or-folder-to-tag]] is the same idea for backgrounds.
- [[right-click-menus-consistent]] adds the matching **Remove from [tag]**.

## Built, 2026-11-16

Built with the other two tag items in one change. Tests (96) and the load check pass. Justin checked it in Foundry the same day.

**Justin's check in the Stage window:**
- Pick a tag and search for someone outside it.
- **Right-click** their row: **Add to [tag]** is at the top of the menu.
- **Hover** their row: a **+** shows; click it.
- **Drag** their row up above the divider: the tag's rows light up; drop.
- Each time they move up into the tagged list. Dragging a row onto the stage still works.
