---
title: "Test a tabbed VN Stage window"
kind: test
status: in-progress
waits_on: Justin
blocked_by: []
source: "Justin's words, 2026-11-16; details settled with Justin, 2026-11-16"
added: 2026-11-16
updated: 2026-11-16
---
# Test a tabbed VN Stage window

Try a version of the VN Stage window with three tabs: **Cast**, **Background** and **Presets**. It sits beside today's stacked window, and a title-bar button flips between the two until Justin picks one.

**Why:** the window holds several sections at once. Tabs show one at a time, so the window can be shorter and cover less of the stage, and each tab still fills the full height when the window is dragged bigger. This replaces the dropped horizontal/vertical toggle ([[horizontal-vertical-layout-toggle]]).

## Decisions (Justin, 2026-11-16)

| Question | Decision |
|---|---|
| **Goal** | Both: a shorter window by default, and each tab uses the full height when the window is bigger |
| **Trying it out** | A title-bar button flips between tabbed and stacked, remembered per GM |
| **Tab order** | Cast, Background, Presets |
| **Opening tab** | The last tab used, remembered per GM on this machine |
| **Auto-switch** | Never. The tab changes only when the GM clicks one |
| **Badges** | None. Plain tab names |
| **Window size** | Each mode remembers its own size. Tabbed opens short; stacked opens at today's 560 × 760 |

**Always in view, above the tabs:**
- The tag picker and the Manage tags gear (the tag filters all three tabs).
- **Clear stage** (the broom, now in the Cast header).
- **Save preset** (+) and **Update** (now in the Presets header).
- Room in the same row for the planned stage buttons: Show to players ([[show-to-players]]), Secret and Reveal all ([[reveal]]).

## Build notes

- **Use Foundry's own tabs.** v14's `ApplicationV2` has `static TABS`, `tabGroups` and `changeTab()` (`client/applications/api/application.mjs`). Set the group's `initial` from the remembered tab, and save the tab when it changes.
- **One window, two layouts.** Keep `StageWindow` and its actions. The mode picks the template (or parts): stacked is today's `stage-window.hbs`; tabbed moves the shared bar into a toolbar and puts each section in a tab.
- **The title-bar button** goes in `_getFrameButtons`, beside the view-lock button. Store the mode and both sizes in client settings, next to `collapsed`.
- **Staying in the Cast tab:** the search box, the Party row, Reset expressions and Re-read the art folder.
- **Collapsing sections** has no use in tabbed mode, so hide the chevrons there. Background folder groups still collapse.
- **Scrolling:** each tab scrolls on its own. Keep `.vn-cast-list` and `.vn-bg-scroll` in `scrollable` so a re-render keeps the place.
- **Re-renders** (a stage change fires one) must keep the open tab.
- **Dragging from Cast** onto the stage must still work from the tabbed window.

## Built (2026-11-16)

- **Layout button** in the title bar, beside the view lock. It shows a folder icon ("Show as tabs") in stacked mode and a bars icon ("Show all sections") in tabbed mode.
- **Settings** (client, hidden): `windowLayout` (`stacked` or `tabbed`), `windowTab` (the last tab used) and `windowSizes` (one size per layout). Tabbed opens at 560 × 480 and stacked at 560 × 760, until the GM resizes the window.
- **Tabbed mode** uses Foundry's own tabs. A row holds the tabs on the left and Update, Save preset and Clear stage on the right. Reset expressions and Re-read the art folder move next to the Cast search box.
- **Stacked mode** is unchanged.
- Code: `scripts/window.js`, `scripts/settings.js`, `templates/stage-window.hbs`, `styles/stage.css`, `lang/en.json`.
- Tests (94) and the load check pass. The template was rendered in both layouts outside Foundry. Nothing has run in Foundry yet.

## Check in Foundry (Justin)

- The layout button flips between layouts, and each layout reopens at its own size after a reload.
- Clicking a tab switches it, and the window reopens on that tab. A stage change (adding a character) keeps the open tab.
- Each tab scrolls on its own. Dragging a character from the Cast tab onto the stage still works.
- Update appears in the tab row after you change a loaded preset.
- Then the real test, in a session: does the window read more easily with tabs? Is moving between cast, backgrounds and presets quicker than scrolling? Does anything get hidden that needs to stay in view?

**Next step:** Justin checks it in Foundry and picks a layout. Claude then removes the losing one.
