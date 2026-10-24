// ZENOA AGENCY — Supabase Edge Function "audit-public"
// Publie les audits et sert la page publique (sans connexion). La clé secrète (service_role) ne quitte jamais le serveur.
//
// Actions (corps JSON { action, ... }) :
//   publish    { audit_id, password?, expires_at? }  [admin] -> publie (ou republie) ; password : texte = nouveau, "" = retirer, absent = inchangé
//   unpublish  { audit_id }                          [admin] -> dépublie (le lien affiche « Audit indisponible »)
//   view       { slug, password?, count? }           [public] -> contenu de la dernière version publiée + images (liens signés 1 h)
//
// Fichier volontairement autonome : à coller tel quel dans Supabase > Edge Functions > (nouvelle fonction "audit-public") > Deploy.

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",")[0].trim();
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN || "*",
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const SLUG_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[A-Za-z0-9]{8,16}$/;
const BUCKET = "user-resources";
const ITERATIONS = 100_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

// Lien impossible à deviner : 12 caractères tirés au hasard (≈ 70 bits).
export function makeSlug(length = 12): string {
  const limit = 256 - (256 % SLUG_ALPHABET.length);
  const bytes = new Uint8Array(32);
  let out = "";
  while (out.length < length) {
    crypto.getRandomValues(bytes);
    for (const b of bytes) if (b < limit && out.length < length) out += SLUG_ALPHABET[b % SLUG_ALPHABET.length];
  }
  return out;
}

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(await pbkdf2(password, salt, ITERATIONS))}`;
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, iter, salt, hash] = String(stored || "").split("$");
  if (kind !== "pbkdf2" || !iter || !salt || !hash) return false;
  const got = await pbkdf2(password, unb64(salt), Number(iter));
  const want = unb64(hash);
  let diff = got.length ^ want.length;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ (want[i] || 0);
  return diff === 0;
}

export const isExpired = (expiresAt: string | null, now = Date.now()) => !!expiresAt && new Date(expiresAt).getTime() <= now;

// Anti-devinette : 8 essais de mot de passe par minute et par lien (mémoire de l'instance).
const attempts = new Map<string, number[]>();
export function tooManyAttempts(key: string, now = Date.now()): boolean {
  const recent = (attempts.get(key) || []).filter((t) => now - t < 60_000);
  recent.push(now); attempts.set(key, recent);
  return recent.length > 8;
}

async function userFrom(req: Request, db: any) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  return error || !data || !data.user ? null : data.user;
}
// Qui peut publier : l'admin, ou un membre de l'équipe dont le rôle permet de voir ET modifier les audits.
// Renvoie le propriétaire des audits (l'admin), ou null si l'accès est refusé.
async function ownerFor(db: any, userId: string): Promise<string | null> {
  const { data } = await db.from("espace_profiles").select("role").eq("id", userId).maybeSingle();
  if (data && data.role === "admin") return userId;
  const { data: m } = await db.from("team_members").select("role_id").eq("user_id", userId).maybeSingle();
  if (!m || !m.role_id) return null;
  const { data: role } = await db.from("team_roles").select("perms").eq("id", m.role_id).maybeSingle();
  const p = role && role.perms && role.perms.audits;
  if (!p || p.view !== true || p.edit !== true) return null;
  const { data: owner } = await db.from("espace_profiles").select("id").eq("role", "admin").limit(1).maybeSingle();
  return owner ? owner.id : null;
}
async function isTeamMember(db: any, userId: string) {
  const { data } = await db.from("team_members").select("user_id").eq("user_id", userId).maybeSingle();
  return !!data;
}

async function publish(db: any, ownerId: string, body: any) {
  if (!UUID_RE.test(String(body.audit_id))) return json({ error: "Audit introuvable." }, 400);
  const { data: audit } = await db.from("audits").select("id,title,client_name,cover_path,logo_path,content,slug").eq("id", body.audit_id).eq("user_id", ownerId).maybeSingle();
  if (!audit) return json({ error: "Audit introuvable." }, 404);
  const patch: Record<string, unknown> = {
    status: "published",
    slug: audit.slug || makeSlug(),
    published_at: new Date().toISOString(),
    published_content: { title: audit.title, client_name: audit.client_name, cover_path: audit.cover_path, logo_path: audit.logo_path, content: audit.content }
  };
  if (typeof body.password === "string") {
    if (body.password === "") { patch.password_hash = null; patch.has_password = false; }
    else if (body.password.length < 4 || body.password.length > 100) return json({ error: "Le mot de passe doit faire entre 4 et 100 caractères." }, 400);
    else { patch.password_hash = await hashPassword(body.password); patch.has_password = true; }
  }
  if (body.expires_at !== undefined) {
    if (body.expires_at === null || body.expires_at === "") patch.expires_at = null;
    else if (Number.isNaN(new Date(body.expires_at).getTime())) return json({ error: "Date d'expiration invalide." }, 400);
    else patch.expires_at = new Date(body.expires_at).toISOString();
  }
  const { data, error } = await db.from("audits").update(patch).eq("id", audit.id)
    .select("id,status,slug,has_password,expires_at,published_at").single();
  if (error) return json({ error: "Publication impossible." }, 500);
  return json({ audit: data });
}

async function unpublish(db: any, ownerId: string, body: any) {
  if (!UUID_RE.test(String(body.audit_id))) return json({ error: "Audit introuvable." }, 400);
  const { data, error } = await db.from("audits").update({ status: "draft" }).eq("id", body.audit_id).eq("user_id", ownerId)
    .select("id,status,slug,has_password,expires_at,published_at").maybeSingle();
  if (error || !data) return json({ error: "Audit introuvable." }, 404);
  return json({ audit: data });
}

function imagePaths(snap: any): string[] {
  const paths = new Set<string>();
  const add = (p: unknown) => { if (typeof p === "string" && p) paths.add(p); };
  add(snap.cover_path); add(snap.logo_path);
  for (const page of (snap.content && snap.content.pages) || []) for (const b of page.blocks || []) { add(b.path); for (const i of b.items || []) add(i && i.path); }
  return [...paths].slice(0, 200);
}

async function view(db: any, req: Request, body: any) {
  const slug = String(body.slug || "");
  const unavailable = json({ state: "unavailable" });
  if (!SLUG_RE.test(slug)) return unavailable;
  const { data: a } = await db.from("audits").select("id,user_id,status,password_hash,has_password,expires_at,published_content").eq("slug", slug).maybeSingle();
  if (!a || a.status !== "published" || !a.published_content || isExpired(a.expires_at)) return unavailable;

  if (a.has_password) {
    const given = typeof body.password === "string" ? body.password : "";
    if (!given) return json({ state: "password" });
    if (tooManyAttempts(slug)) return json({ state: "password", error: "Trop d'essais. Réessaie dans une minute." }, 429);
    if (!(await verifyPassword(given, a.password_hash))) return json({ state: "password", wrong: true });
  }

  // Tes propres visites (connecté) ne comptent pas.
  const snap = a.published_content;
  const paths = imagePaths(snap);
  const urls: Record<string, string> = {};
  // En parallèle : compter la vue (sauf si c'est toi, connecté) et préparer les images.
  const countView = async () => {
    if (body.count === false) return;
    const viewer = req.headers.get("Authorization") ? await userFrom(req, db) : null;
    const mine = viewer && (viewer.id === a.user_id || (await isTeamMember(db, viewer.id)));
    if (!mine) await db.from("audit_views").insert({ audit_id: a.id });
  };
  const sign = async () => {
    if (!paths.length) return;
    const { data: signed } = await db.storage.from(BUCKET).createSignedUrls(paths, 3600);
    for (const s of signed || []) if (s.signedUrl) urls[s.path] = s.signedUrl;
  };
  await Promise.all([countView().catch((e) => console.error("[audit-public] vue", e)), sign()]);
  return json({ state: "ok", audit: snap, urls });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Requête invalide." }, 400); }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  try {
    if (body.action === "view") return await view(db, req, body);
    if (body.action === "ping") return json({ ok: true }); // sert seulement à réveiller la fonction
    if (body.action === "publish" || body.action === "unpublish") {
      const user = await userFrom(req, db);
      if (!user) return json({ error: "Non authentifié." }, 401);
      const ownerId = await ownerFor(db, user.id);
      if (!ownerId) return json({ error: "Action réservée à l'administrateur." }, 403);
      return body.action === "publish" ? await publish(db, ownerId, body) : await unpublish(db, ownerId, body);
    }
    return json({ error: "Action inconnue." }, 400);
  } catch (e) {
    console.error("[audit-public]", e);
    return json({ error: "Erreur du serveur." }, 500);
  }
});
