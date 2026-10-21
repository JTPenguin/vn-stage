/**
 * Form and expression chosen for art alone (no actor) before it's on a stage:
 * kept on this GM's screen until the character is next added, then put on the
 * new cast entry. A reload forgets them. Characters with actors don't need
 * this: theirs live on the actor, on stage or off.
 */
const pending = new Map(); // art key (the entry's name) → { form?, expression? }

export function pendingFor(name) {
  return pending.get(name) ?? {};
}

export function setPending(name, patch) {
  const next = { ...pendingFor(name), ...patch };
  for (const k of Object.keys(next)) if (next[k] == null) delete next[k];
  if (Object.keys(next).length) pending.set(name, next);
  else pending.delete(name);
}

/** The choices for `name`, forgotten once taken (when it goes on stage). */
export function takePending(name) {
  const out = pendingFor(name);
  pending.delete(name);
  return out;
}
