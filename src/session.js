// Utilisateur connecté et son rôle, connus dès l'ouverture de l'appli
// (main.js) : les pages n'ont pas à les redemander au serveur à chaque fois.
//
// Rôles :
//   "admin"  : toi (désigné dans espace.sql) — Radar, Prospection + gestion des clients
//   "client" : un client de l'espace — uniquement son espace (voir src/views/espace.js)
//   "team"   : membre de l'équipe (créé par l'admin) : il travaille sur les données de l'admin, selon les cases cochées dans son rôle
//   "partner": partenaire (marque, photographe, monteur…) avec un compte : voit seulement ses mannequins et ses collaborations
//   "none"   : compte SANS profil (client supprimé, inscription inconnue...) — aucun accès
//   "radar"  : uniquement tant que l'espace clients n'est pas installé (espace.sql pas encore collé) : l'appli comme avant
import { supabase } from "./supabase.js";
import { readCache, writeCache } from "./data-cache.js";

let current = null;
let currentRole = "radar";
let currentBusinessId = null;
let currentPerms = {};     // droits d'un membre : { radar: { view, edit, delete }, ... }
let currentOwnerId = null; // propriétaire des données partagées (l'admin)
let currentRoleName = null;
let currentPartner = null; // { id, nom } pour un partenaire

export function setCurrentUser(user) {
  current = user || null;
  if (!user) {
    currentRole = "radar";
    currentBusinessId = null;
    currentPerms = {}; currentOwnerId = null; currentRoleName = null; currentPartner = null;
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
export const isTeam = () => currentRole === "team";
export const isPartner = () => currentRole === "partner";
export const getPartner = () => currentPartner;
export const getRoleName = () => currentRoleName;

// Vrai si la personne a le droit (module : radar, prospection, calendrier, audits, dashboard ; niveau : view, edit, delete).
// L'admin a tous les droits ; un membre doit avoir « voir » coché en plus du niveau demandé.
export function can(module, level = "view") {
  if (currentRole === "admin" || currentRole === "radar") return true;
  if (currentRole !== "team") return false;
  const p = currentPerms[module];
  return !!(p && p.view && p[level]);
}
// À qui appartiennent les données : à soi (admin) ou à l'admin (membre de l'équipe).
export function getDataOwnerId() {
  return currentRole === "team" && currentOwnerId ? currentOwnerId : (current && current.id) || null;
}

function applyRole(role, businessId, extra = {}) {
  currentRole = role;
  currentBusinessId = businessId || null;
  currentPerms = extra.perms || {};
  currentOwnerId = extra.ownerId || null;
  currentRoleName = extra.roleName || null;
  currentPartner = extra.partner || null;
}

// Partenaire avec compte ? (la base ne renvoie que SA propre fiche)
async function loadPartnerRole() {
  const { data, error } = await supabase.from("espace_partners").select("id, nom").limit(1);
  if (error || !data || !data.length) return null;
  return { partner: { id: data[0].id, nom: data[0].nom } };
}

// Membre de l'équipe ? (comptes créés par l'admin : pas de profil espace, mais une ligne dans team_members)
async function loadTeamRole() {
  const [perms, owner, mine] = await Promise.all([
    supabase.rpc("my_perms"), supabase.rpc("team_owner"),
    supabase.from("team_roles").select("nom").limit(1)
  ]);
  if (perms.error || perms.data === null || perms.data === undefined) return null;
  return { perms: perms.data, ownerId: owner.data || null, roleName: (Array.isArray(mine.data) ? mine.data[0] : mine.data)?.nom || null };
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
    if (!data) {
      // Pas de profil espace : peut-être un membre de l'équipe (sinon : aucun accès, jamais l'appli Radar par défaut).
      let team = null;
      try { team = await loadTeamRole(); } catch { team = null; }
      if (team) {
        applyRole("team", null, team);
        writeCache(cacheKey, { role: "team", businessId: null, ...team });
        return { ok: true };
      }
      let partner = null;
      try { partner = await loadPartnerRole(); } catch { partner = null; }
      if (partner) {
        applyRole("partner", null, partner);
        writeCache(cacheKey, { role: "partner", businessId: null, ...partner });
        return { ok: true };
      }
      applyRole("none", null);
      writeCache(cacheKey, { role: "none", businessId: null });
      return { ok: true };
    }
    applyRole(data.role, data.business_id);
    writeCache(cacheKey, { role: data.role, businessId: data.business_id });
    return { ok: true };
  }
  if (/espace_profiles|schema cache|does not exist|42P01|PGRST205/i.test(`${error.code || ""} ${error.message || ""}`)) {
    applyRole("radar", null);
    return { ok: true };
  }
  const cached = readCache(cacheKey);
  if (cached) {
    applyRole(cached.role, cached.businessId, cached);
    return { ok: true };
  }
  return { ok: false, message: "Impossible de vérifier ton accès pour le moment. Vérifie ta connexion et réessaie." };
}
