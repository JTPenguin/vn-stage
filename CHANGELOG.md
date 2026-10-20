# Changelog

All notable changes to this module. Versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Stage scenes: `makeStage()` (GM) sets the viewed scene to a fixed 2560 × 1440 frame, gridless with no vision, and flags it as a stage. The safety-net background goes on the scene's own Level once.
- Background tile: `setBackground(src)` shows an image as a locked tile under everything, with `cover` fit, so any image shape fills the frame and swapping it doesn't redraw the canvas.
- View lock: on stage scenes every screen is fitted to the frame; players' view stays locked (refitted on window resize), the GM's is fitted once.
- World settings: art folder and safety-net background.
- Manifest, README, changelog and `.gitignore`.
