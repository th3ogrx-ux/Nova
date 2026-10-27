// Espace clients : lecture des données d'un commerce et petits calculs.
// Toutes les requêtes passent par la sécurité de la base (RLS, espace.sql) :
// un client ne reçoit que SON commerce, quoi que demande ce code.
import { supabase } from "../supabase.js";

// Chiffres que l'admin peut choisir d'afficher pour un client (ex. un électricien
// n'a pas besoin des "Itinéraires"). Par défaut : tous.
export const METRICS = [
  { key: "appels", label: "Appels" },
  { key: "itineraires", label: "Itinéraires" },
  { key: "vues_fiche", label: "Vues de la fiche" },
  { key: "visites_site", label: "Visites du site" }
];

// ---------- Types de clients, réseaux et parties de l'espace ----------
export const TYPES = [
  { key: "marque", label: "Marque" },
  { key: "mannequin", label: "Mannequin" },
  { key: "createur", label: "Créateur de contenu" },
  { key: "local", label: "Commerce local (Google)" },
  { key: "autre", label: "Autre" }
];
export const RESEAUX = [
  { key: "instagram", label: "Instagram", color: "var(--warm-1)" },
  { key: "tiktok", label: "TikTok", color: "#d4a24c" },
  { key: "linkedin", label: "LinkedIn", color: "#9fb4c7" }
];
export const SECTIONS = [
  { key: "reseaux", label: "Statistiques des réseaux (abonnés, vues, engagement)" },
  { key: "calendrier", label: "Calendrier de contenu" },
  { key: "collabs", label: "Campagnes et collaborations" },
  { key: "chiffres", label: "Chiffres Google (appels, itinéraires…)" },
  { key: "avis", label: "Avis Google" }
];
// Réglages proposés à la création selon le type de client.
export const TYPE_DEFAULTS = {
  marque: { sections: ["reseaux", "calendrier", "collabs"], reseaux: ["instagram", "tiktok", "linkedin"] },
  mannequin: { sections: ["reseaux", "calendrier", "collabs"], reseaux: ["instagram", "tiktok"] },
  createur: { sections: ["reseaux", "calendrier", "collabs"], reseaux: ["instagram", "tiktok"] },
  autre: { sections: ["reseaux", "calendrier"], reseaux: ["instagram"] },
  local: { sections: ["chiffres", "avis"], reseaux: [] }
};
export const SOCIAL_FIELDS = [
  { key: "abonnes", label: "Abonnés (total en fin de mois)" },
  { key: "vues", label: "Vues" },
  { key: "portee", label: "Portée (comptes touchés)" },
  { key: "interactions", label: "Interactions (likes, commentaires, partages)" },
  { key: "publications", label: "Publications" }
];
export const POST_FORMATS = [
  { key: "post", label: "Post" }, { key: "reel", label: "Reel" }, { key: "story", label: "Story" },
  { key: "video", label: "Vidéo" }, { key: "carrousel", label: "Carrousel" }, { key: "article", label: "Article" }
];
export const COLLAB_STATUTS = [
  { key: "negociation", label: "Négociation" }, { key: "signe", label: "Signé" }, { key: "en_cours", label: "En cours" },
  { key: "publie", label: "Publié" }, { key: "paye", label: "Payé" }
];
export const COLLAB_NATURES = [
  { key: "collab", label: "Collaboration" }, { key: "campagne", label: "Campagne" }, { key: "shooting", label: "Shooting" },
  { key: "evenement", label: "Événement" }, { key: "autre", label: "Autre" }
];
const pick = (list, key) => (list.find((x) => x.key === key) || {}).label || key;
export const typeLabel = (k) => pick(TYPES, k);
export const reseauLabel = (k) => pick(RESEAUX, k);
export const formatLabel = (k) => pick(POST_FORMATS, k);
export const statutLabel = (k) => pick(COLLAB_STATUTS, k);
export const natureLabel = (k) => pick(COLLAB_NATURES, k);

// Les clients créés avant les réseaux sociaux gardent leur espace Google tel quel.
export function sectionsOf(business) {
  const all = SECTIONS.map((s) => s.key);
  const chosen = business && Array.isArray(business.sections) ? business.sections.filter((k) => all.includes(k)) : null;
  return chosen || ["chiffres", "avis"];
}
export function reseauxOf(business) {
  const all = RESEAUX.map((r) => r.key);
  return business && Array.isArray(business.reseaux) ? business.reseaux.filter((k) => all.includes(k)) : [];
}
// Taux d'engagement en % : interactions ÷ portée (sinon ÷ vues). null si on ne peut pas le calculer.
export function engagementRate(row) {
  if (!row) return null;
  const base = row.portee || row.vues;
  return base ? Math.round(((row.interactions || 0) / base) * 1000) / 10 : null;
}
export const formatEuro = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n) || 0);

