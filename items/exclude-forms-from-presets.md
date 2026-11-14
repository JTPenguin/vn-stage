---
title: "Don't include forms in presets"
kind: feature
status: ready
waits_on: Claude
priority: 🔼
blocked_by: []
source: "Justin's request, 2026-10-31; scope settled with Justin, 2026-11-13"
added: 2026-10-31
updated: 2026-11-13
---
# Don't include forms in presets

Presets should leave party members' forms alone.

**Why:** a PC's form is part of their story (a curse, a transformation). Today `snapshot` in `scripts/presets.js` saves the form of every actor-linked character, and `applyForms` writes it back to the actor on load. Loading an old preset can therefore switch a PC back out of a form they are in now, on every stage, because the form lives on the actor.

**Decision (Justin, 2026-11-13):** party members only. NPCs keep today's behaviour: a preset saves their form and puts it back.

**Build:**
1. `snapshot` leaves `form` off entries marked `partyMember`.
2. `applyForms` skips party members, including old presets that saved a form for them.
3. The "changed since loaded" check (`stagePreset`) must not light Update just because a PC changed form.
4. Tests in `tools/test.mjs` for all three.

**Check in Foundry:** put a PC in a form, load a preset saved before the change, and confirm the PC keeps the form while an NPC switches to its saved one.
