// Prospection > Scripts et offres : scripts en bulles de message, packs d'offre en cartes de tarifs comparables.
import { CANAUX, sum, rate, saveOffer, deleteOffer, escapeHtml, fmtInt, fmtPct, fmtEuro, canalIcon, canauxChips, cleanPhases, phaseCost, phasesSummary, offerProgram, weeksOf, titlesOf, weeksCount } from "./pro-data.js";
import { draftGet, draftSet, draftClear, debounce } from "./pro-draft.js";
import { emptyState, openModal, modalHeader, field, readForm, toast, friendlyError, copyText } from "./pro-ui.js";
import { openScriptModal } from "./pro-strategies.js";

export function renderScripts(root, data, ctx) {
  root.innerHTML = `
    <section class="pro-offers-sec">
      <div class="pro-panel-head pro-seq" style="--i:3"><h2 class="panel-title">Mes offres</h2><button type="button" class="btn primary btn-sm" data-action="new-offer">+ Ajouter une offre</button></div>
      ${data.offers.length ? `<div class="pro-pricing n${Math.min(data.offers.length, 4)}">${data.offers.map((o, i) => `
        <article class="card pro-price${o.populaire ? " pop" : ""} pro-seq" style="--i:${i + 4}">
          ${o.populaire ? `<span class="pro-ribbon">Le plus choisi</span>` : ""}
          <h3>${escapeHtml(o.nom)}</h3>
          ${(o.phases || []).length ? phasedHeader(o) : priceHeader(o, offerParts(o))}
          ${o.description ? `<p class="pro-muted">${escapeHtml(o.description)}</p>` : ""}
          ${(o.phases || []).length ? phaseTimeline(o.phases) : ""}
          ${offerListHtml(offerParts(o))}
          <div class="pro-price-btns">${(o.phases || []).length ? `<button type="button" class="btn primary btn-sm" data-program="${o.id}">Voir le programme complet</button>` : ""}<button type="button" class="btn ghost btn-sm" data-edit-offer="${o.id}">Modifier</button></div>
        </article>`).join("")}</div>`
        : `<div class="card">${emptyState({ title: "Aucun pack d'offre", text: "Présente 2 ou 3 packs côte à côte (ex. Essentiel, Pro, Premium) : c'est plus simple à comparer pour toi comme pour tes prospects.", cta: "Créer un pack", action: "new-offer2" })}</div>`}
    </section>`;

  root.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); ctx.openStrategy(b.dataset.open); }));
  // Un script long est replié sur quelques lignes : un clic le déplie.
  root.querySelectorAll("[data-expand]").forEach((b) => {
    const toggle = () => { const open = b.classList.toggle("clamp") === false; b.setAttribute("aria-expanded", String(open)); };
    b.addEventListener("click", toggle);
    b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
  });
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