export function enabledMetrics(business) {
  const all = METRICS.map((m) => m.key);
  const chosen = business && Array.isArray(business.metriques) ? business.metriques.filter((k) => all.includes(k)) : [];
  return chosen.length ? chosen : all;
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// "2026-09-01" -> Date locale du 1er septembre (évite le décalage de fuseau).
export function monthDate(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

export function monthLabel(key) {
  const label = monthDate(key).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function currentMonthKey() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-01";
}

export function formatDate(key) {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

export const formatNumber = (n) => new Intl.NumberFormat("fr-FR").format(n);
export const formatRating = (n) => n.toFixed(1).replace(".", ",");

// Variation en % entre deux mois (null si le mois précédent est inconnu ou nul).
export function variation(current, previous) {
  if (previous == null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// Charge tout ce qu'il faut pour afficher le tableau de bord d'un commerce.
export async function loadEspaceData(businessId) {
  // Les nouvelles tables (réseaux, calendrier, collaborations) viennent de espace-reseaux.sql : absentes = listes vides.
  const optional = (q) => q.then((r) => (r.error ? [] : r.data || []), () => []);
  const [business, stats, reviews, tasks, socialStats, posts, collabs] = await Promise.all([
    supabase.from("espace_businesses").select("*").eq("id", businessId).maybeSingle(), // "*" : fonctionne aussi avant l'ajout de la colonne "metriques"
    supabase.from("espace_monthly_stats").select("mois, appels, itineraires, vues_fiche, visites_site").eq("business_id", businessId).order("mois", { ascending: false }).limit(12),
    supabase.from("espace_reviews").select("id, auteur, note, texte, date, repondu, reponse").eq("business_id", businessId).order("date", { ascending: false }),
    supabase.from("espace_tasks").select("id, titre, statut, mois").eq("business_id", businessId).gte("mois", currentMonthKey()),
    optional(supabase.from("espace_social_stats").select("mois, reseau, abonnes, vues, portee, interactions, publications").eq("business_id", businessId).order("mois", { ascending: false }).limit(72)),
    optional(supabase.from("espace_posts").select("id, date_prevue, reseau, format, titre, legende, visuel_url, statut").eq("business_id", businessId).order("date_prevue").limit(300)),
    optional(supabase.from("espace_collabs").select("id, marque, nature, statut, montant, date_prevue, notes").eq("business_id", businessId).order("created_at", { ascending: false }).limit(200))
  ]);
  const error = business.error || stats.error || reviews.error || tasks.error;
  if (error) throw error;
  return {
    business: business.data,
    stats: stats.data || [],
    reviews: reviews.data || [],
    tasks: tasks.data || [],
    socialStats, posts, collabs
  };
}

// Synthèse : note moyenne, chiffres du dernier mois saisi et variation vs le mois d'avant.
export function summarize(data) {
  const { reviews, stats } = data;
  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.note, 0) / reviews.length : null;
  const latest = stats[0] || null;
  const previous = stats[1] || null;
  const toAnswer = reviews.filter((r) => !r.repondu);
  return { average, count: reviews.length, latest, previous, toAnswerCount: toAnswer.length };
}

// ---------- Séries pour les graphiques ----------
const monthKeyOf = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-01";

export function shortMonth(key) {
  const label = monthDate(key).toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Les `count` derniers mois, du plus ancien au mois en cours.
export function lastMonthKeys(count) {
  const now = new Date();
  const keys = [];
  for (let i = count - 1; i >= 0; i--) keys.push(monthKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  return keys;
}

// Avis reçus dans chaque mois + note moyenne CUMULÉE à la fin du mois
// (celle que voit le public sur Google) ; null tant qu'il n'y a aucun avis.
export function reviewSeries(reviews, count) {
  return lastMonthKeys(count).map((mois) => {
    const [y, m] = mois.split("-").map(Number);
    const monthEnd = monthKeyOf(new Date(y, m, 1)); // 1er du mois suivant
    const upTo = reviews.filter((r) => r.date < monthEnd);
    const inMonth = reviews.filter((r) => r.date >= mois && r.date < monthEnd);
    return {
      mois,
      count: inMonth.length,
      average: upTo.length ? upTo.reduce((s, r) => s + r.note, 0) / upTo.length : null
    };
  });
}

// Chiffres mensuels saisis, du plus ancien au plus récent, limités aux `count` derniers.
export function statSeries(stats, count) {
  return stats.slice().sort((a, b) => a.mois.localeCompare(b.mois)).slice(-count);
}
