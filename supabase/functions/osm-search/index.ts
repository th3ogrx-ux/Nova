// ZENOA RADAR — Supabase Edge Function
// Recherche d'entreprises locales via OpenStreetMap (Nominatim pour
// géocoder la ville, Overpass pour lister les entreprises par tag),
// puis complète chaque résultat sans site email connu en lisant son
// site web (page d'accueil + page contact) côté serveur.
//
// Appelée depuis le client authentifié via
// supabase.functions.invoke("osm-search", { body: { category, city } }).
//
// Secrets requis : aucun — Nominatim et Overpass sont des API
// publiques gratuites, sans clé. (SUPABASE_URL et
// SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par la
// plateforme à toutes les Edge Functions.)
//
// IMPORTANT (politesse envers OpenStreetMap) : un User-Agent qui
// identifie l'appli est obligatoire (règle Nominatim), les résultats
// sont mis en cache (table business_search_cache / city_geocode_cache)
// pour éviter de refaire la même requête, et chaque recherche
// utilisateur ne déclenche qu'un seul appel Nominatim + un seul appel
// Overpass (pas de boucle/rafale).

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

// User-Agent descriptif exigé par la politique d'usage de Nominatim —
// surtout pas un User-Agent de navigateur générique.
const OSM_USER_AGENT = "ZenoaRadar/1.0 (app de prospection locale; contact via le site)";

// Catégorie métier -> tag OpenStreetMap. À garder synchronisé avec la
// liste affichée côté client (src/categories.js).
const CATEGORY_TAGS: Record<string, { key: string; value: string }> = {
  coiffeur: { key: "shop", value: "hairdresser" },
  restaurant: { key: "amenity", value: "restaurant" },
  plombier: { key: "craft", value: "plumber" },
  electricien: { key: "craft", value: "electrician" },
  boulangerie: { key: "shop", value: "bakery" },
  garage: { key: "shop", value: "car_repair" },
  dentiste: { key: "amenity", value: "dentist" },
  medecin: { key: "amenity", value: "doctors" },
  avocat: { key: "office", value: "lawyer" },
  salle_sport: { key: "leisure", value: "fitness_centre" },
  institut_beaute: { key: "shop", value: "beauty" },
  fleuriste: { key: "shop", value: "florist" },
  boucherie: { key: "shop", value: "butcher" },
  cafe: { key: "amenity", value: "cafe" },
  hotel: { key: "tourism", value: "hotel" },
  agence_immo: { key: "office", value: "estate_agent" },
  veterinaire: { key: "amenity", value: "veterinary" },
  photographe: { key: "craft", value: "photographer" },
  menuisier: { key: "craft", value: "carpenter" },
  architecte: { key: "office", value: "architect" }
};

const SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;       // 24h : une recherche category+city n'est jamais refaite dans la journée
const GEOCODE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;  // 30j : une ville ne change pas de coordonnées
const SEARCH_RADIUS_METERS = 12000;                     // rayon autour du centre-ville
const MAX_RESULTS = 40;
const MAX_TOTAL_SCRAPES = 20;         // plafond de sites visités par recherche (budget CPU de la fonction)
const MAX_SCRAPE_BYTES = 50000;       // un mailto/email se trouve presque toujours dans les premiers Ko d'une page
const CONTACT_PAGE_GUESSES = ["/contact", "/contact-us", "/contacts", "/nous-contacter"];

const MAILTO_RE = /mailto:([^"'?\s]+)/i;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}

// ---------- Géocodage de la ville (Nominatim, avec cache) ----------
async function geocodeCity(city: string, supabase: ReturnType<typeof createClient>) {
  const cached = await supabase
    .from("city_geocode_cache")
    .select("lat, lon, created_at")
    .eq("city", city)
    .maybeSingle();

  if (cached.data && Date.now() - new Date(cached.data.created_at as string).getTime() < GEOCODE_CACHE_TTL_MS) {
    return { lat: cached.data.lat as number, lon: cached.data.lon as number };
  }

  const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(city);
  const res = await fetch(url, { headers: { "User-Agent": OSM_USER_AGENT, "Accept-Language": "fr" } });
  if (!res.ok) throw new Error("Nominatim a répondu " + res.status);
  const data = await res.json();
  const first = data[0];
  if (!first) return null;

  const lat = parseFloat(first.lat);
  const lon = parseFloat(first.lon);

  await supabase.from("city_geocode_cache").upsert(
    { city, lat, lon, display_name: first.display_name, created_at: new Date().toISOString() },
    { onConflict: "city" }
  );

  return { lat, lon };
}

// ---------- Recherche des entreprises (Overpass) ----------
async function searchOverpass(tag: { key: string; value: string }, lat: number, lon: number) {
  const query =
    "[out:json][timeout:25];" +
    "(" +
    `node["${tag.key}"="${tag.value}"](around:${SEARCH_RADIUS_METERS},${lat},${lon});` +
    `way["${tag.key}"="${tag.value}"](around:${SEARCH_RADIUS_METERS},${lat},${lon});` +
    ");" +
    "out center tags;";

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "User-Agent": OSM_USER_AGENT, "Content-Type": "text/plain" },
    body: query
  });
  if (!res.ok) throw new Error("Overpass a répondu " + res.status);
  const data = await res.json();
  return (data.elements || []) as any[];
}

