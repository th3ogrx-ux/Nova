// Prospection > Pipeline : une colonne par étape, cartes glissables, compteur par colonne.
import { CANAUX, ETAPES, saveProspect, deleteProspect, escapeHtml, fmtEuro, canalIcon } from "./pro-data.js";
import { renderBoard, moveButtons } from "./pro-kanban.js";
import { bindFormDraft } from "./pro-draft.js";
import { emptyState, openModal, modalHeader, field, options, readForm, toast, friendlyError } from "./pro-ui.js";

const canalOptions = [{ key: "", label: "—" }, ...Object.entries(CANAUX).map(([key, c]) => ({ key, label: c.label }))];

export function renderPipeline(root, data, ctx) {
  root.innerHTML = `
    <div class="pro-toolbar pro-seq" style="--i:0">
      <p class="pro-muted pro-toolbar-text">${data.prospects.length} prospect${data.prospects.length > 1 ? "s" : ""} dans le pipeline</p>
      <button type="button" class="btn primary btn-sm" data-action="new">+ Ajouter un prospect</button>
    </div>
    <div data-body></div>`;
  root.querySelector('[data-action="new"]').addEventListener("click", () => openProspectModal(null, data, ctx));
  const body = root.querySelector("[data-body]");
  if (!data.prospects.length) {
    body.innerHTML = `<div class="card">${emptyState({ title: "Ton pipeline est vide", text: "Ajoute chaque prospect qui te répond ou qui t'intéresse, puis fais-le avancer de colonne en colonne jusqu'à la signature.", cta: "Ajouter un prospect", action: "new2" })}</div>`;
    body.querySelector('[data-action="new2"]').addEventListener("click", () => openProspectModal(null, data, ctx));
    return;
  }
  const strategyTitle = Object.fromEntries(data.strategies.map((s) => [s.id, s.titre]));
  renderBoard(body, {
    columns: ETAPES, items: data.prospects, colOf: (p) => p.etape,
    footerHtml: (list) => { const total = list.reduce((a, p) => a + (Number(p.valeur) || 0), 0); return total ? `<span>${fmtEuro(total)}</span>` : ""; },
    cardHtml: (p) => `
      <div class="pro-pcard">
        <div class="pro-pcard-top"><strong>${escapeHtml(p.nom)}</strong>${moveButtons(ETAPES.findIndex((e) => e.key === p.etape), ETAPES.length)}</div>
        ${p.contact ? `<p class="pro-muted">${escapeHtml(p.contact)}</p>` : ""}
        <div class="pro-pcard-foot">
          ${p.canal ? `<span class="pro-chip">${canalIcon(p.canal, 13)} ${escapeHtml(CANAUX[p.canal].label)}</span>` : ""}
          ${p.strategy_id && strategyTitle[p.strategy_id] ? `<span class="pro-chip alt" title="${escapeHtml(strategyTitle[p.strategy_id])}">${escapeHtml(strategyTitle[p.strategy_id])}</span>` : ""}
          ${p.valeur ? `<span class="pro-value">${fmtEuro(p.valeur)}</span>` : ""}
        </div>
      </div>`,
    onMove: async (id, etape) => {
      const p = data.prospects.find((x) => x.id === id), before = p.etape;
      p.etape = etape; ctx.rerender({ animate: false });
      try { await saveProspect({ etape }, id); if (etape === "signe") toast("Client signé, bravo !"); } catch (err) { p.etape = before; ctx.rerender({ animate: false }); toast(friendlyError(err), "error"); }
    },
    onOpen: (id) => openProspectModal(data.prospects.find((p) => p.id === id), data, ctx),
    emptyText: "Aucun prospect"
  });
}

export function openProspectModal(prospect, data, ctx) {
  const p = prospect || { etape: "contacte" };
  const { overlay, close } = openModal(`${modalHeader(prospect ? "Modifier le prospect" : "Nouveau prospect")}
    <form data-form>
      ${field("Nom du prospect *", `<input type="text" name="nom" maxlength="120" required value="${escapeHtml(p.nom || "")}" placeholder="Ex : Salon Éclat, Lyon">`)}
      ${field("Contact", `<input type="text" name="contact" maxlength="200" value="${escapeHtml(p.contact || "")}" placeholder="@pseudo, e-mail ou téléphone">`)}
      <div class="pro-form-row">
        ${field("Étape", `<select name="etape">${options(ETAPES, p.etape)}</select>`)}
        ${field("Canal", `<select name="canal">${options(canalOptions, p.canal || "")}</select>`)}
      </div>
      <div class="pro-form-row">
        ${field("Stratégie", `<select name="strategy_id"><option value="">—</option>${data.strategies.map((s) => `<option value="${s.id}"${s.id === p.strategy_id ? " selected" : ""}>${escapeHtml(s.titre)}</option>`).join("")}</select>`)}
        ${field("Valeur estimée (€)", `<input type="number" name="valeur" min="0" step="1" value="${p.valeur != null ? p.valeur : ""}">`)}
      </div>
      ${field("Objectifs du prospect", `<textarea name="objectifs" rows="2" maxlength="2000">${escapeHtml(p.objectifs || "")}</textarea>`)}
      ${field("Notes importantes", `<textarea name="notes" rows="3" maxlength="4000">${escapeHtml(p.notes || "")}</textarea>`)}
      <div class="error-msg" data-error></div>
      <div class="modal-actions">${prospect ? `<button type="button" class="btn danger" data-delete style="margin-right:auto;">Supprimer</button>` : ""}<button type="button" class="btn ghost" data-close>Annuler</button><button type="submit" class="btn primary">Enregistrer</button></div>
    </form>`, { maxWidth: 520 });
  const form = overlay.querySelector("[data-form]"), errorEl = overlay.querySelector("[data-error]");
  form.nom.focus();
  const draft = bindFormDraft(form, "prospect:" + (prospect ? prospect.id : "new"), { onReset: () => { close(); openProspectModal(prospect, data, ctx); } });
  overlay.querySelector(".modal-actions [data-close]").addEventListener("click", () => draft.clear());
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = readForm(form);
    if (!v.nom) { errorEl.textContent = "Indique le nom du prospect."; return; }
    try { await saveProspect(v, prospect && prospect.id); draft.clear(); close(); toast("Prospect enregistré ✓"); ctx.reload(); } catch (err) { errorEl.textContent = friendlyError(err); }
  });
  const del = overlay.querySelector("[data-delete]");
  if (del) del.addEventListener("click", async () => {
    const ok = await window.confirmDialog(`Supprimer « ${prospect.nom} » ?`, { danger: true, confirmLabel: "Supprimer" });
    if (!ok) return;
    try { await deleteProspect(prospect.id); draft.clear(); close(); ctx.reload(); } catch (err) { errorEl.textContent = friendlyError(err); }
  });
}
