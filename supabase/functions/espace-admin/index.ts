// ZENOA ESPACE — Supabase Edge Function "espace-admin"
// Gère les comptes des clients. Utilise la clé secrète (service_role), qui ne
// quitte JAMAIS le serveur : le navigateur envoie seulement sa session, et la
// fonction vérifie qu'elle appartient bien à l'ADMIN avant toute action.
//
// Actions (corps JSON { action, ... }) :
//   create_client   { nom, secteur?, ville?, email }  -> commerce + compte + mot de passe temporaire
//   reset_password  { business_id }                   -> nouveau mot de passe temporaire
//   get_account     { business_id }                   -> email et dernière connexion du client
//   delete_client   { business_id }                   -> supprime le commerce, ses données et son compte
//
// Fichier volontairement autonome (aucun import local) : à coller tel quel dans
// Supabase > Edge Functions > (nouvelle fonction "espace-admin") > Code > Deploy.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; // sans 0/O, 1/l/I

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

// Mot de passe temporaire lisible : 3 groupes de 4 caractères, ex. "Kd7m-Xq2Z-hn4P".
export function generateTempPassword(): string {
  const bytes = new Uint8Array(12);
  const limit = 256 - (256 % PASSWORD_ALPHABET.length); // évite un biais statistique
  let chars = "";
  while (chars.length < 12) {
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < limit && chars.length < 12) chars += PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length];
    }
  }
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Vérifie que l'appelant est connecté ET administrateur (rôle lu dans la base).
async function requireAdmin(req: Request, db: any) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { error: json({ error: "Non authentifié." }, 401) };
  const { data, error } = await db.auth.getUser(token);
  if (error || !data || !data.user) return { error: json({ error: "Non authentifié." }, 401) };
  const { data: profile } = await db.from("espace_profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (!profile || profile.role !== "admin") return { error: json({ error: "Action réservée à l'administrateur." }, 403) };
  return { user: data.user };
}

async function clientProfile(db: any, businessId: string) {
  const { data } = await db.from("espace_profiles").select("id").eq("business_id", businessId).eq("role", "client").limit(1);
  return data && data[0] ? data[0] : null;
}

async function createClientAccount(db: any, body: any) {
  const nom = text(body.nom, 150);
  const secteur = text(body.secteur, 80);
  const ville = text(body.ville, 80);
  const email = text(body.email, 200).toLowerCase();
  if (!nom) return json({ error: "Indique le nom du commerce." }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: "L'email du contact n'est pas valide." }, 400);

  const { data: business, error: businessError } = await db
    .from("espace_businesses").insert({ nom, secteur: secteur || null, ville: ville || null }).select("id").single();
  if (businessError || !business) return json({ error: "Création du commerce impossible." }, 500);

  const password = generateTempPassword();
  const { data: created, error: userError } = await db.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { must_change_password: true }
  });
  if (userError || !created || !created.user) {
    await db.from("espace_businesses").delete().eq("id", business.id); // on ne laisse pas de commerce orphelin
    const exists = /already|registered|exists/i.test(userError ? userError.message : "");
    return json({ error: exists ? "Un compte existe déjà avec cet email." : "Création du compte impossible." }, exists ? 409 : 500);
  }

  const { error: profileError } = await db.from("espace_profiles").insert({ id: created.user.id, role: "client", business_id: business.id });
  if (profileError) {
    await db.auth.admin.deleteUser(created.user.id);
    await db.from("espace_businesses").delete().eq("id", business.id);
    return json({ error: "Création du profil impossible." }, 500);
  }
  return json({ business_id: business.id, email, temp_password: password });
}

async function resetPassword(db: any, body: any) {
  if (!UUID_RE.test(String(body.business_id || ""))) return json({ error: "Commerce invalide." }, 400);
  const profile = await clientProfile(db, body.business_id);
  if (!profile) return json({ error: "Ce commerce n'a pas de compte client." }, 404);
  const password = generateTempPassword();
  const { data, error } = await db.auth.admin.updateUserById(profile.id, { password, user_metadata: { must_change_password: true } });
  if (error || !data || !data.user) return json({ error: "Réinitialisation impossible." }, 500);
  return json({ email: data.user.email, temp_password: password });
}

async function getAccount(db: any, body: any) {
  if (!UUID_RE.test(String(body.business_id || ""))) return json({ error: "Commerce invalide." }, 400);
  const profile = await clientProfile(db, body.business_id);
  if (!profile) return json({ email: null });
  const { data, error } = await db.auth.admin.getUserById(profile.id);
  if (error || !data || !data.user) return json({ email: null });
  return json({
    email: data.user.email,
    last_sign_in_at: data.user.last_sign_in_at || null,
    must_change_password: !!(data.user.user_metadata && data.user.user_metadata.must_change_password)
  });
}

async function deleteClient(db: any, body: any) {
  if (!UUID_RE.test(String(body.business_id || ""))) return json({ error: "Commerce invalide." }, 400);
  // Seulement des comptes "client" : jamais un administrateur.
  const { data: profiles } = await db.from("espace_profiles").select("id").eq("business_id", body.business_id).eq("role", "client");
  for (const p of profiles || []) await db.auth.admin.deleteUser(p.id);
  const { error } = await db.from("espace_businesses").delete().eq("id", body.business_id); // supprime en cascade chiffres, avis, tâches, messages
  if (error) return json({ error: "Suppression impossible." }, 500);
  return json({ ok: true });
}

export async function handle(req: Request, db: any): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  try {
    const auth = await requireAdmin(req, db);
    if (auth.error) return auth.error;
    const body = await req.json().catch(() => ({}));
    switch (body.action) {
      case "create_client": return await createClientAccount(db, body);
      case "reset_password": return await resetPassword(db, body);
      case "get_account": return await getAccount(db, body);
      case "delete_client": return await deleteClient(db, body);
      default: return json({ error: "Action inconnue." }, 400);
    }
  } catch (err) {
    console.error("[espace-admin]", err);
    return json({ error: "Erreur inattendue." }, 500);
  }
}

Deno.serve((req) =>
  handle(req, createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false }
  }))
);
