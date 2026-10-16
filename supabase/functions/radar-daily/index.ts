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
// Recherche : plutôt qu'une requête Overpass sur toute la France (trop
// lourde, elle expire et renvoie une liste vide), on tire chaque jour
// quelques grandes villes réparties sur le territoire et on cherche
// tous les métiers ciblés autour de chacune, en une requête par ville.
//
// Budget : l'ancienne version de ce type de job avait planté en
// production (WORKER_RESOURCE_LIMIT). On ne visite donc les sites web
// (pour trouver l'email) que pour les prospects réellement retenus, en
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
const CITIES_PER_DAY = 3;              // une requête Overpass par ville
const SEARCH_RADIUS_METERS = 10000;
const RESULTS_PER_CITY = 400;          // limite "out ... N;" d'Overpass
const OVERPASS_REQUEST_TIMEOUT_MS = 30000;
const MAX_SCRAPES_PER_RUN = 60;        // sites web visités max (pour l'email)
const SCRAPE_CONCURRENCY = 10;
// La fonction est coupée au bout de 150 s (plan gratuit) : passé ce
// délai depuis le démarrage, on ne lance plus de nouvelles visites de
// sites, pour avoir fini avant la coupure.
const SCRAPE_DEADLINE_MS = 110000;
const SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_CATEGORY = "__radar_metiers__";
const MAX_SCRAPE_BYTES = 50000;
const CONTACT_PAGE_GUESSES = ["/contact"];
const OSM_USER_AGENT = "ZenoaRadar/1.0 (app de prospection locale; contact via le site)";
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter"
];

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

// Grandes villes réparties sur tout le territoire (coordonnées en dur :
// pas besoin de géocoder via Nominatim).
const CITIES: Array<{ name: string; lat: number; lon: number }> = [
  { name: "Paris", lat: 48.8566, lon: 2.3522 },
  { name: "Marseille", lat: 43.2965, lon: 5.3698 },
  { name: "Lyon", lat: 45.7640, lon: 4.8357 },
  { name: "Toulouse", lat: 43.6047, lon: 1.4442 },
  { name: "Nice", lat: 43.7102, lon: 7.2620 },
  { name: "Nantes", lat: 47.2184, lon: -1.5536 },
  { name: "Montpellier", lat: 43.6108, lon: 3.8767 },
  { name: "Strasbourg", lat: 48.5734, lon: 7.7521 },
  { name: "Bordeaux", lat: 44.8378, lon: -0.5792 },
  { name: "Lille", lat: 50.6292, lon: 3.0573 },
  { name: "Rennes", lat: 48.1173, lon: -1.6778 },
  { name: "Reims", lat: 49.2583, lon: 4.0317 },
  { name: "Toulon", lat: 43.1242, lon: 5.9280 },
  { name: "Saint-Étienne", lat: 45.4397, lon: 4.3872 },
  { name: "Le Havre", lat: 49.4944, lon: 0.1079 },
  { name: "Grenoble", lat: 45.1885, lon: 5.7245 },
  { name: "Dijon", lat: 47.3220, lon: 5.0415 },
  { name: "Angers", lat: 47.4784, lon: -0.5632 },
  { name: "Nîmes", lat: 43.8367, lon: 4.3601 },
  { name: "Clermont-Ferrand", lat: 45.7772, lon: 3.0870 },
  { name: "Le Mans", lat: 48.0061, lon: 0.1996 },
  { name: "Aix-en-Provence", lat: 43.5297, lon: 5.4474 },
  { name: "Brest", lat: 48.3904, lon: -4.4861 },
  { name: "Tours", lat: 47.3941, lon: 0.6848 },
  { name: "Amiens", lat: 49.8941, lon: 2.2958 },
  { name: "Limoges", lat: 45.8336, lon: 1.2611 },
  { name: "Annecy", lat: 45.8992, lon: 6.1294 },
  { name: "Perpignan", lat: 42.6887, lon: 2.8948 },
  { name: "Metz", lat: 49.1193, lon: 6.1757 },
  { name: "Besançon", lat: 47.2378, lon: 6.0241 },
  { name: "Orléans", lat: 47.9030, lon: 1.9093 },
  { name: "Rouen", lat: 49.4432, lon: 1.0999 },
  { name: "Mulhouse", lat: 47.7508, lon: 7.3359 },
  { name: "Caen", lat: 49.1829, lon: -0.3707 },
  { name: "Nancy", lat: 48.6921, lon: 6.1844 },
  { name: "Avignon", lat: 43.9493, lon: 4.8055 },
  { name: "Poitiers", lat: 46.5802, lon: 0.3404 },
  { name: "La Rochelle", lat: 46.1603, lon: -1.1511 },
  { name: "Pau", lat: 43.2951, lon: -0.3708 },
  { name: "Bayonne", lat: 43.4929, lon: -1.4748 }
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}

