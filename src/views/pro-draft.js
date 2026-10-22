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
  return wrapped;
}
