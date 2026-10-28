// Espace mannequin : lecture des données d'un mannequin et petits calculs.
// Toutes les requêtes passent par la sécurité de la base (RLS) : un mannequin ne reçoit que SES données,
// un partenaire que ses mannequins et ses collaborations, quoi que demande ce code.
import { supabase } from "../supabase.js";

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// ---------- Réseaux, statistiques, calendrier, collaborations, partenaires ----------
export const RESEAUX = [
  { key: "instagram", label: "Instagram", color: "var(--warm-1)" },
  { key: "tiktok", label: "TikTok", color: "#d4a24c" },
  { key: "linkedin", label: "LinkedIn", color: "#9fb4c7" }
];
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
// Suivi d'une collaboration, de la recherche au paiement (les colonnes du suivi par mannequin).
export const COLLAB_STATUTS = [
  { key: "a_contacter", label: "À contacter" }, { key: "contacte", label: "Contactée" }, { key: "reponse", label: "Réponse reçue" },
  { key: "negociation", label: "Négociation" }, { key: "signe", label: "Signée" }, { key: "en_cours", label: "En cours" },
  { key: "publie", label: "Publiée" }, { key: "paye", label: "Payée" }, { key: "refuse", label: "Refusée" }
];
export const COLLAB_NATURES = [
  { key: "collab", label: "Collaboration" }, { key: "campagne", label: "Campagne" }, { key: "shooting", label: "Shooting" },
  { key: "evenement", label: "Événement" }, { key: "autre", label: "Autre" }
];
export const PARTNER_CATEGORIES = [
  { key: "marque", label: "Marque" }, { key: "photographe", label: "Photographe" }, { key: "monteur", label: "Monteur vidéo" },
  { key: "videaste", label: "Vidéaste" }, { key: "agence", label: "Agence" }, { key: "styliste", label: "Styliste" },
  { key: "maquilleur", label: "Maquilleur" }, { key: "autre", label: "Autre" }
];
export const PARTNER_STATUTS = [
  { key: "a_contacter", label: "À contacter" }, { key: "contacte", label: "Contacté" }, { key: "en_discussion", label: "En discussion" },
  { key: "actif", label: "Actif" }, { key: "inactif", label: "Inactif" }
];
const pick = (list, key) => (list.find((x) => x.key === key) || {}).label || key;
export const reseauLabel = (k) => pick(RESEAUX, k);
export const formatLabel = (k) => pick(POST_FORMATS, k);
export const statutLabel = (k) => pick(COLLAB_STATUTS, k);
export const natureLabel = (k) => pick(COLLAB_NATURES, k);
export const categorieLabel = (k) => pick(PARTNER_CATEGORIES, k);
export const partnerStatutLabel = (k) => pick(PARTNER_STATUTS, k);

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

// ---------- Dates ----------
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

// Variation en % entre deux mois (null si le mois précédent est inconnu ou nul).
export function variation(current, previous) {
  if (previous == null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

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

// ---------- Chargement ----------
const PARTNER_COLS = "id, nom, categorie, statut, contact_nom, email, telephone, instagram, site";

// Tout ce qu'il faut pour afficher l'espace d'un mannequin.
export async function loadEspaceData(businessId) {
  // Les tables « réseaux » et « partenaires » viennent de espace-reseaux.sql / partenaires.sql : absentes = listes vides.
  const optional = (q) => q.then((r) => (r.error ? [] : r.data || []), () => []);
  const [business, tasks, socialStats, posts, collabs, links] = await Promise.all([
    supabase.from("espace_businesses").select("*").eq("id", businessId).maybeSingle(),
    supabase.from("espace_tasks").select("id, titre, statut, mois").eq("business_id", businessId).gte("mois", currentMonthKey()),
    optional(supabase.from("espace_social_stats").select("mois, reseau, abonnes, vues, portee, interactions, publications").eq("business_id", businessId).order("mois", { ascending: false }).limit(72)),
    optional(supabase.from("espace_posts").select("id, date_prevue, reseau, format, titre, legende, visuel_url, statut").eq("business_id", businessId).order("date_prevue").limit(300)),
    optional(supabase.from("espace_collabs").select("id, marque, nature, statut, montant, date_prevue, notes, partner_id").eq("business_id", businessId).order("created_at", { ascending: false }).limit(200)),
    optional(supabase.from("espace_partner_links").select("partner_id").eq("business_id", businessId))
  ]);
  if (business.error || tasks.error) throw business.error || tasks.error;
  const ids = links.map((l) => l.partner_id);
  const partners = ids.length ? await optional(supabase.from("espace_partners").select(PARTNER_COLS).in("id", ids).order("nom")) : [];
  return { business: business.data, tasks: tasks.data || [], socialStats, posts, collabs, partners };
}
