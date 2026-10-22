// Client Supabase "tout-puissant" (clé secrète service_role).
// "server-only" : si ce fichier est importé par du code du navigateur, la
// compilation échoue — la clé secrète ne peut donc jamais partir au client.
// À utiliser uniquement pour créer des comptes (jamais pour lire des données).
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante (voir .env.example)");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
