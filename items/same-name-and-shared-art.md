---
title: "Decide how to handle actors with the same name or shared art"
kind: decision
status: ready
waits_on: Claude
priority: 🔽
blocked_by: []
source: "Justin, 2026-11-02: add an item to decide how to handle multiple actors with the same name or that share art; decided with Justin, 2026-11-13"
added: 2026-11-02
updated: 2026-11-13
---
# Decide how to handle actors with the same name or shared art

Two cases need one rule. First, two actors can share a name, so a name cannot key their art or their folders. Second, two actors can share art, such as one portrait or one token used by more than one actor.

**Where it comes up (Justin, 2026-11-13):**
- Generic NPCs with the same name in several scenarios ("Guard", "Cultist"), each with different art.
- Copies of one actor (per scene or scenario) that should share one set of art.
- Several same-named actors on the stage at once.

**What the code does today:**
- `addToCast` links an entry to the *first* world actor with that name (`game.actors.getName`).
- `findEntry` matches an existing entry by actor *or by name*. Adding a second "Bandit" finds the first one and moves it, so two can't stand on the stage together.
- Saved choices (flip, size, scale, offset) live in `characterPrefs`, keyed by name, so same-named actors share them.
- Art is found by the "VN art…" link (an actor flag), then by a folder with the actor's name. Forms live on the actor, so they are already per actor.

**Decision (Justin, 2026-11-13):** key by actor, with the name as a label only.
- Cast entries with an actor match by actor only. The name is used only for art-only entries that have no actor.
- Saved choices for an actor are keyed by its art key, not the name. Copies that share art then share flip and size, and different art keeps different choices.
- Shared art is stored once. Each actor points to it with the existing "VN art…" link. Nothing is copied.
- A generic name gets a unique art folder (for example "Guard (5-04)"), and the actor links to it.

**Still to settle in the build plan:**
- A migration for the existing name-keyed `characterPrefs`.
- How the pipeline names folders for same-named NPCs. The Character Art Pipeline owns that part, and it needs its own item there.

**Next step:** Claude writes the build plan and opens the matching Character Art Pipeline item.
