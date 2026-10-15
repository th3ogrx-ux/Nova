// ZENOA RADAR — Supabase Edge Function "radar-daily"
// Génère automatiquement jusqu'à 50 nouveaux prospects par jour pour
// chaque utilisateur inscrit, partout en France, sans jamais reproposer
// une fiche déjà vue (contrainte unique user_id+osm_id sur radar_leads).
//
// Fichier volontairement autonome (aucun import local) pour pouvoir
// être collé tel quel dans Supabase > Edge Functions > radar-daily >
// Code, puis déployé depuis le dashboard, sans CLI.
//
// Appelée chaque jour à 6h par un job pg_cron (radar-auto-prospecting.sql).
// Protégée par le header "x-cron-secret", comparé au secret
// RADAR_CRON_SECRET (Edge Functions > Secrets).
//
// Budget : l'ancienne version de ce type de job avait planté en
// production (WORKER_RESOURCE_LIMIT). On limite donc le nombre de
// catégories interrogées par jour, et on ne visite les sites web (pour
// trouver l'email) que pour les prospects réellement retenus, en
// parallèle et avec un plafond global.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RADAR_CRON_SECRET = Deno.env.get("RADAR_CRON_SECRET") || "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const LEADS_PER_USER_PER_DAY = 50;
const CATEGORIES_PER_DAY = 3;          // appels Overpass par exécution
const RESULTS_PER_CATEGORY = 150;      // limite "out ... N;" d'Overpass
const MAX_SCRAPES_PER_RUN = 60;        // sites web visités max (pour l'email)
const SCRAPE_CONCURRENCY = 10;
const SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FRANCE_CACHE_CITY = "__france__";
const MAX_SCRAPE_BYTES = 50000;
const CONTACT_PAGE_GUESSES = ["/contact", "/nous-contacter"];
const OSM_USER_AGENT = "ZenoaRadar/1.0 (app de prospection locale; contact via le site)";

// Métiers ciblés -> tag OpenStreetMap. Déménageurs, wedding planners,
// nettoyage/services à domicile et e-commerçants n'ont pas de tag OSM
// fiable et ne peuvent donc pas être cherchés par zone géographique.
const CATEGORY_TAGS: Record<string, { key: string; value: string }> = {
  artisan_batiment: { key: "office", value: "construction_company" },
  plombier: { key: "craft", value: "plumber" },
  electricien: { key: "craft", value: "electrician" },
  couvreur: { key: "craft", value: "roofer" },
  menuisier: { key: "craft", value: "carpenter" },
  chauffage_pac: { key: "craft", value: "hvac" },
  cuisiniste: { key: "shop", value: "kitchen" },
  paysagiste: { key: "craft", value: "gardener" },
  agence_immo: { key: "office", value: "estate_agent" },
  courtier_assurance: { key: "office", value: "insurance" },
  courtier_credit: { key: "office", value: "financial_advisor" },
  expert_comptable: { key: "office", value: "accountant" },
  consultant_formateur: { key: "office", value: "consulting" },
  organisme_formation: { key: "office", value: "educational_institution" },
  therapeute: { key: "healthcare", value: "psychotherapist" },
  osteopathe: { key: "healthcare", value: "osteopath" },
  kine: { key: "healthcare", value: "physiotherapist" },
  institut_beaute: { key: "shop", value: "beauty" },
  coiffeur: { key: "shop", value: "hairdresser" },
  photographe: { key: "craft", value: "photographer" },
  lieu_reception: { key: "amenity", value: "events_venue" },
  traiteur: { key: "craft", value: "caterer" },
  auto_ecole: { key: "amenity", value: "driving_school" },
  salle_sport: { key: "leisure", value: "fitness_centre" },
  garage: { key: "shop", value: "car_repair" },
  gite: { key: "tourism", value: "guest_house" },
  pme_industrielle: { key: "man_made", value: "works" }
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}

