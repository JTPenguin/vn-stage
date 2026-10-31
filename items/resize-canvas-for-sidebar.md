---
title: "Resize the canvas when the sidebar shows or hides"
kind: feature
status: ready
waits_on: Claude
priority: ⏫
blocked_by: []
source: "Justin's request, 2026-10-27"
added: 2026-10-27
updated: 2026-10-30
---
# Resize the canvas when the sidebar shows or hides

When someone shows or hides Foundry's sidebar, re-fit their view to the space that is free, so nothing sits under the sidebar.

**Decisions (Justin, 2026-10-30):**
- **Drop the shared sidebar gap.** The layout stops reserving the right strip of the frame (`LAYOUT.sidebar` in `constants.js`, used by `arrange.js` and `dropSlot` in `rules.js`). Each screen fits around its own sidebar instead. A lone side can then use the full frame width.
- **Sidebar open:** fit the whole frame inside the area left of the sidebar (scale = the smaller of free width ÷ frame width and screen height ÷ frame height). That leaves bands above and below. The module draws nothing in them; Foundry's own canvas shows there.
- **Sidebar closed:** cover the whole window, as `fitView` does now.
- **Re-fit on every toggle** (Foundry's `collapseSidebar` hook) and on window resize. Players can't zoom by hand anyway.
- **GM:** re-fit only while [[gm-canvas-lock]] is on. An unlocked GM moves freely.

**Tests to update:** `tools/test.mjs` checks that the layout never uses the sidebar's share, and passes `LAYOUT.sidebar` to `dropSlot`. Both change with the gap.

**Related:** this reverses the sidebar gap from [[character-clustering]] (done). [[stage-areas]] also rewrites `arrange.js`; build one, then the other, not both at once.
