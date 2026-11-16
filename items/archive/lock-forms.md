---
title: Lock forms
kind: feature
status: done
waits_on: none
outcome: "Built 2026-10-30; marked done by Justin. The GM right-clicks a form in the character menu to lock or open it; players don't see locked forms and can't switch to them. Locks are saved on the actor."
priority: 🔼
blocked_by: []
source: Justin's ideas backlog, 2026-10-21 (moved here 2026-10-24)
added: 2026-10-24
updated: 2026-11-16
---
# Lock forms

Let the GM disable some of a character's forms, so a player can't switch to them. For example, a cursed character can't switch back to their original, uncursed form.

**Decisions (Justin, 2026-10-30):**
- **Where:** the GM's character menu marks each form locked or open.
- **Saved on the actor** (an actor flag holding the locked art keys), so the locks follow it to every stage.
- **Players** don't see locked forms in their menu at all, and `setForm` refuses a locked form for non-GMs.
- **The GM** can still switch to any form, locked or not.
- Characters without an actor need nothing: only the GM can switch their forms already.

**Built (2026-10-30), waiting on Justin's check in Foundry:**
1. As GM, a portrait of an actor-linked character with forms lets you right-click a form to lock it. Locking dims it, the tooltip says it's locked, and the menu stays open. Right-click it again to open it. Lock two forms quickly: both stay locked after reopening.
2. Open the same character on another stage: the lock is still there.
3. As a player who owns the actor, the locked form is gone from the menu.
4. As that player, `VNStage.setForm(castId, "<locked key>")`, `VNStage.setForm(castId, null)` with Base locked, and `VNStage.setForm(castId, "nonsense")` all change nothing.
5. Lock Base while the character is in another form: the player can't get back to Base, the GM can.
6. A character without an actor can't be locked: right-click does nothing. In the off-stage Cast row menu, right-click locks forms of actor characters too.
