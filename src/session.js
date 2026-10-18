// Utilisateur connecté, connu dès l'ouverture de l'appli (main.js) : les
// pages n'ont pas à le redemander au serveur à chaque fois (une demande
// réseau par page, et elles passaient l'une après l'autre).
import { supabase } from "./supabase.js";

let current = null;

export function setCurrentUser(user) {
  current = user || null;
}

export async function getCurrentUser() {
  if (current) return current;
  const { data } = await supabase.auth.getSession();
  return data.session ? data.session.user : null;
}
