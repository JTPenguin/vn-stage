# Changelog

All notable changes to this module. Versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
- Clusters with room to spare spread out: neighbours stand up to 75% of their average width apart (`LAYOUT.roomyStep`) instead of 55%, so a party alone on the stage isn't bunched. Crowding and zoom still use 55%, so crowded stages are unchanged.

### Removed
- The Party's whole-width side (Full): in the Cast list, the character menu and the layout (`LAYOUT.fullStep`). A side alone on the stage is already centred. Stages and presets saved with it read as Left.

### Changed
- Cast list: Left and Right are lit toggles, one at a time. Turn one on to place the character or move them; turn the lit one off to remove them. The separate remove buttons are gone. A party member's toggles are disabled ("On stage with The Party").
- Cast list: the whole row of anyone on the stage lights up.

### Added
- Drag a portrait on the stage to move the character within its side or to the other side (a party member moves The Party). A marker shows where it will land; Escape cancels. The press is the module's alone: Foundry no longer starts its own selection box or drag on a portrait.
- Drag a Cast row, The Party, or an actor from the sidebar onto the stage to put them where they're dropped (the marker shows while dragging).
- Cast list: a remove button on every character standing on the stage, and on The Party.
- GM hover: the character's name above their head, and a pointer cursor.

### Changed
- Characters are worked on the stage itself: clicking a portrait opens its character menu (`scripts/interact.js`), with the expressions and, for the GM, a row of actions: Flip, Adjust, Add to group (while editing one), Remove; for a party member, The Party's left, right and whole-width sides and Remove The Party. Players still get only the expressions of characters they own.
- The Stage window's On stage section is gone (its rows, expression menus and buttons); Reset everyone to neutral moves to the Cast heading.

### Changed
- Crowded stages zoom out around each face's centre instead of the ground: faces stay where they stood at full size and only shrink, so they don't sink behind bottom HUDs; bodies shrink upward. The face guide follows.

### Added
- Bottom shade: while any portrait's cut-off bottom edge is in view (zoomed out, or raised with Adjust), a dark band fades in over the 10% above the highest exposed edge and is solid below it. Two locked tiles (`assets/shade-fade.webp`, `assets/shade-solid.webp`); none at full size.

### Changed
- Crowded stages: one pass of fixed rules driven by crowding (the width the clusters need at full size, with full buffers, over the width available). The two sides always share the width in proportion to what each needs, so spacing matches; the outer pads and centre gap shrink smoothly to a quarter between crowding 1.0 and 1.2; then every portrait zooms out alike, to no less than 75% (the face guide follows); only past that do clusters overlap more. The arithmetic is in `scripts/arrange.js`, free of Foundry calls; tuning values in `LAYOUT`. `VNStage.status()` reports the zoom, crowding and buffers.
- Layout clusters characters instead of spreading them across half the frame: neighbours overlap by about half a portrait, and a cluster squeezes only when it runs out of room. With both sides in use, each cluster sits at its own outer edge; with one side in use, that side gets the whole width and its cluster is centred. The Party at full width is centred with wider spacing. The right 17% of the frame stays clear for Foundry's sidebar (`LAYOUT` in `constants.js`).

### Added
- The Party: a cast entry that stands for the PF2e party's characters whenever the stage is drawn. Put it on the left, the right or the whole width (spread evenly) from the top of the Cast list; On stage shows it as one row (forward, back, side, remove) with its members beneath (expression, adjust, flip). A change to the party's membership redraws the stage (the active GM's screen).
- Presets: save the stage's background and cast (sides and order; The Party as an entry) under a name, and load it in one click from the new Presets section. A preset saved with a group selected belongs to that group, is listed with it, and selects it again when loaded. Saving over a name asks first; deleting asks first.
- API: `resolveCast`, `addParty`, `setCast`, `listPresets`, `savePreset`, `loadPreset`, `deletePreset`.

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
