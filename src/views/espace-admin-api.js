// Appels à la fonction Supabase "espace-admin" (création et gestion des comptes
// clients). Elle utilise la clé secrète côté serveur et vérifie que l'appelant
// est l'admin : le navigateur n'a jamais cette clé.
import { supabase } from "../supabase.js";

export async function callAdmin(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke("espace-admin", { body: { action, ...payload } });
  if (error) {
    const status = error.context && error.context.status;
    if (status === 404) throw new Error("La fonction « espace-admin » n'est pas encore installée dans Supabase (voir les instructions).");
    let message = null;
    try { message = (await error.context.json()).error; } catch { /* corps non JSON */ }
    throw new Error(message || "Impossible de contacter le serveur. Réessaie dans un instant.");
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

// Prévient les pages déjà ouvertes (Aperçu client, Messages) qu'elles doivent se mettre à jour.
export function notifyEspaceChanged() {
  window.dispatchEvent(new CustomEvent("zenoa:espace-changed"));
}
