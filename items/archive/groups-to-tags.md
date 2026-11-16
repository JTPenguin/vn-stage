---
title: Replace groups with tags
kind: feature
status: done
waits_on: none
outcome: "Built in fa6ba9c; Justin marked it done on 2026-11-16."
priority: 🔼
blocked_by: []
source: Justin's list, 2026-10-30; planned with Justin, 2026-11-16
added: 2026-10-30
updated: 2026-11-16
---
# Replace groups with tags

Groups become tags. One tag can pull together characters, backgrounds and presets, and tagging happens in the Stage window, on the item itself.

**Status:** built 2026-11-16 on Justin's go, waiting on his check in Foundry (the list at the end). The tests and the load check pass; nothing has been tried in Foundry.

## What changes, and what doesn't

**Finding (2026-11-16):** groups already work like tags underneath. A character, a preset or a single background can sit in several groups today. So this is a change to how tagging feels and reads, not to what the data can hold.

| | Today (groups) | After (tags) |
|---|---|---|
| Word | Group | Tag, everywhere |
| Tag one item | Right-click → Groups… → a checklist of every group → OK | Right-click → Tags… → a small window: the item's tags as chips, and a text field to type more |
| Make a new one | New group… button, then a name dialog | Type a new name in the text field and press Enter |
| See an item's tags | Open its Groups… checklist | Chips on Cast rows; hover text on backgrounds and presets |
| Manage | The Groups window, three sections per group | A small Tags dialog: rename, merge, delete, folders |
| The view | One group at a time | One tag at a time (unchanged) |

## Decided (Justin)

- **Tags replace groups fully** (2026-11-16). Every group becomes a tag with the same characters, folders, single backgrounds and presets.
- **One tag at a time** (2026-10-30). With a tag selected, the window shows only items with that tag (2026-11-16). No one-click "add to this tag" buttons on items outside it.
- **Tagging is done in the Stage window**, through a small window per item: its existing tags, and a text field to type new ones (2026-11-16).
- **Tags show as chips where there's room:** on Cast rows under All, Recent and search results. Backgrounds and preset chips list their tags in the hover text.
- **The Groups window shrinks to a small Tags dialog:** rename, merge, delete, and each tag's background folders.
- **Folders stay.** A tag can hold whole folders. The automatic pattern and the hook keep working.
- **What tags stand for:** scenarios or sessions, locations, and factions or recurring casts. Not types or moods, so one tag at a time is enough.

## How it works

### The tag window (new)

- **Opens from** Tags… in the character menu (a portrait on stage or a Cast row), on a preset chip's right-click menu, and on a background's right-click.
- **Shows** the item's tags as chips, each with ×. A tag that comes from the character's art file is marked; removing it only hides the character from that tag here, as today. A tag a background has through a folder is marked "from folder" and has no ×.
- **Text field** with the cursor already in it. It suggests existing tags as you type. Enter adds the tag, and creates it if it's new. A comma adds several.
- **Saves at once.** No OK button. Escape closes it.
- **One window.** It stays open and switches to whichever item you open Tags… on next, so tagging ten things in a row is ten right-clicks, not ten dialogs.
- A form shares its base character's tags, as today.

### The Stage window

- **The tag menu** at the top keeps All characters and Recent, and gains **Untagged**: the characters and presets with no tag, and the backgrounds in the stage's own folder that have none. This is the prep to-do list.
- **Cast rows** show tag chips under All, Recent, Untagged and in search results. Clicking a chip switches the window to that tag.
- **Search still reaches everyone.** With a tag selected, search finds characters outside it under "Not in this tag", so one can be pulled in with Tags….
- **Presets:** saving with a tag selected gives the preset that tag. Loading a preset keeps the current tag when the preset has it, and otherwise switches to the preset's first tag. Both as today.
- **Backgrounds:** a background shown now but outside the tag stays pinned first, with "right-click to tag it".

### The Tags dialog (replaces the Groups window)

- One list of every tag, with how many characters, backgrounds and presets each holds.
- Per tag: **Rename**, **Merge into…** (move everything to another tag, then delete this one), **Delete** (the items stay), and its **folders** (add, remove; automatic ones are marked).
- A tag exists while something carries it or it has a folder. There are no empty tags to clean up.
- **New tag from a folder…** (added while building): a tag is listed only once something has it, so a tag that starts with a folder of backgrounds is made here, name and folder together.

### Folders and the art files

- **Setting:** "Tag background folders", pattern `scenes/{tag}/`. `{group}` in an existing pattern still works.
- **Hook:** `vn-stage.tagFolders`. The Wayfinder module's `vn-stage.groupFolders` listener is renamed in the same change.
- **Art files:** `vn-stage.json` gains `tags`. `groups` is still read, so existing art and friends' art need no change.

### Existing data

One `migrate.js` step (bump `SCHEMA`), run once by the active GM:

| Stored today | Becomes |
|---|---|
| World setting `groups` | `tags`, same shape |
| World setting `groupFolders` | `tagFolders` |
| Preset field `groups` | `tags` |
| Scene flag `group` | `tag` |

Nothing is dropped: members, hand removals, folders, hidden automatic folders, single backgrounds and deleted markers all carry over.

**Console API:** `listTags`, `getTag`, `createTag`, `addFolder`, `addMember`, `tagFolders`, `stageTag`, `setStageTag`, `setPresetTags`, `openTags`. The group names are gone. The Wayfinder module called none of them; its hook listener is renamed. Macros in the worlds weren't checked.

## Build order

1. **Data and names.** Migration, settings, flags, hook, API, the art's `tags` field, and tests for the migration and tag rules in `tools/test.mjs`. The window still works, now saying "tag".
2. **The tag window.** Replaces the three Groups… checklists (`chooseCharacterGroups`, `chooseImageGroups`, `choosePresetGroups`).
3. **Showing tags.** Chips on Cast rows, hover text on backgrounds and presets, the Untagged view.
4. **The Tags dialog.** Replaces `groups-window.js` and `templates/groups-window.hbs`, which are deleted. Drop `pick-list.js` if nothing else uses it.
5. **Words.** README (settings, API, hooks, stored data), CHANGELOG, `lang/en.json`, `docs/art-format.md`, `docs/vn-stage.schema.json`, and the Wayfinder module's hook.

## Checks in Foundry (Justin)

1. Upgrade a world with groups: the console reports the new schema, and every old group appears as a tag with the same characters, folders, single backgrounds and presets. Each stage opens on the tag it had.
2. Right-click a character, a preset and a background: Tags… opens the same small window. Type an existing tag and a new one; both stick. × removes one. Escape in the field closes the window, and a picked suggestion is added on Enter.
3. With the tag window open, open Tags… on another item: the window switches to it.
4. Untagged lists only items with no tag, and an item leaves it once tagged. Remove the last thing from a tag: the tag leaves the menu, and a stage showing it goes back to All characters.
5. Chips show on Cast rows under All, Recent and search; clicking one switches the tag.
6. Manage tags (the gear): rename, merge and delete each do what they say, and a deleted tag's items stay. New tag from a folder… makes a tag whose backgrounds show at once.
7. A scenario tag ("PFS 4-07") still finds its scene folder by itself in the Wayfinder world.
8. A character whose art file names a tag in `groups`, and one that names it in `tags`, both appear under it.

## Touches other items

- [[reorder-backgrounds]] saves its order "per group": that becomes per tag.
- [[horizontal-vertical-layout-toggle]] mentions the group bar: it becomes the tag bar.

## Not in this plan

- Showing two tags at once (a scenario and a location together).
- Tagging a preset's cast and background along with it when saving.
- Tagging several selected items in one go.
