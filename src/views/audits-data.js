// Module Audits : accès aux tables audits / audit_views (voir audits.sql).
import { supabase } from "../supabase.js";
import { getDataOwnerId } from "../session.js";

// Colonnes lisibles : password_hash n'est volontairement jamais demandé (la base refuse de le donner).
export const AUDIT_COLS = "id,user_id,title,client_name,status,content,cover_path,logo_path,slug,has_password,expires_at,is_template,template_kind,published_content,created_at,updated_at,published_at";
const LIST_COLS = "id,title,client_name,status,slug,has_password,expires_at,is_template,template_kind,created_at,updated_at,published_at";

export const MISSING_MESSAGE = "Le module Audits n'est pas encore installé : colle le fichier audits.sql dans Supabase (SQL Editor > Run), puis recharge la page.";
export const isMissingTable = (err) => !!err && (err.code === "PGRST205" || err.code === "42P01" || /audits|schema cache/i.test(err.message || ""));

const uid = async () => getDataOwnerId() || (await supabase.auth.getUser()).data.user.id; // un membre écrit pour l'admin (propriétaire des données)
async function run(q) { const { data, error } = await q; if (error) throw error; return data; }

export const EMPTY_CONTENT = () => ({ pages: [{ id: newId(), title: "Page 1", blocks: [] }] });
export const newId = () => Math.random().toString(36).slice(2, 10);

// Liste + vues en même temps (deux requêtes en parallèle au lieu de l'une après l'autre).
export async function listAudits() {
  const [rows, stats] = await Promise.all([
    run(supabase.from("audits").select(LIST_COLS).eq("is_template", false).order("updated_at", { ascending: false })),
    run(supabase.rpc("audit_view_stats")).then((s) => Object.fromEntries((s || []).map((r) => [r.audit_id, { vues: Number(r.vues), derniere: r.derniere }]))).catch(() => ({}))
  ]);
  return rows.map((a) => ({ ...a, vues: (stats[a.id] || {}).vues || 0, derniere: (stats[a.id] || {}).derniere || null }));
}
// Un audit ouvert est gardé quelques secondes : survoler « Modifier » le charge déjà (ouverture quasi instantanée).
const loading = new Map();
export function getAudit(id, { fresh = false } = {}) {
  const hit = loading.get(id);
  if (!fresh && hit && Date.now() - hit.at < 20000) return hit.promise;
  const promise = run(supabase.from("audits").select(AUDIT_COLS).eq("id", id).single());
  loading.set(id, { at: Date.now(), promise });
  promise.catch(() => loading.delete(id));
  return promise;
}
export const forgetAudit = (id) => loading.delete(id);
export async function createAudit(values) {
  return run(supabase.from("audits").insert({ content: EMPTY_CONTENT(), ...values, user_id: await uid() }).select(AUDIT_COLS).single());
}
// La sauvegarde ne renvoie que l'essentiel (pas tout le contenu de l'audit) : plus rapide.
export const updateAudit = (id, values) => { forgetAudit(id); return run(supabase.from("audits").update({ ...values, updated_at: new Date().toISOString() }).eq("id", id).select("id,updated_at").single()); };
export const deleteAudit = (id) => run(supabase.from("audits").delete().eq("id", id));
export async function duplicateAudit(id) {
  const a = await getAudit(id);
  return createAudit({ title: (a.title + " (copie)").slice(0, 160), client_name: a.client_name, content: a.content, cover_path: a.cover_path, logo_path: a.logo_path });
}

export const publicUrl = (slug) => `${location.origin}/a/${slug}`;
export const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("fr-FR") : "";
export const fmtDateTime = (iso) => { const d = new Date(iso); return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); };
