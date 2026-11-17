---
title: "Make right-clicks in the VN Stage window consistent"
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
# Make right-clicks in the VN Stage window consistent

Every right-click in the Stage window should open a menu, and every menu should offer the same tag items.

## Why

Right-click does different things in different places today:

| Where | What happens now | Built with |
|---|---|---|
| **A background** | Opens the tag editor straight away, with no menu | A `contextmenu` listener in `window.js` |
| **A Cast row** | Opens the character menu: forms, expressions and an icon row (Flip, Adjust, VN art…, Tags…, Remove) | `openCastMenu` in `menu.js` |
| **A preset chip** | Opens a menu: Update from stage, Rename…, Tags…, Delete | Foundry's `ContextMenu` in `_onFirstRender` |

## What Justin chose

**Same items, own looks.** The character menu keeps its own icon style, because it holds forms and expressions. Backgrounds get Foundry's text menu, like presets. Every menu offers the same tag items.

| Menu | Items |
|---|---|
| **Background** (new) | **Tags…**, then **Remove from [tag]** |
| **Preset** | As now, plus **Remove from [tag]** |
| **Character** | As now, plus **Add to [tag]** for rows outside the tag (see [[add-tag-to-character-from-search]]) or **Remove from [tag]** for rows inside it |

- The tag items show only when a real tag is selected, not under All, Recent or Untagged.
- A background tagged through its folder can't be removed alone. Its menu should say so, such as "From folder [name]: set in Manage tags", rather than offer **Remove**.

## How it could work

- **Background menu:** replace the `contextmenu` listener in `_onRender` with a second Foundry `ContextMenu` in `_onFirstRender`, on `.vn-bg-choice`. Use its `condition` option to show **Remove from [tag]** only when it applies.
- **Folder tags:** `backgroundTags()` in `tags.js` already marks each tag with `viaFolder`. Use it to pick between **Remove** and the folder note.
- **Character menu:** `gmActions` in `menu.js` adds an icon button for the tag item, with the tag's name in its tooltip.
- **Shared wording:** keep the labels in one place so the three menus can't drift apart.

## Done when

- Right-clicking a background, a Cast row and a preset each opens a menu.
- Each menu offers **Tags…** and the right **Add** or **Remove** item for the current tag, and none under All, Recent or Untagged.
- Tests and the load check pass, and Justin checks each right-click in the Stage window.

## Related

- [[add-background-or-folder-to-tag]]: the matching way to add backgrounds.
- [[add-tag-to-character-from-search]]: the matching way to add characters.

## Built, 2026-11-16

Built with the other two tag items in one change. Tests (96) and the load check pass. Justin checked it in Foundry the same day.

**Justin's check in the Stage window:**
- Pick a tag. Right-click a background: **Tags…** and **Remove from [tag]**. One tagged only through its folder shows **In [tag] through its folder: Manage tags…** instead.
- Right-click a preset: **Remove from [tag]** sits between Tags… and Delete.
- Right-click a Cast row in the tag: a **−** icon beside Tags… removes them.
- Under All, Recent or Untagged none of these tag items show.
