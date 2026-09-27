// ZENOA — Supabase Edge Function
// Tirage quotidien automatique de 20 prospects (Zenoa Radar), déclenché
// par pg_cron tous les jours à midi (voir radar-leads.sql pour la table
// et le cron). Peut aussi être déclenchée manuellement pour un test.
//
// Sécurité : cette fonction n'est pas appelée par un utilisateur connecté
// (elle est déclenchée par le planificateur côté base de données), donc
// elle est protégée par un secret partagé plutôt que par une session.
//
// Secrets requis (supabase secrets set ...) :
//   GEOAPIFY_API_KEY, RADAR_CRON_SECRET
// (SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement
// par la plateforme Supabase à toutes les Edge Functions.)

import { createClient } from "npm:@supabase/supabase-js@2";

const GEOAPIFY_API_KEY = Deno.env.get("GEOAPIFY_API_KEY")!;
const RADAR_CRON_SECRET = Deno.env.get("RADAR_CRON_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
};

const DAILY_TARGET = 20;
const MAX_ATTEMPTS = 14;

const MAILTO_RE = /mailto:([^"'?\s]+)/i;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// Les 31 métiers de la liste du chef qui correspondent à une vraie
// catégorie Geoapify Places (les ~20 autres métiers indépendants —
// plombiers, kinés, wedding planners, etc. — n'existent pas comme
// catégorie de lieu cherchable dans les données OpenStreetMap).
const TRADES: { label: string; category: string }[] = [
  { label: "Coiffeurs / barbiers", category: "service.beauty.hairdresser" },
  { label: "Instituts de beauté / onglerie", category: "service.beauty.spa,service.beauty.massage,service.beauty.tanning_salon" },
  { label: "Restaurants", category: "catering.restaurant" },
  { label: "Pizzerias / snacks", category: "catering.restaurant.pizza,catering.fast_food" },
  { label: "Boulangers / pâtissiers", category: "commercial.food_and_drink.bakery" },
  { label: "Fleuristes", category: "commercial.florist" },
  { label: "Primeurs / épiceries de quartier", category: "commercial.food_and_drink.fruit_and_vegetable,commercial.convenience" },
  { label: "Bouchers / poissonniers", category: "commercial.food_and_drink.butcher,commercial.food_and_drink.seafood" },
  { label: "Électriciens", category: "service.electrician" },
  { label: "Menuisiers / ébénistes", category: "service.carpenter" },
  { label: "Garages / mécaniciens auto", category: "service.vehicle.repair.car" },
  { label: "Loueurs de véhicules indépendants", category: "rental.car" },
  { label: "Dentistes indépendants", category: "healthcare.dentist" },
  { label: "Vétérinaires", category: "pet.veterinary" },
  { label: "Salles de sport locales", category: "sport.fitness.gym,sport.fitness.fitness_centre" },
  { label: "Auto-écoles", category: "education.driving_school" },
  { label: "Agences immobilières locales", category: "office.estate_agent" },
  { label: "Avocats indépendants", category: "office.lawyer" },
  { label: "Notaires", category: "office.notary" },
  { label: "Experts-comptables indépendants", category: "office.accountant" },
  { label: "Architectes indépendants", category: "office.architect" },
  { label: "Hôtels indépendants", category: "accommodation.hotel" },
  { label: "Gîtes / chambres d'hôtes", category: "accommodation.guest_house" },
  { label: "Campings indépendants", category: "camping.camp_site" },
  { label: "Photographes", category: "service.photographer" },
  { label: "Salons de tatouage", category: "service.beauty.tattoo" },
  { label: "Serruriers", category: "service.locksmith" },
  { label: "Taxis / VTC indépendants", category: "service.taxi" },
  { label: "Librairies indépendantes", category: "commercial.books" },
  { label: "Magasins de vélos", category: "commercial.outdoor_and_sport.bicycle" },
  { label: "Cabinets de recrutement indépendants", category: "office.employment_agency" }
];

// Grandes et moyennes villes françaises réparties sur tout le territoire,
// pour une prospection qui couvre "toute la France" au fil des jours.
const CITIES = [
  "Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Montpellier", "Strasbourg",
  "Bordeaux", "Lille", "Rennes", "Reims", "Le Havre", "Saint-Étienne", "Toulon", "Grenoble",
  "Dijon", "Angers", "Nîmes", "Villeurbanne", "Clermont-Ferrand", "Le Mans", "Aix-en-Provence",
  "Brest", "Tours", "Limoges", "Amiens", "Annecy", "Perpignan", "Metz", "Besançon", "Orléans",
  "Rouen", "Mulhouse", "Caen", "Nancy", "Argenteuil", "Roubaix", "Tourcoing", "Avignon",
  "Dunkerque", "Poitiers", "Versailles", "La Rochelle", "Pau", "Béziers", "Colmar", "Bourges",
  "Ajaccio", "Cannes", "Antibes", "Chambéry", "Valence", "Troyes", "Niort", "Vannes", "Quimper",
  "Bayonne", "Albi", "Blois"
];

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function scrapeEmail(websiteUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ZenoaRadar/1.0)" }
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    const mailtoMatch = html.match(MAILTO_RE);
    if (mailtoMatch && mailtoMatch[1]) {
      return decodeURIComponent(mailtoMatch[1]).replace(/\.(html?|php)$/i, "");
    }
    const emailMatch = html.match(EMAIL_RE);
    if (emailMatch) return emailMatch[0];
    return null;
  } catch {
    return null;
  }
}

