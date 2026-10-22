import { indexedActorKey } from "./art.js";
import { getCast, partyEntryIds } from "./cast.js";
import { listPresets, stagePreset } from "./presets.js";
import { currentBackground, backgroundFolder, folderImages, backgroundLabel, decodePath, isVideo } from "./stage.js";
import { ALL, RECENT, getGroup, groupFolders, memberNames } from "./groups.js";
import { folderLabel } from "./groups-window.js";
import { esc } from "./dialogs.js";
import { safetyBackground } from "./settings.js";

/**
 * What the Stage window shows, worked out from the stage, the art and the
 * settings: Cast rows, preset chips and background strips. No rendering here
 * (window.js), so the window's class stays about what it does.
 */

/**
 * The Cast list for the selected group: the group's members (Recent in its
 * order, otherwise by name), and everyone else by name (none for All
 * characters). `rows` is every row, for looking them up by id.
 */
export async function castLists(index, scene, selected) {
  const rows = await castRows(index, getCast(scene));
  const members = memberNames(selected, index);
  const inGroup = new Set(members);
  const byLabel = (a, b) => a.label.localeCompare(b.label);
  const mine = rows.filter((r) => inGroup.has(r.key));
  if (selected === RECENT) mine.sort((a, b) => members.indexOf(a.key) - members.indexOf(b.key) || byLabel(a, b));
  else mine.sort(byLabel);
  const others = selected === ALL ? [] : rows.filter((r) => !inGroup.has(r.key)).sort(byLabel);
  return { rows, mine, others };
}

/** Does cast entry `e` stand for this Cast row? Its actor's entry, or for art alone, the art-only entry with its key. */
function isRowEntry(row, e) {
  return row.actorUuid ? e.actorUuid === row.actorUuid : !e.actorUuid && e.name === row.key;
}

/** The cast entry a row's toggles work on, read fresh (the row's own may be from the last render). */
export function castEntryFor(row) {
  return getCast().find((e) => isRowEntry(row, e)) ?? null;
}

/** Is any party member on stage? (The Party's row lights up a little, even when they're split.) */
export function partyOnStage(scene) {
  return partyEntryIds(scene).length > 0;
}

/**
 * Everyone the Cast list can offer: one row per world actor with VN art (so it
 * goes on stage linked, and its owners control its expression; several actors
 * can share one character's art), and one per character no actor uses (or that
 * stands on stage without an actor); forms have no rows of their own. Each row
 * knows its cast entry on stage.
 */
export async function castRows(index, cast) {
  const byKey = new Map(index.map((a) => [a.key, a]));
  const keys = new Set(byKey.keys());
  const rows = [];
  const usedKeys = new Set();
  for (const actor of game.actors) {
    if (actor.type === "party") continue;
    const key = await indexedActorKey(actor, keys);
    const art = key && byKey.get(key);
    if (!art) continue;
    usedKeys.add(key);
    rows.push({ row: actor.uuid, key, name: actor.name, actorUuid: actor.uuid, label: actor.name, note: art.label !== actor.name ? art.label : null, thumb: art.thumb });
  }
  const artOnlyOnStage = new Set(cast.filter((e) => !e.actorUuid).map((e) => e.name));
  for (const art of index) {
    if (usedKeys.has(art.key) && !artOnlyOnStage.has(art.key)) continue;
    // Forms are switched from the character menu, so they get no row of their own (unless one stands on stage as art alone).
    if (art.key.includes("/forms/") && !artOnlyOnStage.has(art.key)) continue;
    rows.push({ row: `art:${art.key}`, key: art.key, name: art.key, actorUuid: null, label: art.label, note: usedKeys.has(art.key) ? "art only" : null, thumb: art.thumb });
  }
  for (const r of rows) {
    r.entry = cast.find((e) => isRowEntry(r, e)) ?? null;
    r.side = r.entry?.side ?? null;
  }
  return rows;
}

export function rowContext(r) {
  return {
    row: r.row, label: r.label, note: r.note, thumb: r.thumb,
    onStage: !!r.entry,
    search: `${r.label} ${r.note ?? ""} ${r.key}`.toLowerCase(),
    left: r.side === "left", right: r.side === "right",
  };
}

/**
 * The Presets list: the group's presets (every preset under All characters and
 * Recent, labelled with their groups). The one last loaded or saved on this stage
 * is lit, and marked changed once the stage differs from it.
 */
export function presetRows(scene, group) {
  const lit = stagePreset(scene);
  const label = (id) => getGroup(id)?.label ?? id;
  return listPresets(group?.id ?? null).map((p) => ({
    id: p.id,
    name: p.name,
    // Foundry shows tooltips as HTML, so the names are escaped.
    tooltip: [
      esc(p.name),
      group ? null : p.groups.length ? `Groups: ${esc(p.groups.map(label).join(", "))}` : null,
      lit?.id === p.id && lit.changed ? "The stage has changed since it was loaded" : null,
      "Click to load · right-click for more",
    ].filter(Boolean).join("<br>"),
    current: lit?.id === p.id,
    changed: lit?.id === p.id && lit.changed,
  }));
}

/**
 * The Background strips: the default background pinned first (and the one shown
 * now, when it's in no strip, so it can be added to a group), then the group's
 * single backgrounds and each of its folders, with a heading each when there's
 * more than one strip; or the stage's own last-browsed folder when there's no group.
 */
export async function backgroundStrips(scene, group, collapsed) {
  const current = currentBackground(scene);
  const safety = safetyBackground();
  const same = (a, b) => !!a && !!b && decodePath(a) === decodePath(b);
  const choice = (src, label, pinned = false) => ({ src, label, pinned, video: isVideo(src), current: same(src, current) });

  const folders = group ? (await groupFolders(group.id)).map((f) => f.folder) : [backgroundFolder(scene)].filter(Boolean);
  const strips = await Promise.all(folders.map(async (folder) => ({
    folder,
    heading: group ? folderLabel(folder) : null,
    collapsed: !!collapsed[`folder:${folder}`],
    choices: (await folderImages(folder)).filter((src) => !same(src, safety)).map((src) => choice(src, backgroundLabel(src))),
  })));
  if (group?.images.length) {
    strips.unshift({
      folder: `images:${group.id}`,
      heading: "Single backgrounds",
      collapsed: !!collapsed[`folder:images:${group.id}`],
      choices: group.images.filter((src) => !same(src, safety)).map((src) => choice(src, backgroundLabel(src))),
    });
  }
  const pinned = safety ? [choice(safety, "Default background", true)] : [];
  const offered = strips.some((s) => s.choices.some((c) => c.current)) || same(current, safety);
  if (current && !offered) pinned.push({ ...choice(current, `${backgroundLabel(current)} (shown now; right-click to add it to a group)`), elsewhere: true });
  const showHeadings = !!group && strips.length > 1;
  for (const s of strips) s.showHeading = showHeadings;
  return { pinned, strips, folder: group ? null : folders[0] ?? null, grouped: !!group };
}
