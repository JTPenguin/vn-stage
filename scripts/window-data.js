import { indexedActorKey, baseArtKeyOf } from "./art.js";
import { getCast, partyEntryIds, partyCluster, PARTY_LABEL } from "./cast.js";
import { listPresets, stagePreset } from "./presets.js";
import { currentBackground, backgroundFolder, folderImages, backgroundLabel, decodePath, isVideo } from "./stage.js";
import { ALL, RECENT, UNTAGGED, getTag, tagFolders, memberNames, listTags, backgroundTags } from "./tags.js";
import { folderLabel } from "./tags-window.js";
import { esc } from "./dialogs.js";
import { safetyBackground } from "./settings.js";
import { familyOf, isEntryFor, tellApart, backgroundTagItem, presetFaces } from "./rules.js";

/**
 * What the Stage window shows, worked out from the stage, the art and the
 * settings: Cast rows, preset rows and background strips. No rendering here
 * (window.js), so the window's class stays about what it does.
 */

/**
 * The Cast list for the selected tag: the characters with it (Recent in its
 * order, otherwise by name), and everyone else by name (none for All
 * characters). `rows` is every row, for looking them up by id. Rows show their
 * tags as chips except the selected tag's own rows, which all share it.
 */
export async function castLists(index, scene, selected) {
  const rows = await castRows(index, getCast(scene));
  const tagged = !!getTag(selected);
  const members = memberNames(selected);
  const tagsOf = new Map(); // art key → its tags, worked out once for every row
  for (const t of listTags()) for (const n of memberNames(t.id)) tagsOf.set(n, [...(tagsOf.get(n) ?? []), t]);
  for (const r of rows) r.tags = tagged && members.includes(r.key) ? [] : tagsOf.get(familyOf(r.key)) ?? [];
  const withTag = new Set(members);
  const byLabel = (a, b) => a.label.localeCompare(b.label);
  const mine = rows.filter((r) => withTag.has(r.key));
  if (selected === RECENT) mine.sort((a, b) => members.indexOf(a.key) - members.indexOf(b.key) || byLabel(a, b));
  else mine.sort(byLabel);
  const others = selected === ALL ? [] : rows.filter((r) => !withTag.has(r.key)).sort(byLabel);
  return { rows, mine, others };
}

/** Does cast entry `e` stand for this Cast row? Its actor's entry, or for art alone, the art-only entry with its key. */
function isRowEntry(row, e) {
  return isEntryFor(e, { name: row.key, actorUuid: row.actorUuid });
}

/** The cast entry a row works on, read fresh (the row's own may be from the last render). */
export function castEntryFor(row) {
  return getCast().find((e) => isRowEntry(row, e)) ?? null;
}

/**
 * The Party's row. `together` when every member stands in one cluster
 * (the row lights up fully); `onStage`: is any member on stage? (The row
 * lights up a little, even when they're split, and shows its ×.)
 */
export function partyRow(scene) {
  return {
    label: PARTY_LABEL,
    together: partyCluster(scene) !== null,
    onStage: partyEntryIds(scene).length > 0,
  };
}

/**
 * Everyone the Cast list can offer: one row per world actor with VN art (so it
 * goes on stage linked, and its owners control its expression; several actors
 * can share one character's art), and one per character no actor uses (or that
 * stands on stage without an actor); forms have no rows of their own. Actors
 * that share a name are told apart by their art, then by their sidebar folder
 * (tellApart in rules.js). Each row knows its cast entry on stage.
 */
export async function castRows(index, cast) {
  const byKey = new Map(index.map((a) => [a.key, a]));
  const rows = [];
  const usedKeys = new Set();
  for (const actor of game.actors) {
    if (actor.type === "party") continue;
    const key = await indexedActorKey(actor);
    const art = key && byKey.get(key);
    if (!art) continue;
    usedKeys.add(key);
    rows.push({ row: actor.uuid, key, name: actor.name, actorUuid: actor.uuid, label: actor.name, note: art.label !== actor.name ? art.label : null, artLabel: art.label, folder: folderPath(actor), thumb: art.thumb });
  }
  tellApart(rows);
  const artOnlyOnStage = new Set(cast.filter((e) => !e.actorUuid).map((e) => e.name));
  for (const art of index) {
    if (usedKeys.has(art.key) && !artOnlyOnStage.has(art.key)) continue;
    // Forms are switched from the character menu, so they get no row of their own (unless one stands on stage as art alone).
    if (art.key.includes("/forms/") && !artOnlyOnStage.has(art.key)) continue;
    rows.push({ row: `art:${art.key}`, key: art.key, name: art.key, actorUuid: null, label: art.label, note: usedKeys.has(art.key) ? "art only" : null, thumb: art.thumb });
  }
  for (const r of rows) {
    r.entry = cast.find((e) => isRowEntry(r, e)) ?? null;
  }
  return rows;
}

/** An actor's sidebar folder, from the top: "Scenario 5 / Gatehouse" ("" outside any folder). */
function folderPath(actor) {
  const folder = actor.folder;
  if (!folder) return "";
  return [...(folder.ancestors ?? [])].reverse().concat(folder).map((f) => f.name).join(" / ");
}

const CHIPS = 1; // tag chips a Cast tile has room for; the rest are counted

