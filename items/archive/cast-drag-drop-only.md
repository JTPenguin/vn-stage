---
title: "Cast list: drag and drop replaces the left/right/group controls"
kind: feature
status: done
waits_on: none
outcome: "Built 2026-11-16; Justin checked it in Foundry the same day."
blocked_by: []
source: "Justin's words, 2026-11-16; details from an interview the same day"
added: 2026-11-16
updated: 2026-11-16
---
# Cast list: drag and drop replaces the left/right/group controls

Remove the Left / Right and ‹ number › controls from the Cast section of the VN Stage window. Drag and drop becomes the way to put characters on the stage and move them. A small × takes an on-stage character off.

**Why:** the controls duplicate what dragging already does, and they take up room in the cast list. Fewer controls and less API also make the module simpler.

## What changes in the window

| Row | Today | After |
|---|---|---|
| Character, off stage | Left / Right buttons (shift-click: new cluster) | No buttons. Drag the row onto the stage |
| Character, on stage | ‹ cluster number › (the number takes them off) | A small × that takes them off. The warm highlight and bold name stay |
| The Party, off stage | Left / Right buttons | No buttons. Drag the row onto the stage |
| The Party, on stage or partly on stage | ‹ number › once they stand together | A small × whenever any member is on stage. It calls `removeParty`, which takes every member off |

- **No cluster number on the row.** The highlight shows who is on stage; the stage shows the clusters.
- **Other ways off stay:** the row's right-click menu ("Remove from the stage") and the red band across the top of the stage.
- **Update the tooltips** on the Party row's name and the Cast rows, which describe Left, Right, ‹ and ›.

## What drag and drop already covers

Nothing new needs building for these. `dropCanvasData` in `scripts/module.js` and `dropTarget` in `scripts/interact.js` already handle them, with the drop marker showing where the character lands.

- Joining any cluster at any place, not only the leftmost or rightmost.
- Starting a new cluster anywhere, which replaces shift-click.
- Moving a character, or the whole party, between clusters (the ‹ › job).
- Dragging an actor or the party from the Foundry sidebar.

## Code to remove

Justin's call: drop as much as possible. No macros or other modules use the API, so nothing outside the module can break.

| Where | Remove |
|---|---|
| `templates/cast-row.hbs`, `templates/stage-window.hbs` | The `vn-toggles` buttons; add the × |
| `scripts/window.js` | The `add`, `move`, `remove`, `addParty`, `moveParty`, `removeParty` handlers for those buttons (keep one handler each for the × on a character and on the Party) |
| `scripts/window-data.js` | `cluster`, `canLeft`, `canRight` on rows and the Party row |
| `scripts/rules.js` | `neighbourTarget`, `joinIndex`, and the `side` option in `resolveCluster`; `innerIndex` too if nothing is left using it |
| `scripts/cast.js` | The `side` option in `addToCast`, `addParty` and `moveToCluster`; `switchSide`; `moveInCluster` |
| `scripts/module.js` | `switchSide`, `moveInCluster` and the old names `partySide` and `moveInSide` in the API |
| `styles/` | `.vn-step` and `.vn-cluster` rules; the Left / Right toggle styles if nothing else uses them |
| `tools/test.mjs` | Tests for the removed functions |
| `README.md` | The Cast API line and "Clusters in the API" paragraph; the "Switch a side" row in the table of internals |

**Keep `clustersFromSides`.** It upgrades old scenes and presets saved with sides (`migrate.js` and `getCast`), so it stays whatever happens to the `side` option.

**`addParty` simplified.** Its default path used to leave members already in the cluster where they stood and join the rest at the end nearest the middle. That path existed for Left / Right only, so now `addParty` always gathers every member there as one block, the same as a drop. `innerIndex` went with it.

## Related items

- [[horizontal-vertical-layout-toggle]] says the Cast list "keeps the most width, because its rows hold the cluster buttons". That reason goes away with this item.
- [[tabbed-vn-stage-window]]: a narrower Cast list helps a tabbed or side-by-side window.

## Check

- Tests and load check pass (`CLAUDE.md`).
- In Foundry (Justin): drag a character and the Party on and between clusters; take each off with ×, the right-click menu and the red band; the rows show no leftover buttons or tooltips.

## Status

Done. Tests and the load check passed, and Justin checked it in Foundry on 2026-11-16.
