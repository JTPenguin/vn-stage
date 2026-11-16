---
title: "Actors with the same name or shared art"
kind: work
status: in-progress
waits_on: Justin
priority: 🔽
blocked_by: []
source: "Justin, 2026-11-02: add an item to decide how to handle multiple actors with the same name or that share art; decided with Justin, 2026-11-13; details settled and built, 2026-11-16"
added: 2026-11-02
updated: 2026-11-16
---
# Actors with the same name or shared art

Two cases need one rule. First, two actors can share a name, so a name cannot key their art or their folders. Second, two actors can share art, such as one portrait or one token used by more than one actor.

**Where it comes up (Justin, 2026-11-13):**
- Generic NPCs with the same name in several scenarios ("Guard", "Cultist"), each with different art.
- Copies of one actor (per scene or scenario) that should share one set of art.
- Several same-named actors on the stage at once.

**Decision (Justin, 2026-11-13):** key by actor, with the name as a label only.
- Cast entries with an actor match by actor only. The name is used only for art-only entries that have no actor.
- Saved choices for an actor are keyed by its art key, not the name. Copies that share art then share flip and size, and different art keeps different choices.
- Shared art is stored once. Each actor points to it with the existing "VN art…" link. Nothing is copied.
- A generic name gets a unique art folder (for example "Guard (5-04)"), and the actor links to it.

**Details settled (Justin, 2026-11-16):**

| Question | Answer |
|---|---|
| Can one actor stand on a stage twice? | No. One entry per actor; three Guards are three actors. |
| How does a generic actor find its folder? | Images beat the name: an actor whose portrait or token lives in another character's art folder uses that folder. |
| How does the Cast list tell same-named rows apart? | By the art's label, then by the actor's sidebar folder. |
| Actors with no VN art? | Their choices are keyed by actor (`actor:<id>`). A schema 5 upgrade copies each name's choices to every such actor. |

**Built (2026-11-16):**
- `findEntry`, `setCast` and the Cast rows share one rule, `isEntryFor` (rules.js): by actor, or by name for art alone.
- `addToCast` no longer links by name from the window or a drop. From the console, a bare name links only when exactly one actor has it.
- `automaticKey` (rules.js) is the images-beat-name rule; `automaticArt` and `indexedActorKey` both use it.
- `prefsKeyOf` (art.js) gives the key for saved choices; layout, Adjust and the menu's Flip use it.
- `tellApart` (rules.js) writes the Cast row notes.
- Saved choices were already keyed by art key, so only artless actors needed the upgrade.
- Tests and the load check pass. README and CHANGELOG are updated.

**The pipeline's part:** how it names folders for same-named NPCs is the Character Art Pipeline item `same-name-npc-folders`.

**Next step (Justin):** check in Foundry.
- [ ] Two actors named the same, with different art, stand on one stage together.
- [ ] An actor with no VN art… link whose token lives in "Name (something)/" shows that art, and VN art… says "from its images".
- [ ] A duplicated actor shares the original's art, and Flip on one flips both.
- [ ] Same-named Cast rows show the art label, and copies show their folder.
- [ ] After the upgrade, an actor with no art keeps its flip and size.
