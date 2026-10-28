// Équipe : liste des droits (modules et niveaux), accès aux rôles et aux membres.
import { supabase } from "../supabase.js";
import { callAdmin } from "./espace-admin-api.js";

export const MODULES = [
  { key: "dashboard", label: "Tableau de bord", hint: "Les ventes et le chiffre d'affaires" },
  { key: "prospection", label: "Offres", hint: "Voir et modifier les offres" },
  { key: "calendrier", label: "Calendrier", hint: "Rendez-vous et rappels des prospects et mannequins" },
  { key: "audits", label: "Audits", hint: "Créer, publier et suivre les audits" }
];
export const LEVELS = [
  { key: "view", label: "Voir" },
  { key: "edit", label: "Créer / modifier" },
  { key: "delete", label: "Supprimer" }
];
// Ce que seul l'admin peut faire (non délégable) : affiché dans l'éditeur de rôle pour que ce soit clair.
export const ADMIN_ONLY = ["Clients et Aperçu client", "Messages avec les clients", "Équipe : ajouter, exclure, changer les rôles", "Création et modification des rôles", "Journal de sécurité"];

export const emptyPerms = () => Object.fromEntries(MODULES.map((m) => [m.key, { view: false, edit: false, delete: false }]));
export function normalizePerms(p) {
  const out = emptyPerms();
  MODULES.forEach((m) => {
    const x = (p && p[m.key]) || {};
    const view = x.view === true;
    out[m.key] = { view, edit: view && x.edit === true, delete: view && x.delete === true };
  });
  return out;
}
export function summarize(perms) {
  const p = normalizePerms(perms);
  const seen = MODULES.filter((m) => p[m.key].view).length, edit = MODULES.filter((m) => p[m.key].edit).length;
  if (!seen) return "Aucun accès";
  return `${seen} page${seen > 1 ? "s" : ""} · modification sur ${edit}`;
}

async function run(q) { const { data, error } = await q; if (error) throw error; return data; }
export const listRoles = () => run(supabase.from("team_roles").select("id,nom,perms,created_at").order("created_at"));
export const listMemberRoleIds = () => run(supabase.from("team_members").select("user_id,role_id"));
export const saveRole = (values, id) => id
  ? run(supabase.from("team_roles").update(values).eq("id", id).select().single())
  : run(supabase.from("team_roles").insert(values).select().single());
export const deleteRole = (id) => run(supabase.from("team_roles").delete().eq("id", id));
export const setMemberRole = (userId, roleId) => run(supabase.from("team_members").update({ role_id: roleId || null }).eq("user_id", userId).select());
export const loadTeam = () => callAdmin("team_list");
export const createMember = (values) => callAdmin("team_create", values);
export const removeMember = (userId) => callAdmin("team_remove", { user_id: userId });
export const resetMemberPassword = (userId) => callAdmin("team_reset_password", { user_id: userId });

export const MISSING_MESSAGE = "L'équipe n'est pas encore installée : colle equipe.sql dans Supabase (SQL Editor > Run), puis recharge la page.";
export const isMissing = (err) => !!err && (/team_roles|team_members|schema cache|equipe\.sql|42P01|PGRST205/i.test(`${err.code || ""} ${err.message || ""}`));

// « En ligne » si vu il y a moins de 2 minutes et demie ; sinon « Vu il y a … ».
export const ONLINE_MS = 150000;
export function lastActivity(iso) {
  if (!iso) return { online: false, text: "Jamais connecté" };
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < ONLINE_MS) return { online: true, text: "En ligne" };
  const min = Math.round(ms / 60000);
  if (min < 60) return { online: false, text: `Vu il y a ${min} min` };
  const h = Math.round(min / 60);
  if (h < 24) return { online: false, text: `Vu il y a ${h} h` };
  const d = new Date(iso), hhmm = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const days = Math.floor(h / 24);
  return { online: false, text: days === 1 ? `Vu hier à ${hhmm}` : `Vu le ${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} à ${hhmm}` };
}
export const latest = (...dates) => dates.filter(Boolean).sort().pop() || null;