// Tirage déterministe pour la journée (relancer la fonction le même
// jour redonne le même tirage), qui change chaque jour.
function pickDaily<T>(items: T[], count: number) {
  const seed = new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;

  const shuffled = [...items];
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

function categoryOf(tags: Record<string, string>) {
  for (const [category, tag] of Object.entries(CATEGORY_TAGS)) {
    if (tags[tag.key] === tag.value) return category;
  }
  return null;
}

// Essaie chaque serveur Overpass à tour de rôle, en commençant par
// `firstEndpoint` (pour répartir les villes entre les serveurs), avec
// une limite de temps par serveur : un serveur saturé peut sinon faire
// attendre la requête jusqu'à la coupure de la fonction.
async function runOverpass(query: string, firstEndpoint: number) {
  let lastError = "";
  for (let k = 0; k < OVERPASS_ENDPOINTS.length; k++) {
    const endpoint = OVERPASS_ENDPOINTS[(firstEndpoint + k) % OVERPASS_ENDPOINTS.length];
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "User-Agent": OSM_USER_AGENT, "Content-Type": "text/plain" },
        body: query,
        signal: AbortSignal.timeout(OVERPASS_REQUEST_TIMEOUT_MS)
      });
      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 150);
        lastError = endpoint + " a répondu " + res.status + (detail ? " (" + detail + ")" : "");
        continue;
      }
      const data = await res.json();
      // Overpass répond 200 avec une "remark" quand la requête expire :
      // on la traite comme un échec pour essayer le serveur suivant.
      if (data.remark && !(data.elements || []).length) {
        lastError = endpoint + " : " + data.remark;
        continue;
      }
      return data.elements || [];
    } catch (err) {
      lastError = endpoint + " : " + String(err);
    }
  }
  throw new Error(lastError);
}

