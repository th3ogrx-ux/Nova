// Journal de sécurité : l'appli signale quelques événements à la base (table audit_log).
// On n'y met jamais de mot de passe ni d'e-mail : seulement une empreinte SHA-256 de l'e-mail
// pour compter les échecs de connexion d'une même adresse.
import { supabase } from "./supabase.js";

export async function emailHash(email) {
  const bytes = new TextEncoder().encode(String(email).trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Ne doit jamais gêner l'utilisateur : toute erreur est ignorée.
export async function logEvent(type, detail = null) {
  try { await supabase.rpc("log_security_event", { p_type: type, p_detail: detail }); } catch { /* sans effet */ }
}

export async function logLoginFailure(hash) {
  try { await supabase.rpc("log_login_failure", { p_email_hash: hash }); } catch { /* sans effet */ }
}

// true = trop d'échecs récents pour cette adresse.
export async function isLoginLocked(hash) {
  try {
    const { data } = await supabase.rpc("login_locked", { p_email_hash: hash });
    return data === true;
  } catch {
    return false;
  }
}

// Alertes affichées à l'admin : activité anormale récente. Renvoie une liste de messages.
export async function loadSecurityAlerts() {
  const now = Date.now();
  const since = (ms) => new Date(now - ms).toISOString();
  const count = async (type, ms) => {
    const { count: n } = await supabase.from("audit_log").select("id", { count: "exact", head: true }).eq("type", type).gte("created_at", since(ms));
    return n || 0;
  };
  try {
    const [failed, denied] = await Promise.all([count("login_failed", 3600e3), count("access_denied", 86400e3)]);
    const alerts = [];
    if (failed >= 10) alerts.push(`${failed} échecs de connexion en 1 heure : quelqu'un essaie peut-être de deviner un mot de passe.`);
    if (denied >= 5) alerts.push(`${denied} accès refusés en 24 heures : un compte tente d'ouvrir des pages qui ne lui sont pas permises.`);
    return alerts;
  } catch {
    return [];
  }
}

export async function loadRecentEvents(limit = 15) {
  const { data } = await supabase.from("audit_log").select("created_at, type, detail, business_id").order("created_at", { ascending: false }).limit(limit);
  return data || [];
}

export const EVENT_LABELS = {
  login_failed: "Échec de connexion",
  login_success: "Connexion réussie",
  access_denied: "Accès refusé",
  mfa_enrolled: "Double authentification activée",
  mfa_removed: "Double authentification retirée",
  password_changed: "Mot de passe changé",
  client_created: "Client créé",
  client_deleted: "Client supprimé",
  client_password_reset: "Mot de passe client réinitialisé",
  data_exported: "Données d'un client exportées",
  purge: "Nettoyage automatique"
};
