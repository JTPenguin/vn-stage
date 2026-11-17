---
title: Give each Stage window tab its own action row
kind: feature
status: done
waits_on: none
outcome: "Each tab has its own action row on the right; the tab row holds the tabs and the tag picker. Checked by Justin, 2026-11-16."
blocked_by: []
source: Justin's words, 2026-11-16; interview with Justin, 2026-11-16
added: 2026-11-16
updated: 2026-11-16
priority: ⏫
---
# Give each Stage window tab its own action row

Each tab gets a row at the top for the actions that belong to it. The shared tab row stops carrying action buttons.

| Tab | Row holds |
|---|---|
| **Cast** | The search box, Reset expressions and Re-read art folder (all already there), plus **Clear stage** (moved from the tab row) |
| **Presets** | **Save as preset** (moved from the tab row) |
| **Background** | Browse…, + and Add folder… (moved up from the bottom of the tab), plus the browsed folder's path |

**Why:** the buttons in the tab row don't say which tab they act on. A row inside the tab makes the link clear.

**Today:** the tab row's right side holds Update (only when a loaded preset has changed), Save as preset (+) and Clear stage (broom), in `.vn-stage-tools` ([stage-window.hbs:30-34](../templates/stage-window.hbs)). Cast's top row is `.vn-cast-tools` ([stage-window.hbs:84-88](../templates/stage-window.hbs)). Background's row, `.vn-bg-row`, sits below the grid ([stage-window.hbs:70-80](../templates/stage-window.hbs)). Save as preset asks for a name and confirms a replace; Clear stage acts at once ([window.js:415-440](../scripts/window.js)).

**Earlier decision this reverses:** when the tabs were built, Clear stage and Save as preset were placed above the tabs so they were always in view ([[tabbed-vn-stage-window]]).

**Clear stage only in the Cast tab (Justin, 2026-11-16):** it is hidden while Background or Presets is open. The tab row ends up with tabs only.

**Clear stage look (Justin, 2026-11-16):** the broom icon, last in the Cast row. It now asks for confirmation before taking everyone off, every time. No Shift-click shortcut. Use the module's existing `confirm` dialog, as Save as preset does for a replace.

**Save as preset look (Justin, 2026-11-16):** a labelled button, "+ Save as preset", not a bare icon. Its tooltip keeps the "tagged …" part when a tag is picked.

**Background row (Justin, 2026-11-16):** moves to the top of the tab, above the grid. The browsed folder's path stays in the row. The "No backgrounds have this tag yet…" and "Browse to a scenario's scene art…" hints leave the row and show as empty-state text in the grid instead.

**Future stage-wide buttons (Justin, 2026-11-16):** Show to players ([[show-to-players]]), Secret and Reveal all ([[reveal]]) go in the Cast tab's row when they are built, not the tab row.

**Related:** [[update-preset-from-context-menu]] removes the Update button from the tab row; do both together so the tab row ends up with tabs only. [[presets-as-grid]] changes the Presets tab. [[background-tab-add-tiles]] may later turn + and Add folder… into in-grid tiles, which would empty most of the Background row.

**Check in Foundry:** each tab shows its row at the top; the tab row shows tabs only; Clear stage asks before clearing; Save as preset still names and saves; the Background path shows after Browse…, and the empty hints show in an empty grid; the Cast row doesn't crowd at the window's narrowest width; the tag picker sits on the tab row and wraps below the tabs in a narrow window; changing the tag still filters all three tabs.

**Built (2026-11-16):** the tab row holds tabs only. Each tab has a `.vn-tab-actions` row at its top: Cast adds the broom (Clear stage, now with a confirmation) after Re-read; Presets has "+ Save as preset"; Background's row moved above the grid, shows the folder path only when no tag is picked, and its two hints moved into the grid as empty-state text. The empty Presets text now says "Save the stage with Save as preset." Code: `templates/stage-window.hbs`, `scripts/window.js`, `styles/stage.css`. Tests and the load check pass. The template was rendered outside Foundry in five states and looked right. Not yet run in Foundry.

**Follow-up (Justin, 2026-11-16):** the action buttons in every tab's row sit on the right. The broom has the same gap as the other icons.

**Tag picker joins the tab row (Justin, 2026-11-16):** the tabs stay on the left; the tag icon (with its tooltip), the picker and the gear sit on the right. The picker fills the space left, at least 8rem wide. When the window is too narrow for both, the tag group wraps onto a second line under the tabs. Built the same day: the separate tag bar is gone. Rendered outside Foundry at 360, 440 and 560 px wide: one line at 440 and up, wrapped at 360.

**Checked:** Justin checked it and closed it, 2026-11-16.
