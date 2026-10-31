---
title: "Replace groups with tags"
kind: idea
status: proposed
waits_on: Justin
priority: ⏬
blocked_by: []
source: "Justin's list, 2026-10-30"
added: 2026-10-30
updated: 2026-10-30
---
# Replace groups with tags

Possibly replace the groups feature with a tags feature. The same tags could be applied to presets, backgrounds and characters, so one tag can pull together items of different kinds. Groups hold each item in one place; tags let an item appear under several.

**Today:** a group holds background folders, single backgrounds, characters (from the art's `groups` field plus hand edits) and presets, and each stage remembers its group.

**Decided (Justin, 2026-10-30):** if tags come, the window shows one tag at a time, like groups today.

**Still open (Justin isn't sure yet):**
- Do tags replace groups fully, or sit alongside them as an extra filter?
- How do existing groups migrate without losing their members, folders and presets?
- What happens to automatic group background folders (`scenes/{group}/`) and the `vn-stage.groupFolders` hook?
