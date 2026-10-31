---
title: "Stage clusters instead of fixed left and right"
kind: feature
status: ready
waits_on: Claude
priority: 🔼
blocked_by: []
source: "Justin's request, 2026-10-26"
added: 2026-10-26
updated: 2026-10-30
---
# Stage clusters instead of fixed left and right

Replace the stage's fixed left and right sides with one or more clusters. The clusters spread evenly across the stage. Characters can be dragged between clusters, the same way they can be dragged between left and right today. Dropping a character between two clusters creates a new cluster holding just that character. Dropping a character at the far left or far right creates a new cluster on that edge and adds the character to it.

**Decisions (Justin, 2026-10-30):**
- **Name:** "cluster", matching the layout code's word.
- **No cap** on the number of clusters.
- **An empty cluster disappears** when its last character leaves.
- **Existing data:** a stage's or preset's left side becomes cluster 1 and its right side cluster 2. This changes the cast entry's `side`, so it needs a `migrate.js` step (bump `SCHEMA`) and README updates (stored data, the console API's `side` arguments such as `addToCast`, `switchSide`, `addParty`).
- **The party** drops into one cluster as a block.

**Where:** `arrange.js` (regions and crowding for N clusters), `rules.js` (`dropSlot`), `interact.js` (drag markers), the Cast list's side toggles, and their tests. [[resize-canvas-for-sidebar]] also changes `arrange.js`; build one, then the other.
