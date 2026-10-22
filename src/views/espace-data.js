// Espace clients : lecture des données d'un commerce et petits calculs.
// Toutes les requêtes passent par la sécurité de la base (RLS, espace.sql) :
// un client ne reçoit que SON commerce, quoi que demande ce code.
import { supabase } from "../supabase.js";

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
  const [business, stats, reviews, tasks] = await Promise.all([
    supabase.from("espace_businesses").select("id, nom, secteur, ville, lien_avis_google").eq("id", businessId).maybeSingle(),
    supabase.from("espace_monthly_stats").select("mois, appels, itineraires, vues_fiche, visites_site").eq("business_id", businessId).order("mois", { ascending: false }).limit(12),
    supabase.from("espace_reviews").select("id, auteur, note, texte, date, repondu, reponse").eq("business_id", businessId).order("date", { ascending: false }),
    supabase.from("espace_tasks").select("id, titre, statut, mois").eq("business_id", businessId).gte("mois", currentMonthKey())
  ]);
  const error = business.error || stats.error || reviews.error || tasks.error;
  if (error) throw error;
  return {
    business: business.data,
    stats: stats.data || [],
    reviews: reviews.data || [],
    tasks: tasks.data || []
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
