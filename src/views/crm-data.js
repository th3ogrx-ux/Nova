// CRM – Agence Web : listes de valeurs, petits utilitaires et accès aux
// tables crm_agence_prospects / crm_agence_projets (voir crm-agence.sql).
import { supabase } from "../supabase.js";

export const SECTEURS = ["Restaurant", "Coiffeur/Beauté", "Artisan", "Commerce", "Santé", "Autre"];
export const SITES = ["Aucun", "Vieux", "Correct"];
export const SOURCES = ["Google Maps", "Porte-à-porte", "Téléphone", "Email", "Recommandation", "Réseaux sociaux"];
export const ETAPES = ["À contacter", "Contacté", "Intéressé", "Rendez-vous", "Maquette envoyée", "Devis envoyé", "Gagné", "Perdu"];
export const STATUTS = ["Attente contenu", "En création", "En validation", "En ligne"];

// Couleur de chaque étape (pastille du pipeline, du tableau, du tableau de bord).
export const ETAPE_COLORS = {
  "À contacter": "#8e86a3",
  "Contacté": "var(--warning)",
  "Intéressé": "var(--accent-blue-2)",
  "Rendez-vous": "var(--warm-1)",
  "Maquette envoyée": "#a78bfa",
  "Devis envoyé": "#e0a43a",
  "Gagné": "var(--ok)",
  "Perdu": "var(--danger)"
};

export const STATUT_PILLS = {
  "Attente contenu": "neutral",
  "En création": "warning",
  "En validation": "blue",
  "En ligne": "ok"
};

export const PROSPECTS_TABLE = "crm_agence_prospects";
export const PROJETS_TABLE = "crm_agence_projets";

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

export function dateKey(d = new Date()) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

export function shortDate(key) {
  if (!key) return "";
  const [year, month, day] = key.split("-");
  return `${day}/${month}/${year}`;
}

const eurosShort = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eurosWithCents = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

// "1 700 €" pour un montant rond, "799,90 €" seulement s'il y a des centimes.
export function formatEuros(value) {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  return Number.isInteger(rounded) ? eurosShort.format(rounded) : eurosWithCents.format(rounded);
}

export function normalize(str) {
  return (str || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Relance à faire : date de prochaine relance aujourd'hui ou dépassée.
export function isRelanceDue(prospect, today = dateKey()) {
  return !!prospect.prochaine_relance && prospect.prochaine_relance <= today;
}

export function isMissingTable(error) {
  return /crm_agence|schema cache|does not exist/i.test((error && error.message) || "");
}

export const MISSING_TABLE_MESSAGE = "La page CRM n'est pas encore installée : colle le fichier crm-agence.sql dans Supabase (SQL Editor > Run), puis recharge la page.";

export async function loadCrm(userId) {
  const [prospectsRes, projetsRes] = await Promise.all([
    supabase.from(PROSPECTS_TABLE).select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from(PROJETS_TABLE).select("*").eq("user_id", userId).order("created_at", { ascending: false })
  ]);
  const error = prospectsRes.error || projetsRes.error;
  if (error) throw error;
  return { prospects: prospectsRes.data || [], projets: projetsRes.data || [] };
}

// Enregistre une fiche prospect (création si pas d'id). Au passage en
// "Gagné", note la date du jour (compteur "gagnés ce mois-ci") et crée
// le projet du client s'il n'en a pas encore.
export async function saveProspect(userId, values, previous = null) {
  const row = { ...values, updated_at: new Date().toISOString() };
  if (row.etape === "Gagné") {
    row.gagne_le = previous && previous.etape === "Gagné" && previous.gagne_le ? previous.gagne_le : dateKey();
  } else {
    row.gagne_le = null;
  }

  const query = previous
    ? supabase.from(PROSPECTS_TABLE).update(row).eq("id", previous.id).select().single()
    : supabase.from(PROSPECTS_TABLE).insert({ ...row, user_id: userId }).select().single();
  const { data, error } = await query;
  if (error) throw error;

  if (data.etape === "Gagné" && (!previous || previous.etape !== "Gagné")) {
    const { count } = await supabase.from(PROJETS_TABLE).select("id", { count: "exact", head: true }).eq("prospect_id", data.id);
    if (!count) await supabase.from(PROJETS_TABLE).insert({ user_id: userId, prospect_id: data.id });
  }
  return data;
}
