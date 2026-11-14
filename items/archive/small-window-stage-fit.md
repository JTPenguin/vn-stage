---
title: "Keep the stage above the bottom of small windows"
kind: feature
status: done
waits_on: none
outcome: "Built and checked in Foundry 2026-11-13: in a wide or short window the frame's bottom meets the window's bottom and the top is cropped instead, capped just above the highest face."
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

**Built (2026-11-13), in `fitFrame` (`scripts/rules.js`):**
- In the cover case, the view lines the frame's bottom up with the screen's bottom, so all the cropping comes off the top. Screens 16:9 or narrower are unchanged.
- The top crop stops at `MAX_TOP_CROP` (45% of the frame height), just above the highest face guide (a Large creature's, near 50%). Only screens wider than about 3.2:1 reach it. After that the bottom is cropped too.
- The sidebar-open fit is unchanged.
- Tests: the sidebar-closed fit test now checks 21:9, a short window and a capped 4:1 screen (86 pass).

**Checked in Foundry (test world, as GM, a 1200 × 450 window):** the frame's bottom sat exactly at the window's bottom (450 px), the top was cropped by 225 px, and both characters' faces were fully in view.
