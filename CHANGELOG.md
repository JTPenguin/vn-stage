# Changelog

All notable changes to this module. Versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
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
