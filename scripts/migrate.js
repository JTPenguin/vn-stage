import { MODULE } from "./constants.js";
import { partyMembers } from "./cast.js";
import { upgradeCast, absolutePrefs } from "./rules.js";
import { characterArt, scanArtIfStale } from "./art.js";
import { isStage } from "./stage.js";
import { layout } from "./layout.js";

/**
 * One-time data upgrades. The world setting `schema` records the last one run;
 * the active GM's screen runs any newer ones once Foundry is ready, then lays
 * out the viewed stage. Code reads only the current form, so each change of
 * stored data gets a step here instead of a conversion on every read.
 *
 *   1 (0.2.0)  Stage casts: the "Full" side reads as left; the whole-party entry
 *              becomes the party's members. Presets: `group` becomes `groups`;
 *              the same cast changes, members marked `partyMember` (an old
 *              whole-party entry stays when no party is known, and still fills
 *              in when the preset loads).
 *   2          Character prefs: Adjust's scale and yOffset hold the actual values,
 *              not a factor on and an addition to the art file's. Values equal to
 *              the art's own are dropped.
 */
export const SCHEMA = 2;

const STEPS = {
  1: toV1,
  2: toV2,
};

/** Is an upgrade still to run in this world? (The GM's screen waits for it before laying out.) */
export function migrationPending() {
  return game.settings.get(MODULE, "schema") < SCHEMA;
}

export async function migrate() {
  if (!game.user.isGM || (game.users.activeGM ?? game.user) !== game.user) return;
  const from = game.settings.get(MODULE, "schema");
  if (from >= SCHEMA) return;
  for (let v = from + 1; v <= SCHEMA; v++) {
    try {
      await STEPS[v]();
    } catch (err) {
      console.error(`VN Stage | Data upgrade ${v} failed; it will be tried again next time`, err);
      ui.notifications.error(`VN Stage | Couldn't upgrade stored data (step ${v}). See the console.`);
      return;
    }
    await game.settings.set(MODULE, "schema", v);
    console.log(`VN Stage | Stored data upgraded to schema ${v}`);
  }
  if (isStage()) layout(canvas.scene);
}

/** Party members as the upgrade rules want them. */
function members() {
  return partyMembers().map((a) => ({ id: a.id, uuid: a.uuid, name: a.name }));
}

async function toV1() {
  const party = members();
  for (const scene of game.scenes) {
    const cast = scene.getFlag(MODULE, "cast");
    if (!Array.isArray(cast)) continue;
    const next = upgradeCast(cast, party);
    if (JSON.stringify(next) !== JSON.stringify(cast)) await scene.setFlag(MODULE, "cast", next);
  }
  const presets = foundry.utils.deepClone(game.settings.get(MODULE, "presets"));
  let changed = false;
  for (const p of Object.values(presets)) {
    const before = JSON.stringify(p);
    p.groups ??= p.group ? [p.group] : [];
    delete p.group;
    p.cast = upgradeCast(p.cast ?? [], party, { preset: true });
    if (JSON.stringify(p) !== before) changed = true;
  }
  if (changed) await game.settings.set(MODULE, "presets", presets);
}

async function toV2() {
  // The art's own values are needed, so read the art folder first if the index is missing or out of date.
  await scanArtIfStale();
  const all = game.settings.get(MODULE, "characterPrefs");
  const next = {};
  for (const [key, prefs] of Object.entries(all)) next[key] = absolutePrefs(prefs, await characterArt(key));
  if (JSON.stringify(next) !== JSON.stringify(all)) await game.settings.set(MODULE, "characterPrefs", next);
}
