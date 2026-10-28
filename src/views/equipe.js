// Page « Équipe » (bouton à gauche des paramètres) : mes membres en haut, mes partenaires (clients) en bas, avec leur activité.
import { loadTeam, listRoles, createMember, removeMember, resetMemberPassword, setMemberRole, lastActivity, latest, isMissing, MISSING_MESSAGE } from "./equipe-data.js";
import { categorieLabel, partnerStatutLabel } from "./espace-data.js";
import { openModal, modalHeader, field, toast, copyText, emptyState, skeleton } from "./pro-ui.js";
import { escapeHtml } from "./pro-data.js";

const initial = (s) => (String(s || "?").trim()[0] || "?").toUpperCase();

export async function renderEquipe(root) {
  root.innerHTML = `
    <div class="aud-head"><h1 class="page-title">Équipe</h1><button type="button" class="btn primary" data-add>+ Ajouter un membre</button></div>
    <div data-body>${skeleton("cols")}</div>`;
  const body = root.querySelector("[data-body]");
  let team = null, roles = [];

  async function load() {
    try { [team, roles] = await Promise.all([loadTeam(), listRoles()]); team = { members: (team && team.members) || [], mannequins: (team && team.mannequins) || [], partners: (team && team.partners) || [] }; }
    catch (err) {
      console.error("[Équipe]", err);
      body.innerHTML = `<div class="card"><p class="error-msg" style="margin:0;">${escapeHtml(isMissing(err) ? MISSING_MESSAGE : err.message || "Impossible de charger l'équipe.")}</p></div>`;
      return;
    }
    draw();
  }

  const roleName = (id) => (roles.find((r) => r.id === id) || {}).nom || null;
  const presenceHtml = (iso) => { const a = lastActivity(iso); return `<span class="eq-presence${a.online ? " on" : ""}"><i aria-hidden="true"></i>${a.text}</span>`; };

  function draw() {
    const m = team.members, mq = team.mannequins, p = team.partners;
    body.innerHTML = `
      <section class="card eq-section" aria-labelledby="eq-h1">
        <h2 class="panel-title" id="eq-h1">Mon équipe <span class="eq-count">${m.length}</span></h2>
        <div data-members>${m.length ? m.map((x) => `
          <div class="eq-row" data-id="${x.user_id}">
            <span class="eq-avatar">${x.avatar_url ? `<img src="${escapeHtml(x.avatar_url)}" alt="">` : escapeHtml(initial(x.pseudo || x.email))}</span>
            <div class="eq-who"><strong>${escapeHtml(x.pseudo || x.email || "Membre")}</strong><span class="pro-muted">${escapeHtml(x.email || "")}</span></div>
            <span class="eq-role-chip${x.role_id && roleName(x.role_id) ? "" : " none"}">${escapeHtml(roleName(x.role_id) || "Sans rôle")}</span>
            ${presenceHtml(latest(x.last_seen, x.last_sign_in_at))}
            <div class="eq-btns"><button type="button" class="btn ghost btn-sm" data-role>Rôle</button><button type="button" class="btn ghost btn-sm" data-reset>Mot de passe</button><button type="button" class="btn danger btn-sm" data-remove>Exclure</button></div>
          </div>`).join("") : emptyState({ title: "Personne dans ton équipe pour l'instant", text: "Ajoute un membre : l'appli crée son compte, tu choisis son rôle.", cta: "Ajouter un membre", action: "add2" })}</div>
      </section>
      <section class="card eq-section" aria-labelledby="eq-h2">
        <h2 class="panel-title" id="eq-h2">Mes mannequins <span class="eq-count">${mq.length}</span></h2>
        ${mq.length ? mq.map((x) => `
          <div class="eq-row eq-partner">
            <span class="eq-avatar alt">${escapeHtml(initial(x.nom))}</span>
            <div class="eq-who"><strong>${escapeHtml(x.nom)}</strong><span class="pro-muted">${escapeHtml(x.email || "")}</span></div>
            ${presenceHtml(latest(x.last_seen, x.last_sign_in_at))}
          </div>`).join("") : `<p class="pro-muted" style="margin:0;">Tes mannequins apparaîtront ici dès que tu en auras créé.</p>`}
      </section>
      <section class="card eq-section" aria-labelledby="eq-h3">
        <h2 class="panel-title" id="eq-h3">Mes partenaires <span class="eq-count">${p.length}</span></h2>
        ${p.length ? p.map((x) => `
          <div class="eq-row eq-partner">
            <span class="eq-avatar alt">${escapeHtml(initial(x.nom))}</span>
            <div class="eq-who"><strong>${escapeHtml(x.nom)}</strong><span class="pro-muted">${escapeHtml(categorieLabel(x.categorie))} · ${escapeHtml(partnerStatutLabel(x.statut))}</span></div>
            ${x.has_account ? presenceHtml(latest(x.last_seen, x.last_sign_in_at)) : `<span class="pro-muted" style="font-size:12.5px;min-width:130px;">Pas de compte</span>`}
          </div>`).join("") : `<p class="pro-muted" style="margin:0;">Ajoute des partenaires dans la page Partenaires.</p>`}
      </section>`;
    body.querySelector('[data-action="add2"]')?.addEventListener("click", addMember);
    body.querySelectorAll(".eq-row[data-id]").forEach((row) => {
      const member = team.members.find((x) => x.user_id === row.dataset.id);
      row.querySelector("[data-role]").addEventListener("click", () => chooseRole(member));
      row.querySelector("[data-reset]").addEventListener("click", async () => {
        const ok = await window.confirmDialog(`Générer un nouveau mot de passe temporaire pour ${member.pseudo || member.email} ?`, { confirmLabel: "Générer" });
        if (!ok) return;
        try { const res = await resetMemberPassword(member.user_id); showCredentials(res.email, res.temp_password, "Nouveau mot de passe"); } catch (err) { toast(err.message, "error"); }
      });
      row.querySelector("[data-remove]").addEventListener("click", async () => {
        const ok = await window.confirmDialog(`Exclure ${member.pseudo || member.email} de l'application ? Son compte sera supprimé et il ne pourra plus se connecter.`, { danger: true, confirmLabel: "Exclure" });
        if (!ok) return;
        try { await removeMember(member.user_id); toast("Membre exclu"); load(); } catch (err) { toast(err.message, "error"); }
      });
    });
  }

  function chooseRole(member) {
    const { overlay, close } = openModal(`${modalHeader("Rôle de " + (member.pseudo || member.email))}
      <form data-form>
        ${roles.length ? `<div class="eq-pick">${[{ id: "", nom: "Aucun rôle (aucun accès)" }, ...roles].map((r) => `<label class="eq-opt"><input type="radio" name="role" value="${r.id}"${(member.role_id || "") === r.id ? " checked" : ""}><span>${escapeHtml(r.nom)}</span></label>`).join("")}</div>`
          : `<p class="pro-muted">Tu n'as pas encore de rôle. Crée-en un dans <strong>Paramètres > Rôles et permissions</strong>.</p>`}
        <div class="error-msg" data-error></div>
        <div class="modal-actions"><button type="button" class="btn ghost" data-close>Annuler</button>${roles.length ? `<button type="submit" class="btn primary">Enregistrer</button>` : ""}</div>
      </form>`, { maxWidth: 440 });
    overlay.querySelector("[data-form]").addEventListener("submit", async (e) => {
      e.preventDefault();
      const value = new FormData(e.target).get("role") || null;
      try { await setMemberRole(member.user_id, value); close(); toast("Rôle mis à jour ✓"); load(); } catch { overlay.querySelector("[data-error]").textContent = "Enregistrement impossible."; }
    });
  }

  function showCredentials(email, password, title) {
    const { overlay } = openModal(`${modalHeader(title)}
      <p class="pro-muted" style="margin:0 0 12px;">Donne ces identifiants à la personne. Elle devra choisir son propre mot de passe à la première connexion. Ils ne seront plus affichés ensuite.</p>
      <div class="aud-linkbox"><input type="text" readonly value="${escapeHtml(email)}" aria-label="Email"></div>
      <div class="aud-linkbox" style="margin-top:8px;"><input type="text" readonly value="${escapeHtml(password)}" aria-label="Mot de passe temporaire" data-pw><button type="button" class="btn ghost btn-sm" data-copy>Copier</button></div>
      <div class="modal-actions"><button type="button" class="btn primary" data-close>Fermer</button></div>`, { maxWidth: 460 });
    overlay.querySelector("[data-copy]").addEventListener("click", async () => toast((await copyText(`Email : ${email}\nMot de passe temporaire : ${password}`)) ? "Identifiants copiés ✓" : "Copie impossible", "ok"));
  }

  function addMember() {
    const { overlay, close } = openModal(`${modalHeader("Ajouter un membre")}
      <form data-form>
        ${field("Email *", `<input type="email" name="email" required maxlength="200" placeholder="prenom@exemple.fr" autocomplete="off">`)}
        ${field("Prénom ou pseudo", `<input type="text" name="pseudo" maxlength="40" placeholder="Ex : Léa">`)}
        ${field("Rôle", `<select name="role_id"><option value="">Aucun pour l'instant</option>${roles.map((r) => `<option value="${r.id}">${escapeHtml(r.nom)}</option>`).join("")}</select>`)}
        ${roles.length ? "" : `<p class="pro-muted" style="margin:0 0 8px;font-size:12.5px;">Crée d'abord un rôle dans Paramètres > Rôles et permissions pour lui donner des accès.</p>`}
        <div class="error-msg" data-error></div>
        <div class="modal-actions"><button type="button" class="btn ghost" data-close>Annuler</button><button type="submit" class="btn primary" data-go>Créer le compte</button></div>
      </form>`, { maxWidth: 480 });
    const form = overlay.querySelector("[data-form]");
    form.email.focus();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const go = overlay.querySelector("[data-go]"), err = overlay.querySelector("[data-error]");
      go.disabled = true; err.textContent = "";
      try {
        const res = await createMember({ email: form.email.value.trim(), pseudo: form.pseudo.value.trim() || undefined, role_id: form.role_id.value || undefined });
        close(); showCredentials(res.email, res.temp_password, "Compte créé"); load();
      } catch (error) { err.textContent = error.message; go.disabled = false; }
    });
  }

  root.querySelector("[data-add]").addEventListener("click", addMember);
  await load();
  // Mise à jour de « En ligne » toutes les 30 s tant que la page existe.
  const timer = setInterval(() => { if (!root.isConnected) return clearInterval(timer); if (!document.hidden && !document.querySelector(".modal-overlay.open") && !root.closest("[hidden]")) load(); }, 30000);
}
