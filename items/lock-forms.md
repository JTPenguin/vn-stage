---
title: "Lock forms"
kind: feature
status: ready
waits_on: Claude
priority: 🔼
blocked_by: []
source: "Justin's ideas backlog, 2026-10-21 (moved here 2026-10-24)"
added: 2026-10-24
updated: 2026-10-30
---
# Lock forms

Let the GM disable some of a character's forms, so a player can't switch to them. For example, a cursed character can't switch back to their original, uncursed form.

**Decisions (Justin, 2026-10-30):**
- **Where:** the GM's character menu marks each form locked or open.
- **Saved on the actor** (an actor flag holding the locked art keys), so the locks follow it to every stage.
- **Players** don't see locked forms in their menu at all, and `setForm` refuses a locked form for non-GMs.
- **The GM** can still switch to any form, locked or not.
- Characters without an actor need nothing: only the GM can switch their forms already.
