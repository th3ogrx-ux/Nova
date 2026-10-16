// Génération des prospects du jour pour Zenoa Radar.
//
// La recherche OpenStreetMap (Overpass) se fait depuis le navigateur :
// les serveurs Overpass gratuits refusent les appels venant des
// serveurs de Supabase (réponses 406 / 50x depuis le datacenter), mais
// acceptent ceux des navigateurs. La liste trouvée est ensuite envoyée
// à l'edge function "radar-daily", qui applique le quota de 50 par jour,
// enregistre les prospects et cherche les emails sur leurs sites (ce
// que le navigateur ne peut pas faire, faute d'autorisation CORS).
import { supabase } from "./supabase.js";

export const LEADS_PER_DAY = 50;
const CITIES_PER_DAY = 3;
const SEARCH_RADIUS_METERS = 10000;
const RESULTS_PER_CITY = 400;
const OVERPASS_TIMEOUT_MS = 30000;
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter"
];

// Métiers ciblés -> tag OpenStreetMap (même liste que la validation
// côté radar-daily). Déménageurs, wedding planners, nettoyage/services
// à domicile et e-commerçants n'ont pas de tag OSM fiable.
const CATEGORY_TAGS = {
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

// Grandes villes réparties sur tout le territoire.
const CITIES = [
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

// Tirage déterministe par jour et par utilisateur : chacun a ses propres
// villes, qui changent chaque jour.
function pickDaily(items, count, seed) {
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

function categoryOf(tags) {
  for (const [category, tag] of Object.entries(CATEGORY_TAGS)) {
    if (tags[tag.key] === tag.value) return category;
  }
  return null;
}

function buildAddress(tags) {
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:postcode"],
    tags["addr:city"]
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

async function runOverpass(query, firstEndpoint) {
  let lastError = "";
  for (let k = 0; k < OVERPASS_ENDPOINTS.length; k++) {
    const endpoint = OVERPASS_ENDPOINTS[(firstEndpoint + k) % OVERPASS_ENDPOINTS.length];
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS)
      });
      if (!res.ok) {
        lastError = endpoint + " a répondu " + res.status;
        continue;
      }
      const data = await res.json();
      // Overpass répond 200 avec une "remark" quand la requête expire.
      if (data.remark && !(data.elements || []).length) {
        lastError = endpoint + " : " + data.remark;
        continue;
      }
      return data.elements || [];
    } catch (err) {
      // "Failed to fetch" : le serveur a répondu une erreur sans en-têtes
      // CORS (le navigateur masque alors le code), ou n'est pas joignable.
      const host = new URL(endpoint).host;
      lastError = err.name === "TimeoutError" ? host + " : trop lent" : host + " : refusé ou injoignable";
    }
  }
  throw new Error(lastError);
}

// Une instruction par clé OSM (craft, shop, office…) avec la liste de ses
// valeurs, écrites sans guillemets autour de "clé=valeur" : les serveurs
// Overpass rejetaient (406 / erreurs sans en-têtes CORS) la requête à
// 54 filtres ["clé"="valeur"], motif typique de ce que les pare-feux
// applicatifs prennent pour une injection SQL.
function buildTagStatements() {
  const valuesByKey = {};
  for (const { key, value } of Object.values(CATEGORY_TAGS)) {
    (valuesByKey[key] = valuesByKey[key] || []).push(value);
  }
  return Object.entries(valuesByKey)
    .map(([key, values]) => {
      const filter = values.length === 1 ? `[${key}=${values[0]}]` : `[${key}~"^(${values.join("|")})$"]`;
      return `node${filter};way${filter};`;
    })
    .join("");
}

// Toutes les entreprises joignables (téléphone, email ou site) des
// métiers ciblés, dans un rectangle autour de la ville.
async function searchCity(city, firstEndpoint) {
  const dLat = SEARCH_RADIUS_METERS / 111320;
  const dLon = SEARCH_RADIUS_METERS / (111320 * Math.cos((city.lat * Math.PI) / 180));
  const bbox = [city.lat - dLat, city.lon - dLon, city.lat + dLat, city.lon + dLon].map((n) => n.toFixed(4)).join(",");
  const statements = buildTagStatements();
  const elements = await runOverpass(`[out:json][timeout:25][bbox:${bbox}];(${statements});out center tags ${RESULTS_PER_CITY};`, firstEndpoint);

  const results = [];
  for (const el of elements) {
    const tags = el.tags || {};
    const category = categoryOf(tags);
    if (!tags.name || !category) continue;
    const website = tags.website || tags["contact:website"] || null;
    const phone = tags.phone || tags["contact:phone"] || null;
    const email = tags.email || tags["contact:email"] || null;
    if (!website && !phone && !email) continue;
    results.push({
      osm_id: el.type + "/" + el.id,
      name: tags.name,
      address: buildAddress(tags),
      phone,
      website,
      email,
      category,
      city: tags["addr:city"] || city.name
    });
  }
  return results;
}

// Génère les prospects du jour si l'utilisateur n'en a encore reçu
// aucun aujourd'hui. `onStatus` affiche la progression à l'écran.
// Renvoie le nombre de prospects ajoutés (0 si déjà fait aujourd'hui).
export async function generateTodayLeadsIfNeeded(userId, onStatus) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count, error: countError } = await supabase
    .from("radar_leads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfDay.toISOString());
  if (countError) throw new Error(countError.message);
  if (count > 0) return 0;

  onStatus("Zenoa Radar cherche tes entreprises du jour… (ça peut prendre jusqu'à une minute)");

  const seed = startOfDay.toISOString().slice(0, 10) + userId;
  const cities = pickDaily(CITIES, CITIES_PER_DAY, seed);
  let candidates = [];
  const errors = [];
  // Une ville après l'autre : les serveurs Overpass limitent le nombre
  // de requêtes simultanées par visiteur.
  for (let i = 0; i < cities.length; i++) {
    try {
      candidates = candidates.concat(await searchCity(cities[i], i));
    } catch (err) {
      errors.push(cities[i].name + " : " + err.message);
    }
  }
  if (!candidates.length) {
    throw new Error("Impossible de joindre OpenStreetMap pour le moment (" + errors.join(" | ") + "). Réessaie dans quelques minutes.");
  }

  // Mélange pour alterner villes et métiers dans la liste du jour.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const { data, error } = await supabase.functions.invoke("radar-daily", { body: { candidates } });
  if (error) {
    let message = error.message;
    try { message = (await error.context.json()).error || message; } catch { /* corps non JSON */ }
    throw new Error(message);
  }
  return (data && data.inserted) || 0;
}
