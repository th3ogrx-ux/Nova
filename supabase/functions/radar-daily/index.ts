// ZENOA RADAR — Supabase Edge Function "radar-daily"
// Enregistre les prospects du jour d'un utilisateur, après avoir vérifié
// qu'ils remplissent les critères (site absent ou ancien, e-mail trouvé).
//
// La recherche OpenStreetMap (Overpass) se fait dans le navigateur
// (src/radar-generate.js) : les serveurs Overpass gratuits refusent les
// appels venant des serveurs de Supabase (406 / 50x). Le navigateur
// envoie ici la liste trouvée ; cette fonction :
//   1. vérifie l'utilisateur (JWT de sa session) ;
//   2. valide chaque fiche et applique le quota de 50 prospects/jour ;
//   3. visite leurs sites : écarte les sites récents et les fiches sans e-mail
//      (l'e-mail est cherché sur la page d'accueil, puis sur /contact) ;
//   4. enregistre les prospects retenus (jamais un déjà vu), dans l'ordre de priorité.
//
// Fichier volontairement autonome (aucun import local) pour pouvoir
// être collé tel quel dans Supabase > Edge Functions > radar-daily >
// Code, puis déployé depuis le dashboard, sans CLI.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Domaine autorisé à appeler la fonction : secret ALLOWED_ORIGINS (ex. "https://mon-site.vercel.app"),
// un seul domaine. Sans ce secret, tous les domaines sont acceptés ("*").
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map((o) => o.trim()).filter(Boolean);
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0] || "*",
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const LEADS_PER_DAY = 50;
const MAX_CANDIDATES = 1500;
const MAX_EXAMINED = 200;              // fiches examinées au maximum par génération
const SCRAPE_CONCURRENCY = 10;
// La fonction est coupée au bout de 150 s (plan gratuit) : au-delà de ce
// délai, on ne lance plus de nouvelles visites de sites.
const SCRAPE_DEADLINE_MS = 110000;
const MAX_SCRAPE_BYTES = 50000;
const CONTACT_PAGE_GUESSES = ["/contact"];
const OSM_USER_AGENT = "ZenoaRadar/1.0 (prospection locale; +https://github.com/th3ogrx-ux/Nova)";
const WEBSITE_HEADERS = {
  "User-Agent": OSM_USER_AGENT,
  "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8"
};

// Doit rester identique aux clés de CATEGORY_INFO dans src/radar-categories.js.
const CATEGORIES = new Set([
  // Cibles actuelles : 1) coiffeurs/barbiers, 2) restaurants/snacks/pizzerias, 3) artisans
  "coiffeur", "barbier", "restaurant", "snack", "pizzeria", "electricien", "plombier", "chauffagiste",
  // Anciens métiers (compatibilité)
  "institut_beaute", "onglerie", "tatoueur", "garage", "carrossier", "salle_sport", "boxe", "osteopathe", "kine", "massage",
  "artisan_batiment", "couvreur", "menuisier", "chauffage_pac", "cuisiniste", "paysagiste", "agence_immo", "courtier_assurance",
  "courtier_credit", "expert_comptable", "consultant_formateur", "organisme_formation", "therapeute", "photographe",
  "lieu_reception", "traiteur", "auto_ecole", "gite", "pme_industrielle"
]);
const OSM_ID_RE = /^(node|way|relation)\/\d{1,15}$/;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