function parisDateStr(): string {
  // "sent_date" doit correspondre à la date vue par l'équipe (heure de
  // Paris), pas à la date par défaut de Postgres (UTC) — sinon un tirage
  // qui tombe entre 22h et minuit UTC (déjà le lendemain à Paris) se
  // range sous la mauvaise date et disparaît de "Prospects du jour".
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

async function geocodeCity(city: string): Promise<{ placeId: string | null; error: string | null }> {
  const url = "https://api.geoapify.com/v1/geocode/search?text=" + encodeURIComponent(city) +
    "&type=city&lang=fr&limit=1&apiKey=" + GEOAPIFY_API_KEY;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { placeId: null, error: "HTTP " + res.status + " " + body.slice(0, 300) };
  }
  const data = await res.json();
  const feature = (data.features || [])[0];
  const placeId = (feature && feature.properties && feature.properties.place_id) || null;
  if (!placeId) return { placeId: null, error: "pas de place_id dans la réponse : " + JSON.stringify(data).slice(0, 300) };
  return { placeId, error: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const providedSecret = req.headers.get("x-cron-secret") || url.searchParams.get("secret") || "";
  if (providedSecret !== RADAR_CRON_SECRET) {
    return new Response(JSON.stringify({ error: "non autorisé" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }

  if (!GEOAPIFY_API_KEY) {
    return new Response(JSON.stringify({ error: "GEOAPIFY_API_KEY manquante côté secrets Supabase" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const geocodeCache: Record<string, string | null> = {};
    let inserted: any[] = [];
    let attempts = 0;
    let tradeOrder = shuffle(TRADES);
    let tradeIndex = 0;
    let geocodeFailures = 0;
    let placesFailures = 0;
    let zeroFeatureCount = 0;
    let lastPlacesError: string | null = null;
    let lastGeocodeError: string | null = null;

    while (inserted.length < DAILY_TARGET && attempts < MAX_ATTEMPTS) {
      attempts++;
      if (tradeIndex >= tradeOrder.length) tradeOrder = shuffle(TRADES);
      const trade = tradeOrder[tradeIndex % tradeOrder.length];
      tradeIndex++;
      const city = CITIES[Math.floor(Math.random() * CITIES.length)];

      if (!(city in geocodeCache)) {
        const g = await geocodeCity(city);
        geocodeCache[city] = g.placeId;
        if (g.error) lastGeocodeError = city + ": " + g.error;
      }
      const placeId = geocodeCache[city];
      if (!placeId) { geocodeFailures++; continue; }

      const placesUrl = "https://api.geoapify.com/v2/places?categories=" + encodeURIComponent(trade.category) +
        "&filter=place:" + encodeURIComponent(placeId) + "&limit=25&lang=fr&apiKey=" + GEOAPIFY_API_KEY;
      const placesRes = await fetch(placesUrl);
      if (!placesRes.ok) {
        placesFailures++;
        lastPlacesError = await placesRes.text().catch(() => placesRes.status.toString());
        continue;
      }
      const placesData = await placesRes.json();
      const features = placesData.features || [];
      if (!features.length) { zeroFeatureCount++; continue; }

      const candidatePlaceIds = features.map((f: any) => f.properties && f.properties.place_id).filter(Boolean);
      const existingRes = await supabase.from("radar_leads").select("place_id").in("place_id", candidatePlaceIds);
      const existingIds = new Set(((existingRes && existingRes.data) || []).map((r: any) => r.place_id));

      const freshFeatures = features.filter((f: any) => f.properties && f.properties.place_id && !existingIds.has(f.properties.place_id));
      const remaining = DAILY_TARGET - inserted.length;
      const toInsert = freshFeatures.slice(0, remaining);

      const rows = await Promise.all(toInsert.map(async (f: any) => {
        const p = f.properties || {};
        const website = p.website || null;
        const email = website ? await scrapeEmail(website) : null;
        return {
          place_id: p.place_id,
          name: p.name || p.address_line1 || "Sans nom",
          address: p.formatted || null,
          phone: p.phone || (p.contact && p.contact.phone) || null,
          website,
          email,
          category_label: trade.label,
          city: city,
          sent_date: parisDateStr()
        };
      }));

      if (rows.length) {
        const insertRes = await supabase.from("radar_leads").insert(rows).select();
        if (!insertRes.error && insertRes.data) inserted = inserted.concat(insertRes.data);
      }
    }

    return new Response(JSON.stringify({
      inserted: inserted.length,
      attempts: attempts,
      geocodeFailures: geocodeFailures,
      placesFailures: placesFailures,
      zeroFeatureCount: zeroFeatureCount,
      lastPlacesError: lastPlacesError,
      lastGeocodeError: lastGeocodeError
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "erreur serveur", detail: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }
});
