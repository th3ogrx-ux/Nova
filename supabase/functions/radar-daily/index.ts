// ZENOA RADAR — Supabase Edge Function "radar-daily"
// Enregistre les prospects du jour d'un utilisateur et cherche leurs
// emails sur leurs sites web.
//
// La recherche OpenStreetMap (Overpass) se fait dans le navigateur
// (src/radar-generate.js) : les serveurs Overpass gratuits refusent les
// appels venant des serveurs de Supabase (406 / 50x). Le navigateur
// envoie ici la liste trouvée ; cette fonction :
//   1. vérifie l'utilisateur (JWT de sa session) ;
//   2. valide chaque fiche et applique le quota de 50 prospects/jour ;
//   3. enregistre les nouveaux prospects (jamais un déjà vu) ;
//   4. en arrière-plan, visite leurs sites pour trouver un email.
//
// Fichier volontairement autonome (aucun import local) pour pouvoir
// être collé tel quel dans Supabase > Edge Functions > radar-daily >
// Code, puis déployé depuis le dashboard, sans CLI.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const LEADS_PER_DAY = 50;
const MAX_CANDIDATES = 1500;
const MAX_SCRAPES = 50;                // sites visités max par génération
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

// Doit rester identique aux clés de CATEGORY_TAGS dans src/radar-generate.js.
const CATEGORIES = new Set([
  "artisan_batiment", "plombier", "electricien", "couvreur", "menuisier", "chauffage_pac",
  "cuisiniste", "paysagiste", "agence_immo", "courtier_assurance", "courtier_credit",
  "expert_comptable", "consultant_formateur", "organisme_formation", "therapeute", "osteopathe",
  "kine", "institut_beaute", "coiffeur", "photographe", "lieu_reception", "traiteur",
  "auto_ecole", "salle_sport", "garage", "gite", "pme_industrielle"
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
  if (!website && !phone && !email) return null;
  return {
    osm_id: osmId,
    name,
    address: text(c.address, 300),
    phone,
    website,
    email,
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

function extractEmail(html: string): string | null {
  const mailto = html.match(/mailto:([^"'?\s]+)/i);
  if (mailto && mailto[1]) return decodeURIComponent(mailto[1]).replace(/\.(html?|php)$/i, "");
  const plain = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return plain ? plain[0] : null;
}

async function inspectWebsite(website: string) {
  const home = await fetchPage(website);
  if (!home) return { email: null, quality: "needs_update" };

  let email = extractEmail(home);
  const mobileFriendly = /<meta[^>]+name=["']viewport["']/i.test(home);

  if (!email) {
    const base = website.endsWith("/") ? website.slice(0, -1) : website;
    for (const guess of CONTACT_PAGE_GUESSES) {
      const contact = await fetchPage(base + guess);
      if (contact) email = extractEmail(contact);
      if (email) break;
    }
  }

  const quality = website.startsWith("https://") && mobileFriendly ? "good" : "needs_update";
  return { email, quality };
}

// Visite les sites des prospects qui en ont un, par lots parallèles,
// et enregistre l'email trouvé et la qualité du site.
async function enrichWithWebsites(supabase: any, userId: string, leads: any[], startedAt: number) {
  const toScrape = leads.filter((l) => l.website && !l.email).slice(0, MAX_SCRAPES);
  let found = 0;
  for (let i = 0; i < toScrape.length; i += SCRAPE_CONCURRENCY) {
    if (Date.now() - startedAt > SCRAPE_DEADLINE_MS) break;
    await Promise.all(toScrape.slice(i, i + SCRAPE_CONCURRENCY).map(async (lead) => {
      const info = await inspectWebsite(lead.website);
      if (info.email) found++;
      await supabase
        .from("radar_leads")
        .update({ email: info.email, site_quality: info.quality, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("osm_id", lead.osm_id);
    }));
  }
  console.log("[radar-daily]", userId, ":", found, "emails trouvés sur", toScrape.length, "sites");
}

// Fourni par le runtime des Edge Functions Supabase : laisse une tâche
// continuer après l'envoi de la réponse (dans la limite de durée de
// la fonction).
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

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
    if (countError) return jsonResponse({ error: countError.message }, 500);
    const allowed = LEADS_PER_DAY - (todayCount || 0);
    if (allowed <= 0) return jsonResponse({ inserted: 0, message: "Les prospects du jour ont déjà été générés." });

    // ---------- Jamais un prospect déjà vu ----------
    const { data: existing, error: existingError } = await supabase
      .from("radar_leads")
      .select("osm_id")
      .eq("user_id", userId);
    if (existingError) return jsonResponse({ error: existingError.message }, 500);
    const seen = new Set((existing || []).map((r: any) => r.osm_id));

    const fresh: any[] = [];
    for (const c of candidates) {
      if (fresh.length >= allowed) break;
      if (seen.has(c.osm_id)) continue;
      seen.add(c.osm_id);
      fresh.push(c);
    }
    if (!fresh.length) return jsonResponse({ inserted: 0, message: "Aucune nouvelle entreprise trouvée aujourd'hui." });

    const { error: insertError } = await supabase
      .from("radar_leads")
      .insert(fresh.map((c) => ({ ...c, user_id: userId, status: "en_attente" })));
    if (insertError) return jsonResponse({ error: insertError.message }, 500);
    console.log("[radar-daily]", userId, ":", fresh.length, "prospects ajoutés");

    // ---------- Emails, en arrière-plan ----------
    EdgeRuntime.waitUntil(
      enrichWithWebsites(supabase, userId, fresh, startedAt)
        .catch((err) => console.error("[radar-daily] emails :", String(err)))
    );

    return jsonResponse({ inserted: fresh.length });
  } catch (err) {
    console.error("[radar-daily] échec :", String(err));
    return jsonResponse({ error: "Erreur serveur : " + String(err) }, 500);
  }
});
