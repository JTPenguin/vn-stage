# Changelog

All notable changes to this module. Versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-10-21

What changed since 0.1.0, as it stands now. (The day-by-day history is in the git log.)

### Added
- **Working on the stage itself.** Click a portrait for its character menu: its forms, its expressions, and for the GM Flip, Adjust, VN art…, Groups… and Remove. Drag a portrait to move the character within its side or to the other side (a marker shows where; Escape cancels); Foundry's own drag and selection box no longer start on a portrait. The GM sees each character's name on hover. Drop a Cast row, The Party, the party actor or any actor from the sidebar where they should stand.
- **Layout for crowds** (`scripts/arrange.js`, tuned in `LAYOUT`): characters cluster from their outer edge; a side alone is centred and spreads out a little (`roomyStep`); the right 17% stays clear for Foundry's sidebar. Crowded stages share the width in proportion to each side's needs, shrink the buffers, then zoom everyone out around their faces to no less than 75%; a bottom shade hides edges that rise into view.
- **The Party** as a shortcut: Left or Right gathers every PF2e party member (PCs and travelling NPCs; familiars stay off) on that side, the lit toggle takes them all off, and each stage remembers the order they last stood in (`partyOrder`). Members are otherwise ordinary characters.
- **Presets**, shown as chips: click to load (background and cast), right-click for Update from stage, Rename…, Groups…, Delete; + in the header saves the stage. The preset last loaded or saved is lit, with a dot and an Update button once the stage changes. Presets mark party members and fit today's party on load (members still here keep their places, new ones join beside them, leavers stay off), and save each character's form. A preset can be in several groups.
- **The Groups window** (gear button by the Group menu, replacing Edit group mode): every group's characters, backgrounds and presets, managed the same way (× takes one out, + Add… opens a checklist). Groups now also hold single background images and presets, and pick up automatic folders: the "Group background folders" setting (`{group}` pattern) and the `vn-stage.groupFolders` hook for other modules. Groups… in the character menu, on presets and on backgrounds.
- **Art keys and forms:** a character's art is a folder under the art root, its forms subfolders with their own VN portraits. An actor finds its art by its VN art… link, its name, then its own images. A character with several forms switches between them from the menu (crossfade; the expression carries over when it can); the form is saved on the actor, so it follows them and players can switch their own. Forms and expressions can be chosen off stage from a Cast row's menu, before adding the character.
- **Video backgrounds** (`.webm`, `.mp4`, `.m4v`, `.ogv`), looping silently; their thumbnails play on hover. The Background strip shows three rows of fixed-size thumbnails, then scrolls.
- **Cast list:** one row per world actor with VN art (linked, so owners keep control), plus art no actor uses; lit Left/Right toggles place, move or remove; searching finds characters outside the group too, under "Not in this group". Right-click a row for the character menu.
- **Fades** (`scripts/fades.js`): portraits fade in and out, backgrounds and form changes crossfade, drawn by each screen with no document updates; off for reduced motion, and off for the session after any error.
- **Stored-data upgrades** (`scripts/migrate.js`, world setting `schema`): the active GM's screen runs any pending upgrade once when Foundry is ready. Schema 1 converts old whole-party entries, the removed Full side, and presets' single `group`.
- **Checks:** `tools/check-load.mjs` also reports import cycles; `tools/test.mjs` tests the Foundry-free rules in `scripts/rules.js` and `scripts/arrange.js`.

### Changed
- The Stage window only runs the scene (group, presets, background, cast); what a group holds is managed in the Groups window. It renders once per burst of changes.
- The layout runs from hooks on the screen of the GM who made a change, so saving data never calls it directly (and the scripts have no import cycles).
- The character menu opens above every window.

### Fixed
- One unreadable or differently shaped manifest no longer empties the Cast list or stops the Stage window opening; both shapes of `forms` are read.

### Removed
- The On stage section, Edit group mode, the whole-width (Full) side, and the live whole-party entry with its reordering and menu items.

## [0.1.0] - 2026-10-20

First release: the four required needs of the E3 plan (portraits on two sides, static backgrounds, GM and player expressions), plus groups and per-character adjustment.

