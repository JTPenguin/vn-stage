---
title: "Make the module work for other GMs' games"
kind: work
status: ready
waits_on: Justin
priority: ⏬
blocked_by: []
source: "Curse of Strahd To Do (moved here 2026-10-24); interview with Justin 2026-11-16"
added: 2026-10-24
updated: 2026-11-16
---
# Make the module work for other GMs' games

The module shouldn't assume Justin's file layout. Chase wants it for his *Season of Ghosts* game and offered to adapt it himself.

**Decision (Justin, 2026-10-30):** nothing more is needed in the code. The art-format work of 2026-10-23 (M1 to M3, [docs/art-format.md](../docs/art-format.md)) covers it.

**Today:** Chase has the 0.2.0 zip (built by hand on 2026-10-29). The repo has no GitHub remote, no licence and no packaging script; `dist/` is gitignored. About 34 commits since then sit under "Unreleased" in [CHANGELOG.md](../CHANGELOG.md), including the schema 3, 4 and 5 upgrades. The README rule "no `manifest` or `download` URL in `module.json`" keeps Foundry's updater from overwriting the working copy, which Foundry loads through a symlink.

**Code is table-neutral (checked 2026-11-16):** no paths or campaign names in `scripts/`, `lang/` or `styles/`. The PF2e parts fail safely on other systems: the party row ([cast.js:36](../scripts/cast.js)) and creature size from the sheet ([layout.js:158](../scripts/layout.js)) are skipped without PF2e. Season of Ghosts is PF2e anyway.

**Model to follow:** PF2e Subsystems Framework, public at `JTPenguin/pf2e-subsystems-framework`. Its `.github/workflows/release.yml` runs on a `v*` tag: it checks the tag against `module.json`, runs the tests, builds the zip with `tools/build-zip.mjs`, and publishes a release with the zip and `module.json`. Its manifest URL is `releases/latest/download/module.json`.

**Next version (Justin, 2026-11-16):** cut 0.3.0 from the current code: bump `version`, turn "Unreleased" into a 0.3.0 changelog entry, tag `v0.3.0`. Chase moves from 0.2.0 to 0.3.0, so his world runs the schema 3 to 5 upgrades once.

**Updates (Justin, 2026-11-16):** publish on GitHub like Subsystems, so Chase installs and updates from a manifest URL.

**Repo (Justin, 2026-11-16):** public, with an MIT licence like Subsystems. The README's "shared privately; not published" line goes, and the install steps change to the manifest URL.

**Manifest and download (Justin, 2026-11-16):** added at build time, not kept in the working copy. The build script writes `manifest` and `download` into the zip's `module.json` only, and the release uploads that file. The README rule stays.

**items/ (Justin, 2026-11-16):** stays in the public repo, campaign names and all.

**One item (Justin, 2026-11-16):** repo, licence, build script, release workflow, the 0.3.0 release and sending Chase the URL are all this item.

**Work list:**

- Create the public repo `JTPenguin/vn-stage` and push `main` (Justin approves the push).
- Add an MIT `LICENSE`.
- Add `tools/build-zip.mjs`: builds `dist/vn-stage-<version>.zip` with the module files and a `module.json` that has `manifest` and `download` filled in for that version.
- Add `.github/workflows/release.yml`, adapted from Subsystems: check the tag against `version`, run the tests and load check, build, publish the zip and the built `module.json`. No compendium step.
- Update the README (install by manifest URL, release steps, drop "not published") and CLAUDE.md (pointer to the release steps).
- Cut 0.3.0 and tag it.
- Justin sends Chase the manifest URL: `https://github.com/JTPenguin/vn-stage/releases/latest/download/module.json`.

**Open questions:**

- What happens to Chase's own changes (his fork, or fixes sent back) is not decided. Wait until he has used it.

**Related:** moving Subsystems to the same build-time manifest is a Subsystems idea: `~/Projects/PF2e Subsystems Framework/items/build-time-manifest.md`.

**Next step:** Justin says go. Claude then does the work list up to the tag, asking before the first push. Justin sends Chase the URL and closes the item.
