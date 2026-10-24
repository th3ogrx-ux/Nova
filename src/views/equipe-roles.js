// Paramètres > Rôles et permissions : créer des rôles et cocher ce que chacun peut faire.
import { MODULES, LEVELS, ADMIN_ONLY, emptyPerms, normalizePerms, summarize, listRoles, listMemberRoleIds, saveRole, deleteRole, isMissing, MISSING_MESSAGE } from "./equipe-data.js";
import { openModal, modalHeader, toast } from "./pro-ui.js";
import { escapeHtml } from "./pro-data.js";

export async function renderRolesCard(card) {
  card.innerHTML = `<div class="panel-title">Rôles et permissions</div>
    <p class="settings-hint" style="font-size:13px;color:var(--light-text-dim);margin:0 0 14px;max-width:560px;">Crée des rôles (ex. « Setter », « Assistant ») et coche ce que chacun peut voir, modifier ou supprimer. Ensuite, donne un rôle à chaque membre depuis le bouton Équipe.</p>
    <div data-roles-list><p class="pro-muted">Chargement…</p></div>
    <button type="button" class="btn primary btn-sm" data-new-role style="margin-top:12px;">+ Créer un rôle</button>`;
  const listEl = card.querySelector("[data-roles-list]");
  let roles = [], counts = {};

  async function load() {
    try {
      const [r, m] = await Promise.all([listRoles(), listMemberRoleIds()]);
      roles = r; counts = {};
      m.forEach((x) => { if (x.role_id) counts[x.role_id] = (counts[x.role_id] || 0) + 1; });
    } catch (err) {
      listEl.innerHTML = `<p class="error-msg" style="margin:0;">${escapeHtml(isMissing(err) ? MISSING_MESSAGE : "Impossible de charger les rôles.")}</p>`;
      card.querySelector("[data-new-role]").hidden = true;
      return;
    }
    draw();
  }

  function draw() {
    if (!roles.length) { listEl.innerHTML = `<p class="pro-muted" style="margin:0;">Aucun rôle pour l'instant.</p>`; return; }
    listEl.innerHTML = `<div class="eq-roles">${roles.map((r) => `
      <div class="eq-role" data-id="${r.id}">
        <div class="eq-role-main"><strong>${escapeHtml(r.nom)}</strong><span class="pro-muted">${escapeHtml(summarize(r.perms))} · ${counts[r.id] || 0} membre${(counts[r.id] || 0) > 1 ? "s" : ""}</span></div>
        <div class="eq-role-btns"><button type="button" class="btn ghost btn-sm" data-edit>Modifier</button><button type="button" class="btn danger btn-sm" data-del>Supprimer</button></div>
      </div>`).join("")}</div>`;
    listEl.querySelectorAll(".eq-role").forEach((row) => {
      const role = roles.find((x) => x.id === row.dataset.id);
      row.querySelector("[data-edit]").addEventListener("click", () => editRole(role));
      row.querySelector("[data-del]").addEventListener("click", async () => {
        const n = counts[role.id] || 0;
        const ok = await window.confirmDialog(n ? `Supprimer le rôle « ${role.nom} » ? ${n} membre${n > 1 ? "s" : ""} n'auront plus aucun accès tant que tu ne leur donnes pas un autre rôle.` : `Supprimer le rôle « ${role.nom} » ?`, { danger: true, confirmLabel: "Supprimer" });
        if (!ok) return;
        try { await deleteRole(role.id); toast("Rôle supprimé"); load(); } catch { toast("Suppression impossible.", "error"); }
      });
    });
  }

  function editRole(role) {
    const perms = normalizePerms(role ? role.perms : emptyPerms());
    const { overlay, close } = openModal(`${modalHeader(role ? "Modifier le rôle" : "Nouveau rôle")}
      <form data-form>
        <label class="aud-lbl">Nom du rôle<input type="text" name="nom" maxlength="40" required value="${escapeHtml(role ? role.nom : "")}" placeholder="Ex : Setter"></label>
        <div class="eq-matrix" role="group" aria-label="Permissions">
          <div class="eq-mrow eq-mhead"><span></span>${LEVELS.map((l) => `<span>${l.label}</span>`).join("")}</div>
          ${MODULES.map((m) => `<div class="eq-mrow" data-m="${m.key}"><span class="eq-mname"><strong>${m.label}</strong><small>${m.hint}</small></span>
            ${LEVELS.map((l) => `<label class="eq-cell"><input type="checkbox" data-l="${l.key}" aria-label="${m.label} : ${l.label}"${perms[m.key][l.key] ? " checked" : ""}></label>`).join("")}</div>`).join("")}
        </div>
        <p class="eq-reserved"><strong>Toujours réservé à toi :</strong> ${ADMIN_ONLY.map(escapeHtml).join(" · ")}.</p>
        <div class="error-msg" data-error></div>
        <div class="modal-actions"><button type="button" class="btn ghost" data-close>Annuler</button><button type="submit" class="btn primary">Enregistrer</button></div>
      </form>`, { maxWidth: 620 });
    const form = overlay.querySelector("[data-form]");
    form.nom.focus();
    // Cohérence : « modifier » et « supprimer » demandent « voir » ; décocher « voir » décoche le reste.
    overlay.querySelectorAll(".eq-mrow[data-m]").forEach((row) => {
      const box = (l) => row.querySelector(`[data-l="${l}"]`);
      row.addEventListener("change", (e) => {
        if (e.target === box("view") && !box("view").checked) { box("edit").checked = false; box("delete").checked = false; }
        else if (e.target !== box("view") && e.target.checked) box("view").checked = true;
      });
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nom = form.nom.value.trim(), err = overlay.querySelector("[data-error]");
      if (!nom) { err.textContent = "Donne un nom au rôle."; return; }
      const out = {};
      overlay.querySelectorAll(".eq-mrow[data-m]").forEach((row) => {
        const g = (l) => row.querySelector(`[data-l="${l}"]`).checked;
        out[row.dataset.m] = { view: g("view"), edit: g("view") && g("edit"), delete: g("view") && g("delete") };
      });
      try { await saveRole({ nom, perms: out }, role && role.id); close(); toast("Rôle enregistré ✓"); load(); }
      catch (error) { err.textContent = /duplicate|unique/i.test(error.message || "") ? "Un rôle porte déjà ce nom." : isMissing(error) ? MISSING_MESSAGE : "Enregistrement impossible, réessaie."; }
    });
  }

  card.querySelector("[data-new-role]").addEventListener("click", () => editRole(null));
  await load();
}
