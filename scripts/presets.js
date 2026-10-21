import { MODULE } from "./constants.js";
import { getCast, setCast } from "./cast.js";
import { currentBackground, setBackground, decodePath } from "./stage.js";
import { getGroup, stageGroup, setStageGroup } from "./groups.js";

/**
 * Presets: a saved background and cast (sides and order), loaded onto a stage in
 * one click. The Party is saved as an entry, not as names, so it fills in with
 * whoever is in the party when the preset loads. A preset can belong to any
 * number of groups; one saved while a group is selected starts in that group.
 * Each stage remembers the preset last loaded or saved on it (a scene flag), so
 * the Stage window can light it and offer Update once the stage has changed.
 *
 * Stored in a world setting: { [id]: { name, groups: [], background, cast, saved } }.
 * Older presets have `group` (one id or null) instead; they're read as `groups`.
 */

function all() {
  const presets = foundry.utils.deepClone(game.settings.get(MODULE, "presets"));
  for (const p of Object.values(presets)) {
    p.groups ??= p.group ? [p.group] : [];
    delete p.group;
  }
  return presets;
}

async function store(presets) {
  await game.settings.set(MODULE, "presets", presets);
}

function requireGM() {
  if (!game.user.isGM) throw new Error("VN Stage | Only the GM can change presets.");
}

/** Presets, by name. With a group id, only that group's presets. */
export function listPresets(groupId = null) {
  return Object.entries(all())
    .map(([id, p]) => ({ id, ...p }))
    .filter((p) => !groupId || p.groups.includes(groupId))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

export function getPreset(id) {
  const p = all()[id];
  return p ? { id, ...p } : null;
}

/** A preset with this name in this group (or among the ungrouped ones, for null). */
export function findPresetByName(name, groupId) {
  return listPresets().find((p) => p.name.toLowerCase() === name.toLowerCase()
    && (groupId ? p.groups.includes(groupId) : !p.groups.length)) ?? null;
}

/** What a preset keeps of a stage: its background and its cast without ids or expressions. */
function snapshot(scene) {
  return {
    background: currentBackground(scene),
    cast: getCast(scene).map(({ id: _id, expression: _x, ...rest }) => rest),
  };
}

/** Save the viewed stage as a new preset (or over the one with the same name in the stage's group). */
export async function savePreset(name, { scene = canvas.scene } = {}) {
  requireGM();
  const group = getGroup(stageGroup(scene))?.id ?? null;
  const presets = all();
  const existing = findPresetByName(name, group);
  const id = existing?.id ?? foundry.utils.randomID();
  presets[id] = {
    name: name.trim(),
    groups: existing?.groups ?? (group ? [group] : []),
    ...snapshot(scene),
    saved: today(),
  };
  await store(presets);
  await scene.setFlag(MODULE, "preset", id);
  return id;
}

/** Overwrite a preset with what's on the viewed stage now. Its name and groups stay. */
export async function updatePreset(id, { scene = canvas.scene } = {}) {
  requireGM();
  const presets = all();
  if (!presets[id]) return;
  presets[id] = { ...presets[id], ...snapshot(scene), saved: today() };
  await store(presets);
  await scene.setFlag(MODULE, "preset", id);
}

export async function renamePreset(id, name) {
  requireGM();
  const presets = all();
  if (!presets[id] || !name.trim()) return;
  presets[id].name = name.trim();
  await store(presets);
}

/** Put a preset in exactly these groups. */
export async function setPresetGroups(id, groups) {
  requireGM();
  const presets = all();
  if (!presets[id]) return;
  presets[id].groups = [...new Set(groups)];
  await store(presets);
}

/** Add or remove several presets from one group (the Groups window). */
export async function setPresetsInGroup(ids, groupId, inGroup) {
  requireGM();
  const presets = all();
  for (const id of ids) {
    const p = presets[id];
    if (!p) continue;
    p.groups = inGroup ? [...new Set([...p.groups, groupId])] : p.groups.filter((g) => g !== groupId);
  }
  await store(presets);
}

/** A deleted group leaves every preset (the presets stay). */
export async function forgetGroup(groupId) {
  const ids = listPresets(groupId).map((p) => p.id);
  if (ids.length) await setPresetsInGroup(ids, groupId, false);
}

/**
 * Load a preset onto the viewed stage: its background and cast. The stage keeps
 * its group when the preset belongs to it; otherwise it switches to the
 * preset's first group.
 */
export async function loadPreset(id, { scene = canvas.scene } = {}) {
  requireGM();
  const preset = all()[id];
  if (!preset) return;
  const groups = preset.groups.filter((g) => getGroup(g));
  if (groups.length && !groups.includes(stageGroup(scene))) await setStageGroup(groups[0], scene);
  if (preset.background) await setBackground(preset.background, { scene });
  await setCast(preset.cast ?? [], { scene });
  await scene.setFlag(MODULE, "preset", id);
}

export async function deletePreset(id) {
  requireGM();
  const presets = all();
  delete presets[id];
  await store(presets);
}

/**
 * The preset last loaded or saved on this stage, and whether the stage has
 * changed since: { id, changed }, or null.
 */
export function stagePreset(scene = canvas.scene) {
  const id = scene?.getFlag(MODULE, "preset");
  const preset = id && all()[id];
  if (!preset) return null;
  const now = snapshot(scene);
  const same = (a, b) => (a ? decodePath(a) : null) === (b ? decodePath(b) : null);
  const changed = !same(now.background, preset.background) || stable(now.cast) !== stable(preset.cast ?? []);
  return { id, changed };
}

/** JSON with sorted keys, so entries compare equal whatever order their fields were written in. */
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).filter((k) => value[k] != null).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
