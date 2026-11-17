---
title: Update a preset only from its right-click menu
kind: feature
status: in-progress
waits_on: Justin
blocked_by: []
source: Justin's words, 2026-11-16; interview with Justin, 2026-11-16
added: 2026-11-16
updated: 2026-11-16
priority: 🔼
---
# Update a preset only from its right-click menu

Remove the **Update** button from the tab row. Updating a preset becomes a deliberate action in the Presets tab: right-click a preset, then choose Update.

**Why:** the button shows whenever a loaded preset has changed, but nothing on screen says which preset it would overwrite. An overwrite should name its target.

**Today:** the right-click menu already has **Update from stage** on every preset, and it overwrites without asking ([window.js:257](../scripts/window.js)). The loaded preset's chip is highlighted and shows an amber dot once the stage changes, with "The stage has changed since it was loaded" in its tooltip ([window-data.js:125-138](../scripts/window-data.js)). The tab-row Update button is the only other user of that check (`changedPreset`, [window.js:131](../scripts/window.js)).

**Confirmation (Justin, 2026-11-16):** updating the loaded preset saves at once. Updating any other preset asks first and names it.

**Changed cue (Justin, 2026-11-16):** keep the amber dot and tooltip line as they are. [[presets-as-grid]] carries them over to the tile.

**Menu scope (Justin, 2026-11-16):** Update from stage stays on every preset.

**Related:** [[tab-action-rows]] (the tab row ends with tabs only).

**Built (2026-11-16):** the Update button and its `changedPreset` context are gone. The right-click **Update from stage** saves the loaded preset at once and asks first for any other, naming it. Code: `scripts/window.js`, `templates/stage-window.hbs`, `styles/stage.css`. Tests and the load check pass. Not yet run in Foundry.

**Check in Foundry (Justin):** load a preset, change the stage, and see the amber dot; right-click it and Update from stage saves without asking; right-click another preset and Update from stage asks, naming it.

**Next step:** Justin checks it in Foundry, then closes it.
