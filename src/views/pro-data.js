// Module Prospection : listes de valeurs, accès aux tables pro_* (voir prospection.sql)
// et tous les calculs (semaines, taux, tendances) utilisés par les écrans.
import { supabase } from "../supabase.js";

export const CANAUX = {
  instagram:   { label: "Instagram", icon: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".9" fill="currentColor"/>' },
  email:       { label: "E-mail", icon: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>' },
  telephone:   { label: "Téléphone", icon: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>' },
  linkedin:    { label: "LinkedIn", icon: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-7M12 13a3 3 0 0 1 6 0v4"/>' },
  terrain:     { label: "Terrain", icon: '<path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>' },
  google_maps: { label: "Google Maps", icon: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>' },
  tiktok:      { label: "TikTok", icon: '<path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 4c.4 2.4 1.9 4 4.5 4.2"/>' },
  facebook:    { label: "Facebook", icon: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8.5A.5.5 0 0 1 14 8z"/>' },
  whatsapp:    { label: "WhatsApp", icon: '<path d="M4 20l1.3-4.2A8 8 0 1 1 8.3 18.8L4 20z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-.8.8a4 4 0 0 1-1.8-1.8l.8-.8-1-2z"/>' },
  sms:         { label: "SMS", icon: '<rect x="3" y="4" width="18" height="13" rx="3"/><path d="M8 21l3-4"/><path d="M8 10h8M8 13h5"/>' },
  autre:       { label: "Autre", icon: '<circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/>' }
};

export const STATUTS = [
  { key: "a_tester", label: "À tester", color: "var(--light-text-dim)" },
  { key: "en_cours", label: "En cours", color: "var(--warning)" },
  { key: "validee", label: "Validée", color: "var(--ok)" },
  { key: "abandonnee", label: "Abandonnée", color: "var(--danger)" }
];
export const ETAPES = [
  { key: "contacte", label: "Contacté", color: "var(--light-text-dim)" },
  { key: "repondu", label: "A répondu", color: "var(--gold)" },
  { key: "interesse", label: "Intéressé", color: "var(--warning)" },
  { key: "audit", label: "Audit envoyé", color: "var(--warm-2)" },
  { key: "signe", label: "Signé", color: "var(--ok)" }
];
// Calendrier de contenu : les 3 types de vidéo et leur avancement.
export const VIDEO_TYPES = [
  { key: "viral", label: "Viral", color: "var(--warm-1)", hint: "Pour toucher un maximum de monde" },
  { key: "valeur", label: "Valeur", color: "var(--gold)", hint: "Pour apprendre quelque chose, aider" },
  { key: "perso", label: "Contenu perso", color: "var(--ok)", hint: "Pour créer du lien : coulisses, histoire, vécu" }
];
export const VIDEO_STATUTS = [
  { key: "a_tourner", label: "À tourner" },
  { key: "tourne", label: "Tournée" },
  { key: "publie", label: "Publiée" }
];
export const videoType = (key) => VIDEO_TYPES.find((t) => t.key === key) || VIDEO_TYPES[1];
export const nextVideoStatut = (key) => VIDEO_STATUTS[(VIDEO_STATUTS.findIndex((s) => s.key === key) + 1) % VIDEO_STATUTS.length].key;

export const statutOf = (key) => STATUTS.find((s) => s.key === key) || STATUTS[0];

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML.replace(/"/g, "&quot;");
}

export const reducedMotion = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
export const fmtInt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(n || 0));
export const fmtEuro = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
export const fmtPct = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d).replace(".", ",") : "0") + " %";

// Canaux d'une stratégie : la liste « canaux », ou à défaut l'ancien canal unique.
export const canauxOf = (s) => {
  const list = (Array.isArray(s && s.canaux) ? s.canaux : []).filter((k) => CANAUX[k]);
  return list.length ? list : [(s && CANAUX[s.canal] ? s.canal : "autre")];
};
export const canauxLabel = (s) => canauxOf(s).map((k) => CANAUX[k].label).join(", ");
export const canauxIcons = (s, size = 14) => `<span class="pro-icons" title="${escapeHtml(canauxLabel(s))}">${canauxOf(s).map((k) => canalIcon(k, size)).join("")}</span>`;
export function canauxChips(s, { max = 2 } = {}) {
  const list = canauxOf(s), shown = list.slice(0, max), more = list.length - shown.length;
  return shown.map((k) => `<span class="pro-chip">${canalIcon(k)} ${escapeHtml(CANAUX[k].label)}</span>`).join("") + (more > 0 ? `<span class="pro-chip" title="${escapeHtml(canauxLabel(s))}">+${more}</span>` : "");
}

export function canalIcon(key, size = 16) {
  const c = CANAUX[key] || CANAUX.autre;
  return `<svg class="pro-ico" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${c.icon}</svg>`;
}

// ---------- Dates (semaines du lundi au dimanche, heure locale) ----------
export const dateKey = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
export const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
export function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
export function mondayOf(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
export const weekKey = (date) => dateKey(mondayOf(date));
const SHORT_DAY = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
export const shortDay = (date) => SHORT_DAY.format(date).replace(".", "");
export function weekLabel(mondayKey) {
  const m = parseKey(mondayKey);
  return shortDay(m) + " – " + shortDay(addDays(m, 6));
}

// ---------- Chargement ----------
export const isMissingTable = (error) => /pro_(strategies|logs|scripts|prospects|offers|reviews|settings|videos)|schema cache|does not exist/i.test((error && error.message) || "");
export const MISSING_MESSAGE = "Le module Prospection n'est pas encore installé : colle le fichier prospection.sql dans Supabase (SQL Editor > Run), puis recharge la page.";

export async function loadAll() {
  const since = dateKey(addDays(new Date(), -7 * 30)); // 30 semaines d'historique
  const q = (t) => supabase.from(t).select("*");
  const [strategies, scripts, logs, prospects, offers, reviews, settings, videos] = await Promise.all([
    q("pro_strategies").order("position").order("created_at"),
    q("pro_scripts").order("version"),
    q("pro_logs").gte("jour", since).order("jour", { ascending: false }).order("created_at", { ascending: false }).limit(5000),
    q("pro_prospects").order("position").order("created_at", { ascending: false }),
    q("pro_offers").order("position").order("prix"),
    q("pro_reviews").order("semaine", { ascending: false }).limit(60),
    q("pro_settings").maybeSingle(),
    q("pro_videos").order("jour").order("created_at").limit(3000)
  ]);
  const failed = [strategies, scripts, logs, prospects, offers, reviews, settings].find((r) => r.error);
  if (failed) throw failed.error;
  return {
    strategies: strategies.data || [], scripts: scripts.data || [], logs: logs.data || [],
    prospects: prospects.data || [], offers: offers.data || [], reviews: reviews.data || [],
    // La table des vidéos est récente : si le SQL n'est pas encore collé, le reste de la prospection continue de marcher.
    videos: videos.error ? [] : videos.data || [],
    videosMissing: !!videos.error,
    objectif: (settings.data && settings.data.objectif_hebdo) || 50
  };
}

// ---------- Calculs ----------
const ZERO = () => ({ envoyes: 0, reponses: 0, interesses: 0, audits: 0, clients: 0 });
export function sum(logs) {
  const t = ZERO();
  for (const l of logs) for (const k in t) t[k] += l[k] || 0;
  return t;
}
export const rate = (num, den) => (den > 0 ? (num / den) * 100 : 0);
export const inRange = (logs, fromKey, toKey) => logs.filter((l) => l.jour >= fromKey && l.jour <= toKey);

// Totaux semaine par semaine, des plus anciennes aux plus récentes (la dernière = semaine en cours).
export function weeklySeries(logs, count, endMonday = mondayOf()) {
  const weeks = [];
  for (let i = count - 1; i >= 0; i--) weeks.push(addDays(endMonday, -7 * i));
  return weeks.map((m) => {
    const from = dateKey(m), to = dateKey(addDays(m, 6));
    return { monday: from, ...sum(inRange(logs, from, to)) };
  });
}

// delta en % (null si pas de base de comparaison)
export function variation(current, previous) {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function dayTotals(logs) {
  const map = {};
  for (const l of logs) map[l.jour] = (map[l.jour] || 0) + (l.envoyes || 0);
  return map;
}

// Stats par stratégie sur une période [from, to] (clés de date), avec tendance et petite série hebdomadaire.
export function strategyStats(data, fromKey, toKey) {
  const prevLen = Math.round((parseKey(toKey) - parseKey(fromKey)) / 86400000) + 1;
  const prevTo = dateKey(addDays(parseKey(fromKey), -1));
  const prevFrom = dateKey(addDays(parseKey(fromKey), -prevLen));
  return data.strategies.map((s) => {
    const mine = data.logs.filter((l) => l.strategy_id === s.id);
    const cur = sum(inRange(mine, fromKey, toKey));
    const prev = sum(inRange(mine, prevFrom, prevTo));
    const taux = rate(cur.reponses, cur.envoyes), tauxPrev = rate(prev.reponses, prev.envoyes);
    let trend = "flat";
    if (cur.envoyes >= 5 && prev.envoyes >= 5) trend = taux > tauxPrev + 0.5 ? "up" : taux < tauxPrev - 0.5 ? "down" : "flat";
    const all = sum(mine);
    return { strategy: s, ...cur, taux, trend, all, tauxAll: rate(all.reponses, all.envoyes), conversion: rate(all.clients, all.envoyes), weeks: weeklySeries(mine, 8) };
  });
}

// Meilleure stratégie : meilleur taux de réponse, avec au moins 10 messages envoyés au total.
export function bestStrategy(stats) {
  const ok = stats.filter((s) => s.all.envoyes >= 10 && s.strategy.statut !== "abandonnee");
  return ok.sort((a, b) => b.tauxAll - a.tauxAll)[0] || null;
}

// ---------- Écritures ----------
async function run(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}
const uid = async () => (await supabase.auth.getUser()).data.user.id;

export async function saveStrategy(values, id) {
  return id ? run(supabase.from("pro_strategies").update(values).eq("id", id).select().single())
            : run(supabase.from("pro_strategies").insert({ ...values, user_id: await uid() }).select().single());
}
export const deleteStrategy = (id) => run(supabase.from("pro_strategies").delete().eq("id", id));
export async function saveScript(strategyId, version, texte, id) {
  return id ? run(supabase.from("pro_scripts").update({ texte }).eq("id", id).select().single())
            : run(supabase.from("pro_scripts").insert({ strategy_id: strategyId, version, texte, user_id: await uid() }).select().single());
}
export const deleteScript = (id) => run(supabase.from("pro_scripts").delete().eq("id", id));
export async function addLog(values) { return run(supabase.from("pro_logs").insert({ ...values, user_id: await uid() }).select().single()); }
export const deleteLog = (id) => run(supabase.from("pro_logs").delete().eq("id", id));
export async function saveProspect(values, id) {
  const row = { ...values, updated_at: new Date().toISOString() };
  return id ? run(supabase.from("pro_prospects").update(row).eq("id", id).select().single())
            : run(supabase.from("pro_prospects").insert({ ...row, user_id: await uid() }).select().single());
}
export const deleteProspect = (id) => run(supabase.from("pro_prospects").delete().eq("id", id));
export async function saveOffer(values, id) {
  return id ? run(supabase.from("pro_offers").update(values).eq("id", id).select().single())
            : run(supabase.from("pro_offers").insert({ ...values, user_id: await uid() }).select().single());
}
export const deleteOffer = (id) => run(supabase.from("pro_offers").delete().eq("id", id));
export async function saveReview(semaine, values) {
  return run(supabase.from("pro_reviews").upsert({ ...values, semaine, user_id: await uid(), updated_at: new Date().toISOString() }, { onConflict: "user_id,semaine" }).select().single());
}
export async function saveObjectif(n) {
  return run(supabase.from("pro_settings").upsert({ user_id: await uid(), objectif_hebdo: n }, { onConflict: "user_id" }));
}

// ---------- Offres à étapes (long terme) ----------
// Travail semaine par semaine d'une étape : liste de textes (ancien format : une ligne = une semaine).
export function weeksOf(p) {
  let weeks = Array.isArray(p && p.semaines) ? p.semaines : String((p && p.taches) || "").replace(/\r/g, "").split("\n");
  weeks = weeks.slice(0, 60).map((w) => String(w == null ? "" : w).trim().slice(0, 600));
  while (weeks.length && !weeks[weeks.length - 1]) weeks.pop(); // les semaines vides à la fin ne comptent pas
  return weeks;
}
// Un mois = 4 semaines : une case par semaine, un titre possible par mois.
export const weeksCount = (mois) => Math.max(1, Math.round(mois * 4));
export function titlesOf(p) {
  const t = (Array.isArray(p && p.titres_mois) ? p.titres_mois : []).slice(0, 60).map((x) => String(x == null ? "" : x).trim().slice(0, 80));
  while (t.length && !t[t.length - 1]) t.pop();
  return t;
}

export function cleanPhases(list) {
  return (Array.isArray(list) ? list : []).map((p) => ({
    titre: String((p && p.titre) || "").trim().slice(0, 80),
    mois: Math.min(60, Math.max(1, Math.floor(Number(p && p.mois) || 1))),
    prix: Math.max(0, Number(p && p.prix) || 0),
    mode: p && p.mode === "total" ? "total" : "mois",
    detail: String((p && p.detail) || "").trim().slice(0, 200),
    semaines: weeksOf(p),
    titres_mois: titlesOf(p)
  })).filter((p) => p.titre);
}
export const phaseCost = (p) => (p.mode === "mois" ? p.prix * p.mois : p.prix);
// { total, mois, parMois } pour l'ensemble des étapes
export function phasesSummary(phases) {
  const total = phases.reduce((a, p) => a + phaseCost(p), 0), mois = phases.reduce((a, p) => a + p.mois, 0);
  return { total, mois, parMois: mois ? total / mois : 0 };
}

// Programme complet d'une offre : étape après étape, mois après mois (4 semaines), semaine après semaine.
export function offerProgram(phases) {
  let week = 1, month = 1;
  return phases.map((p) => {
    const lines = weeksOf(p), titles = titlesOf(p);
    const count = Math.max(lines.length, weeksCount(p.mois));
    const weeks = Array.from({ length: count }, (_, i) => ({ n: week + i, task: (lines[i] || "").trim() }));
    const months = Array.from({ length: Math.ceil(count / 4) }, (_, m) => ({ n: month + m, titre: titles[m] || "", weeks: weeks.slice(m * 4, m * 4 + 4) }));
    const out = { phase: p, fromMonth: month, weeks, months, planned: lines.filter(Boolean).length };
    week += count; month += p.mois;
    return out;
  });
}

// Petit libellé de prix d'une offre : « 890 € », « 79 € / mois » ou « 480 € sur 6 mois » (offre à étapes).
export function offerPriceLabel(o) {
  const phases = Array.isArray(o.phases) ? cleanPhases(o.phases) : [];
  if (phases.length) { const sm = phasesSummary(phases); return `${fmtEuro(sm.total)} sur ${sm.mois} mois`; }
  return fmtEuro(o.prix) + (o.periode === "mois" ? " / mois" : "");
}

// ---------- Calendrier de contenu ----------
export async function saveVideo(values, id) {
  return id ? run(supabase.from("pro_videos").update(values).eq("id", id).select().single())
            : run(supabase.from("pro_videos").insert({ ...values, user_id: await uid() }).select().single());
}
export async function addVideos(list) {
  const user = await uid();
  return run(supabase.from("pro_videos").insert(list.map((v) => ({ ...v, user_id: user }))).select());
}
export const deleteVideo = (id) => run(supabase.from("pro_videos").delete().eq("id", id));
