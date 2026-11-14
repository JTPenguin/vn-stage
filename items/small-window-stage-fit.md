---
title: "Keep the stage above the bottom of small windows"
kind: feature
status: ready
waits_on: Claude
priority: 🔼
blocked_by: []
source: "Justin's request, 2026-10-31; rule settled with Justin, 2026-11-13"
added: 2026-10-31
updated: 2026-11-13
---
# Keep the stage above the bottom of small windows

In a small window, the stage should not sit below the bottom of the window. That keeps the characters' faces in view as the central focus.

**Today (`fitFrame` in `scripts/rules.js`):** with the sidebar closed, the frame covers the screen and is centred. In a window wider than 16:9, the frame is taller than the screen, so it is cut equally at the top and the bottom, and the bottom of the stage drops out of view. With the sidebar open the whole frame fits, so this case doesn't arise.

**Decision (Justin, 2026-11-13):** keep covering the screen, but line the frame's bottom up with the window's bottom. All the cropping comes off the top (the sky), and the heads stay in view.

**Build:**
1. In the cover case, set the view's `y` so the frame's bottom edge meets the screen's bottom edge, rather than centring it.
2. Every screen does this for itself (players and a GM with a locked view re-fit on resize already).
3. Test `fitFrame` for wide, 16:9 and tall screens in `tools/test.mjs`.

**Open detail:** for a very wide window, the crop could reach the top of the tallest faces. If it does in practice, cap the crop at the face guide's top and accept a band at the top. Check this in Foundry with a short window.
