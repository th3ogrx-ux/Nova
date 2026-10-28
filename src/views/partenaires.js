// Page « Partenaires » : annuaire de marques, photographes, monteurs vidéo… avec leur statut, leurs mannequins
// et, pour certains, un compte de connexion à accès limité.
import {
  loadDirectory, savePartner, deletePartner, savePrivate, setLinks, createAccount, resetAccount, removeAccount, isMissing, MISSING_MESSAGE
} from "./partenaires-data.js";
import { PARTNER_CATEGORIES, PARTNER_STATUTS, categorieLabel, partnerStatutLabel } from "./espace-data.js";
import { openModal, modalHeader, field, options, toast, copyText, emptyState, skeleton, friendlyError } from "./pro-ui.js";
import { escapeHtml } from "./pro-data.js";

const state = { q: "", categorie: "", statut: "" };
const PILL = { actif: "ok", en_discussion: "blue", contacte: "neutral", a_contacter: "neutral", inactif: "neutral" };

export async function renderPartenaires(root) {
  root.innerHTML = `
    <div class="aud-head"><h1 class="page-title">Partenaires</h1><button type="button" class="btn primary" data-add>+ Nouveau partenaire</button></div>
    <div data-body>${skeleton("cols")}</div>`;
  const body = root.querySelector("[data-body]");
  let dir = null;

  async function load() {
    try { dir = await loadDirectory(); } catch (err) {
      console.error("[Partenaires]", err);
      body.innerHTML = `<div class="card"><p class="error-msg" style="margin:0;">${escapeHtml(isMissing(err) ? MISSING_MESSAGE : "Impossible de charger les partenaires. Recharge la page.")}</p></div>`;
      return;
    }
    draw();
  }

  const privateOf = (id) => dir.privates.find((p) => p.partner_id === id) || {};
  const linkedBusinesses = (id) => dir.links.filter((l) => l.partner_id === id).map((l) => dir.businesses.find((b) => b.id === l.business_id)).filter(Boolean);

  function draw() {
    if (!dir.partners.length) {
      body.innerHTML = `<div class="card">${emptyState({ title: "Aucun partenaire pour l'instant", text: "Ajoute les marques, photographes, monteurs vidéo… avec qui tu travailles ou veux travailler, puis associe-les à tes mannequins.", cta: "Ajouter un partenaire", action: "add2" })}</div>`;
      body.querySelector('[data-action="add2"]').addEventListener("click", () => editPartner(null));
      return;
    }
    body.innerHTML = `
      <div class="aud-filters">
        <input type="search" class="aud-search" placeholder="Rechercher un partenaire…" value="${escapeHtml(state.q)}" aria-label="Rechercher">
        <select data-f="categorie" aria-label="Catégorie"><option value="">Toutes les catégories</option>${options(PARTNER_CATEGORIES, state.categorie)}</select>
        <select data-f="statut" aria-label="Statut"><option value="">Tous les statuts</option>${options(PARTNER_STATUTS, state.statut)}</select>
      </div>
      <div class="par-summary">${PARTNER_STATUTS.map((s) => `<span class="pro-chip">${escapeHtml(s.label)} <b>${dir.partners.filter((p) => p.statut === s.key).length}</b></span>`).join("")}</div>
      <div class="par-grid" data-grid></div>`;
    body.querySelector('[data-f="categorie"]').value = state.categorie;
    body.querySelector('[data-f="statut"]').value = state.statut;
    const apply = () => {
      const q = state.q.trim().toLowerCase();
      const shown = dir.partners.filter((p) => (!state.categorie || p.categorie === state.categorie) && (!state.statut || p.statut === state.statut)
        && (!q || [p.nom, p.contact_nom, p.email, p.instagram].filter(Boolean).join(" ").toLowerCase().includes(q)));
      const grid = body.querySelector("[data-grid]");
      grid.innerHTML = shown.length ? shown.map(cardHtml).join("") : `<p class="pro-muted">Aucun partenaire ne correspond.</p>`;
      wire(grid);
    };
    body.querySelector(".aud-search").addEventListener("input", (e) => { state.q = e.target.value; apply(); });
    body.querySelectorAll("select[data-f]").forEach((s) => s.addEventListener("change", () => { state[s.dataset.f] = s.value; apply(); }));
    apply();
  }

  function cardHtml(p) {
    const models = linkedBusinesses(p.id);
    const ig = p.instagram ? p.instagram.replace(/^@/, "") : "";
    return `<article class="card par-card" data-id="${p.id}">
      <div class="aud-card-top"><h3 class="aud-title">${escapeHtml(p.nom)}</h3><span class="status-pill neutral">${escapeHtml(categorieLabel(p.categorie))}</span></div>
      <p class="aud-client">${p.contact_nom ? escapeHtml(p.contact_nom) : '<span class="pro-muted">Pas de contact</span>'}</p>
      <div class="par-contacts">${p.email ? `<a href="mailto:${escapeHtml(p.email)}">${escapeHtml(p.email)}</a>` : ""}${ig ? `<a href="https://instagram.com/${encodeURIComponent(ig)}" target="_blank" rel="noopener noreferrer">@${escapeHtml(ig)}</a>` : ""}${p.telephone ? `<span>${escapeHtml(p.telephone)}</span>` : ""}</div>
      <div class="par-row"><select data-status aria-label="Statut" class="crm-inline-select">${options(PARTNER_STATUTS, p.statut)}</select>
        ${p.user_id ? `<span class="status-pill ok">Compte actif</span>` : ""}</div>
      <div class="par-models">${models.length ? models.map((b) => `<span class="pro-chip alt">${escapeHtml(b.nom)}</span>`).join("") : `<span class="pro-muted" style="font-size:12.5px;">Aucun mannequin associé</span>`}</div>
      <div class="aud-actions"><button type="button" class="btn primary btn-sm" data-edit>Modifier</button><button type="button" class="btn ghost btn-sm" data-account>Compte</button><button type="button" class="btn danger btn-sm" data-del>Supprimer</button></div>
    </article>`;
  }

  function wire(grid) {
    grid.querySelectorAll(".par-card").forEach((card) => {
      const p = dir.partners.find((x) => x.id === card.dataset.id);
      card.querySelector("[data-edit]").addEventListener("click", () => editPartner(p));
      card.querySelector("[data-account]").addEventListener("click", () => accountDialog(p));
      card.querySelector("[data-status]").addEventListener("change", async (e) => {
        try { await savePartner({ statut: e.target.value }, p.id); p.statut = e.target.value; toast("Statut mis à jour ✓"); } catch (err) { toast(friendlyError(err), "error"); load(); }
      });
      card.querySelector("[data-del]").addEventListener("click", async () => {
        const ok = await window.confirmDialog(`Supprimer « ${p.nom} » ?${p.user_id ? " Son compte de connexion sera aussi à supprimer." : ""}`, { danger: true, confirmLabel: "Supprimer" });
        if (!ok) return;
        try { if (p.user_id) await removeAccount(p.id).catch(() => {}); await deletePartner(p.id); toast("Partenaire supprimé"); load(); } catch (err) { toast(friendlyError(err), "error"); }
      });
    });
  }

  function editPartner(p) {
    const priv = p ? privateOf(p.id) : {};
    const current = p ? dir.links.filter((l) => l.partner_id === p.id).map((l) => l.business_id) : [];
    const { overlay, close } = openModal(`${modalHeader(p ? "Modifier le partenaire" : "Nouveau partenaire")}
      <form data-form>
        ${field("Nom *", `<input type="text" name="nom" maxlength="120" required value="${escapeHtml(p ? p.nom : "")}" placeholder="Ex : Studio Lumière">`)}
        <div class="pro-form-row">
          ${field("Catégorie", `<select name="categorie">${options(PARTNER_CATEGORIES, p ? p.categorie : "marque")}</select>`)}
          ${field("Statut", `<select name="statut">${options(PARTNER_STATUTS, p ? p.statut : "a_contacter")}</select>`)}
        </div>
        <div class="pro-form-row">
          ${field("Personne à contacter", `<input type="text" name="contact_nom" maxlength="120" value="${escapeHtml(p ? p.contact_nom || "" : "")}">`)}
          ${field("Téléphone", `<input type="tel" name="telephone" maxlength="40" value="${escapeHtml(p ? p.telephone || "" : "")}">`)}
        </div>
        <div class="pro-form-row">
          ${field("E-mail", `<input type="email" name="email" maxlength="200" value="${escapeHtml(p ? p.email || "" : "")}">`)}
          ${field("Instagram", `<input type="text" name="instagram" maxlength="80" placeholder="@pseudo" value="${escapeHtml(p ? p.instagram || "" : "")}">`)}
        </div>
        ${field("Site web", `<input type="text" name="site" maxlength="300" value="${escapeHtml(p ? p.site || "" : "")}">`)}
        <div class="field"><label class="field-label">Mannequins associés</label>
          ${dir.businesses.length ? `<div class="par-check-grid">${dir.businesses.map((b) => `<label class="crm-check"><input type="checkbox" name="model" value="${b.id}"${current.includes(b.id) ? " checked" : ""}> ${escapeHtml(b.nom)}</label>`).join("")}</div>` : `<p class="pro-muted" style="margin:0;">Crée d'abord un mannequin dans la page Mannequins.</p>`}
          <p class="pro-muted" style="font-size:12px;margin:4px 0 0;">Chaque mannequin voit ses partenaires : nom, métier, statut et contacts.</p></div>
        ${field("Tarif (privé, jamais visible par le mannequin)", `<input type="text" name="tarif" maxlength="200" value="${escapeHtml(priv.tarif || "")}" placeholder="Ex : 400 € la demi-journée">`)}
        ${field("Notes (privées)", `<textarea name="notes" rows="3" maxlength="4000">${escapeHtml(priv.notes || "")}</textarea>`)}
        <div class="error-msg" data-error></div>
        <div class="modal-actions"><button type="button" class="btn ghost" data-close>Annuler</button><button type="submit" class="btn primary">Enregistrer</button></div>
      </form>`, { maxWidth: 560 });
    const form = overlay.querySelector("[data-form]");
    form.nom.focus();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = overlay.querySelector("[data-error]"); err.textContent = "";
      const nom = form.nom.value.trim();
      if (!nom) { err.textContent = "Indique le nom du partenaire."; return; }
      const val = (n) => form[n].value.trim() || null;
      const row = { nom, categorie: form.categorie.value, statut: form.statut.value, contact_nom: val("contact_nom"), telephone: val("telephone"), email: val("email"), instagram: val("instagram"), site: val("site") };
      try {
        const saved = await savePartner(row, p && p.id);
        await savePrivate(saved.id, { tarif: val("tarif"), notes: val("notes") });
        await setLinks(saved.id, [...form.querySelectorAll('input[name="model"]:checked')].map((i) => i.value), current);
        close(); toast("Partenaire enregistré ✓"); load();
      } catch (error) { err.textContent = isMissing(error) ? MISSING_MESSAGE : friendlyError(error); }
    });
  }

  function showCredentials(email, password, title) {
    const { overlay } = openModal(`${modalHeader(title)}
      <p class="pro-muted" style="margin:0 0 12px;">Transmets ces identifiants au partenaire. Il choisira son propre mot de passe à la première connexion. Ils ne seront plus affichés ensuite.</p>
      <div class="aud-linkbox"><input type="text" readonly value="${escapeHtml(email)}" aria-label="Email"></div>
      <div class="aud-linkbox" style="margin-top:8px;"><input type="text" readonly value="${escapeHtml(password)}" aria-label="Mot de passe temporaire" data-pw><button type="button" class="btn ghost btn-sm" data-copy>Copier</button></div>
      <div class="modal-actions"><button type="button" class="btn primary" data-close>Fermer</button></div>`, { maxWidth: 460 });
    overlay.querySelector("[data-copy]").addEventListener("click", async () => toast((await copyText(`Email : ${email}\nMot de passe temporaire : ${password}`)) ? "Identifiants copiés ✓" : "Copie impossible", "ok"));
  }

  function accountDialog(p) {
    if (p.user_id) {
      const { overlay, close } = openModal(`${modalHeader("Compte de " + p.nom)}
        <p class="pro-muted" style="margin:0 0 14px;">Ce partenaire peut se connecter : il voit ses mannequins et ses collaborations (rien d'autre).</p>
        <div class="error-msg" data-error></div>
        <div class="modal-actions"><button type="button" class="btn danger" data-remove style="margin-right:auto;">Supprimer le compte</button><button type="button" class="btn ghost" data-reset>Nouveau mot de passe</button><button type="button" class="btn primary" data-close>Fermer</button></div>`, { maxWidth: 480 });
      overlay.querySelector("[data-reset]").addEventListener("click", async () => {
        try { const res = await resetAccount(p.id); close(); showCredentials(res.email, res.temp_password, "Nouveau mot de passe"); } catch (err) { overlay.querySelector("[data-error]").textContent = err.message; }
      });
      overlay.querySelector("[data-remove]").addEventListener("click", async () => {
        const ok = await window.confirmDialog("Supprimer le compte de connexion ? La fiche reste dans l'annuaire.", { danger: true, confirmLabel: "Supprimer" });
        if (!ok) return;
        try { await removeAccount(p.id); close(); toast("Compte supprimé"); load(); } catch (err) { overlay.querySelector("[data-error]").textContent = err.message; }
      });
      return;
    }
    const { overlay, close } = openModal(`${modalHeader("Créer un compte pour " + p.nom)}
      <form data-form>
        <p class="pro-muted" style="margin:0 0 12px;">Un compte à accès limité : le partenaire verra ses mannequins et ses collaborations.</p>
        ${field("E-mail de connexion *", `<input type="email" name="email" required maxlength="200" value="${escapeHtml(p.email || "")}">`)}
        <div class="error-msg" data-error></div>
        <div class="modal-actions"><button type="button" class="btn ghost" data-close>Annuler</button><button type="submit" class="btn primary" data-go>Créer le compte</button></div>
      </form>`, { maxWidth: 460 });
    overlay.querySelector("[data-form]").addEventListener("submit", async (e) => {
      e.preventDefault();
      const go = overlay.querySelector("[data-go]"); go.disabled = true;
      try { const res = await createAccount(p.id, e.target.email.value.trim()); close(); showCredentials(res.email, res.temp_password, "Compte créé"); load(); }
      catch (err) { overlay.querySelector("[data-error]").textContent = err.message; go.disabled = false; }
    });
  }

  root.querySelector("[data-add]").addEventListener("click", () => editPartner(null));
  await load();
}
