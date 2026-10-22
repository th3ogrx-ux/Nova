// Prospection > Scripts et offres : scripts en bulles de message, packs d'offre en cartes de tarifs comparables.
import { CANAUX, sum, rate, saveOffer, deleteOffer, escapeHtml, fmtInt, fmtPct, fmtEuro, canalIcon } from "./pro-data.js";
import { emptyState, openModal, modalHeader, field, readForm, toast, friendlyError, copyText } from "./pro-ui.js";
import { openScriptModal } from "./pro-strategies.js";

export function renderScripts(root, data, ctx) {
  const groups = data.strategies.map((s) => ({ s, scripts: data.scripts.filter((x) => x.strategy_id === s.id) })).filter((g) => g.scripts.length);
  root.innerHTML = `
    <section>
      <div class="pro-panel-head pro-seq" style="--i:0"><h2 class="panel-title">Scripts</h2></div>
      ${groups.length ? groups.map(({ s, scripts }, gi) => `
        <div class="pro-sgroup pro-seq" style="--i:${gi + 1}">
          <div class="pro-sgroup-head"><button type="button" class="pro-link" data-open="${s.id}">${escapeHtml(s.titre)}</button><span class="pro-chip">${canalIcon(s.canal, 13)} ${escapeHtml(CANAUX[s.canal].label)}</span></div>
          <div class="pro-bubbles">${scripts.map((sc) => {
            const t = sum(data.logs.filter((l) => l.script_id === sc.id));
            return `<div class="pro-msg">
              <div class="pro-bubble out">${escapeHtml(sc.texte).replace(/\n/g, "<br>")}</div>
              <div class="pro-msg-foot"><span class="pro-vbadge">${sc.version}</span>
                <span class="pro-msg-rate"><b>${t.envoyes ? fmtPct(rate(t.reponses, t.envoyes)) : "—"}</b> de réponses${t.envoyes ? ` · ${fmtInt(t.envoyes)} envoyés` : ""}</span>
                <button type="button" class="btn ghost btn-sm" data-copy="${sc.id}">Copier</button>
                <button type="button" class="icon-btn" data-edit-script="${sc.id}" aria-label="Modifier la version ${sc.version}">✎</button></div>
            </div>`;
          }).join("")}</div>
        </div>`).join("")
        : `<div class="card">${emptyState({ title: "Aucun script pour l'instant", text: "Les scripts se rangent par stratégie : ouvre une stratégie et écris son message (version A, puis B pour comparer).", cta: data.strategies.length ? "Voir mes stratégies" : "Créer une stratégie", action: "to-strat" })}</div>`}
    </section>

    <section class="pro-offers-sec">
      <div class="pro-panel-head pro-seq" style="--i:3"><h2 class="panel-title">Packs d'offre</h2><button type="button" class="btn primary btn-sm" data-action="new-offer">+ Ajouter un pack</button></div>
      ${data.offers.length ? `<div class="pro-pricing n${Math.min(data.offers.length, 4)}">${data.offers.map((o, i) => `
        <article class="card pro-price${o.populaire ? " pop" : ""} pro-seq" style="--i:${i + 4}">
          ${o.populaire ? `<span class="pro-ribbon">Le plus choisi</span>` : ""}
          <h3>${escapeHtml(o.nom)}</h3>
          <div class="pro-price-amount"><b>${fmtEuro(o.prix)}</b><span>${o.periode === "mois" ? "/ mois" : "une fois"}</span></div>
          ${o.description ? `<p class="pro-muted">${escapeHtml(o.description)}</p>` : ""}
          <ul>${(o.atouts || "").split("\n").map((a) => a.trim()).filter(Boolean).map((a) => `<li><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span>${escapeHtml(a)}</span></li>`).join("")}</ul>
          <button type="button" class="btn ghost btn-sm" data-edit-offer="${o.id}">Modifier</button>
        </article>`).join("")}</div>`
        : `<div class="card">${emptyState({ title: "Aucun pack d'offre", text: "Présente 2 ou 3 packs côte à côte (ex. Essentiel, Pro, Premium) : c'est plus simple à comparer pour toi comme pour tes prospects.", cta: "Créer un pack", action: "new-offer2" })}</div>`}
    </section>`;

  root.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => ctx.openStrategy(b.dataset.open)));
  const toStrat = root.querySelector('[data-action="to-strat"]'); if (toStrat) toStrat.addEventListener("click", () => ctx.goTab("strategies"));
  root.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => { const sc = data.scripts.find((x) => x.id === b.dataset.copy); toast((await copyText(sc.texte)) ? "Message copié ✓" : "Copie impossible"); }));
  root.querySelectorAll("[data-edit-script]").forEach((b) => b.addEventListener("click", () => { const sc = data.scripts.find((x) => x.id === b.dataset.editScript); openScriptModal(data.strategies.find((s) => s.id === sc.strategy_id), sc, sc.version, ctx); }));
  const newOffer = () => openOfferModal(null, ctx);
  root.querySelector('[data-action="new-offer"]').addEventListener("click", newOffer);
  const n2 = root.querySelector('[data-action="new-offer2"]'); if (n2) n2.addEventListener("click", newOffer);
  root.querySelectorAll("[data-edit-offer]").forEach((b) => b.addEventListener("click", () => openOfferModal(data.offers.find((o) => o.id === b.dataset.editOffer), ctx)));
}

