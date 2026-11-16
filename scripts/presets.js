import { MODULE } from "./constants.js";
import { getCast, setCast, partyMembers, orderedMembers } from "./cast.js";
import { fitPartyCast, stable } from "./rules.js";
import { currentBackground, setBackground, decodePath } from "./stage.js";
import { UNTAGGED, getTag, stageTag, setStageTag } from "./tags.js";

/**
 * Presets: a saved background and cast (clusters and order), loaded onto a stage in
 * one click. Party members are saved marked as such (`partyMember`), so a
 * preset fits whoever is in the party when it loads: members still in it stand
 * where they were saved, new members join next to them, and members who've left
 * stay off. (Older presets hold one entry for the whole party, filled in with
 * every member where it stood.) Each character's form is saved too (`form`,
 * null for their base art) and put back on load. A preset can carry any
 * number of tags; one saved while a tag is selected starts with that tag.
 * Each stage remembers the preset last loaded or saved on it (a scene flag), so
 * the Stage window can light it and offer Update once the stage has changed.
 *
 * Stored in a world setting: { [id]: { name, tags: [], background, cast, saved } }.
 */

function all() {
  const presets = foundry.utils.deepClone(game.settings.get(MODULE, "presets"));
  for (const p of Object.values(presets)) p.tags ??= [];
  return presets;
}

async function store(presets) {
  await game.settings.set(MODULE, "presets", presets);
}

function requireGM() {
  if (!game.user.isGM) throw new Error("VN Stage | Only the GM can change presets.");
}

/** Presets, by name. With a tag id, only the presets with that tag; with UNTAGGED, the ones with none. */
export function listPresets(tagId = null) {
  return Object.entries(all())
    .map(([id, p]) => ({ id, ...p }))
    .filter((p) => !tagId || (tagId === UNTAGGED ? !p.tags.some((t) => getTag(t)) : p.tags.includes(tagId)))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

export function getPreset(id) {
  const p = all()[id];
  return p ? { id, ...p } : null;
}

/** A preset with this name and this tag (or among the untagged ones, for null). */
export function findPresetByName(name, tagId) {
  return listPresets().find((p) => p.name.toLowerCase() === name.toLowerCase()
    && (tagId ? p.tags.includes(tagId) : !p.tags.length)) ?? null;
}

/** What a preset keeps of a stage: its background, and its cast without ids or expressions, party members marked, with their forms. */
function snapshot(scene) {
  const members = new Set(partyMembers().map((a) => a.uuid));
  return {
    background: currentBackground(scene),
    cast: getCast(scene).map(({ id: _id, expression: _x, ...rest }) => {
      const out = members.has(rest.actorUuid) ? { ...rest, partyMember: true } : { ...rest };
      if (rest.actorUuid) out.form = fromUuidSync(rest.actorUuid)?.getFlag(MODULE, "form") ?? null;
      return out;
    }),
  };
}

/**
 * Put back the forms a preset saved for characters with actors (they live on
 * the actor), and leave them off the cast entries. Presets saved before forms
 * existed have no `form`, so those actors keep theirs.
 */
async function applyForms(cast) {
  for (const e of cast) {
    if (!e.actorUuid || !("form" in e)) continue;
    const actor = fromUuidSync(e.actorUuid);
    const now = actor?.getFlag(MODULE, "form") ?? null;
    if (actor && now !== e.form) await (e.form ? actor.setFlag(MODULE, "form", e.form) : actor.unsetFlag(MODULE, "form"));
    delete e.form;
  }
  return cast;
}

/** Save the viewed stage as a new preset (or over the one with the same name and the stage's tag). */
export async function savePreset(name, { scene = canvas.scene } = {}) {
  requireGM();
  const tag = getTag(stageTag(scene))?.id ?? null;
  const presets = all();
  const existing = findPresetByName(name, tag);
  const id = existing?.id ?? foundry.utils.randomID();
  presets[id] = {
    name: name.trim(),
    tags: existing?.tags ?? (tag ? [tag] : []),
    ...snapshot(scene),
    saved: today(),
  };
  await store(presets);
  await scene.setFlag(MODULE, "preset", id);
  return id;
}

/** Overwrite a preset with what's on the viewed stage now. Its name and tags stay. */
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

/** Give a preset exactly these tags. */
export async function setPresetTags(id, tags) {
  requireGM();
  const presets = all();
  if (!presets[id]) return;
  presets[id].tags = [...new Set(tags)];
  await store(presets);
}

/** Tag or untag one preset. */
export async function setPresetTag(id, tagId, on) {
  const preset = getPreset(id);
  if (!preset) return;
  await setPresetTags(id, on ? [...preset.tags, tagId] : preset.tags.filter((t) => t !== tagId));
}

/** Every preset with tag `from` gets `to` instead, or just loses it (a merged or deleted tag). The presets stay. */
export async function replacePresetTag(from, to = null) {
  requireGM();
  const presets = all();
  let changed = false;
  for (const p of Object.values(presets)) {
    if (!p.tags.includes(from)) continue;
    p.tags = [...new Set(p.tags.flatMap((t) => (t !== from ? [t] : to ? [to] : [])))];
    changed = true;
  }
  if (changed) await store(presets);
}

/**
 * Load a preset onto the viewed stage: its background and cast. The stage keeps
 * its tag when the preset has it; otherwise it switches to the preset's
 * first tag.
 */
export async function loadPreset(id, { scene = canvas.scene } = {}) {
  requireGM();
  const preset = all()[id];
  if (!preset) return;
  const tags = preset.tags.filter((t) => getTag(t));
  if (tags.length && !tags.includes(stageTag(scene))) await setStageTag(tags[0], scene);
  if (preset.background) await setBackground(preset.background, { scene });
  const members = orderedMembers(scene.getFlag(MODULE, "partyOrder") ?? []);
  await setCast(await applyForms(fitPartyCast(preset.cast ?? [], members)), { scene });
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

function today() {
  return new Date().toISOString().slice(0, 10);
}