/** A Cast tile. Its hover text holds the full name and the note (Foundry shows tooltips as HTML, so both are escaped). */
export function rowContext(r) {
  const tags = r.tags ?? [];
  return {
    row: r.row, label: r.label, note: r.note, thumb: r.thumb,
    tooltip: [esc(r.label), r.note ? esc(r.note) : null].filter(Boolean).join("<br>"),
    onStage: !!r.entry,
    tags: tags.slice(0, CHIPS),
    moreTags: tags.length > CHIPS ? { count: tags.length - CHIPS, tooltip: esc(tags.map((t) => t.label).join(", ")) } : null,
    search: `${r.label} ${r.note ?? ""} ${r.key} ${tags.map((t) => t.label).join(" ")}`.toLowerCase(),
  };
}

/**
 * The Presets list: the presets with the selected tag (every preset under All
 * characters and Recent, the ones with no tag under Untagged). Each row shows
 * its background, its name and who's in it: one Party avatar for any party
 * members, then everyone else in standing order (window.js trims them to the
 * row's width). A row has no hover text of its own, so its avatars' show. The
 * one last loaded or saved on this stage is lit, and marked changed once the
 * stage differs from it.
 */
export async function presetRows(index, scene, selected) {
  const lit = stagePreset(scene);
  const only = getTag(selected)?.id ?? (selected === UNTAGGED ? UNTAGGED : null);
  const byKey = new Map(index.map((a) => [a.key, a]));
  return Promise.all(listPresets(only).map(async (p) => {
    const { party, others } = presetFaces(p.cast);
    return {
      id: p.id,
      name: p.name,
      background: p.background ? { src: p.background, video: isVideo(p.background) } : null,
      party: party ? { label: PARTY_LABEL } : null,
      faces: await Promise.all(others.map((e) => presetFace(e, byKey))),
      current: lit?.id === p.id,
      changed: lit?.id === p.id && lit.changed,
    };
  }));
}

/** One avatar on a preset row: the character's thumb (the form the preset saved, if it has art) and name. */
async function presetFace(entry, byKey) {
  const base = await baseArtKeyOf(entry);
  const form = entry.form && base && familyOf(entry.form) === familyOf(base) && byKey.has(entry.form) ? entry.form : null;
  const name = (entry.actorUuid && fromUuidSync(entry.actorUuid)?.name) || byKey.get(base)?.label || entry.name;
  return { thumb: byKey.get(form ?? base)?.thumb ?? null, name, tooltip: esc(name) };
}

/** "Tags: A, B" for a hover text (escaped: Foundry shows tooltips as HTML), or null with none. */
function tagLine(tags) {
  return tags.length ? `Tags: ${esc(tags.map((t) => t.label).join(", "))}` : null;
}

/**
 * The Background strips: the default background pinned first (and the one shown
 * now, when it's in no strip, so it can be tagged), then the tag's single
 * backgrounds and each of its folders, with a heading each when there's more
 * than one strip; or the stage's own last-browsed folder when no tag is
 * selected (under Untagged, only its backgrounds that have no tag). Each
 * background names its tags in its hover text.
 */
export async function backgroundStrips(scene, selected, collapsed) {
  const tag = getTag(selected);
  const current = currentBackground(scene);
  const safety = safetyBackground();
  const tagsOf = await backgroundTags();
  const same = (a, b) => !!a && !!b && decodePath(a) === decodePath(b);
  const choice = (src, label, pinned = false) => ({
    src, label, pinned, video: isVideo(src), current: same(src, current),
    tagItem: tag ? backgroundTagItem(tagsOf(src), tag.id) : null, // what its right-click menu offers for the tag
    tooltip: [esc(label), tagLine(tagsOf(src))].filter(Boolean).join("<br>"),
  });

  const folders = tag ? (await tagFolders(tag.id)).map((f) => f.folder) : [backgroundFolder(scene)].filter(Boolean);
  const offer = (src) => !same(src, safety) && (selected !== UNTAGGED || !tagsOf(src).length);
  const strips = await Promise.all(folders.map(async (folder) => ({
    folder,
    heading: tag ? folderLabel(folder) : null,
    collapsed: !!collapsed[`folder:${folder}`],
    choices: (await folderImages(folder)).filter(offer).map((src) => choice(src, backgroundLabel(src))),
  })));
  if (tag?.images.length) {
    strips.unshift({
      folder: `images:${tag.id}`,
      heading: "Single backgrounds",
      collapsed: !!collapsed[`folder:images:${tag.id}`],
      choices: tag.images.filter((src) => !same(src, safety)).map((src) => choice(src, backgroundLabel(src))),
    });
  }
  const pinned = safety ? [choice(safety, "Default background", true)] : [];
  const offered = strips.some((s) => s.choices.some((c) => c.current)) || same(current, safety);
  if (current && !offered) {
    const note = tagsOf(current).length ? "shown now" : "shown now; right-click to tag it";
    pinned.push({ ...choice(current, `${backgroundLabel(current)} (${note})`), elsewhere: true });
  }
  const showHeadings = !!tag && strips.length > 1;
  for (const s of strips) s.showHeading = showHeadings;
  return { pinned, strips, folder: tag ? null : folders[0] ?? null, tagged: !!tag };
}
