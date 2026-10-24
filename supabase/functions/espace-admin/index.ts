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
//   team_list                                         -> membres de l'équipe + partenaires (clients), e-mails et dernière activité
//   team_create     { email, role_id?, pseudo? }      -> compte de membre + mot de passe temporaire
//   team_remove     { user_id }                       -> exclut un membre (supprime son compte)
//   team_reset_password { user_id }                   -> nouveau mot de passe temporaire pour un membre
//
// Fichier volontairement autonome (aucun import local) : à coller tel quel dans
// Supabase > Edge Functions > (nouvelle fonction "espace-admin") > Code > Deploy.

import { createClient } from "npm:@supabase/supabase-js@2";

// Domaine autorisé à appeler la fonction : secret ALLOWED_ORIGINS (ex. "https://mon-site.vercel.app"),
// un seul domaine. Sans ce secret, tous les domaines sont acceptés ("*").
const ALLOWED_ORIGIN = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",")[0].trim();
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN || "*",
  "Vary": "Origin",
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

// Journal de sécurité (jamais de mot de passe ni d'e-mail). N'empêche jamais l'action en cas d'erreur.
async function audit(db: any, type: string, actor: string, businessId: string | null = null) {
  try { await db.from("audit_log").insert({ type, actor, business_id: businessId }); } catch (e) { console.error("[espace-admin] audit", e); }
}

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

async function createClientAccount(db: any, body: any, actor: string) {
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
  await audit(db, "client_created", actor, business.id);
  return json({ business_id: business.id, email, temp_password: password });
}

async function resetPassword(db: any, body: any, actor: string) {
  if (!UUID_RE.test(String(body.business_id || ""))) return json({ error: "Commerce invalide." }, 400);
  const profile = await clientProfile(db, body.business_id);
  if (!profile) return json({ error: "Ce commerce n'a pas de compte client." }, 404);
  const password = generateTempPassword();
  const { data, error } = await db.auth.admin.updateUserById(profile.id, { password, user_metadata: { must_change_password: true } });
  if (error || !data || !data.user) return json({ error: "Réinitialisation impossible." }, 500);
  await audit(db, "client_password_reset", actor, body.business_id);
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

async function deleteClient(db: any, body: any, actor: string) {
  if (!UUID_RE.test(String(body.business_id || ""))) return json({ error: "Commerce invalide." }, 400);
  // Seulement des comptes "client" : jamais un administrateur.
  const { data: profiles } = await db.from("espace_profiles").select("id").eq("business_id", body.business_id).eq("role", "client");
  for (const p of profiles || []) await db.auth.admin.deleteUser(p.id);
  const { error } = await db.from("espace_businesses").delete().eq("id", body.business_id); // supprime en cascade chiffres, avis, tâches, messages
  if (error) return json({ error: "Suppression impossible." }, 500);
  await audit(db, "client_deleted", actor, body.business_id);
  return json({ ok: true });
}

// ---------- Équipe : membres (comptes avec un rôle) et partenaires (clients) ----------

// Tout ce qu'il faut pour la page « Équipe » : membres, clients, dernière activité. Les e-mails et dernières connexions
// ne sont lisibles que côté serveur (auth.users), d'où cette action.
async function teamList(db: any) {
  const [m, pr, pf, cl] = await Promise.all([
    db.from("team_members").select("user_id,role_id,created_at"),
    db.from("team_presence").select("user_id,last_seen"),
    db.from("user_profiles").select("user_id,pseudo,avatar_url"),
    db.from("espace_profiles").select("id,business_id").eq("role", "client")
  ]);
  if (m.error) return json({ error: "La table des membres n'est pas installée : colle equipe.sql dans Supabase (SQL Editor)." }, 500);
  const presence: Record<string, string> = {};
  for (const r of pr.data || []) presence[r.user_id] = r.last_seen;
  const profiles: Record<string, any> = {};
  for (const r of pf.data || []) profiles[r.user_id] = r;
  const info = async (id: string) => {
    const { data } = await db.auth.admin.getUserById(id);
    const u = data && data.user;
    return { email: u ? u.email : null, last_sign_in_at: u ? u.last_sign_in_at || null : null, must_change_password: !!(u && u.user_metadata && u.user_metadata.must_change_password) };
  };
  const members = await Promise.all((m.data || []).map(async (r: any) => ({
    user_id: r.user_id, role_id: r.role_id, created_at: r.created_at,
    pseudo: (profiles[r.user_id] || {}).pseudo || null, avatar_url: (profiles[r.user_id] || {}).avatar_url || null,
    last_seen: presence[r.user_id] || null, ...(await info(r.user_id))
  })));
  const { data: biz } = await db.from("espace_businesses").select("id,nom,is_example");
  const names: Record<string, string> = {};
  for (const b of biz || []) if (!b.is_example) names[b.id] = b.nom;
  const partners = (await Promise.all((cl.data || []).filter((r: any) => names[r.business_id]).map(async (r: any) => ({
    user_id: r.id, business_id: r.business_id, nom: names[r.business_id], last_seen: presence[r.id] || null, ...(await info(r.id))
  }))));
  return json({ members, partners });
}

async function teamCreate(db: any, body: any, actor: string) {
  const email = text(body.email, 200).toLowerCase();
  const pseudo = text(body.pseudo, 40);
  if (!EMAIL_RE.test(email)) return json({ error: "L'email n'est pas valide." }, 400);
  let roleId: string | null = null;
  if (body.role_id) {
    if (!UUID_RE.test(String(body.role_id))) return json({ error: "Rôle invalide." }, 400);
    const { data: role } = await db.from("team_roles").select("id").eq("id", body.role_id).maybeSingle();
    if (!role) return json({ error: "Ce rôle n'existe pas." }, 400);
    roleId = role.id;
  }
  const password = generateTempPassword();
  const { data: created, error: userError } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { must_change_password: true } });
  if (userError || !created || !created.user) {
    const exists = /already|registered|exists/i.test(userError ? userError.message : "");
    return json({ error: exists ? "Un compte existe déjà avec cet email." : "Création du compte impossible." }, exists ? 409 : 500);
  }
  const { error: memberError } = await db.from("team_members").insert({ user_id: created.user.id, role_id: roleId });
  if (memberError) {
    await db.auth.admin.deleteUser(created.user.id);
    return json({ error: "Création du membre impossible. As-tu collé equipe.sql dans Supabase ?" }, 500);
  }
  if (pseudo) { try { await db.from("user_profiles").insert({ user_id: created.user.id, pseudo }); } catch (e) { console.error("[espace-admin] pseudo", e); } }
  await audit(db, "team_member_created", actor);
  return json({ user_id: created.user.id, email, temp_password: password });
}

