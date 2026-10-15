// Mode sombre pour la zone de contenu principale (.main) — préférence
// propre à cet appareil, stockée en local (pas besoin de la
// synchroniser entre appareils pour un simple réglage d'affichage).
const STORAGE_KEY = "zenoa-theme";

export function getTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function setTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // stockage indisponible (navigation privée...) : le réglage ne
    // persistera pas d'une session à l'autre, mais n'empêche pas
    // l'appli de fonctionner.
  }
  applyTheme();
}

export function applyTheme() {
  const app = document.getElementById("app");
  if (!app) return;
  if (getTheme() === "dark") app.dataset.theme = "dark";
  else delete app.dataset.theme;
}
