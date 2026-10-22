/**
 * The module's rules that need no Foundry: plain data in, plain data out. Kept
 * apart so tools/test.mjs can check them outside Foundry. (The layout's
 * arithmetic lives in arrange.js for the same reason.) Nothing here imports
 * anything.
 */

/* -------------------------------------------- */
/*  The party                                   */
/* -------------------------------------------- */

/** An entry from before party members were separate: it stands for the whole party. */
export function isOldPartyEntry(e) {
  return !!e?.party && !e.name && !e.actorUuid;
}

/**
 * Party members ({ id, uuid, name }) in a remembered order (actor ids); members
 * not in it come after, in the order given.
 */
export function orderMembers(members, order = []) {
  const rank = (a) => { const i = order.indexOf(a.id); return i === -1 ? Infinity : i; };
  return members.map((a, i) => ({ a, i })).sort((x, y) => rank(x.a) - rank(y.a) || x.i - y.i).map(({ a }) => a);
}

/**
 * A preset's saved cast fitted to today's party (`members`, in standing order).
 * Saved members still in the party keep their places; members who've left are
 * dropped; new members join right after the last saved member who's still here
 * (or where the first saved member stood). An old whole-party entry becomes
 * every member not placed otherwise, where it stood.
 */
export function fitPartyCast(saved, members) {
  const here = new Set(members.map((a) => a.uuid));
  // Members the preset already places (marked, or standing alone in an older preset).
  const placed = new Set(saved.filter((e) => !isOldPartyEntry(e) && here.has(e.actorUuid)).map((e) => e.actorUuid));
  const entryOf = (a, side) => ({ name: a.name, actorUuid: a.uuid, side });
  const out = [];
  let anchor = null; // where newcomers go: { at (index in out), side }
  for (const e of saved) {
    if (isOldPartyEntry(e)) {
      for (const a of orderMembers(members, e.order)) {
        if (placed.has(a.uuid)) continue;
        out.push(entryOf(a, e.side));
        placed.add(a.uuid);
      }
      continue;
    }
    if (!e.partyMember) { out.push(e); continue; }
    if (here.has(e.actorUuid)) {
      const { partyMember: _p, ...rest } = e;
      out.push(rest);
      anchor = { at: out.length, side: e.side };
    } else anchor ??= { at: out.length, side: e.side };
  }
  if (anchor) out.splice(anchor.at, 0, ...members.filter((a) => !placed.has(a.uuid)).map((a) => entryOf(a, anchor.side)));
  return out;
}

/* -------------------------------------------- */
/*  Presets                                     */
/* -------------------------------------------- */

/** JSON with sorted keys and no empty fields, so entries compare equal whatever order their fields were written in. */
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).filter((k) => value[k] != null).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/* -------------------------------------------- */
/*  Art                                         */
/* -------------------------------------------- */

/**
 * A manifest's forms as a list of { form, label, folder }, whichever way it
 * writes them: a list with `folder` (the pipeline's form tool), or an object
 * keyed by form with `dir` (forms made by hand). Folders lose their trailing slash.
 */
export function formsOf(m) {
  const raw = m?.forms;
  const list = Array.isArray(raw) ? raw
    : raw && typeof raw === "object" ? Object.entries(raw).map(([form, f]) => ({ form, ...f })) : [];
  return list.map((f) => ({ ...f, folder: (f.folder ?? f.dir ?? "").replace(/\/$/, "") })).filter((f) => f.folder);
}

/** The character a key belongs to: "Rahadin/forms/corrupted" → "Rahadin". */
export function familyOf(key) {
  const i = key.indexOf("/forms/");
  return i === -1 ? key : key.slice(0, i);
}

/* -------------------------------------------- */
/*  Groups                                      */
/* -------------------------------------------- */

/**
 * A group's members: characters whose art tags name it (`index`: [{ name, groups }]),
 * plus ones added by hand, minus ones removed by hand (a removal wins over a tag).
 */
export function groupMembers(id, index, { add = [], remove = [] } = {}) {
  const names = new Set(index.filter((a) => a.groups.includes(id)).map((a) => a.name));
  for (const n of add) names.add(n);
  for (const n of remove) names.delete(n);
  return [...names];
}

/** The Recent list after using `used` (newest first), at most `max` long. */
export function mergeRecent(used, before, max) {
  return [...used, ...before.filter((n) => !used.includes(n))].slice(0, max);
}

/* -------------------------------------------- */
/*  Dropping on the stage                       */
/* -------------------------------------------- */

/**
 * Where a drop at frame x would put a character, given each side's centres in
 * standing order (frame pixels): { side, index, x } with x where the marker goes.
 * The sides divide halfway between the two clusters, or in the middle of the
 * usable width (the frame less the sidebar share) when one side is empty.
 */
export function dropSlot(x, left, right, frameWidth, sidebar) {
  const boundary = left.length && right.length
    ? (Math.max(...left) + Math.min(...right)) / 2
    : (frameWidth * (1 - sidebar)) / 2;
  const side = x < boundary ? "left" : "right";
  const list = side === "left" ? left : right;
  // Standing order runs from the outer edge: left to right on the left, right to left on the right.
  const inward = side === "left" ? (c) => c < x : (c) => c > x;
  const index = list.filter(inward).length;
  const prev = list[index - 1], next = list[index];
  const gap = 0.06 * frameWidth * (side === "left" ? 1 : -1);
  const mx = prev !== undefined && next !== undefined ? (prev + next) / 2
    : prev !== undefined ? prev + gap : next !== undefined ? next - gap : x;
  return { side, index, x: mx };
}