### Added
- Expressions: left-click a portrait for a strip of its expressions (face close-ups from the manifest's face box); the GM can change anyone's, players their own characters' (actors they own). Clicks hit only the portrait's visible pixels and ignore drags. An actor-linked character keeps its expression on the actor, so it follows them to every stage; the active GM's screen redraws the stage when it changes. Characters without an actor keep theirs on the cast entry.
- On stage rows: an expression menu for each character with expressions.
- Reset everyone to neutral (On stage heading): clears every actor's saved expression and every stage's cast entries.
- Every screen preloads all expressions of the characters on stage, so a change shows at once.
- Groups: a name, any number of background folders and its characters, chosen from the Group menu at the top of the Stage window (each stage remembers its group). Members come from the manifests' `groups` tags (written by the Character Art Pipeline), plus hand additions, minus hand removals. With a group selected, the Cast list shows its members and the Background strip shows all its folders (a collapsible heading per folder when there's more than one); Browse… then sets a one-off background without changing any folder.
- Built-in menu entries: All characters (as before groups) and Recent (the last 24 characters put on any stage).
- Edit group mode (pencil): Rename, Delete (confirmed), folder chips with remove and Add folder…, add or remove members (Show everyone lists non-members), and add from On stage rows. Normal mode shows none of these. New group (+) is always available.
- API: `listGroups`, `getGroup`, `memberNames`, `createGroup`, `addFolder`, `addMember`, `stageGroup`, `setStageGroup` (for the Landing and E4).
- Collapsible Stage window sections (Background, On stage, Cast): click a heading; the state is remembered on each machine (client setting).
- Background quick swaps: the Stage window shows a thumbnail strip of every image in the stage's background folder, with the default background pinned first; one click swaps. Browsing to an image sets that folder (remembered per stage), except the default background's own folder. Hover shows the name without its number ("Absalom Docks").
- Stage window (GM, scene-control button in the token controls): Make stage, the background (current image and a file browser), On stage (left and right columns with forward, back, flip, other side and remove), and the Cast list from the art folder with search and Left / Right buttons.
- Cast: a scene flag lists who stands where, in order; `layout()` (GM) draws it as locked portrait tiles, creating, updating and deleting tiles to match, one call at a time. A `vn-stage.layout` hook reports each portrait's box for other modules.
- Art lookup by convention from `<art folder>/<Name>/manifest.json` (portrait, expressions, avatar thumbnail, measured face height, size and adjust).
- Layout: two sides, spread from the outside edge inward, first-placed in front, all at full size. Faces drawn at one height (8% of the frame, so portraits stand about half the screen tall) from the manifests' face measurements, then creature size (actor first, manifest otherwise), the manifest's adjust and the character's own scale.
- Default height from the head box: the face's top sits on the face guide for the character's size; if that would show the portrait's cut-off bottom edge, it stands on the bottom edge instead. Images without a face measurement stand on the bottom edge.
- Per-character choices saved in a world setting, so they follow the character to every stage: Flip, scale and height offset.
- Adjust window (sliders button on an On stage row): a Size choice (Auto from the sheet, then the art's manifest, or any PF2e size), scale (0.25–3) and "lower by" (−60% to +100% of the height) sliders that apply as you drag, Reset (back to the head-box default). While it's open the GM's screen shows the face guide: two lines across the frame where this character's face should start and end, sized and placed for their creature size (every size shares one ground line, 7 faces below a Medium face's top), and a box around their face as it stands.
- No VN art: the actor's own image at half the frame height, marked quietly in the window.
- Drag an actor onto the left or right half of a stage to add it there (GM); no token is created.
- Stage scenes: `makeStage()` (GM) sets the viewed scene to a fixed 2560 × 1440 frame, gridless with no vision, and flags it as a stage. The safety-net background goes on the scene's own Level once.
- Background tile: `setBackground(src)` shows an image as a locked tile under everything, with `cover` fit, so any image shape fills the frame and swapping it doesn't redraw the canvas.
- View lock: on stage scenes every screen is fitted to the frame; players' view stays locked (refitted on window resize), the GM's is fitted once.
- World settings: art folder and safety-net background.
- Manifest, README, changelog and `.gitignore`.
