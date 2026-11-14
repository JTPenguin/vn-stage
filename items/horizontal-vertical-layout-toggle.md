---
title: "Toggle the VN Stage window between horizontal and vertical layouts"
kind: feature
status: ready
waits_on: Claude
priority: 🔽
blocked_by: []
source: "Justin's request, 2026-10-31; details settled with Justin, 2026-11-13"
added: 2026-10-31
updated: 2026-11-13
---
# Toggle the VN Stage window between horizontal and vertical layouts

Let the GM switch the VN Stage window between two layouts.

**Vertical (current):** the Presets, Background and Cast sections stack top to bottom (`.vn-stage-body` is a flex column; the window opens at 560 × 760).

**Horizontal (new):** the Presets, Background and Cast sections sit side by side, so the characters on the stage are easier to see while the GM works.

**Decisions (Justin, 2026-11-13):**
- **Toggle:** a button in the window's title bar flips the layout.
- **The window reshapes** when it flips: tall for vertical, wide and short for horizontal.
- **Remembered per GM**, as a client or user setting.

**Build notes:**
- Horizontal puts the three sections in columns. The group bar stays across the top.
- Each column scrolls on its own. The Cast list keeps the most width, because its rows hold the cluster buttons.
- Collapsing a section narrows its column rather than hiding it.
- Remember the window size for each layout separately.

**Next step:** Claude writes a build plan, with a quick mock-up of the horizontal layout for Justin to check before building.
