// Brouillons : ce que tu tapes dans une longue fenêtre est gardé automatiquement sur cet appareil,
// pour ne rien perdre si la page se recharge (iPhone qui libère la mémoire, changement d'appli, fermeture par erreur…).
const PREFIX = "zenoa-pro-draft:";

export function draftGet(key) {
  try { const raw = localStorage.getItem(PREFIX + key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function draftSet(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* stockage plein : pas grave */ }
}
export function draftClear(key) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* pas grave */ }
}
// Appelle fn au plus une fois par `wait` ms, après la dernière frappe.
export function debounce(fn, wait = 300) {
  let t;
  const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  wrapped.flush = (...args) => { clearTimeout(t); fn(...args); };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

// Brouillon automatique d'un formulaire simple : champs [name] et cases [data-canal].
// Rend { restored, clear }. Si un brouillon existe, il est remis dans les champs et un bandeau le signale.
export function bindFormDraft(form, key, { onReset } = {}) {
  const read = () => {
    const v = {};
    form.querySelectorAll("[name]").forEach((el) => { v[el.name] = el.type === "checkbox" ? el.checked : el.value; });
    v.__canaux = [...form.querySelectorAll("[data-canal]:checked")].map((c) => c.dataset.canal);
    return v;
  };
  const draft = draftGet(key);
  if (draft) {
    form.querySelectorAll("[name]").forEach((el) => {
      if (!(el.name in draft)) return;
      if (el.type === "checkbox") el.checked = !!draft[el.name]; else el.value = draft[el.name];
    });
    if (Array.isArray(draft.__canaux)) form.querySelectorAll("[data-canal]").forEach((c) => { c.checked = draft.__canaux.includes(c.dataset.canal); });
    const note = document.createElement("div");
    note.className = "pro-draft-note";
    note.setAttribute("role", "status");
    note.innerHTML = `<span>Brouillon retrouvé : ton texte non enregistré a été restauré.</span><button type="button" class="btn ghost btn-sm">Repartir de zéro</button>`;
    note.querySelector("button").addEventListener("click", () => { draftClear(key); onReset && onReset(); });
    form.prepend(note);
  }
  const save = debounce(() => draftSet(key, read()), 400);
  form.addEventListener("input", save);
  form.addEventListener("change", save);
  return { restored: !!draft, clear: () => { save.cancel && save.cancel(); draftClear(key); } };
}