// ---------- Overpass : tous les métiers ciblés autour d'une ville (cache 24h) ----------
async function getCityResults(city: { name: string; lat: number; lon: number }, supabase: any, firstEndpoint: number) {
  const cacheRes = await supabase
    .from("business_search_cache")
    .select("results, created_at")
    .eq("category", CACHE_CATEGORY)
    .eq("city", city.name)
    .maybeSingle();

  if (cacheRes.data && Date.now() - new Date(cacheRes.data.created_at).getTime() < SEARCH_CACHE_TTL_MS) {
    return cacheRes.data.results as any[];
  }

  // Rectangle (bbox) autour de la ville plutôt qu'un rayon "around" : avec
  // "around", Overpass parcourt toutes les fiches du métier dans le monde
  // avant de filtrer par distance, et la requête (27 métiers) expirait sur
  // tous les serveurs. Avec une bbox globale, il n'explore que la zone.
  const dLat = SEARCH_RADIUS_METERS / 111320;
  const dLon = SEARCH_RADIUS_METERS / (111320 * Math.cos((city.lat * Math.PI) / 180));
  const bbox = [city.lat - dLat, city.lon - dLon, city.lat + dLat, city.lon + dLon].map((n) => n.toFixed(4)).join(",");
  const statements = Object.values(CATEGORY_TAGS)
    .map((t) => `node["${t.key}"="${t.value}"];way["${t.key}"="${t.value}"];`)
    .join("");
  const elements = await runOverpass(`[out:json][timeout:25][bbox:${bbox}];(${statements});out center tags ${RESULTS_PER_CITY};`, firstEndpoint);

  const results: any[] = [];
  for (const el of elements) {
    const tags = el.tags || {};
    const category = categoryOf(tags);
    if (!tags.name || !category) continue;
    const website = tags.website || tags["contact:website"] || null;
    const phone = tags.phone || tags["contact:phone"] || null;
    const email = tags.email || tags["contact:email"] || null;
    // Sans aucun moyen de contact, la fiche est inutile pour prospecter.
    if (!website && !phone && !email) continue;
    results.push({
      osm_id: el.type + "/" + el.id,
      name: tags.name,
      address: buildAddress(tags),
      phone,
      website,
      email,
      site_quality: website ? "needs_update" : "no_site",
      category,
      city: tags["addr:city"] || city.name
    });
  }

  // Un résultat vide n'est jamais mis en cache, pour pouvoir retenter.
  if (results.length) {
    await supabase.from("business_search_cache").upsert(
      { category: CACHE_CATEGORY, city: city.name, results, created_at: new Date().toISOString() },
      { onConflict: "category,city" }
    );
  }

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

// Complète email/qualité des prospects qui ont un site, par lots
// parallèles, dans la limite du budget de l'exécution et du délai
// avant la coupure de la fonction.
async function enrichWithWebsites(leads: any[], budget: { count: number }, startedAt: number) {
  const toScrape = leads.filter((l) => l.website && !l.email);
  for (let i = 0; i < toScrape.length; i += SCRAPE_CONCURRENCY) {
    const remaining = MAX_SCRAPES_PER_RUN - budget.count;
    if (remaining <= 0 || Date.now() - startedAt > SCRAPE_DEADLINE_MS) return;
    const batch = toScrape.slice(i, i + Math.min(SCRAPE_CONCURRENCY, remaining));
    budget.count += batch.length;
    await Promise.all(batch.map(async (lead) => {
      const info = await inspectWebsite(lead.website);
      lead.email = info.email;
      lead.site_quality = info.quality;
      lead.enriched = true;
    }));
  }
}

// Fourni par le runtime des Edge Functions Supabase : laisse une tâche
// continuer après l'envoi de la réponse (dans la limite de durée de
// la fonction).
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

async function generateDailyLeads(supabase: any) {
  const startedAt = Date.now();
  const cities = pickDaily(CITIES, CITIES_PER_DAY);
  console.log("[radar-daily] démarrage — villes du jour :", cities.map((c) => c.name).join(", "));

  // ---------- Pool du jour (villes en parallèle, chacune sur un serveur différent) ----------
  const settled = await Promise.allSettled(cities.map((city, i) => getCityResults(city, supabase, i)));
  let pool: any[] = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") {
      console.log("[radar-daily]", cities[i].name, ":", s.value.length, "entreprises joignables");
      pool = pool.concat(s.value);
    } else {
      console.error("[radar-daily]", cities[i].name, ": échec Overpass —", String(s.reason));
    }
  });
  shuffleInPlace(pool);

  // ---------- Utilisateurs inscrits ----------
  const userIds: string[] = [];
  for (let page = 1; ; page++) {
    const res = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (res && res.error) console.error("[radar-daily] listUsers :", res.error.message);
    const users = (res && res.data && res.data.users) || [];
    userIds.push(...users.map((u: any) => u.id));
    if (users.length < 200) break;
  }
  console.log("[radar-daily] pool", pool.length, "— utilisateurs", userIds.length);

  // ---------- Insertion immédiate (sans attendre les emails) ----------
  const inserted: Array<{ userId: string; leads: any[] }> = [];
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
      console.log("[radar-daily]", userId, ": aucun nouveau prospect");
      continue;
    }

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
    if (insertError) {
      console.error("[radar-daily]", userId, ": erreur d'insertion —", insertError.message);
      continue;
    }
    console.log("[radar-daily]", userId, ":", rows.length, "prospects ajoutés");
    inserted.push({ userId, leads: fresh });
  }

  // ---------- Emails trouvés sur les sites, ajoutés après coup ----------
  // Si la fonction est coupée pendant cette étape, les prospects sont
  // déjà enregistrés : seuls quelques emails manqueront.
  const budget = { count: 0 };
  for (const { userId, leads } of inserted) {
    await enrichWithWebsites(leads, budget, startedAt);
    const updates = leads.filter((l) => l.enriched);
    await Promise.all(updates.map((l) =>
      supabase
        .from("radar_leads")
        .update({ email: l.email, site_quality: l.site_quality, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("osm_id", l.osm_id)
    ));
    console.log("[radar-daily]", userId, ":", updates.filter((l) => l.email).length, "emails trouvés sur", updates.length, "sites visités");
  }
  console.log("[radar-daily] terminé en", Math.round((Date.now() - startedAt) / 1000), "s");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  if (!RADAR_CRON_SECRET || req.headers.get("x-cron-secret") !== RADAR_CRON_SECRET) {
    return jsonResponse({ error: "non autorisé" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // La génération peut prendre plus d'une minute : on répond tout de
  // suite et on termine en arrière-plan, sinon l'appelant (panneau de
  // test du dashboard, pg_net) abandonne avant.
  EdgeRuntime.waitUntil(
    generateDailyLeads(supabase).catch((err) => console.error("[radar-daily] échec :", String(err)))
  );

  return jsonResponse({ ok: true, message: "Génération lancée — les prospects arrivent d'ici une à deux minutes." }, 202);
});
