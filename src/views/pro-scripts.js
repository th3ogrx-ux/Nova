// Prospection > Scripts et offres : scripts en bulles de message, packs d'offre en cartes de tarifs comparables.
import { CANAUX, sum, rate, saveOffer, deleteOffer, escapeHtml, fmtInt, fmtPct, fmtEuro, canalIcon, cleanPhases, phaseCost, phasesSummary, offerProgram, weeksOf, weeksCount } from "./pro-data.js";
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
          ${(o.phases || []).length ? phasedHeader(o) : `<div class="pro-price-amount"><b>${fmtEuro(o.prix)}</b><span>${o.periode === "mois" ? "/ mois" : "une fois"}</span></div>`}
          ${o.description ? `<p class="pro-muted">${escapeHtml(o.description)}</p>` : ""}
          ${(o.phases || []).length ? phaseTimeline(o.phases) : ""}
          <ul>${(o.atouts || "").split("\n").map((a) => a.trim()).filter(Boolean).map((a) => `<li><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span>${escapeHtml(a)}</span></li>`).join("")}</ul>
          <div class="pro-price-btns">${(o.phases || []).length ? `<button type="button" class="btn primary btn-sm" data-program="${o.id}">Voir le programme complet</button>` : ""}<button type="button" class="btn ghost btn-sm" data-edit-offer="${o.id}">Modifier</button></div>
        </article>`).join("")}</div>`
        : `<div class="card">${emptyState({ title: "Aucun pack d'offre", text: "Présente 2 ou 3 packs côte à côte (ex. Essentiel, Pro, Premium) : c'est plus simple à comparer pour toi comme pour tes prospects.", cta: "Créer un pack", action: "new-offer2" })}</div>`}
    </section>`;

  root.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => ctx.openStrategy(b.dataset.open)));
  const toStrat = root.querySelector('[data-action="to-strat"]'); if (toStrat) toStrat.addEventListener("click", () => ctx.goTab("strategies"));
  root.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => { const sc = data.scripts.find((x) => x.id === b.dataset.copy); toast((await copyText(sc.texte)) ? "Message copié ✓" : "Copie impossible"); }));
  root.querySelectorAll("[data-edit-script]").forEach((b) => b.addEventListener("click", () => { const sc = data.scripts.find((x) => x.id === b.dataset.editScript); openScriptModal(data.strategies.find((s) => s.id === sc.strategy_id), sc, sc.version, ctx); }));
  root.querySelectorAll("[data-program]").forEach((b) => b.addEventListener("click", () => openProgramModal(data.offers.find((o) => o.id === b.dataset.program))));
  const newOffer = () => openOfferModal(null, ctx);
  root.querySelector('[data-action="new-offer"]').addEventListener("click", newOffer);
  const n2 = root.querySelector('[data-action="new-offer2"]'); if (n2) n2.addEventListener("click", newOffer);
  root.querySelectorAll("[data-edit-offer]").forEach((b) => b.addEventListener("click", () => openOfferModal(data.offers.find((o) => o.id === b.dataset.editOffer), ctx)));
}

const monthsLabel = (start, n) => (n === 1 ? `Mois ${start}` : `Mois ${start} à ${start + n - 1}`);
const costText = (p) => (p.mode === "mois" ? `${fmtEuro(p.prix)} / mois${p.mois > 1 ? ` · ${fmtEuro(p.prix * p.mois)} au total` : ""}` : `${fmtEuro(p.prix)} au total`);

function phasedHeader(o) {
  const sm = phasesSummary(o.phases);
  return `<div class="pro-price-amount"><b>${fmtEuro(sm.total)}</b><span>sur ${sm.mois} mois</span></div>
    <p class="pro-price-avg">Soit ${fmtEuro(sm.parMois)} par mois en moyenne</p>`;
}
function phaseTimeline(phases) {
  let start = 1;
  return `<ol class="pro-phases">${phases.map((p) => {
    const li = `<li><span class="pro-phase-dot"></span><div><div class="pro-phase-when">${monthsLabel(start, p.mois)}</div><div class="pro-phase-title">${escapeHtml(p.titre)}</div>
      <div class="pro-phase-cost">${costText(p)}</div>${p.detail ? `<div class="pro-muted pro-phase-detail">${escapeHtml(p.detail)}</div>` : ""}</div></li>`;
    start += p.mois;
    return li;
  }).join("")}</ol>`;
}

function programText(offer) {
  return offerProgram(offer.phases).map(({ phase, fromMonth, weeks }) => `${phase.titre} (mois ${fromMonth}${phase.mois > 1 ? " à " + (fromMonth + phase.mois - 1) : ""}, ${costText(phase)})\n` + weeks.filter((w) => w.task).map((w) => `  Semaine ${w.n} : ${w.task.replace(/\n/g, "\n    ")}`).join("\n")).join("\n\n");
}

// Programme complet : tout le travail à faire, étape par étape et semaine par semaine.
function openProgramModal(offer) {
  const prog = offerProgram(offer.phases), sm = phasesSummary(offer.phases);
  const planned = prog.reduce((a, p) => a + p.planned, 0);
  const { overlay } = openModal(`${modalHeader("Programme : " + offer.nom)}
    <p class="pro-muted" style="margin:0 0 14px;">${fmtEuro(sm.total)} sur ${sm.mois} mois · ${planned ? planned + " semaine" + (planned > 1 ? "s" : "") + " détaillée" + (planned > 1 ? "s" : "") : "aucune semaine détaillée pour l'instant"}</p>
    <div class="pro-program">${prog.map(({ phase, fromMonth, weeks }) => `
      <section class="pro-program-phase">
        <header><span class="pro-phase-when">${monthsLabel(fromMonth, phase.mois)}</span><h3>${escapeHtml(phase.titre)}</h3><span class="pro-phase-cost">${costText(phase)}</span></header>
        <ol class="pro-weeks">${weeks.map((w) => `<li class="${w.task ? "" : "empty"}"><span class="pro-week-n">S${w.n}</span><span>${w.task ? escapeHtml(w.task).replace(/\n/g, "<br>") : "À définir"}</span></li>`).join("")}</ol>
      </section>`).join("")}</div>
    <div class="modal-actions"><button type="button" class="btn ghost" data-close>Fermer</button><button type="button" class="btn primary" data-copy-program>Copier le programme</button></div>`, { maxWidth: 620 });
  overlay.querySelector("[data-copy-program]").addEventListener("click", async () => toast((await copyText(programText(offer))) ? "Programme copié ✓" : "Copie impossible"));
}

function weekBox(i, text = "") {
  return `<div class="pro-wk"><label for="wk-${Math.random().toString(36).slice(2, 8)}-${i}"><span class="pro-week-n">Sem. ${i + 1}</span></label>
    <textarea data-w rows="2" maxlength="600" placeholder="Ce que tu fais cette semaine…" aria-label="Semaine ${i + 1}">${escapeHtml(text)}</textarea></div>`;
}
function weekBoxes(p) {
  const weeks = weeksOf(p);
  return Array.from({ length: Math.max(weeks.length, weeksCount(p.mois || 3)) }, (_, i) => weekBox(i, weeks[i] || "")).join("");
}

function phaseRow(p = {}) {
  return `<div class="pro-phase-row" data-phase>
    <div class="pro-phase-row-top"><input type="text" data-f="titre" maxlength="80" placeholder="Ex : Fiche Google et visibilité locale" value="${escapeHtml(p.titre || "")}" aria-label="Nom de l'étape"><button type="button" class="icon-btn" data-rm aria-label="Retirer cette étape">✕</button></div>
    <div class="pro-phase-row-grid">
      <label>Durée<span class="pro-phase-unit"><input type="number" data-f="mois" min="1" max="60" step="1" value="${p.mois || 3}"> mois</span></label>
      <label>Prix<span class="pro-phase-unit"><input type="number" data-f="prix" min="0" step="1" value="${p.prix != null ? p.prix : ""}"> €</span></label>
      <label>Ce prix est<select data-f="mode"><option value="total"${p.mode === "total" ? " selected" : ""}>au total</option><option value="mois"${p.mode !== "total" ? " selected" : ""}>par mois</option></select></label>
    </div>
    <input type="text" data-f="detail" maxlength="200" placeholder="En une phrase : ce que tu fais pendant cette étape (facultatif)" value="${escapeHtml(p.detail || "")}" aria-label="Détail de l'étape">
    <details class="pro-phase-weeks"${weeksOf(p).length ? " open" : ""}>
      <summary>Travail semaine par semaine <em data-weeks-info></em></summary>
      <div class="pro-wk-list" data-weeks>${weekBoxes(p)}</div>
      <button type="button" class="btn ghost btn-sm" data-add-week>+ Ajouter une semaine</button>
    </details>
  </div>`;
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
      <div class="pro-phases-edit">
        <div class="pro-phases-edit-head"><span class="field-label" style="margin:0;">Étapes dans le temps (offre long terme)</span></div>
        <p class="pro-muted" style="margin:0 0 10px;">Pour une offre qui s'étale sur plusieurs mois : ex. 3 mois à 180 € pour la fiche Google, puis 3 mois de réseaux sociaux. Laisse vide pour une offre simple.</p>
        <div data-phases>${(o.phases || []).map(phaseRow).join("")}</div>
        <div class="pro-phases-total" data-phases-total aria-live="polite"></div>
        <button type="button" class="btn ghost btn-sm" data-add-phase>+ Ajouter une étape</button>
      </div>
      <label class="crm-check"><input type="checkbox" name="populaire"${o.populaire ? " checked" : ""}> Mettre en avant (« le plus choisi »)</label>
      <div class="error-msg" data-error></div>
      <div class="modal-actions">${offer ? `<button type="button" class="btn danger" data-delete style="margin-right:auto;">Supprimer</button>` : ""}<button type="button" class="btn ghost" data-close>Annuler</button><button type="submit" class="btn primary">Enregistrer</button></div>
    </form>`, { maxWidth: 500 });
  const form = overlay.querySelector("[data-form]"), errorEl = overlay.querySelector("[data-error]");
  form.nom.focus();
  const box = form.querySelector("[data-phases]"), totalEl = form.querySelector("[data-phases-total]");
  const readPhases = () => cleanPhases([...box.querySelectorAll("[data-phase]")].map((row) => ({
    ...Object.fromEntries([...row.querySelectorAll("[data-f]")].map((i) => [i.dataset.f, i.value])),
    semaines: [...row.querySelectorAll("[data-w]")].map((t) => t.value)
  })));
  // Le nombre de cases suit la durée de l'étape (environ 4 semaines par mois) ; une case remplie n'est jamais retirée.
  const syncWeeks = (row, { trim = false } = {}) => {
    const list = row.querySelector("[data-weeks]"), want = weeksCount(Number(row.querySelector('[data-f="mois"]').value) || 1);
    let boxes = list.querySelectorAll(".pro-wk");
    while (boxes.length < want) { list.insertAdjacentHTML("beforeend", weekBox(boxes.length)); boxes = list.querySelectorAll(".pro-wk"); }
    while (trim && boxes.length > want && !boxes[boxes.length - 1].querySelector("textarea").value.trim()) { boxes[boxes.length - 1].remove(); boxes = list.querySelectorAll(".pro-wk"); }
    const filled = [...list.querySelectorAll("textarea")].filter((t) => t.value.trim()).length;
    row.querySelector("[data-weeks-info]").textContent = `(${filled} sur ${boxes.length} remplie${filled > 1 ? "s" : ""})`;
  };
  const syncPhases = () => {
    const phases = readPhases();
    form.prix.disabled = phases.length > 0;
    form.periode.disabled = phases.length > 0;
    if (!phases.length) { totalEl.textContent = ""; return; }
    const sm = phasesSummary(phases);
    form.prix.value = Math.round(sm.total * 100) / 100;
    totalEl.textContent = `Total : ${fmtEuro(sm.total)} sur ${sm.mois} mois (${fmtEuro(sm.parMois)} par mois en moyenne)`;
  };
  box.addEventListener("input", (e) => { const row = e.target.closest("[data-phase]"); if (row) syncWeeks(row, { trim: e.target.matches('[data-f="mois"]') }); syncPhases(); });
  box.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add-week]");
    if (!add) return;
    const row = add.closest("[data-phase]"), list = row.querySelector("[data-weeks]");
    if (list.querySelectorAll(".pro-wk").length >= 60) return;
    list.insertAdjacentHTML("beforeend", weekBox(list.querySelectorAll(".pro-wk").length));
    list.lastElementChild.querySelector("textarea").focus();
    syncWeeks(row);
  });
  box.addEventListener("click", (e) => { const rm = e.target.closest("[data-rm]"); if (rm) { rm.closest("[data-phase]").remove(); syncPhases(); } });
  form.querySelector("[data-add-phase]").addEventListener("click", () => {
    if (box.querySelectorAll("[data-phase]").length >= 12) return;
    box.insertAdjacentHTML("beforeend", phaseRow());
    syncWeeks(box.lastElementChild);
    box.lastElementChild.querySelector('[data-f="titre"]').focus();
    syncPhases();
  });
  box.querySelectorAll("[data-phase]").forEach(syncWeeks);
  syncPhases();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    form.prix.disabled = false; form.periode.disabled = false; // champs figés seulement pour l'affichage
    const v = readForm(form);
    const phases = readPhases();
    if (phases.length) { v.prix = Math.round(phasesSummary(phases).total * 100) / 100; v.periode = "unique"; }
    v.phases = phases;
    if (!v.nom || v.prix == null || !(v.prix >= 0)) { syncPhases(); errorEl.textContent = "Indique un nom et un prix."; return; }
    try { await saveOffer(v, offer && offer.id); close(); toast("Pack enregistré ✓"); ctx.reload(); } catch (err) { errorEl.textContent = friendlyError(err); }
  });
  const del = overlay.querySelector("[data-delete]");
  if (del) del.addEventListener("click", async () => {
    const ok = await window.confirmDialog(`Supprimer le pack « ${offer.nom} » ?`, { danger: true, confirmLabel: "Supprimer" });
    if (!ok) return;
    try { await deleteOffer(offer.id); close(); ctx.reload(); } catch (err) { errorEl.textContent = friendlyError(err); }
  });
}
