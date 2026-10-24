// Audits : publication, dépublication, lien à copier (la fonction Supabase « audit-public » fait le travail côté serveur).
import { supabase } from "../supabase.js";
import { publicUrl, fmtDate } from "./audits-data.js";
import { openModal, modalHeader, toast, copyText } from "./pro-ui.js";
import { escapeHtml } from "./pro-data.js";

export async function callAuditFn(body) {
  const { data, error } = await supabase.functions.invoke("audit-public", { body });
  if (error) {
    const status = error.context && error.context.status;
    if (status === 404) throw new Error("La fonction « audit-public » n'est pas encore installée dans Supabase (colle supabase/functions/audit-public/index.ts dans Edge Functions).");
    let message = null;
    try { message = (await error.context.json()).error; } catch { /* corps non JSON */ }
    throw new Error(message || "Impossible de contacter le serveur. Réessaie dans un instant.");
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}
// Premier appel à vide : le serveur « se réveille » pendant que tu édites, la vraie publication est ensuite rapide.
let warmed = 0;
export function warmUp() {
  if (Date.now() - warmed < 240000) return;
  warmed = Date.now();
  supabase.functions.invoke("audit-public", { body: { action: "ping" } }).catch(() => {});
}
export const publishError = (err) => (err && err.message) || "Action impossible pour le moment.";
export const unpublish = (auditId) => callAuditFn({ action: "unpublish", audit_id: auditId });

export function openPublishDialog(audit, { onChange = () => {}, beforePublish = null } = {}) {
  warmUp();
  const pub = audit.status === "published";
  const expDay = audit.expires_at ? audit.expires_at.slice(0, 10) : "";
  const { overlay, close } = openModal(`${modalHeader(pub ? "Publication" : "Publier l'audit")}
    <form data-form>
      ${pub && audit.slug ? `<div class="aud-linkbox"><input type="text" readonly value="${escapeHtml(publicUrl(audit.slug))}" aria-label="Lien public" data-url><button type="button" class="btn ghost btn-sm" data-copy>Copier le lien</button></div>
      <p class="pro-muted" style="margin:6px 0 14px;">Publié le ${fmtDate(audit.published_at)}. Le lien montre toujours la dernière version publiée ; pense à republier après tes modifications.</p>` :
      `<p class="pro-muted" style="margin:0 0 14px;">Un lien privé et impossible à deviner sera créé. Seules les personnes qui l'ont peuvent voir l'audit, sans compte.</p>`}
      <label class="aud-lbl">Mot de passe (facultatif)<input type="password" name="password" maxlength="100" autocomplete="new-password" placeholder="${audit.has_password ? "Laisser vide pour garder l'actuel" : "Aucun"}"></label>
      ${audit.has_password ? `<label class="aud-check" style="margin-top:6px;"><input type="checkbox" name="rm_password"> Retirer le mot de passe</label>` : ""}
      <label class="aud-lbl" style="margin-top:10px;">Date d'expiration (facultatif)<input type="date" name="expires" value="${expDay}"></label>
      <div class="error-msg" data-error></div>
      <div class="modal-actions">${pub ? `<button type="button" class="btn danger" data-unpub style="margin-right:auto;">Dépublier</button>` : ""}<button type="button" class="btn ghost" data-close>Fermer</button><button type="submit" class="btn primary" data-go>${pub ? "Republier" : "Publier"}</button></div>
    </form>`, { maxWidth: 500 });
  const form = overlay.querySelector("[data-form]"), errorEl = overlay.querySelector("[data-error]"), go = overlay.querySelector("[data-go]");
  overlay.querySelector("[data-copy]")?.addEventListener("click", async () => toast((await copyText(publicUrl(audit.slug))) ? "Lien copié ✓" : "Copie impossible", "ok"));
  overlay.querySelector("[data-url]")?.addEventListener("focus", (e) => e.target.select());
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); errorEl.textContent = ""; go.disabled = true; go.textContent = "Publication…";
    // On s'assure que tout est enregistré AVANT de publier (sinon l'ancienne version serait publiée).
    if (beforePublish && !(await beforePublish())) { errorEl.textContent = "Enregistrement en cours : réessaie dans un instant."; go.disabled = false; go.textContent = pub ? "Republier" : "Publier"; return; }
    const body = { action: "publish", audit_id: audit.id, expires_at: form.expires.value ? new Date(form.expires.value + "T23:59:59").toISOString() : null };
    if (form.password.value) body.password = form.password.value;
    else if (form.rm_password && form.rm_password.checked) body.password = "";
    try {
      const res = await callAuditFn(body);
      onChange(res.audit); close();
      openPublishDialog({ ...audit, ...res.audit }, { onChange, beforePublish });
      toast(pub ? "Audit republié ✓" : "Audit publié ✓");
    } catch (err) { errorEl.textContent = publishError(err); go.disabled = false; go.textContent = pub ? "Republier" : "Publier"; }
  });
  overlay.querySelector("[data-unpub]")?.addEventListener("click", async () => {
    const ok = await window.confirmDialog("Dépublier cet audit ? Le lien affichera « Audit indisponible ».", { confirmLabel: "Dépublier" });
    if (!ok) return;
    try { const res = await unpublish(audit.id); onChange(res.audit); close(); toast("Audit dépublié"); } catch (err) { errorEl.textContent = publishError(err); }
  });
}
