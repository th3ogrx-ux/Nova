// ZENOA RADAR — logique partagée de recherche OpenStreetMap, utilisée
// par la fonction "osm-search" (recherche manuelle) et "radar-daily"
// (génération automatique quotidienne), pour ne pas dupliquer le
// géocodage, l'appel Overpass et la lecture des sites web.

// User-Agent descriptif exigé par la politique d'usage de Nominatim —
// surtout pas un User-Agent de navigateur générique.
export const OSM_USER_AGENT = "ZenoaRadar/1.0 (app de prospection locale; contact via le site)";

// Catégorie métier -> tag OpenStreetMap. Liste choisie par
// l'utilisateur (profils à cibler pour la prospection). OSM ne
// recense que des établissements géolocalisés avec un tag reconnu :
// certains métiers demandés n'ont pas d'équivalent fiable (déménageurs,
// wedding planners, agences de nettoyage/services à domicile,
// e-commerçants purement en ligne) et sont donc volontairement absents
// — impossible à chercher par zone géographique sur OpenStreetMap.
export const CATEGORY_TAGS: Record<string, { key: string; value: string }> = {
  artisan_batiment: { key: "office", value: "construction_company" },   // artisans du bâtiment / rénovation
  plombier: { key: "craft", value: "plumber" },
  electricien: { key: "craft", value: "electrician" },
  couvreur: { key: "craft", value: "roofer" },
  menuisier: { key: "craft", value: "carpenter" },
  chauffage_pac: { key: "craft", value: "hvac" },                       // pompes à chaleur / chauffage (pas de tag dédié pour le solaire)
  cuisiniste: { key: "shop", value: "kitchen" },                        // cuisinistes et salles de bain
  paysagiste: { key: "craft", value: "gardener" },                      // paysagistes (pas de tag dédié pour les pisciniers)
  agence_immo: { key: "office", value: "estate_agent" },
  courtier_assurance: { key: "office", value: "insurance" },
  courtier_credit: { key: "office", value: "financial_advisor" },       // courtiers crédit / gestion de patrimoine
  expert_comptable: { key: "office", value: "accountant" },
  consultant_formateur: { key: "office", value: "consulting" },         // consultants, formateurs, coachs
  organisme_formation: { key: "office", value: "educational_institution" },
  therapeute: { key: "healthcare", value: "psychotherapist" },          // psys, sophrologues, naturopathes, hypnothérapeutes
  osteopathe: { key: "healthcare", value: "osteopath" },
  kine: { key: "healthcare", value: "physiotherapist" },
  institut_beaute: { key: "shop", value: "beauty" },                    // cliniques esthétiques et instituts de beauté
  coiffeur: { key: "shop", value: "hairdresser" },                      // coiffeurs et barbiers
  photographe: { key: "craft", value: "photographer" },                 // photographes et vidéastes
  lieu_reception: { key: "amenity", value: "events_venue" },
  traiteur: { key: "craft", value: "caterer" },
  auto_ecole: { key: "amenity", value: "driving_school" },
  salle_sport: { key: "leisure", value: "fitness_centre" },             // salles de sport et studios yoga/pilates
  garage: { key: "shop", value: "car_repair" },                         // garages et carrossiers
  gite: { key: "tourism", value: "guest_house" },                       // gîtes et chambres d'hôtes
  pme_industrielle: { key: "man_made", value: "works" }                 // petites PME industrielles locales
};

export const SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;       // 24h : une recherche category+city n'est jamais refaite dans la journée
export const GEOCODE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;  // 30j : une ville ne change pas de coordonnées
export const SEARCH_RADIUS_METERS = 12000;                     // rayon autour du centre-ville
export const MAX_RESULTS = 40;
export const MAX_SCRAPE_BYTES = 50000;       // un mailto/email se trouve presque toujours dans les premiers Ko d'une page
export const CONTACT_PAGE_GUESSES = ["/contact", "/contact-us", "/contacts", "/nous-contacter"];

