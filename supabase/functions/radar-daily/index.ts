// ZENOA RADAR — Supabase Edge Function "radar-daily"
// Génère automatiquement jusqu'à 20 nouveaux prospects par jour pour
// chaque utilisateur ayant configuré une recherche automatique
// (table radar_search_settings), sans jamais resurfacer un prospect
// déjà vu (contrainte unique user_id+osm_id sur radar_leads).
//
// Appelée une fois par jour par un job pg_cron (voir
// radar-auto-prospecting.sql), PAS par le client : pas de JWT
// utilisateur, on utilise directement la clé service_role.
//
// IMPORTANT (budget CPU) : l'ancienne version de ce type de fonction
// a déjà planté en production (WORKER_RESOURCE_LIMIT) en essayant de
// visiter trop de sites web dans une seule invocation groupant tous
// les utilisateurs. Ici le budget de scraping (lecture de site pour
// trouver un email) est volontairement modeste et partagé entre tous
// les utilisateurs traités dans la même invocation.

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCachedOrFreshResults } from "../_shared/osm-search-lib.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const LEADS_PER_USER_PER_DAY = 20;
const MAX_SCRAPES_PER_INVOCATION = 30; // partagé entre tous les utilisateurs de cette exécution

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const scrapeBudget = { count: 0 };
  const summary: Array<{ user_id: string; inserted: number; error?: string }> = [];

  try {
    const { data: settings, error: settingsError } = await supabase
      .from("radar_search_settings")
      .select("user_id, category, city");

    if (settingsError) return jsonResponse({ error: settingsError.message }, 500);

    for (const setting of settings || []) {
      const { user_id, category, city } = setting as { user_id: string; category: string; city: string };
      try {
        // Un cache (category, city) sert pour tous les utilisateurs
        // qui ciblent la même combinaison le même jour.
        const results = await getCachedOrFreshResults(category, city, supabase, scrapeBudget, MAX_SCRAPES_PER_INVOCATION);
        if (!results || !results.length) {
          summary.push({ user_id, inserted: 0 });
          continue;
        }

        // Ne garder que les fiches jamais vues par cet utilisateur.
        const { data: existing } = await supabase
          .from("radar_leads")
          .select("osm_id")
          .eq("user_id", user_id)
          .not("osm_id", "is", null);
        const seen = new Set((existing || []).map((r: any) => r.osm_id));

        const fresh = results.filter((r: any) => r.osm_id && !seen.has(r.osm_id)).slice(0, LEADS_PER_USER_PER_DAY);
        if (!fresh.length) {
          summary.push({ user_id, inserted: 0 });
          continue;
        }

        const rows = fresh.map((r: any) => ({
          user_id,
          osm_id: r.osm_id,
          name: r.name,
          address: r.address,
          phone: r.phone,
          website: r.website,
          email: r.email,
          category,
          city,
          site_quality: r.site_quality,
          status: "en_attente"
        }));

        const { error: insertError } = await supabase.from("radar_leads").insert(rows);
        if (insertError) {
          summary.push({ user_id, inserted: 0, error: insertError.message });
          continue;
        }

        summary.push({ user_id, inserted: rows.length });
      } catch (err) {
        summary.push({ user_id, inserted: 0, error: String(err) });
      }
    }

    return jsonResponse({ ok: true, summary });
  } catch (err) {
    return jsonResponse({ error: "Erreur serveur", detail: String(err) }, 500);
  }
});
