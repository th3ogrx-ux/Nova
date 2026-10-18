// Dernières données affichées par chaque page, gardées dans le navigateur :
// à l'ouverture du site, les pages s'affichent tout de suite avec, puis se
// mettent à jour dès que Supabase répond. Effacé à la déconnexion.
const PREFIX = "zenoa-cache:";

export function readCache(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeCache(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch { /* stockage plein ou indisponible : pas grave */ }
}

export function sameData(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function clearCache() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch { /* idem */ }
}