// Seulement un membre de l'équipe : jamais l'admin, jamais un client.
async function memberOnly(db: any, id: unknown) {
  if (!UUID_RE.test(String(id || ""))) return null;
  const { data } = await db.from("team_members").select("user_id").eq("user_id", id).maybeSingle();
  return data ? String(id) : null;
}
async function teamRemove(db: any, body: any, actor: string) {
  const id = await memberOnly(db, body.user_id);
  if (!id) return json({ error: "Membre introuvable." }, 404);
  await db.from("team_members").delete().eq("user_id", id);
  const { error } = await db.auth.admin.deleteUser(id);
  if (error) return json({ error: "Suppression impossible." }, 500);
  await audit(db, "team_member_removed", actor);
  return json({ ok: true });
}
async function teamResetPassword(db: any, body: any, actor: string) {
  const id = await memberOnly(db, body.user_id);
  if (!id) return json({ error: "Membre introuvable." }, 404);
  const password = generateTempPassword();
  const { data, error } = await db.auth.admin.updateUserById(id, { password, user_metadata: { must_change_password: true } });
  if (error || !data || !data.user) return json({ error: "Réinitialisation impossible." }, 500);
  await audit(db, "team_member_password_reset", actor);
  return json({ email: data.user.email, temp_password: password });
}

export async function handle(req: Request, db: any): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  try {
    const auth = await requireAdmin(req, db);
    if (auth.error) return auth.error;
    const body = await req.json().catch(() => ({}));
    switch (body.action) {
      case "create_client": return await createClientAccount(db, body, auth.user.id);
      case "reset_password": return await resetPassword(db, body, auth.user.id);
      case "get_account": return await getAccount(db, body);
      case "delete_client": return await deleteClient(db, body, auth.user.id);
      case "team_list": return await teamList(db);
      case "team_create": return await teamCreate(db, body, auth.user.id);
      case "team_remove": return await teamRemove(db, body, auth.user.id);
      case "team_reset_password": return await teamResetPassword(db, body, auth.user.id);
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
