---
title: "Stage clusters instead of fixed left and right"
kind: feature
status: in-progress
waits_on: Justin
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

**Built (2026-10-30), waiting on Justin's check in Foundry.** Two choices made while building: with exactly one cluster, the Cast list's Left adds at its left end and Right at its right end. The console API's cluster numbers are the ones `VNStage.status()` shows.
1. Upgrade: load a world with existing stages and presets. The console says "upgraded to schema 3", and a two-sided stage looks the same as before.
2. Load a preset saved before the upgrade: everyone stands where they used to, and the party fills in.
3. Drag on the stage:
   - within a cluster: a solid marker, and the character reorders;
   - to another cluster: a dashed marker with an arrow pointing the right way;
   - between two clusters: a dashed "+" marker, and a new cluster holds just that character, with the clusters spread evenly;
   - to the far left or right edge: a new edge cluster, also on a crowded stage;
   - the last character out of a cluster: the cluster disappears and the rest spread out again;
   - a character standing alone back onto their own spot: nothing changes, and the marker is solid.
4. Drop a Cast row, a sidebar actor (also one whose name is already on stage) and the party actor: each lands where the marker shows. The party lands as one block, also into a new cluster.
5. Cast list: Left and Right off stage, and shift-click for a new edge cluster. On stage, ‹ › move the character and the lit number removes them. ‹ is disabled for someone alone in cluster 1. The party row works the same way.
6. Four clusters and 10 or more characters: the space between shrinks, nobody runs off the frame, and the bottom shade behaves.
7. Console: `VNStage.addToCast({name:"X", side:"right"})`, `VNStage.addToCast({name:"Y", cluster:1, newCluster:true})`, `VNStage.moveToCluster(id, 1)`, `VNStage.switchSide(id)`, and `VNStage.status()` showing `cluster` numbers.
8. Moving characters between clusters slides them, and the shadows go along.
9. Players' screens match the GM's, with and without the sidebar.
