// Transforme un nom d'entreprise en slug d'URL (ex: "Chez Marco" -> "chez-marco").
export function slugify(name) {
  return (name || "entreprise")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // retire les accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "entreprise";
}

// Ajoute un court suffixe aléatoire pour garantir l'unicité du slug
// (deux prospects peuvent avoir le même nom).
export function uniqueSlug(name) {
  const base = slugify(name);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}