// Tirage déterministe pour la journée (relancer la fonction le même
// jour redonne les mêmes catégories), qui change chaque jour.
function pickDailyCategories(allCategories: string[], count: number) {
  const seed = new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;

  const shuffled = [...allCategories];
  for (let i = shuffled.length - 1; i > 0; i--) {
    hash = (hash * 1103515245 + 12345) >>> 0;
    const j = hash % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildAddress(tags: Record<string, string>) {
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:postcode"],
    tags["addr:city"]
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

// ---------- Overpass : une catégorie dans toute la France (avec cache 24h) ----------
async function getCountryResults(category: string, supabase: any) {
  const tag = CATEGORY_TAGS[category];

  const cacheRes = await supabase
    .from("business_search_cache")
    .select("results, created_at")
    .eq("category", category)
    .eq("city", FRANCE_CACHE_CITY)
    .maybeSingle();

  if (cacheRes.data && Date.now() - new Date(cacheRes.data.created_at).getTime() < SEARCH_CACHE_TTL_MS) {
    return cacheRes.data.results as any[];
  }

  const query =
    "[out:json][timeout:50];" +
    'area["ISO3166-1"="FR"][admin_level=2]->.a;' +
    "(" +
    `node["${tag.key}"="${tag.value}"](area.a);` +
    `way["${tag.key}"="${tag.value}"](area.a);` +
    ");" +
    `out center tags ${RESULTS_PER_CATEGORY};`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "User-Agent": OSM_USER_AGENT, "Content-Type": "text/plain" },
    body: query
  });
  if (!res.ok) throw new Error("Overpass a répondu " + res.status);
  const data = await res.json();

  const results: any[] = [];
  for (const el of data.elements || []) {
    const tags = el.tags || {};
    if (!tags.name) continue;
    const website = tags.website || tags["contact:website"] || null;
    results.push({
      osm_id: el.type + "/" + el.id,
      name: tags.name,
      address: buildAddress(tags),
      phone: tags.phone || tags["contact:phone"] || null,
      website,
      email: tags.email || tags["contact:email"] || null,
      site_quality: website ? "needs_update" : "no_site",
      city: tags["addr:city"] || null
    });
  }

  await supabase.from("business_search_cache").upsert(
    { category, city: FRANCE_CACHE_CITY, results, created_at: new Date().toISOString() },
    { onConflict: "category,city" }
  );

  return results;
}

// ---------- Lecture d'un site web (email + qualité) ----------
async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": OSM_USER_AGENT } });
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

// Complète email/qualité des prospects retenus qui ont un site, par
// lots parallèles, dans la limite du budget global de l'exécution.
async function enrichWithWebsites(leads: any[], budget: { count: number }) {
  const toScrape = leads.filter((l) => l.website && !l.email);
  for (let i = 0; i < toScrape.length; i += SCRAPE_CONCURRENCY) {
    const remaining = MAX_SCRAPES_PER_RUN - budget.count;
    if (remaining <= 0) return;
    const batch = toScrape.slice(i, i + Math.min(SCRAPE_CONCURRENCY, remaining));
    budget.count += batch.length;
    await Promise.all(batch.map(async (lead) => {
      const info = await inspectWebsite(lead.website);
      lead.email = info.email;
      lead.site_quality = info.quality;
    }));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  if (!RADAR_CRON_SECRET || req.headers.get("x-cron-secret") !== RADAR_CRON_SECRET) {
    return jsonResponse({ error: "non autorisé" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    // ---------- Pool du jour ----------
    const categories = pickDailyCategories(Object.keys(CATEGORY_TAGS), CATEGORIES_PER_DAY);
    let pool: any[] = [];
    const errors: string[] = [];

    for (const category of categories) {
      try {
        const results = await getCountryResults(category, supabase);
        pool = pool.concat(results.map((r: any) => ({ ...r, category })));
      } catch (err) {
        errors.push(category + " : " + String(err));
      }
    }
    shuffleInPlace(pool);

    // ---------- Utilisateurs inscrits ----------
    const userIds: string[] = [];
    for (let page = 1; ; page++) {
      const res = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      const users = (res && res.data && res.data.users) || [];
      if (res && res.error) errors.push("listUsers : " + res.error.message);
      userIds.push(...users.map((u: any) => u.id));
      if (users.length < 200) break;
    }

    const budget = { count: 0 };
    const summary: Array<{ user_id: string; inserted: number; error?: string }> = [];

    for (const userId of userIds) {
      const { data: existing } = await supabase
        .from("radar_leads")
        .select("osm_id")
        .eq("user_id", userId);
      const seen = new Set((existing || []).map((r: any) => r.osm_id));

      const fresh = pool
        .filter((r) => !seen.has(r.osm_id))
        .slice(0, LEADS_PER_USER_PER_DAY)
        .map((r) => ({ ...r }));

      if (!fresh.length) {
        summary.push({ user_id: userId, inserted: 0 });
        continue;
      }

      await enrichWithWebsites(fresh, budget);

      const rows = fresh.map((r) => ({
        user_id: userId,
        osm_id: r.osm_id,
        name: r.name,
        address: r.address,
        phone: r.phone,
        website: r.website,
        email: r.email,
        category: r.category,
        city: r.city,
        site_quality: r.site_quality,
        status: "en_attente"
      }));

      const { error: insertError } = await supabase.from("radar_leads").insert(rows);
      summary.push(insertError
        ? { user_id: userId, inserted: 0, error: insertError.message }
        : { user_id: userId, inserted: rows.length });
    }

    return jsonResponse({ ok: true, categories, pool_size: pool.length, scraped: budget.count, errors, summary });
  } catch (err) {
    return jsonResponse({ error: "Erreur serveur", detail: String(err) }, 500);
  }
});