function openOfferModal(offer, ctx) {
  const o = offer || { periode: "unique" };
  const { overlay, close } = openModal(`${modalHeader(offer ? "Modifier le pack" : "Nouveau pack")}
    <form data-form>
      ${field("Nom *", `<input type="text" name="nom" maxlength="60" required value="${escapeHtml(o.nom || "")}" placeholder="Ex : Pack Pro">`)}
      <div class="pro-form-row">
        ${field("Prix (€) *", `<input type="number" name="prix" min="0" step="1" required value="${o.prix != null ? o.prix : ""}">`)}
        ${field("Paiement", `<select name="periode"><option value="unique"${o.periode === "unique" ? " selected" : ""}>Une fois</option><option value="mois"${o.periode === "mois" ? " selected" : ""}>Par mois</option></select>`)}
      </div>
      ${field("Description", `<input type="text" name="description" maxlength="200" value="${escapeHtml(o.description || "")}" placeholder="Une phrase pour résumer le pack">`)}
      ${field("Ce qui est inclus (un point par ligne)", `<textarea name="atouts" rows="5" maxlength="1000" placeholder="Site vitrine 5 pages&#10;Fiche Google optimisée">${escapeHtml(o.atouts || "")}</textarea>`)}
      <label class="crm-check"><input type="checkbox" name="populaire"${o.populaire ? " checked" : ""}> Mettre en avant (« le plus choisi »)</label>
      <div class="error-msg" data-error></div>
      <div class="modal-actions">${offer ? `<button type="button" class="btn danger" data-delete style="margin-right:auto;">Supprimer</button>` : ""}<button type="button" class="btn ghost" data-close>Annuler</button><button type="submit" class="btn primary">Enregistrer</button></div>
    </form>`, { maxWidth: 500 });
  const form = overlay.querySelector("[data-form]"), errorEl = overlay.querySelector("[data-error]");
  form.nom.focus();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = readForm(form);
    if (!v.nom || v.prix == null || !(v.prix >= 0)) { errorEl.textContent = "Indique un nom et un prix."; return; }
    try { await saveOffer(v, offer && offer.id); close(); toast("Pack enregistré ✓"); ctx.reload(); } catch (err) { errorEl.textContent = friendlyError(err); }
  });
  const del = overlay.querySelector("[data-delete]");
  if (del) del.addEventListener("click", async () => {
    const ok = await window.confirmDialog(`Supprimer le pack « ${offer.nom} » ?`, { danger: true, confirmLabel: "Supprimer" });
    if (!ok) return;
    try { await deleteOffer(offer.id); close(); ctx.reload(); } catch (err) { errorEl.textContent = friendlyError(err); }
  });
}