const MAILTO_RE = /mailto:([^"'?\s]+)/i;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// ---------- Géocodage de la ville (Nominatim, avec cache) ----------
export async function geocodeCity(city: string, supabase: any) {
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
export async function searchOverpass(tag: { key: string; value: string }, lat: number, lon: number) {
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

export function buildAddress(tags: Record<string, string>) {
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:postcode"],
    tags["addr:city"]
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

// ---------- Lecture du site web (email + indices de qualité) ----------
export async function fetchPage(url: string): Promise<string | null> {
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

export function extractEmail(html: string): string | null {
  const mailtoMatch = html.match(MAILTO_RE);
  if (mailtoMatch && mailtoMatch[1]) {
    return decodeURIComponent(mailtoMatch[1]).replace(/\.(html?|php)$/i, "");
  }
  const emailMatch = html.match(EMAIL_RE);
  return emailMatch ? emailMatch[0] : null;
}

export function hasViewportMeta(html: string): boolean {
  return /<meta[^>]+name=["']viewport["']/i.test(html);
}

// Visite le site (accueil, puis une page contact si besoin) pour
// trouver un email et juger la qualité du site. `scrapeBudget` est un
// objet partagé {count} qui plafonne le nombre total de sites visités
// sur toute la recherche (budget CPU de la fonction appelante).
export async function inspectWebsite(website: string, scrapeBudget: { count: number }, maxScrapes: number) {
  const isHttps = website.startsWith("https://");
  if (scrapeBudget.count >= maxScrapes) {
    return { email: null, quality: "needs_update" as const };
  }

  scrapeBudget.count++;
  const homeHtml = await fetchPage(website);
  if (!homeHtml) {
    return { email: null, quality: "needs_update" as const };
  }

  let email = extractEmail(homeHtml);
  let mobileFriendly = hasViewportMeta(homeHtml);

  if (!email && scrapeBudget.count < maxScrapes) {
    for (const guess of CONTACT_PAGE_GUESSES) {
      if (email || scrapeBudget.count >= maxScrapes) break;
      scrapeBudget.count++;
      const base = website.endsWith("/") ? website.slice(0, -1) : website;
      const contactHtml = await fetchPage(base + guess);
      if (contactHtml) email = extractEmail(contactHtml);
    }
  }

  const quality = isHttps && mobileFriendly ? "good" : "needs_update";
  return { email, quality: quality as "good" | "needs_update" };
}

// Récupère les résultats bruts pour une catégorie+ville, en passant
// par le cache partagé (business_search_cache) comme le fait la
// recherche manuelle — déjà géocodé et interrogé sur Overpass une
// seule fois par jour pour la même combinaison, quel que soit le
// nombre d'utilisateurs qui la ciblent.
export async function getCachedOrFreshResults(
  category: string,
  city: string,
  supabase: any,
  scrapeBudget: { count: number },
  maxScrapes: number
) {
  const tag = CATEGORY_TAGS[category];
  if (!tag) return null;

  const cacheRes = await supabase
    .from("business_search_cache")
    .select("results, created_at")
    .eq("category", category)
    .eq("city", city)
    .maybeSingle();

  if (cacheRes.data && Date.now() - new Date(cacheRes.data.created_at as string).getTime() < SEARCH_CACHE_TTL_MS) {
    return cacheRes.data.results as any[];
  }

  const geo = await geocodeCity(city, supabase);
  if (!geo) return null;

  const elements = await searchOverpass(tag, geo.lat, geo.lon);
  const results: any[] = [];

  for (const el of elements.slice(0, MAX_RESULTS)) {
    const tags = el.tags || {};
    const name = tags.name;
    if (!name) continue;

    const website = tags.website || tags["contact:website"] || null;
    let email = tags.email || tags["contact:email"] || null;
    let siteQuality: "no_site" | "needs_update" | "good" = website ? "needs_update" : "no_site";

    if (website) {
      const inspection = await inspectWebsite(website, scrapeBudget, maxScrapes);
      if (!email) email = inspection.email;
      siteQuality = inspection.quality;
    }

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

  return results;
}

// ============================================================
// Recherche nationale (toute la France), utilisée par radar-daily
// pour la génération automatique — pas de ville à choisir. On
// réutilise la table business_search_cache avec une valeur de
// "city" spéciale pour la mettre en cache comme les recherches
// manuelles (1 appel Overpass par catégorie et par jour, quel que
// soit le nombre d'utilisateurs).
//
// IMPORTANT (budget CPU, leçon tirée de l'ancienne appli qui avait
// planté en production sur ce type de job — "WORKER_RESOURCE_LIMIT")
// : contrairement à la recherche manuelle, on NE visite PAS chaque
// site web pour en extraire l'email (ce serait des centaines de
// requêtes par catégorie) — la qualité du site est donc estimée
// seulement à partir de la présence d'un site déclaré sur OSM.
export const FRANCE_CACHE_CITY = "__france__";
const COUNTRY_RESULTS_LIMIT = 150; // résultats max par catégorie (limite Overpass "out ... N;")

async function searchOverpassCountry(tag: { key: string; value: string }, limit: number) {
  const query =
    "[out:json][timeout:50];" +
    'area["ISO3166-1"="FR"][admin_level=2]->.a;' +
    "(" +
    `node["${tag.key}"="${tag.value}"](area.a);` +
    `way["${tag.key}"="${tag.value}"](area.a);` +
    ");" +
    `out center tags ${limit};`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "User-Agent": OSM_USER_AGENT, "Content-Type": "text/plain" },
    body: query
  });
  if (!res.ok) throw new Error("Overpass a répondu " + res.status);
  const data = await res.json();
  return (data.elements || []) as any[];
}

export async function getCountryResultsForCategory(category: string, supabase: any) {
  const tag = CATEGORY_TAGS[category];
  if (!tag) return [];

  const cacheRes = await supabase
    .from("business_search_cache")
    .select("results, created_at")
    .eq("category", category)
    .eq("city", FRANCE_CACHE_CITY)
    .maybeSingle();

  if (cacheRes.data && Date.now() - new Date(cacheRes.data.created_at as string).getTime() < SEARCH_CACHE_TTL_MS) {
    return cacheRes.data.results as any[];
  }

  const elements = await searchOverpassCountry(tag, COUNTRY_RESULTS_LIMIT);
  const results: any[] = [];

  for (const el of elements) {
    const tags = el.tags || {};
    const name = tags.name;
    if (!name) continue;

    const website = tags.website || tags["contact:website"] || null;
    const email = tags.email || tags["contact:email"] || null;
    const siteQuality: "no_site" | "needs_update" = website ? "needs_update" : "no_site";

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
      city: tags["addr:city"] || null,
      lat,
      lon
    });
  }

  await supabase.from("business_search_cache").upsert(
    { category, city: FRANCE_CACHE_CITY, results, created_at: new Date().toISOString() },
    { onConflict: "category,city" }
  );

  return results;
}
