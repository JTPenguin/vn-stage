---
title: "Add one background or a folder to the current tag"
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
# Add one background or a folder to the current tag

Give the Background tab a quick way to put a single background, or a whole folder, onto the current tag.

## Why

With a tag selected, the Background tab shows only that tag's backgrounds (`backgroundStrips` in `window-data.js`). An untagged background shows up only as the "shown now" pin after **Browse…**, and the only way to tag it is right-click, then the tag editor. Folders can only be added in **Manage tags**.

## What Justin chose

| Part | Decision |
|---|---|
| **Single background** | A **+** button beside **Browse…** opens the file picker. The picked file joins the current tag (`addImage`). The stage does not change. **Browse…** stays as it is, for showing a background without tagging it. |
| **Folder** | An **Add folder…** button beside **Browse…** opens the folder picker and adds the folder to the current tag (`addFolder`). |
| **No tag selected** | Under All, Recent and Untagged, hide both buttons. |

## How it could work

- **Template:** add the two buttons to `.vn-bg-row` in `templates/stage-window.hbs`, shown only when `bg.tagged`.
- **Single background:** a new action in `window.js`, like `#onBrowseBackground`, whose callback calls `addImage(tagId, decodePath(path))` and not `pickBackground`.
- **Folder:** reuse the folder picker from `TagsWindow.#pickFolder` in `tags-window.js`. It is private now, so move it to a shared helper that both windows call.
- **Empty-tag hint:** the text "Browse to one, then right-click it and choose Tags…" in `stage-window.hbs` changes to point at the new buttons.
- **Refresh:** check that adding a folder clears `folderCache` for it (`clearFolderCache` or `folderCache.delete`) so its images show at once.

## Done when

- With a tag selected, **+** adds a picked background to the tag's "Single backgrounds" strip, and the stage stays as it was.
- **Add folder…** adds a folder strip under its heading.
- Neither button shows under All, Recent or Untagged.
- Tests and the load check pass, and Justin checks it in the Stage window.

## Related

- [[right-click-menus-consistent]] gives backgrounds a right-click menu with **Remove from [tag]**, the opposite of this item. Build them together.
- [[add-tag-to-character-from-search]] is the same idea for characters.

## Built, 2026-11-16

Built with the other two tag items in one change. Tests (96) and the load check pass. Justin checked it in Foundry the same day.

**Justin's check in the Stage window:**
- Pick a tag. On the Background tab, **+** and **Add folder…** sit beside **Browse…**.
- **+**: pick a file. It joins "Single backgrounds" and the stage stays as it was.
- **Add folder…**: pick a folder. A strip with its heading appears.
- Switch to All, Recent or Untagged: both buttons are gone.
