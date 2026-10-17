// CRM – Agence Web : fenêtres de saisie d'une fiche prospect et d'un projet.
import { supabase } from "../supabase.js";
import {
  SECTEURS, SITES, SOURCES, ETAPES, STATUTS, PROSPECTS_TABLE, PROJETS_TABLE,
  escapeHtml, saveProspect, isMissingTable, MISSING_TABLE_MESSAGE
} from "./crm-data.js";

// z-index sous celui de la confirmation (60), pour qu'elle passe devant.
function openModal(innerHtml) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay open";
  overlay.style.zIndex = "59";
  overlay.innerHTML = `<div class="card modal-box crm-modal">${innerHtml}</div>`;
  document.body.appendChild(overlay);

  const onKey = (e) => {
    if (e.key === "Escape" && !document.querySelector("#confirm-overlay.open")) close();
  };
  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  }
  document.addEventListener("keydown", onKey);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  overlay.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
  return { overlay, close };
}

function header(title) {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px;">
      <h2 style="font-size:16px;font-weight:700;letter-spacing:normal;text-transform:none;margin:0;">${escapeHtml(title)}</h2>
      <button type="button" class="icon-btn" data-close title="Fermer" style="width:30px;height:30px;">✕</button>
    </div>
  `;
}

function options(list, selected, { empty = true } = {}) {
  return (empty ? `<option value="">—</option>` : "") +
    list.map((v) => `<option value="${escapeHtml(v)}"${v === selected ? " selected" : ""}>${escapeHtml(v)}</option>`).join("");
}

function field(label, inputHtml, { span = false } = {}) {
  return `<div class="field${span ? " crm-span-2" : ""}"><label class="field-label">${label}</label>${inputHtml}</div>`;
}

const val = (v) => (v == null ? "" : escapeHtml(v));

function footer(isEdit) {
  return `
    <div class="error-msg" data-error></div>
    <div class="modal-actions" style="margin-top:12px;">
      ${isEdit ? `<button type="button" class="btn danger" data-delete style="margin-right:auto;">Supprimer</button>` : ""}
      <button type="button" class="btn ghost" data-close>Annuler</button>
      <button type="submit" class="btn primary" data-submit>Enregistrer</button>
    </div>
  `;
}

function readForm(form) {
  const out = {};
  form.querySelectorAll("[name]").forEach((el) => {
    if (el.type === "checkbox") { out[el.name] = el.checked; return; }
    const v = el.value.trim();
    if (el.type === "number") out[el.name] = v === "" ? null : Number(v);
    else out[el.name] = v === "" ? null : v;
  });
  return out;
}

function showError(errorEl, err) {
  errorEl.textContent = isMissingTable(err) ? MISSING_TABLE_MESSAGE : (err.message || String(err));
}

// ---------- Fiche prospect / client ----------
export function openProspectModal(userId, prospect, onSaved) {
  const p = prospect || { etape: "À contacter" };
  const { overlay, close } = openModal(`
    ${header(prospect ? p.entreprise : "Nouveau prospect")}
    <form data-form>
      <div class="crm-form-grid">
        ${field("Entreprise *", `<input type="text" name="entreprise" maxlength="200" required value="${val(p.entreprise)}">`, { span: true })}
        ${field("Secteur", `<select name="secteur">${options(SECTEURS, p.secteur)}</select>`)}
        ${field("Ville", `<input type="text" name="ville" maxlength="120" value="${val(p.ville)}">`)}
        ${field("Gérant", `<input type="text" name="gerant" maxlength="120" value="${val(p.gerant)}">`)}
        ${field("Téléphone", `<input type="tel" name="telephone" maxlength="40" value="${val(p.telephone)}">`)}
        ${field("Email", `<input type="email" name="email" maxlength="200" value="${val(p.email)}">`, { span: true })}
        ${field("Site actuel", `<select name="site_actuel">${options(SITES, p.site_actuel)}</select>`)}
        ${field("Source", `<select name="source">${options(SOURCES, p.source)}</select>`)}
        ${field("Note Google", `<input type="number" name="note_google" min="0" max="5" step="0.1" value="${val(p.note_google)}" placeholder="ex : 4.6">`)}
        ${field("Nombre d'avis", `<input type="number" name="nb_avis" min="0" step="1" value="${val(p.nb_avis)}">`)}
        ${field("Étape", `<select name="etape">${options(ETAPES, p.etape, { empty: false })}</select>`, { span: true })}
        ${field("Dernier contact", `<input type="date" name="dernier_contact" value="${val(p.dernier_contact)}">`)}
        ${field("Prochaine relance", `<input type="date" name="prochaine_relance" value="${val(p.prochaine_relance)}">`)}
        ${field("Prix création (€)", `<input type="number" name="prix_creation" min="0" step="0.01" value="${val(p.prix_creation)}">`)}
        ${field("Abonnement mensuel (€)", `<input type="number" name="abonnement_mensuel" min="0" step="0.01" value="${val(p.abonnement_mensuel)}">`)}
        ${field("Notes (besoins, objections)", `<textarea name="notes" rows="4" maxlength="5000">${val(p.notes)}</textarea>`, { span: true })}
      </div>
      ${footer(!!prospect)}
    </form>
  `);

  const form = overlay.querySelector("[data-form]");
  const errorEl = overlay.querySelector("[data-error]");
  const submitBtn = overlay.querySelector("[data-submit]");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    submitBtn.disabled = true;
    try {
      await saveProspect(userId, readForm(form), prospect);
      close();
      onSaved();
    } catch (err) {
      showError(errorEl, err);
      submitBtn.disabled = false;
    }
  });

  const deleteBtn = overlay.querySelector("[data-delete]");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      const ok = await window.confirmDialog(`Supprimer « ${prospect.entreprise} » ? Son projet éventuel sera supprimé aussi.`, { danger: true, confirmLabel: "Supprimer" });
      if (!ok) return;
      const { error } = await supabase.from(PROSPECTS_TABLE).delete().eq("id", prospect.id);
      if (error) { showError(errorEl, error); return; }
      close();
      onSaved();
    });
  }
}

// ---------- Projet ----------
// `clients` : les fiches à l'étape "Gagné" (seules à pouvoir avoir un projet).
export function openProjetModal(userId, projet, clients, onSaved) {
  const p = projet || { statut: "Attente contenu" };
  const clientOptions = clients.map((c) =>
    `<option value="${c.id}"${c.id === p.prospect_id ? " selected" : ""}>${escapeHtml(c.entreprise)}</option>`
  ).join("");
  const client = projet && clients.find((c) => c.id === projet.prospect_id);

  const { overlay, close } = openModal(`
    ${header(projet ? "Projet — " + (client ? client.entreprise : "client") : "Nouveau projet")}
    ${clients.length ? "" : `<p style="font-size:13px;color:var(--text-dim);margin-bottom:14px;">Aucun client gagné pour l'instant : passe d'abord un prospect à l'étape « Gagné ».</p>`}
    <form data-form>
      <div class="crm-form-grid">
        ${field("Client *", `<select name="prospect_id" required>${clients.length ? clientOptions : `<option value="">—</option>`}</select>`, { span: true })}
        ${field("Statut", `<select name="statut">${options(STATUTS, p.statut, { empty: false })}</select>`)}
        ${field("Livraison prévue", `<input type="date" name="livraison_prevue" value="${val(p.livraison_prevue)}">`)}
        ${field("Lien du site", `<input type="text" name="lien_site" maxlength="500" placeholder="https://…" value="${val(p.lien_site)}">`, { span: true })}
        ${field("Hébergeur / nom de domaine", `<input type="text" name="hebergeur_domaine" maxlength="200" placeholder="ex : OVH — mon-client.fr" value="${val(p.hebergeur_domaine)}">`, { span: true })}
        <label class="crm-check"><input type="checkbox" name="acompte_paye"${p.acompte_paye ? " checked" : ""}> Acompte payé</label>
        <label class="crm-check"><input type="checkbox" name="solde_paye"${p.solde_paye ? " checked" : ""}> Solde payé</label>
      </div>
      ${footer(!!projet)}
    </form>
  `);

  const form = overlay.querySelector("[data-form]");
  const errorEl = overlay.querySelector("[data-error]");
  const submitBtn = overlay.querySelector("[data-submit]");
  if (!clients.length) submitBtn.disabled = true;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    const values = readForm(form);
    if (values.lien_site && !/^https?:\/\//i.test(values.lien_site)) values.lien_site = "https://" + values.lien_site;
    submitBtn.disabled = true;
    const { error } = projet
      ? await supabase.from(PROJETS_TABLE).update(values).eq("id", projet.id)
      : await supabase.from(PROJETS_TABLE).insert({ ...values, user_id: userId });
    if (error) {
      showError(errorEl, error);
      submitBtn.disabled = false;
      return;
    }
    close();
    onSaved();
  });

  const deleteBtn = overlay.querySelector("[data-delete]");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      const ok = await window.confirmDialog("Supprimer ce projet ?", { danger: true, confirmLabel: "Supprimer" });
      if (!ok) return;
      const { error } = await supabase.from(PROJETS_TABLE).delete().eq("id", projet.id);
      if (error) { showError(errorEl, error); return; }
      close();
      onSaved();
    });
  }
}
