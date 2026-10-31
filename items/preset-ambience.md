---
title: "Ambience in presets"
kind: feature
status: ready
waits_on: Claude
priority: ⏬
blocked_by: []
source: "Justin's ideas backlog, 2026-10-21 (moved here 2026-10-24)"
added: 2026-10-24
updated: 2026-10-30
---
# Ambience in presets

A preset can also start music, so loading a scene brings its sound too.

**Decisions (Justin, 2026-10-30):**
- **One playlist or one track** per preset.
- **Loading** stops the other playing playlists and starts the preset's one.
- **A preset without ambience** leaves the music alone.
- **Saving** a preset records the playlist (or single track) playing at that moment. The edit form can change or clear it.

**Data:** a new optional `ambience` field on presets (playlist id, and track id when it's one track). Add it to the README's stored-data table.
