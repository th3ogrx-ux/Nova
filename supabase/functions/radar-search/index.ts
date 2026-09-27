// ZENOA — Supabase Edge Function
// Appelée directement depuis le front (Zenoa Radar) via fetch().
// Recherche des entreprises via l'API Geoapify Places (gratuite, sans
// carte bancaire) puis tente d'extraire une adresse email sur le site
// web de chaque résultat.
//
// Secret requis (supabase secrets set ...) :
//   GEOAPIFY_API_KEY
// (SUPABASE_URL et SUPABASE_ANON_KEY sont fournis automatiquement
// par la plateforme Supabase à toutes les Edge Functions.)

import { createClient } from "npm:@supabase/supabase-js@2";

const GEOAPIFY_API_KEY = Deno.env.get("GEOAPIFY_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const MAILTO_RE = /mailto:([^"'?\s]+)/i;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// Table de correspondance mots-clés FR -> catégorie Geoapify Places.
// L'API Geoapify ne fait pas de recherche plein texte : il faut mapper
// la catégorie tapée par l'utilisateur vers un code de catégorie connu.
const CATEGORY_MAP: { keywords: string[]; category: string }[] = [
  { keywords: ["restaurant", "resto"], category: "catering.restaurant" },
  { keywords: ["pizzeria", "pizza"], category: "catering.restaurant.pizza" },
  { keywords: ["sushi", "japonais"], category: "catering.restaurant.sushi" },
  { keywords: ["cafe", "café", "coffee"], category: "catering.cafe" },
  { keywords: ["bar", "pub"], category: "catering.bar" },
  { keywords: ["fastfood", "fast food", "snack", "kebab"], category: "catering.fast_food" },
  { keywords: ["boulangerie", "boulanger", "patisserie", "pâtisserie"], category: "commercial.food_and_drink.bakery" },
  { keywords: ["supermarche", "supermarché", "epicerie", "épicerie"], category: "commercial.supermarket" },
  { keywords: ["coiffeur", "coiffeuse", "coiffure", "salon de coiffure"], category: "service.beauty.hairdresser" },
  { keywords: ["spa"], category: "service.beauty.spa" },
  { keywords: ["massage"], category: "service.beauty.massage" },
  { keywords: ["tatoueur", "tatouage", "tattoo"], category: "service.beauty.tattoo" },
  { keywords: ["dentiste"], category: "healthcare.dentist" },
  { keywords: ["medecin", "médecin", "docteur", "cabinet medical", "cabinet médical"], category: "healthcare.clinic_or_praxis" },
  { keywords: ["pharmacie"], category: "healthcare.pharmacy" },
  { keywords: ["vetement", "vêtement", "pret-a-porter", "prêt-à-porter", "boutique"], category: "commercial.clothing.clothes" },
  { keywords: ["chaussure", "chaussures"], category: "commercial.clothing.shoes" },
  { keywords: ["fleuriste"], category: "commercial.florist" },
  { keywords: ["garage", "mecanicien", "mécanicien", "reparation auto", "réparation auto"], category: "service.vehicle.repair.car" },
  { keywords: ["banque"], category: "service.financial.bank" },
  { keywords: ["opticien"], category: "commercial.health_and_beauty.optician" },
  { keywords: ["salle de sport", "fitness", "gym", "musculation"], category: "sport.fitness.gym" },
  { keywords: ["hotel", "hôtel"], category: "accommodation.hotel" }
];

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function resolveCategory(input: string): string | null {
  const n = normalize(input);
  for (const entry of CATEGORY_MAP) {
    for (const kw of entry.keywords) {
      const nk = normalize(kw);
      if (n.includes(nk) || nk.includes(n)) return entry.category;
    }
  }
  return null;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "non authentifié" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData || !userData.user) {
      return new Response(JSON.stringify({ error: "non authentifié" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    const body = await req.json().catch(() => ({}));
    const city = (body.city || "").toString().trim();
    const category = (body.category || "").toString().trim();

    if (!city || !category) {
      return new Response(JSON.stringify({ error: "ville et catégorie requises" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    const geoCategory = resolveCategory(category);
    if (!geoCategory) {
      return new Response(JSON.stringify({
        error: "catégorie non reconnue, essaie un terme plus courant (restaurant, coiffeur, bar, hôtel, pharmacie, boulangerie...)"
      }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    const geocodeUrl = "https://api.geoapify.com/v1/geocode/search?text=" + encodeURIComponent(city) +
      "&type=city&lang=fr&limit=1&apiKey=" + GEOAPIFY_API_KEY;
    const geocodeRes = await fetch(geocodeUrl);
    if (!geocodeRes.ok) {
      return new Response(JSON.stringify({ error: "erreur de géocodage de la ville" }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }
    const geocodeData = await geocodeRes.json();
    const cityFeature = (geocodeData.features || [])[0];
    const placeId = cityFeature && cityFeature.properties && cityFeature.properties.place_id;
    if (!placeId) {
      return new Response(JSON.stringify({ error: "ville introuvable" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    const placesUrl = "https://api.geoapify.com/v2/places?categories=" + encodeURIComponent(geoCategory) +
      "&filter=place:" + encodeURIComponent(placeId) + "&limit=20&lang=fr&apiKey=" + GEOAPIFY_API_KEY;
    const placesRes = await fetch(placesUrl);
    if (!placesRes.ok) {
      const errText = await placesRes.text().catch(() => "");
      return new Response(JSON.stringify({ error: "erreur Geoapify Places", detail: errText }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    const placesData = await placesRes.json();
    const features = placesData.features || [];

    const results = await Promise.all(features.map(async (f: any) => {
      const p = f.properties || {};
      const website = p.website || null;
      const email = website ? await scrapeEmail(website) : null;
      return {
        name: p.name || p.address_line1 || "Sans nom",
        address: p.formatted || null,
        phone: p.phone || (p.contact && p.contact.phone) || null,
        website,
        email
      };
    }));

    return new Response(JSON.stringify({ results }), {
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
