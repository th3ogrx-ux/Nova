// Rappel "prochaine mise à jour des chiffres" d'un client : calcul de l'urgence
// à partir d'une date AAAA-MM-JJ. Aucune dépendance (testé séparément).
const DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");

export const dateKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parse(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Nombre de jours entre aujourd'hui et la date (négatif = en retard).
export function daysUntil(key, today = new Date()) {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((parse(key) - t0) / DAY);
}

// state : none (pas de date) | late (dépassée) | today | soon (dans 1 à 3 jours) | later
// `urgent` : à traiter bientôt (dépassée, aujourd'hui ou dans 3 jours au plus) -> couleur vive.
export function dueInfo(key, today = new Date()) {
  if (!key) return { state: "none", urgent: false, days: null };
  const days = daysUntil(key, today);
  if (days < 0) return { state: "late", urgent: true, days };
  if (days === 0) return { state: "today", urgent: true, days };
  if (days <= 3) return { state: "soon", urgent: true, days };
  return { state: "later", urgent: false, days };
}

// +1 mois en gardant le même jour (31 janvier -> 28 février, pas 3 mars).
export function addOneMonth(key) {
  const d = parse(key);
  const target = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return dateKeyOf(target);
}