// Conventions dans « Ce qui est inclus » : « ## Titre » = titre de section, « + texte » = supplément
// mis en avant, « essai: 120 » = prix du premier mois (affiché en grand, sans ligne dans la liste).
function offerParts(o) {
  const parts = { essai: null, essaiLabel: null, items: [] };
  (o.atouts || "").split("\n").map((a) => a.trim()).filter(Boolean).forEach((l) => {
    const m = /^essai\s*:\s*(\d+)\s*(?:\|\s*(.+))?$/i.exec(l);
    if (m) { parts.essai = Number(m[1]); parts.essaiLabel = (m[2] || "").trim() || null; }
    else if (l.startsWith("##")) parts.items.push({ t: "h", v: l.replace(/^#+\s*/, "") });
    else if (l.startsWith("+")) parts.items.push({ t: "plus", v: l.replace(/^\+\s*/, "") });
    else parts.items.push({ t: "li", v: l });
  });
  return parts;
}
function priceHeader(o, parts) {
  const essai = parts.essai;
  const per = o.periode === "mois" ? "/ mois" : "une fois";
  if (essai == null) return `<div class="pro-price-amount"><b>${fmtEuro(o.prix)}</b><span>${per}</span></div>`;
  return `<div class="pro-price-trial"><span class="pro-trial-tag">${escapeHtml(parts.essaiLabel || "1er mois d'essai")}</span>
    <div class="pro-price-amount"><b>${fmtEuro(essai)}</b><span>${parts.essaiLabel ? "" : "le premier mois"}</span></div>
    <p class="pro-then">puis <b>${fmtEuro(o.prix)}</b> ${per} · sans engagement</p></div>`;
}
const CHECK = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
function offerListHtml(parts) {
  const out = []; let open = false;
  const close = () => { if (open) { out.push("</ul>"); open = false; } };
  parts.items.forEach((it) => {
    if (it.t === "h") { close(); out.push(`<h4 class="pro-price-sec">${escapeHtml(it.v)}</h4>`); }
    else if (it.t === "plus") { close(); { const [titre, prix, txt] = it.v.split("|").map((x) => x.trim()); out.push(`<div class="pro-price-plus"><span class="pro-plus-tag">En option</span><div class="pro-plus-row"><b>${escapeHtml(titre || "")}</b>${prix ? `<span class="pro-plus-price">${escapeHtml(prix)}</span>` : ""}</div>${txt ? `<p>${escapeHtml(txt)}</p>` : ""}</div>`); } }
    else { if (!open) { out.push("<ul>"); open = true; } out.push(`<li>${CHECK}<span>${escapeHtml(it.v)}</span></li>`); }
  });
  close();
  return `<div class="pro-price-body">${out.join("")}</div>`;
}
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
  return offerProgram(offer.phases).map(({ phase, fromMonth, months }) => `${phase.titre} (mois ${fromMonth}${phase.mois > 1 ? " à " + (fromMonth + phase.mois - 1) : ""}, ${costText(phase)})\n` +
    months.map((m) => {
      const lines = m.weeks.filter((w) => w.task).map((w) => `    Semaine ${w.n} : ${w.task.replace(/\n/g, "\n      ")}`);
      return lines.length || m.titre ? `  Mois ${m.n}${m.titre ? " — " + m.titre : ""}\n${lines.join("\n")}`.trimEnd() : "";
    }).filter(Boolean).join("\n")).join("\n\n");
}

// Programme complet : tout le travail à faire, étape par étape et semaine par semaine.
function openProgramModal(offer) {
  const prog = offerProgram(offer.phases), sm = phasesSummary(offer.phases);
  const planned = prog.reduce((a, p) => a + p.planned, 0);
  const { overlay } = openModal(`${modalHeader("Programme : " + offer.nom)}
    <p class="pro-muted" style="margin:0 0 14px;">${fmtEuro(sm.total)} sur ${sm.mois} mois · ${planned ? planned + " semaine" + (planned > 1 ? "s" : "") + " détaillée" + (planned > 1 ? "s" : "") : "aucune semaine détaillée pour l'instant"}</p>
    <div class="pro-program">${prog.map(({ phase, fromMonth, months }) => `
      <section class="pro-program-phase">
        <header><span class="pro-phase-when">${monthsLabel(fromMonth, phase.mois)}</span><h3>${escapeHtml(phase.titre)}</h3><span class="pro-phase-cost">${costText(phase)}</span></header>
        ${months.map((m) => `<div class="pro-program-month"><h4><span>Mois ${m.n}</span>${m.titre ? escapeHtml(m.titre) : ""}</h4>
          <ol class="pro-weeks">${m.weeks.map((w) => `<li class="${w.task ? "" : "empty"}"><span class="pro-week-n">S${w.n}</span><span>${w.task ? escapeHtml(w.task).replace(/\n/g, "<br>") : "À définir"}</span></li>`).join("")}</ol></div>`).join("")}
      </section>`).join("")}</div>
    <div class="modal-actions"><button type="button" class="btn ghost" data-close>Fermer</button><button type="button" class="btn primary" data-copy-program>Copier le programme</button></div>`, { maxWidth: 620, lockOutside: false });
  overlay.querySelector("[data-copy-program]").addEventListener("click", async () => toast((await copyText(programText(offer))) ? "Programme copié ✓" : "Copie impossible"));
}

// Éditeur du travail prévu : un bloc par mois (4 semaines) avec un titre facultatif, une case par semaine.
const uid = () => Math.random().toString(36).slice(2, 8);
function weeksEditorHtml(weeks, titles, count) {
  const months = Math.ceil(count / 4);
  return Array.from({ length: months }, (_, m) => {
    const boxes = Array.from({ length: Math.min(4, count - m * 4) }, (_, k) => {
      const i = m * 4 + k;
      return `<div class="pro-wk"><label for="wk-${uid()}"><span class="pro-week-n">Sem. ${i + 1}</span></label>
        <textarea data-w rows="2" maxlength="600" placeholder="Ce que tu fais cette semaine…" aria-label="Semaine ${i + 1}">${escapeHtml(weeks[i] || "")}</textarea></div>`;
    }).join("");
    return `<div class="pro-month"><label class="pro-month-title"><span class="pro-month-n" data-month-n>Mois ${m + 1}</span>
      <input type="text" data-mt maxlength="80" placeholder="Titre du mois (ex : Mise en place)" value="${escapeHtml(titles[m] || "")}" aria-label="Titre du mois ${m + 1}"></label>${boxes}</div>`;
  }).join("");
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
    <details class="pro-phase-weeks"${weeksOf(p).length || titlesOf(p).length ? " open" : ""}>
      <summary>Travail semaine par semaine <em data-weeks-info></em></summary>
      <div class="pro-wk-list" data-weeks>${weeksEditorHtml(weeksOf(p), titlesOf(p), Math.max(weeksOf(p).length, weeksCount(p.mois || 3)))}</div>
      <button type="button" class="btn ghost btn-sm" data-add-week>+ Ajouter une semaine</button>
    </details>
  </div>`;
}

function openOfferModal(offer, ctx) {
  const draftKey = "offer:" + (offer ? offer.id : "new");
  const draft = draftGet(draftKey);
  const o = draft ? { ...(offer || { periode: "unique" }), ...draft } : offer || { periode: "unique" };
  const { overlay, close } = openModal(`${modalHeader(offer ? "Modifier le pack" : "Nouveau pack")}
    <form data-form>
      ${draft ? `<div class="pro-draft-note" role="status"><span>Brouillon retrouvé : ton texte non enregistré a été restauré.</span><button type="button" class="btn ghost btn-sm" data-drop-draft>Repartir de zéro</button></div>` : ""}
      ${field("Nom *", `<input type="text" name="nom" maxlength="60" required value="${escapeHtml(o.nom || "")}" placeholder="Ex : Pack Pro">`)}
      <div class="pro-form-row">
        ${field("Prix (€) *", `<input type="number" name="prix" min="0" step="1" required value="${o.prix != null ? o.prix : ""}">`)}
        ${field("Paiement", `<select name="periode"><option value="unique"${o.periode === "unique" ? " selected" : ""}>Une fois</option><option value="mois"${o.periode === "mois" ? " selected" : ""}>Par mois</option></select>`)}
      </div>
      ${field("Description", `<input type="text" name="description" maxlength="200" value="${escapeHtml(o.description || "")}" placeholder="Une phrase pour résumer le pack">`)}
      ${field("Ce qui est inclus (un point par ligne · ## titre · + option : Titre | Prix | Texte · essai: prix | libellé)", `<textarea name="atouts" rows="8" maxlength="1000" placeholder="## Mise en place&#10;Site vitrine 5 pages&#10;+ Option vidéo | +100 € / mois | Une phrase&#10;essai: 120">${escapeHtml(o.atouts || "")}</textarea>`)}
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
    </form>`, { maxWidth: 500, lockOutside: true });
  const form = overlay.querySelector("[data-form]"), errorEl = overlay.querySelector("[data-error]");
  if (!draft) form.nom.focus();
  const box = form.querySelector("[data-phases]"), totalEl = form.querySelector("[data-phases-total]");
  const readWeeks = (row) => ({ semaines: [...row.querySelectorAll("[data-w]")].map((t) => t.value), titres_mois: [...row.querySelectorAll("[data-mt]")].map((t) => t.value) });
  const readPhases = () => cleanPhases([...box.querySelectorAll("[data-phase]")].map((row) => ({
    ...Object.fromEntries([...row.querySelectorAll("[data-f]")].map((i) => [i.dataset.f, i.value])), ...readWeeks(row)
  })));
  // Numéro réel des mois (selon les étapes précédentes) et compteur de semaines remplies.
  const renumber = () => {
    let start = 1;
    box.querySelectorAll("[data-phase]").forEach((row) => {
      row.querySelectorAll("[data-month-n]").forEach((n, m) => { n.textContent = "Mois " + (start + m); });
      start += Math.max(1, Math.floor(Number(row.querySelector('[data-f="mois"]').value) || 1));
      const all = row.querySelectorAll("[data-w]"), filled = [...all].filter((t) => t.value.trim()).length;
      row.querySelector("[data-weeks-info]").textContent = `(${filled} sur ${all.length} remplie${filled > 1 ? "s" : ""})`;
    });
  };
  // Le nombre de cases suit la durée de l'étape (4 semaines par mois) ; une case remplie n'est jamais retirée.
  const syncWeeks = (row, { trim = false, add = 0 } = {}) => {
    const cur = readWeeks(row), mois = Math.max(1, Math.floor(Number(row.querySelector('[data-f="mois"]').value) || 1));
    let count = Math.max(cur.semaines.length, weeksCount(mois)) + add;
    if (trim) { let last = cur.semaines.length; while (last > 0 && !cur.semaines[last - 1].trim()) last--; count = Math.max(weeksCount(mois), last); }
    count = Math.min(60, count);
    if (count === cur.semaines.length) { renumber(); return; }
    row.querySelector("[data-weeks]").innerHTML = weeksEditorHtml(cur.semaines, cur.titres_mois, count);
    renumber();
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
  // Brouillon : tout le formulaire (y compris les étapes à moitié remplies) est gardé sur l'appareil.
  const saveDraft = debounce(() => {
    draftSet(draftKey, {
      nom: form.nom.value, description: form.description.value, atouts: form.atouts.value, populaire: form.populaire.checked,
      prix: form.prix.value === "" ? null : Number(form.prix.value), periode: form.periode.value,
      phases: [...box.querySelectorAll("[data-phase]")].map((row) => ({
        ...Object.fromEntries([...row.querySelectorAll("[data-f]")].map((i) => [i.dataset.f, i.value])), ...readWeeks(row)
      }))
    });
  }, 500);
  // La saisie reste fluide : les calculs (total, compteurs) sont regroupés et ne bloquent pas la frappe.
  const refresh = debounce(() => { renumber(); syncPhases(); }, 200);
  form.addEventListener("input", saveDraft);
  form.addEventListener("change", saveDraft);
  box.addEventListener("input", (e) => {
    const row = e.target.closest("[data-phase]");
    if (row && e.target.matches('[data-f="mois"]')) { syncWeeks(row, { trim: true }); syncPhases(); saveDraft(); return; }
    if (e.target.matches("[data-w], [data-mt], [data-f=\"titre\"], [data-f=\"detail\"]")) { if (e.target.matches("[data-w]")) refresh(); return; }
    refresh();
  });
  overlay.querySelector(".modal-actions [data-close]").addEventListener("click", () => draftClear(draftKey)); // « Annuler » = jeter le brouillon
  const dropDraft = form.querySelector("[data-drop-draft]");
  if (dropDraft) dropDraft.addEventListener("click", () => { draftClear(draftKey); close(); openOfferModal(offer, ctx); });
  box.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add-week]");
    if (!add) return;
    const row = add.closest("[data-phase]");
    syncWeeks(row, { add: 1 });
    const all = row.querySelectorAll("[data-w]");
    all[all.length - 1].focus();
  });
  box.addEventListener("click", (e) => { const rm = e.target.closest("[data-rm]"); if (rm) { rm.closest("[data-phase]").remove(); renumber(); syncPhases(); } });
  form.querySelector("[data-add-phase]").addEventListener("click", () => {
    if (box.querySelectorAll("[data-phase]").length >= 12) return;
    box.insertAdjacentHTML("beforeend", phaseRow());
    syncWeeks(box.lastElementChild);
    box.lastElementChild.querySelector('[data-f="titre"]').focus();
    syncPhases();
  });
  renumber();
  syncPhases();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    form.prix.disabled = false; form.periode.disabled = false; // champs figés seulement pour l'affichage
    const v = readForm(form);
    const phases = readPhases();
    if (phases.length) { v.prix = Math.round(phasesSummary(phases).total * 100) / 100; v.periode = "unique"; }
    v.phases = phases;
    if (!v.nom || v.prix == null || !(v.prix >= 0)) { syncPhases(); errorEl.textContent = "Indique un nom et un prix."; return; }
    try { await saveOffer(v, offer && offer.id); draftClear(draftKey); close(); toast("Pack enregistré ✓"); ctx.reload(); } catch (err) { errorEl.textContent = friendlyError(err); }
  });
  const del = overlay.querySelector("[data-delete]");
  if (del) del.addEventListener("click", async () => {
    const ok = await window.confirmDialog(`Supprimer le pack « ${offer.nom} » ?`, { danger: true, confirmLabel: "Supprimer" });
    if (!ok) return;
    try { await deleteOffer(offer.id); draftClear(draftKey); close(); ctx.reload(); } catch (err) { errorEl.textContent = friendlyError(err); }
  });
}
