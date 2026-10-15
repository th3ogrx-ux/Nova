// ZENOA RADAR — Supabase Edge Function "radar-daily"
// Génère automatiquement jusqu'à 50 nouveaux prospects par jour pour
// CHAQUE utilisateur inscrit, partout en France (aucune recherche à
// configurer), sans jamais resurfacer un prospect déjà vu (contrainte
// unique user_id+osm_id sur radar_leads).
//
// Appelée une fois par jour (6h du matin) par un job pg_cron (voir
// radar-auto-prospecting.sql), PAS par le client : pas de JWT
// utilisateur, on utilise directement la clé service_role.
//
// IMPORTANT (budget CPU) : l'ancienne version de ce type de fonction
// a déjà planté en production (WORKER_RESOURCE_LIMIT) en essayant de
// faire trop de travail dans une seule invocation. Ici on limite le
// nombre de catégories interrogées par jour (un sous-ensemble tournant
// de toutes les catégories), et on NE visite PAS les sites web des
// résultats (pas de recherche d'email) pour rester léger.

import { createClient } from "npm:@supabase/supabase-js@2";
import { CATEGORY_TAGS, getCountryResultsForCategory } from "../_shared/osm-search-lib.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const LEADS_PER_USER_PER_DAY = 50;
const CATEGORIES_PER_DAY = 5; // limite le nombre d'appels Overpass par exécution

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}

// Tirage pseudo-aléatoire mais déterministe pour la journée (même
// résultat si la fonction est relancée plusieurs fois le même jour),
// qui change automatiquement chaque jour suivant.
function pickDailyCategories(allCategories: string[], count: number) {
  const seed = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ---------- Pool du jour : quelques catégories, recherchées dans toute la France ----------
    const categories = pickDailyCategories(Object.keys(CATEGORY_TAGS), CATEGORIES_PER_DAY);
    let pool: any[] = [];

    for (const category of categories) {
      try {
        const results = await getCountryResultsForCategory(category, supabase);
        pool = pool.concat(results.map((r: any) => ({ ...r, category })));
      } catch (err) {
        console.error("[radar-daily] catégorie " + category + " : " + err);
      }
    }
    shuffleInPlace(pool);

    // ---------- Tous les utilisateurs inscrits ----------
    const userIds: string[] = [];
    let page = 1;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !data) break;
      userIds.push(...data.users.map((u) => u.id));
      if (data.users.length < 200) break;
      page++;
    }

    const summary: Array<{ user_id: string; inserted: number; error?: string }> = [];

    for (const userId of userIds) {
      try {
        // Ne garder que les fiches jamais vues par cet utilisateur.
        const { data: existing } = await supabase
          .from("radar_leads")
          .select("osm_id")
          .eq("user_id", userId)
          .not("osm_id", "is", null);
        const seen = new Set((existing || []).map((r: any) => r.osm_id));

        const fresh = pool.filter((r) => r.osm_id && !seen.has(r.osm_id)).slice(0, LEADS_PER_USER_PER_DAY);
        if (!fresh.length) {
          summary.push({ user_id: userId, inserted: 0 });
          continue;
        }

        const rows = fresh.map((r: any) => ({
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
          summary.push({ user_id: userId, inserted: 0, error: insertError.message });
          continue;
        }

        summary.push({ user_id: userId, inserted: rows.length });
      } catch (err) {
        summary.push({ user_id: userId, inserted: 0, error: String(err) });
      }
    }

    return jsonResponse({ ok: true, categories, pool_size: pool.length, summary });
  } catch (err) {
    return jsonResponse({ error: "Erreur serveur", detail: String(err) }, 500);
  }
});