// N'accepte qu'une adresse web publique en http(s) : cette fonction va
// la visiter, et les fiches viennent du navigateur de l'utilisateur.
function safeWebsite(value: unknown): string | null {
  const raw = text(value, 300);
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!host.includes(".") || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
  if (/^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[")) return null;
  return url.toString();
}

function cleanCandidate(c: any) {
  if (!c || typeof c !== "object") return null;
  const osmId = text(c.osm_id, 40);
  const name = text(c.name, 200);
  const category = text(c.category, 40);
  if (!osmId || !OSM_ID_RE.test(osmId) || !name || !category || !CATEGORIES.has(category)) return null;
  const website = safeWebsite(c.website);
  const phone = text(c.phone, 60);
  const email = text(c.email, 200);
  if (!website && !email) return null; // sans e-mail ni site où le chercher, la fiche ne correspond pas aux critères
  return {
    osm_id: osmId,
    name,
    address: text(c.address, 300),
    phone,
    website,
    email: email ? cleanEmail(email) : null,
    category,
    city: text(c.city, 100),
    site_quality: website ? "needs_update" : "no_site"
  };
}

// Minuit (heure de Paris) du jour en cours, pour le quota quotidien.
function startOfTodayParis() {
  const now = new Date();
  const parisWallClock = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const utcWallClock = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = parisWallClock.getTime() - utcWallClock.getTime();
  const parisDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
  return new Date(new Date(parisDay + "T00:00:00Z").getTime() - offsetMs);
}

// ---------- Lecture d'un site web (email + qualité) ----------
async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal, headers: WEBSITE_HEADERS });
    clearTimeout(timeout);
    if (!res.ok || !res.body) return null;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let bytesRead = 0;
    while (bytesRead < MAX_SCRAPE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      html += decoder.decode(value, { stream: true });
    }
    try { await reader.cancel(); } catch { /* déjà fermé */ }
    return html;
  } catch {
    return null;
  }
}

// Adresse e-mail plausible : pas une image (logo@2x.png), pas un exemple, pas une adresse technique.
const JUNK_EMAIL = /\.(png|jpe?g|gif|svg|webp|css|js|ico|woff2?)$|^(noreply|no-reply|donotreply|example|test|sentry|wixpress|u00)|@(example|sentry|wixpress|domain|email)\.|@.*\.(png|jpg)$/i;
export function cleanEmail(raw: string): string | null {
  const email = String(raw || "").trim().toLowerCase().replace(/^mailto:/, "").replace(/[<>"'\s;,)]+$/g, "");
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) || email.length > 200 || JUNK_EMAIL.test(email)) return null;
  return email;
}

export function extractEmail(html: string): string | null {
  for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi)) {
    let candidate = m[1];
    try { candidate = decodeURIComponent(candidate); } catch { /* garde le texte brut */ }
    const ok = cleanEmail(candidate);
    if (ok) return ok;
  }
  for (const m of html.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)) {
    const ok = cleanEmail(m[0]);
    if (ok) return ok;
  }
  return null;
}

