// Utilisateur connecté et son rôle, connus dès l'ouverture de l'appli
// (main.js) : les pages n'ont pas à les redemander au serveur à chaque fois.
//
// Rôles :
//   "admin"  : toi (désigné dans espace.sql) — Radar, CRM, Ressources + gestion des clients
//   "client" : un client de l'espace — uniquement son espace (voir src/views/espace.js)
//   "none"   : compte SANS profil (client supprimé, inscription inconnue...) — aucun accès
//   "radar"  : uniquement tant que l'espace clients n'est pas installé (espace.sql pas encore collé) : l'appli comme avant
import { supabase } from "./supabase.js";
import { readCache, writeCache } from "./data-cache.js";

let current = null;
let currentRole = "radar";
let currentBusinessId = null;

export function setCurrentUser(user) {
  current = user || null;
  if (!user) {
    currentRole = "radar";
    currentBusinessId = null;
  }
}

export async function getCurrentUser() {
  if (current) return current;
  const { data } = await supabase.auth.getSession();
  return data.session ? data.session.user : null;
}

export const getCurrentRole = () => currentRole;
export const getCurrentBusinessId = () => currentBusinessId;
export const isClient = () => currentRole === "client";

function applyRole(role, businessId) {
  currentRole = role;
  currentBusinessId = businessId || null;
}

// Cherche le rôle dans espace_profiles (la base ne renvoie que SA propre ligne).
// - table absente (espace.sql pas encore collé) : utilisateur Radar normal
// - erreur réseau : on se sert du dernier rôle connu ; sinon on refuse d'avancer
//   (un client ne doit jamais voir l'interface Radar, même une seconde).
// Renvoie { ok: true } ou { ok: false, message }.
export async function loadRole(userId) {
  const cacheKey = "role:" + userId;
  const { data, error } = await supabase.from("espace_profiles").select("role, business_id").eq("id", userId).maybeSingle();
  if (!error) {
    const role = data ? data.role : "none"; // pas de profil = pas d'accès (jamais l'appli Radar par défaut)
    applyRole(role, data && data.business_id);
    writeCache(cacheKey, { role, businessId: data && data.business_id });
    return { ok: true };
  }
  if (/espace_profiles|schema cache|does not exist|42P01|PGRST205/i.test(`${error.code || ""} ${error.message || ""}`)) {
    applyRole("radar", null);
    return { ok: true };
  }
  const cached = readCache(cacheKey);
  if (cached) {
    applyRole(cached.role, cached.businessId);
    return { ok: true };
  }
  return { ok: false, message: "Impossible de vérifier ton accès pour le moment. Vérifie ta connexion et réessaie." };
}