function buildAddress(tags: Record<string, string>) {
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:postcode"],
    tags["addr:city"]
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

// ---------- Lecture du site web (email + indices de qualité) ----------
async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": OSM_USER_AGENT }
    });
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
  const mailtoMatch = html.match(MAILTO_RE);
  if (mailtoMatch && mailtoMatch[1]) {
    return decodeURIComponent(mailtoMatch[1]).replace(/\.(html?|php)$/i, "");
  }
  const emailMatch = html.match(EMAIL_RE);
  return emailMatch ? emailMatch[0] : null;
}

function hasViewportMeta(html: string): boolean {
  return /<meta[^>]+name=["']viewport["']/i.test(html);
}

// Visite le site (accueil, puis une page contact si besoin) pour
// trouver un email et juger la qualité du site. `scrapeBudget` est un
// objet partagé {count} qui plafonne le nombre total de sites visités
// sur toute la recherche.
async function inspectWebsite(website: string, scrapeBudget: { count: number }) {
  const isHttps = website.startsWith("https://");
  if (scrapeBudget.count >= MAX_TOTAL_SCRAPES) {
    return { email: null, quality: isHttps ? "needs_update" : "needs_update" };
  }

  scrapeBudget.count++;
  const homeHtml = await fetchPage(website);
  if (!homeHtml) {
    return { email: null, quality: "needs_update" as const };
  }

  let email = extractEmail(homeHtml);
  let mobileFriendly = hasViewportMeta(homeHtml);

  if (!email && scrapeBudget.count < MAX_TOTAL_SCRAPES) {
    for (const guess of CONTACT_PAGE_GUESSES) {
      if (email || scrapeBudget.count >= MAX_TOTAL_SCRAPES) break;
      scrapeBudget.count++;
      const base = website.endsWith("/") ? website.slice(0, -1) : website;
      const contactHtml = await fetchPage(base + guess);
      if (contactHtml) email = extractEmail(contactHtml);
    }
  }

  const quality = isHttps && mobileFriendly ? "good" : "needs_update";
  return { email, quality: quality as "good" | "needs_update" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    // ---------- Authentification de l'appelant ----------
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } }
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: "Non authentifié." }, 401);
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const category = String(body.category || "").trim();
    const city = String(body.city || "").trim();
    const tag = CATEGORY_TAGS[category];
    if (!tag) return jsonResponse({ error: "Catégorie inconnue." }, 400);
    if (!city) return jsonResponse({ error: "Ville manquante." }, 400);

    // Clé service_role : contourne RLS pour lire/écrire les tables
    // internes (quotas, cache) qui ne sont pas accessibles au client.
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ---------- Quota mensuel ----------
    const userPlanRes = await supabase.from("user_plans").select("plan_id").eq("user_id", userId).single();
    const planId = (userPlanRes.data && userPlanRes.data.plan_id) || "free";
    const planRes = await supabase.from("plans").select("max_searches_per_month").eq("id", planId).single();
    const maxSearches = (planRes.data && planRes.data.max_searches_per_month) || 20;

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const countRes = await supabase
      .from("search_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", monthStart.toISOString());

    if ((countRes.count || 0) >= maxSearches) {
      return jsonResponse({ error: "Quota de recherches atteint pour ce mois-ci (" + maxSearches + "). Passe au plan Pro pour plus de recherches." }, 429);
    }

    // ---------- Cache des résultats ----------
    const cacheRes = await supabase
      .from("business_search_cache")
      .select("results, created_at")
      .eq("category", category)
      .eq("city", city)
      .maybeSingle();

    let results: any[];

    if (cacheRes.data && Date.now() - new Date(cacheRes.data.created_at as string).getTime() < SEARCH_CACHE_TTL_MS) {
      results = cacheRes.data.results as any[];
    } else {
      const geo = await geocodeCity(city, supabase);
      if (!geo) return jsonResponse({ error: "Ville introuvable." }, 404);

      const elements = await searchOverpass(tag, geo.lat, geo.lon);
      const scrapeBudget = { count: 0 };
      results = [];

      for (const el of elements.slice(0, MAX_RESULTS)) {
        const tags = el.tags || {};
        const name = tags.name;
        if (!name) continue; // une fiche sans nom n'est pas exploitable pour un premier contact

        const website = tags.website || tags["contact:website"] || null;
        let email = tags.email || tags["contact:email"] || null;
        let siteQuality: "no_site" | "needs_update" | "good" = website ? "needs_update" : "no_site";

        if (website) {
          const inspection = await inspectWebsite(website, scrapeBudget);
          if (!email) email = inspection.email;
          siteQuality = inspection.quality;
        }

        // Un node porte lat/lon directement ; une way/relation porte un
        // centre calculé (demandé via "out center" dans la requête Overpass).
        const lat = el.lat ?? (el.center && el.center.lat) ?? null;
        const lon = el.lon ?? (el.center && el.center.lon) ?? null;

        results.push({
          osm_id: el.type + "/" + el.id,
          name,
          address: buildAddress(tags),
          phone: tags.phone || tags["contact:phone"] || null,
          website,
          email,
          site_quality: siteQuality,
          lat,
          lon
        });
      }

      await supabase.from("business_search_cache").upsert(
        { category, city, results, created_at: new Date().toISOString() },
        { onConflict: "category,city" }
      );
    }

    await supabase.from("search_history").insert({ user_id: userId, category, city, result_count: results.length });

    return jsonResponse({ results, category, city });
  } catch (err) {
    return jsonResponse({ error: "Erreur serveur", detail: String(err) }, 500);
  }
});
