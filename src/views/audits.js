// Page « Audits » : liste des audits (recherche, filtres, actions) ; l'éditeur s'ouvre à la place de la liste.
import { listAudits, createAudit, duplicateAudit, deleteAudit, isMissingTable, MISSING_MESSAGE, publicUrl, fmtDate, fmtDateTime } from "./audits-data.js";
import { emptyState, openModal, modalHeader, field, readForm, toast, copyText, skeleton } from "./pro-ui.js";
import { escapeHtml } from "./pro-data.js";

const state = { q: "", status: "", client: "" };

export async function renderAudits(root, { openId = null } = {}) {
  if (openId) { const m = await import("./audit-editor.js"); return m.renderEditor(root, openId, () => renderAudits(root)); }
  root.innerHTML = `
    <div class="aud-head">
      <h1 class="page-title">Audits</h1>
      <button type="button" class="btn primary" data-action="new">+ Nouveau projet</button>
    </div>
    <div class="pro-body" data-body>${skeleton("cols")}</div>`;
  const body = root.querySelector("[data-body]");
  let list = [];

  const reload = async () => {
    try { list = await listAudits(); } catch (err) {
      console.error("[Audits]", err);
      body.innerHTML = `<div class="card"><p class="error-msg" style="margin:0;">${escapeHtml(isMissingTable(err) ? MISSING_MESSAGE : "Impossible de charger les audits. Recharge la page.")}</p></div>`;
      return false;
    }
    draw(); return true;
  };
  const open = (id) => renderAudits(root, { openId: id });

  function draw() {
    if (!list.length) {
      body.innerHTML = `<div class="card">${emptyState({ title: "Aucun audit pour l'instant", text: "Crée un audit pour un client, remplis-le avec des blocs, puis partage-le avec un lien privé.", cta: "Créer mon premier audit", action: "new2" })}</div>`;
      body.querySelector('[data-action="new2"]').addEventListener("click", newProject);
      return;
    }
    const clients = [...new Set(list.map((a) => a.client_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
    body.innerHTML = `
      <div class="aud-filters">
        <input type="search" class="aud-search" placeholder="Rechercher un audit ou un client…" value="${escapeHtml(state.q)}" aria-label="Rechercher">
        <select data-f="status" aria-label="Statut"><option value="">Tous les statuts</option><option value="draft">Brouillon</option><option value="published">Publié</option></select>
        <select data-f="client" aria-label="Client"><option value="">Tous les clients</option>${clients.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}</select>
      </div>
      <div class="aud-grid" data-grid></div>`;
    body.querySelector('[data-f="status"]').value = state.status;
    body.querySelector('[data-f="client"]').value = clients.includes(state.client) ? state.client : "";
    const apply = () => {
      const q = state.q.trim().toLowerCase();
      const shown = list.filter((a) => (!state.status || a.status === state.status) && (!state.client || a.client_name === state.client) &&
        (!q || (a.title + " " + (a.client_name || "")).toLowerCase().includes(q)));
      body.querySelector("[data-grid]").innerHTML = shown.length ? shown.map(cardHtml).join("") : `<p class="pro-muted">Aucun audit ne correspond à ta recherche.</p>`;
      wireCards(body.querySelector("[data-grid]"));
    };
    body.querySelector(".aud-search").addEventListener("input", (e) => { state.q = e.target.value; apply(); });
    body.querySelectorAll("select[data-f]").forEach((s) => s.addEventListener("change", () => { state[s.dataset.f] = s.value; apply(); }));
    apply();
  }

  function cardHtml(a) {
    const pub = a.status === "published";
    const meta = pub
      ? (a.vues ? `Ouvert ${a.vues} fois, dernière ouverture le ${fmtDateTime(a.derniere)}` : "Pas encore ouvert")
      : "Pas encore publié";
    return `
      <article class="card aud-card" data-id="${a.id}">
        <div class="aud-card-top"><h3 class="aud-title">${escapeHtml(a.title)}</h3><span class="status-pill ${pub ? "ok" : ""}">${pub ? "Publié" : "Brouillon"}</span></div>
        <p class="aud-client">${a.client_name ? escapeHtml(a.client_name) : '<span class="pro-muted">Sans client</span>'}</p>
        <p class="pro-muted aud-meta">Créé le ${fmtDate(a.created_at)} · ${meta}</p>
        <div class="aud-actions">
          <button type="button" class="btn primary btn-sm" data-act="edit">Modifier</button>
          ${pub ? `<button type="button" class="btn ghost btn-sm" data-act="copy">Copier le lien</button>` : ""}
          <button type="button" class="btn ghost btn-sm" data-act="preview">Aperçu</button>
          <button type="button" class="btn ghost btn-sm" data-act="dup">Dupliquer</button>
          ${pub ? `<button type="button" class="btn ghost btn-sm" data-act="unpub">Dépublier</button>` : ""}
          <button type="button" class="btn danger btn-sm" data-act="del">Supprimer</button>
        </div>
      </article>`;
  }

  function wireCards(grid) {
    grid.querySelectorAll(".aud-card").forEach((card) => {
      const a = list.find((x) => x.id === card.dataset.id);
      const on = (act, fn) => card.querySelector(`[data-act="${act}"]`)?.addEventListener("click", fn);
      on("edit", () => open(a.id));
      on("preview", async () => { const m = await import("./audit-editor.js"); m.openPreview(a.id); });
      on("copy", async () => toast((await copyText(publicUrl(a.slug))) ? "Lien copié ✓" : "Copie impossible", "ok"));
      on("dup", async () => { try { await duplicateAudit(a.id); toast("Audit dupliqué ✓"); reload(); } catch (err) { toast("Duplication impossible.", "error"); } });
      on("unpub", async () => {
        const ok = await window.confirmDialog(`Dépublier « ${a.title} » ? Le lien affichera « Audit indisponible ».`, { confirmLabel: "Dépublier" });
        if (!ok) return;
        const m = await import("./audit-publish.js");
        try { await m.unpublish(a.id); toast("Audit dépublié"); reload(); } catch (err) { toast(m.publishError(err), "error"); }
      });
      on("del", async () => {
        const ok = await window.confirmDialog(`Supprimer « ${a.title} » ? Cette action est définitive.`, { danger: true, confirmLabel: "Supprimer" });
        if (!ok) return;
        try { await deleteAudit(a.id); toast("Audit supprimé"); reload(); } catch (err) { toast("Suppression impossible.", "error"); }
      });
    });
  }

  function newProject() {
    const { overlay, close } = openModal(`${modalHeader("Nouveau projet")}
      <form data-form>
        ${field("Titre de l'audit *", `<input type="text" name="title" maxlength="160" required placeholder="Ex : Audit SEO, Salon Éclat">`)}
        ${field("Nom du client", `<input type="text" name="client_name" maxlength="160" placeholder="Ex : Salon Éclat">`)}
        <div class="error-msg" data-error></div>
        <div class="modal-actions"><button type="button" class="btn ghost" data-close>Annuler</button><button type="submit" class="btn primary">Créer</button></div>
      </form>`, { maxWidth: 480 });
    const form = overlay.querySelector("[data-form]");
    form.title.focus();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = readForm(form);
      if (!v.title) { overlay.querySelector("[data-error]").textContent = "Donne un titre à ton audit."; return; }
      try { const a = await createAudit({ title: v.title, client_name: v.client_name }); close(); open(a.id); }
      catch (err) { overlay.querySelector("[data-error]").textContent = isMissingTable(err) ? MISSING_MESSAGE : "Création impossible, réessaie."; }
    });
  }
  root.querySelector('[data-action="new"]').addEventListener("click", newProject);
  await reload();
}