// Un site est « ancien » s'il n'est pas sécurisé (http), n'est pas adapté au téléphone, affiche un copyright de plus de
// 3 ans ou utilise des techniques d'un autre âge. Un site moderne (https + téléphone + récent) n'est pas une cible.
export function siteLooksOld(html: string, url: string, now = new Date()): boolean {
  if (!url.startsWith("https://")) return true;
  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) return true;
  if (/<(frameset|marquee|blink)\b|<font\b|swfobject|\.swf\b|<applet\b|shockwave|flash player/i.test(html)) return true;
  const years = [...html.matchAll(/(?:©|&copy;|copyright)[^0-9]{0,40}((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/gi)].map((m) => Number(m[2] || m[1]));
  if (years.length && Math.max(...years) <= now.getFullYear() - 3) return true;
  return false;
}

// Visite le site : e-mail trouvé (page d'accueil, puis /contact) et site ancien ou non.
// Un site qui ne répond pas est considéré comme ancien (abandonné ou cassé).
async function inspectWebsite(website: string) {
  const home = await fetchPage(website);
  if (!home) return { email: null, old: true };
  let email = extractEmail(home);
  if (!email) {
    const base = website.endsWith("/") ? website.slice(0, -1) : website;
    for (const guess of CONTACT_PAGE_GUESSES) {
      const contact = await fetchPage(base + guess);
      if (contact) email = extractEmail(contact);
      if (email) break;
    }
  }
  return { email, old: siteLooksOld(home, website) };
}

// Garde, dans l'ordre reçu (c'est l'ordre de priorité), les fiches qui remplissent les critères :
//  - pas de site et un e-mail déjà connu  -> « aucun site » ;
//  - un site ANCIEN et un e-mail (connu ou trouvé sur le site) -> « à moderniser » ;
//  - site moderne, ou aucun e-mail -> écartée.
// S'arrête quand il y en a assez, après MAX_EXAMINED fiches, ou à l'échéance.
export async function qualifyCandidates(
  candidates: any[], allowed: number, deadlineAt: number,
  inspect: (website: string) => Promise<{ email: string | null; old: boolean }> = inspectWebsite
) {
  const accepted: any[] = [];
  const stats = { examined: 0, modern: 0, noEmail: 0 };
  const pool = candidates.slice(0, MAX_EXAMINED);
  for (let i = 0; i < pool.length && accepted.length < allowed; i += SCRAPE_CONCURRENCY) {
    if (Date.now() > deadlineAt) break;
    const batch = pool.slice(i, i + SCRAPE_CONCURRENCY);
    const results = await Promise.all(batch.map(async (c) => {
      if (!c.website) return c.email ? { ...c, site_quality: "no_site" } : "noEmail";
      const info = await inspect(c.website);
      if (!info.old) return "modern";
      const email = c.email || (info.email ? cleanEmail(info.email) : null);
      return email ? { ...c, email, site_quality: "needs_update" } : "noEmail";
    }));
    for (const r of results) {
      stats.examined++;
      if (r === "modern") stats.modern++;
      else if (r === "noEmail") stats.noEmail++;
      else if (accepted.length < allowed) accepted.push(r);
    }
  }
  return { accepted, stats };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  const startedAt = Date.now();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    // ---------- Utilisateur connecté ----------
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData || !userData.user) return jsonResponse({ error: "Non authentifié." }, 401);
    const userId = userData.user.id;

    // Réservé à l'administrateur.
    const { data: profile } = await supabase.from("espace_profiles").select("role").eq("id", userId).maybeSingle();
    if (!profile || profile.role !== "admin") return jsonResponse({ error: "Action réservée à l'administrateur." }, 403);

    // ---------- Fiches envoyées par le navigateur ----------
    const body = await req.json().catch(() => ({}));
    const rawCandidates = Array.isArray(body.candidates) ? body.candidates.slice(0, MAX_CANDIDATES) : [];
    const candidates = rawCandidates.map(cleanCandidate).filter(Boolean) as any[];

    // ---------- Quota du jour ----------
    const { count: todayCount, error: countError } = await supabase
      .from("radar_leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", startOfTodayParis().toISOString());
    if (countError) { console.error("[radar-daily]", countError); return jsonResponse({ error: "Erreur du serveur." }, 500); }
    const allowed = LEADS_PER_DAY - (todayCount || 0);
    if (allowed <= 0) return jsonResponse({ inserted: 0, message: "Les prospects du jour ont déjà été générés." });

    // ---------- Jamais un prospect déjà vu ----------
    const { data: existing, error: existingError } = await supabase
      .from("radar_leads")
      .select("osm_id")
      .eq("user_id", userId);
    if (existingError) { console.error("[radar-daily]", existingError); return jsonResponse({ error: "Erreur du serveur." }, 500); }
    const seen = new Set((existing || []).map((r: any) => r.osm_id));

    const unseen: any[] = [];
    for (const c of candidates) {
      if (seen.has(c.osm_id)) continue;
      seen.add(c.osm_id);
      unseen.push(c);
    }
    if (!unseen.length) return jsonResponse({ inserted: 0, message: "Aucune nouvelle entreprise trouvée aujourd'hui." });

    // ---------- Critères : site absent ou ancien + e-mail trouvé ----------
    const { accepted: fresh, stats } = await qualifyCandidates(unseen, allowed, startedAt + SCRAPE_DEADLINE_MS);
    console.log("[radar-daily]", userId, ":", stats.examined, "fiches examinées,", stats.modern, "sites modernes,", stats.noEmail, "sans e-mail,", fresh.length, "retenues");
    if (!fresh.length) {
      return jsonResponse({ inserted: 0, message: `Aucune entreprise ne remplit les critères aujourd'hui (${stats.examined} examinées : ${stats.modern} avec un site récent, ${stats.noEmail} sans e-mail trouvé).` });
    }

    const { error: insertError } = await supabase
      .from("radar_leads")
      .insert(fresh.map((c) => ({ ...c, user_id: userId, status: "en_attente" })));
    if (insertError) { console.error("[radar-daily]", insertError); return jsonResponse({ error: "Erreur du serveur." }, 500); }

    return jsonResponse({ inserted: fresh.length, examined: stats.examined });
  } catch (err) {
    console.error("[radar-daily] échec :", String(err));
    return jsonResponse({ error: "Erreur serveur : " + String(err) }, 500);
  }
});
