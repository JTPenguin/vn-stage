---
title: Smooth canvas scale and slide when the sidebar opens and closes
kind: feature
status: done
waits_on: none
blocked_by: []
source: Justin's words, 2026-10-30
added: 2026-10-30
updated: 2026-11-16
outcome: "Built on 2026-11-16: locked views glide with the sidebar slide (glideView in view.js, cssEase and transitionMs in rules.js). Justin checked it in Foundry on 2026-11-16."
priority: 🔽
---
# Smooth canvas scale and slide when the sidebar opens and closes

Make the canvas scale and slide smoothly when the sidebar opens or closes, instead of jumping to its new size.

**Today:** Foundry slides the sidebar panel over 250 ms (`transition: margin-right 250ms ease` on `#sidebar-content`, `foundry2.css:9162`). The `collapseSidebar` hook waits for that slide to end (`transitionend`, or a 300 ms fallback), then re-fits a locked view in one jump through `canvas.pan` ([module.js:109](scripts/module.js:109)). So the canvas sits still while the panel moves, then snaps.

**Fit target:** `fitFrame` in [rules.js:26](scripts/rules.js:26) gives the end point. With the sidebar open, the whole frame fits left of the panel. With it closed, the frame covers the window. `sidebarWidth()` in [view.js:64](scripts/view.js:64) reads the panel's live position, so mid-slide it gives a width part way between the two.

**Locked pan methods:** a locked view shadows both `canvas.pan` and `canvas.animatePan` so that each jumps to `fitView()` ([view.js:24](scripts/view.js:24)). The glide has to call the prototype's methods, or tween by hand, to get past that.

**Foundry's tween:** `Canvas#animatePan` tweens x, y and scale through `CanvasAnimation.animate` (default 250 ms, `easeInOutCosine`), calling `pan` on each tick (`client/canvas/board.mjs:1803`).

**Timing (Justin, 2026-11-16):** the canvas moves with the slide. Start the tween when `collapseSidebar` fires, aimed at the final fit, so the canvas and panel move together. Don't wait for `transitionend`.

**Who glides (Justin, 2026-11-16):** locked views only: every player, and a GM who locked their view. These are the same views that re-fit today. An unlocked GM stays where they are.

**Scope (Justin, 2026-11-16):** only the sidebar toggle glides. Window resizes, a stage loading and turning the GM lock on stay instant jumps.

**Feel (Justin, 2026-11-16):** 250 ms, with a curve close to the panel's CSS `ease`, so the canvas and panel read as one motion. Take the length from the panel's computed `transition-duration` if that's easy, so a Foundry change keeps them in step.

**Final width (default):** aim at the panel's final width, not its position mid-slide. The panel's own width is fixed (`--sidebar-full-width`) whichever way it's sliding, so use that when the sidebar is opening and 0 when it's closing.

**Toggle mid-glide (default):** a second toggle during a glide starts a new glide from wherever the view is, aimed at the new fit. A window resize during a glide stops it and jumps, as today.

**Tests:** the target fit is already covered through `fitFrame`. If the easing or the final-width choice becomes a pure function, add a test in `tools/test.mjs`. The motion itself needs a check in Foundry by Justin.

**Related:** [[resize-canvas-for-sidebar]] (done) added the re-fit on toggle. [[gm-canvas-lock]] (done) decides when a GM is locked.

**Built (2026-11-16):** `glideView()` in `scripts/view.js` tweens x, y and scale through `CanvasAnimation` and pans through the canvas prototype, so the lock doesn't turn it into a jump. The `collapseSidebar` hook in `scripts/module.js` now calls it at once; the old wait for `transitionend` is gone. The length comes from the panel's computed `transition-duration` (`transitionMs`, 250 ms if it can't be read); the curve is `cssEase`, CSS's `ease`. Both are in `scripts/rules.js` with tests. `refitView()` and `stopView()` stop a running glide, so a window resize still jumps.

**Sidebar width change:** `sidebarWidth()` now returns the open panel's own on-screen width instead of the distance from its left edge to the window's right edge. The two match once the panel has stopped, because an open panel ends at the window edge (`#ui-right` has no right padding). The new one also holds mid-slide. This affects every fit, not only the glide.

**Checked (Justin, 2026-11-16):** checked in Foundry and approved.
