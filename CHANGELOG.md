# Changelog

All notable changes to this module. Versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **The GM can lock a character's forms.** In the character menu, the GM right-clicks a form of an actor-linked character to lock or open it; a locked form is dimmed. Players don't see locked forms and can't switch to them; the GM still can. Locks are saved on the actor, so they follow it to every stage.
- **The GM can lock their own view to the stage, like the players'.** A lock button in the Stage window header, or the Lock my view keybinding (no key by default), keeps the view fitted to the stage frame and ignores pans, drags and zooms. Each GM's choice is remembered on their machine.
- **Characters slide to their new places.** When a side switch, an added or removed character, or a preset load moves or resizes portraits, they slide and scale there over about 0.4 seconds instead of jumping. The bottom shade moves with them. Changes made in the Adjust window still jump, since Adjust is for setting up. Off for viewers who ask their system for reduced motion.
- **Portraits cast a soft shadow,** so characters stand out from the background. Two world settings, Portrait shadows (on by default) and Shadow strength (how dark), apply to every portrait. Each screen draws its own shadows, and they move and fade with their characters.

### Changed
- **Clusters replace the fixed left and right sides.** Characters stand in one or more clusters, spread evenly across the stage. Drag a portrait into another cluster to move it there. Drop it between two clusters to start a new cluster there, or at the far left or right to start one at that edge. A cluster disappears when its last character leaves. A stage with two clusters looks exactly as a two-sided stage did. Drag markers: a solid line within the same cluster, a dashed line with an arrow into another, and a dashed line with a "+" for a new cluster.
- **The Cast list's toggles follow the clusters.** Off stage, Left or Right joins the leftmost or rightmost cluster (with one cluster, Left joins it at its left end and Right at its right end); shift-click starts a new cluster at that edge. On stage, a row shows **‹ n ›**: n is the character's cluster, counted from the left, and clicking it takes them off; ‹ and › move them into the next cluster, or into a new one past the edge. The Party's row works the same way once every member stands in one cluster.
- **Console API:** `addToCast`, `addParty` and the new `moveToCluster` take `cluster` (from 0, left to right) and `newCluster`; `side: "left"` or `"right"` still works. `partyCluster` and `moveInCluster` replace `partySide` and `moveInSide`, which stay as old names; `partySide` now returns a number, and `moveInSide(id, -1)` now means one place left. The `vn-stage.layout` hook's placements carry `cluster` instead of `side`.
- **A one-time upgrade (schema 3)** turns every stage's and preset's sides into clusters: left becomes the first cluster and right the second. A stage with only a right side now puts its leftmost character in front, and a party saved as an old whole-party entry on the right comes back in mirror order. **Going back to an older version after this upgrade breaks stages**, because older versions read only sides.
- **The view re-fits when the sidebar opens or closes.** With the sidebar open, the whole stage fits in the space left of it, with Foundry's canvas showing above and below. With it closed, the stage fills the window as before. This applies to players, and to the GM while their view is locked. The layout no longer keeps the right 17% of the stage clear for the sidebar, so a side alone can use the full width.
- **Easier-to-read folder headings in the Background section** of the Stage window: they use the section titles' font instead of Foundry's small-caps heading face.
- **Art is read from folders and sized by height, not by face.** The module reads `portrait.*`, `expressions/`, `forms/` and an optional `vn-stage.json` (see `docs/art-format.md`) and no longer reads any other art file. The GM's screen scans the art folder and saves the result as the world setting `artIndex`, so players read art without browsing files; the Stage window's refresh button rescans. Characters are sized by the file's `scale` and `yOffset`, and every character now shows its expressions. Crowded stages zoom around the face guide's centre line.
- Wording: the settings hints, the empty-group text and the Groups window tooltip describe the art format (a group is "named in the character's `vn-stage.json`"), and no tool or campaign is named.
- The character menu shows a labelled button per expression instead of face thumbnails.
- The Adjust window's yellow face box is gone; the blue face guide stays as a drawing.
- **Adjust shows the actual scale and height.** It opens at the art file's values, a change replaces them in this world, and Reset goes back to them. Before, Adjust showed a change on top of the file (Scale 1 meant "the file's"). A one-time upgrade (schema 2) converts saved values, so nothing on stage moves.

- **New art shows up on reload.** The GM's screen now rescans the art folder every time the world loads, so a new form or expression appears without pressing refresh. Before, only new or removed character folders were noticed.
- **Loading a preset no longer leaves a character's old form on screen.** When a character's form changed with the preset, their old form stayed up for about five seconds beside the new one before fading. It now fades out with the rest of the old cast.
- **Background and form changes no longer hide the cast.** The old image's stand-in sat above every portrait while it faded, so the cast vanished for a moment. It now fades under them. Loading a preset also keeps characters who are already on stage in place, and replaced portraits fade out as their successors fade in.
- **A drag released over the sidebar no longer leaves things behind.** Releasing a dragged portrait outside the stage (over the sidebar, say) now cancels the drag: the character stays put and the drop marker and floating name clear. Before, the marker stayed until the next drag and the name stayed until reload.
- **Drag markers are steadier.** A drop on a crowded one-sided stage can again reach every position on that side, and the far edge always counts as the other side. A drop on an empty side snaps to one spot, past the other side's end-of-row marker. A drag to the other side shows a dashed marker with an arrow pointing to that side.

### Removed
- Face measurements (`facePx`, `faceBox`, `frame`, `adjust`) and the object-shaped `forms` list.

### Added
- The art format, written down (`docs/art-format.md`, with a JSON Schema in `docs/vn-stage.schema.json`): a character is a folder with a portrait, plus an optional `vn-stage.json`. `normaliseArt` in `scripts/rules.js` turns a folder listing and that file into the module's own shape, with tests.
- Clear the stage (broom button in the Cast heading): everyone off this stage at once. Disabled when the stage is empty.
- A keyboard shortcut to open the Stage window (GM), set in Configure Controls under VN Stage. No key by default.

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
- Groups: a name, any number of background folders and its characters, chosen from the Group menu at the top of the Stage window (each stage remembers its group). Members come from the art's `groups` names, plus hand additions, minus hand removals. With a group selected, the Cast list shows its members and the Background strip shows all its folders (a collapsible heading per folder when there's more than one); Browse… then sets a one-off background without changing any folder.
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
