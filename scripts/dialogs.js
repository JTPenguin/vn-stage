const { DialogV2 } = foundry.applications.api;

/** A one-field name dialog; resolves to the trimmed name, or null. */
export async function askName(title, value, label = "Save") {
  const name = await DialogV2.prompt({
    window: { title },
    content: `<input type="text" name="name" value="${foundry.utils.escapeHTML(value ?? "")}" autofocus>`,
    ok: { label, callback: (_event, button) => button.form.elements.name.value },
    rejectClose: false,
  });
  return name?.trim() || null;
}

/** Pick one of `options` ([{ id, label }]) from a menu; resolves to its id, or null. */
export async function askChoice(title, options, label = "Save") {
  const list = options.map((o) => `<option value="${esc(o.id)}">${esc(o.label)}</option>`).join("");
  const id = await DialogV2.prompt({
    window: { title },
    content: `<select name="choice" autofocus>${list}</select>`,
    ok: { label, callback: (_event, button) => button.form.elements.choice.value },
    rejectClose: false,
  });
  return id || null;
}

/** A yes/no question; `html` is the message (escape anything from the user). */
export function confirm(title, html) {
  return DialogV2.confirm({ window: { title }, content: `<p>${html}</p>`, rejectClose: false });
}

export function esc(text) {
  return foundry.utils.escapeHTML(String(text ?? ""));
}
