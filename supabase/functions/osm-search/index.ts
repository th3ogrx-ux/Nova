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
//
// La logique de géocodage/Overpass/lecture de site est partagée avec
// la fonction "radar-daily" (génération automatique quotidienne) —
// voir ../_shared/osm-search-lib.ts.

import { createClient } from "npm:@supabase/supabase-js@2";
import { CATEGORY_TAGS, getCachedOrFreshResults } from "../_shared/osm-search-lib.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const MAX_TOTAL_SCRAPES = 20; // plafond de sites visités par recherche (budget CPU de la fonction)

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
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
    if (!CATEGORY_TAGS[category]) return jsonResponse({ error: "Catégorie inconnue." }, 400);
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

    // ---------- Résultats (cache partagé, ou recherche fraîche) ----------
    const scrapeBudget = { count: 0 };
    const results = await getCachedOrFreshResults(category, city, supabase, scrapeBudget, MAX_TOTAL_SCRAPES);
    if (results === null) {
      return jsonResponse({ error: "Ville introuvable." }, 404);
    }

    await supabase.from("search_history").insert({ user_id: userId, category, city, result_count: results.length });

    return jsonResponse({ results, category, city });
  } catch (err) {
    return jsonResponse({ error: "Erreur serveur", detail: String(err) }, 500);
  }
});
