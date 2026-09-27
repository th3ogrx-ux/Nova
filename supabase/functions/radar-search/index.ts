// ZENOA — Supabase Edge Function
// Appelée directement depuis le front (Zenoa Radar) via fetch().
// Recherche des entreprises via l'API Google Places (New) puis tente
// d'extraire une adresse email sur le site web de chaque résultat.
//
// Secret requis (supabase secrets set ...) :
//   GOOGLE_PLACES_API_KEY
// (SUPABASE_URL et SUPABASE_ANON_KEY sont fournis automatiquement
// par la plateforme Supabase à toutes les Edge Functions.)

import { createClient } from "npm:@supabase/supabase-js@2";

const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const MAILTO_RE = /mailto:([^"'?\s]+)/i;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

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

    const placesRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.nationalPhoneNumber,places.websiteUri"
      },
      body: JSON.stringify({
        textQuery: category + " à " + city,
        languageCode: "fr"
      })
    });

    if (!placesRes.ok) {
      const errText = await placesRes.text().catch(() => "");
      return new Response(JSON.stringify({ error: "erreur Google Places", detail: errText }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    const placesData = await placesRes.json();
    const places = placesData.places || [];

    const results = await Promise.all(places.map(async (p: any) => {
      const website = p.websiteUri || null;
      const email = website ? await scrapeEmail(website) : null;
      return {
        name: (p.displayName && p.displayName.text) || "Sans nom",
        address: p.formattedAddress || null,
        phone: p.internationalPhoneNumber || p.nationalPhoneNumber || null,
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
