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

// ---------- Exemples ----------
// 3 prospects d'exemple ajoutés une seule fois, à la première ouverture
// du CRM s'il est vide (supprimables comme n'importe quelle fiche).
function seededKey(userId) {
  return "zenoa-crm-exemples-" + userId;
}

let seeding = null;

export async function seedExamplesIfNeeded(userId, data) {
  if (data.prospects.length || data.projets.length || seeding) return false;
  try {
    if (localStorage.getItem(seededKey(userId))) return false;
  } catch { /* stockage indisponible : on ajoute quand même les exemples */ }
  seeding = insertExamples(userId).finally(() => { seeding = null; });
  await seeding;
  try { localStorage.setItem(seededKey(userId), "1"); } catch { /* idem */ }
  return true;
}

async function insertExamples(userId) {

  const examples = [
    {
      entreprise: "Le Petit Bistrot (exemple)", secteur: "Restaurant", ville: "Lyon", gerant: "Marc Dubois",
      telephone: "01 99 00 12 34", email: "contact@petit-bistrot.exemple.fr", site_actuel: "Vieux",
      note_google: 4.6, nb_avis: 212, source: "Google Maps", etape: "Intéressé",
      dernier_contact: addDays(-3), prochaine_relance: dateKey(), prix_creation: 900, abonnement_mensuel: 39,
      notes: "Besoin : menu en ligne + réservation. Objection : budget serré → proposer le paiement en 3 fois."
    },
    {
      entreprise: "Salon Élégance (exemple)", secteur: "Coiffeur/Beauté", ville: "Bordeaux", gerant: "Sophie Martin",
      telephone: "01 99 00 56 78", email: null, site_actuel: "Aucun",
      note_google: 4.8, nb_avis: 96, source: "Porte-à-porte", etape: "À contacter",
      dernier_contact: null, prochaine_relance: addDays(-2), prix_creation: 700, abonnement_mensuel: 29,
      notes: "Pas de site, seulement Instagram. Veut la prise de rendez-vous en ligne."
    },
    {
      entreprise: "Plomberie Garnier (exemple)", secteur: "Artisan", ville: "Nantes", gerant: "Julien Garnier",
      telephone: "01 99 00 90 12", email: "contact@plomberie-garnier.exemple.fr", site_actuel: "Vieux",
      note_google: 4.3, nb_avis: 58, source: "Recommandation", etape: "Gagné",
      dernier_contact: addDays(-5), prochaine_relance: addDays(7), prix_creation: 1200, abonnement_mensuel: 49,
      notes: "Recommandé par le Petit Bistrot. Veut un formulaire de devis et une page « urgences 24h/24 »."
    }
  ];

  const { data: inserted, error } = await supabase
    .from(PROSPECTS_TABLE)
    .insert(examples.map((e) => ({ ...e, user_id: userId, gagne_le: e.etape === "Gagné" ? dateKey() : null })))
    .select();
  if (error) throw error;

  const client = inserted.find((p) => p.etape === "Gagné");
  if (client) {
    await supabase.from(PROJETS_TABLE).insert({
      user_id: userId, prospect_id: client.id, statut: "En création", livraison_prevue: addDays(14),
      lien_site: null, hebergeur_domaine: "OVH — plomberie-garnier.fr", acompte_paye: true, solde_paye: false
    });
  }
}
