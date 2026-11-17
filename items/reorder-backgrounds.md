---
title: "Reorder backgrounds in the VN Stage window"
kind: feature
status: ready
waits_on: Claude
priority: 🔽
blocked_by: []
source: "Justin's request, 2026-10-26"
added: 2026-10-26
updated: 2026-10-30
---
# Reorder backgrounds in the VN Stage window

Let Justin change the order of the backgrounds in the VN Stage window by dragging thumbnails.

**Decisions (Justin, 2026-10-30):**
- **List only.** The order changes how the strips look and nothing else.
- **Drag within a strip:** a thumbnail moves within its own folder strip or the "Single backgrounds" strip, not between strips.
- **Saved per tag.** New files that aren't in the saved order go at the end, sorted as now.

**Where:** `backgroundStrips` in `window-data.js` builds the strips. A new stored field (on the tag, or a new world setting for the built-in "All" view) needs a stored-data row in docs/development.md.
