---
title: "Set up in secret, then reveal"
kind: feature
status: ready
waits_on: Claude
priority: ⏬
blocked_by: []
source: "Justin's ideas backlog, 2026-10-21 (moved here 2026-10-24)"
added: 2026-10-24
updated: 2026-10-30
---
# Set up in secret, then reveal

Build the cast hidden from the players, then show it with one click. Also reveal a single character on cue, such as a villain stepping out of the shadows.

**Decisions (Justin, 2026-10-30):**
- **Characters only.** Background changes still show at once.
- **No gap for hidden characters.** Portraits are shared tiles, so everyone sees one arrangement. The arrangement leaves hidden characters out, so players see the visible cast laid out with no gap.
- **The GM sees each hidden character as a faded ghost** at the spot it will take once revealed (it may overlap its neighbours). Foundry's hidden tile flag gives this: players don't see it; the GM sees it faded.
- **On reveal,** the others re-lay out to make room and the character fades in. This pairs with [[smooth-character-transitions]], so they slide aside instead of jumping.
- **Secret mode:** a "Secret" toggle in the Stage window. While it's on, every character added or loaded (from a preset too) arrives hidden.
- **Per character:** Hide and Reveal in the GM's character menu.
- **Reveal all:** one Stage window button reveals every hidden character at once.

**Data:** a `hidden` mark on the cast entry. Changing the cast entry's shape needs a step in `migrate.js` and a README stored-data update only if existing data must change; a new optional field doesn't.

**Open for build:** whether presets save the hidden mark. Default: no, a preset loads visible unless Secret mode is on.
