import { MODULE } from "./constants.js";
import { getCast, setCast } from "./cast.js";
import { currentBackground, setBackground } from "./stage.js";
import { getGroup, stageGroup, setStageGroup } from "./groups.js";

/**
 * Presets: a saved background and cast (sides and order), loaded onto a stage in
 * one click. The Party is saved as an entry, not as names, so it fills in with
 * whoever is in the party when the preset loads. A preset saved while a group is
 * selected belongs to that group, and loading it selects the group again.
 *
 * Stored in a world setting: { [id]: { name, group, background, cast, saved } }.
 */

function all() {
  return foundry.utils.deepClone(game.settings.get(MODULE, "presets"));
}

function requireGM() {
  if (!game.user.isGM) throw new Error("VN Stage | Only the GM can change presets.");
}

/** Presets, by name. With a group id, only that group's presets. */
export function listPresets(groupId = null) {
  return Object.entries(all())
    .map(([id, p]) => ({ id, ...p }))
    .filter((p) => !groupId || p.group === groupId)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

export function findPresetByName(name, groupId) {
  return listPresets().find((p) => p.name.toLowerCase() === name.toLowerCase() && (p.group ?? null) === (groupId ?? null)) ?? null;
}

/** Save the viewed stage as a preset. Replaces one with the same name in the same group. */
export async function savePreset(name, { scene = canvas.scene } = {}) {
  requireGM();
  const group = getGroup(stageGroup(scene))?.id ?? null;
  const presets = all();
  const existing = findPresetByName(name, group);
  const id = existing?.id ?? foundry.utils.randomID();
  presets[id] = {
    name: name.trim(),
    group,
    background: currentBackground(scene),
    cast: getCast(scene).map(({ id: _id, expression: _x, ...rest }) => rest),
    saved: new Date().toISOString().slice(0, 10),
  };
  await game.settings.set(MODULE, "presets", presets);
  return id;
}

/** Load a preset onto the viewed stage: its group, background and cast. */
export async function loadPreset(id, { scene = canvas.scene } = {}) {
  requireGM();
  const preset = all()[id];
  if (!preset) return;
  if (preset.group && getGroup(preset.group)) await setStageGroup(preset.group, scene);
  if (preset.background) await setBackground(preset.background, { scene });
  await setCast(preset.cast ?? [], { scene });
}

export async function deletePreset(id) {
  requireGM();
  const presets = all();
  delete presets[id];
  await game.settings.set(MODULE, "presets", presets);
}
