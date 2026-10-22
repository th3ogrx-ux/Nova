// Prospection > Stratégies : cartes riches, vue Kanban, page détail (scripts A/B, historique, notes).
import {
  CANAUX, STATUTS, statutOf, strategyStats, weeklySeries, sum, rate, inRange, dateKey, parseKey, shortDay, mondayOf,
  escapeHtml, fmtInt, fmtPct, canalIcon, canauxChips, canauxOf, offerPriceLabel, saveStrategy, deleteStrategy, saveScript, deleteScript, deleteLog
} from "./pro-data.js";
import { miniBars, lineChart, runCounters } from "./pro-charts.js";
import { renderBoard, moveButtons } from "./pro-kanban.js";
import { draftGet, draftSet, draftClear, debounce, bindFormDraft } from "./pro-draft.js";
import { emptyState, openModal, modalHeader, field, options, readForm, toast, friendlyError, copyText } from "./pro-ui.js";

const canalOptions = Object.entries(CANAUX).map(([key, c]) => ({ key, label: c.label }));
const pill = (statut) => { const s = statutOf(statut); return `<span class="pro-pill"><i style="background:${s.color}"></i>${escapeHtml(s.label)}</span>`; };
const allStats = (data) => strategyStats(data, "2000-01-01", dateKey());

const offerChip = (offer) => (offer ? `<span class="pro-chip offer" title="Offre vendue : ${escapeHtml(offer.nom)}">★ ${escapeHtml(offer.nom)} · ${escapeHtml(offerPriceLabel(offer))}</span>` : "");

function cardHtml(st, { board = false, offer = null } = {}) {
  const s = st.strategy;
  return `<div class="pro-scard-top"><span class="pro-chips">${canauxChips(s, { max: board ? 1 : 2 })}</span>${board ? moveButtons(STATUTS.findIndex((x) => x.key === s.statut), STATUTS.length) : pill(s.statut)}</div>
    <h3 class="pro-scard-title">${escapeHtml(s.titre)}</h3>
    <p class="pro-scard-target">${s.cible ? "Cible : " + escapeHtml(s.cible) : "<span class='pro-muted'>Aucune cible précisée</span>"}</p>
    ${s.idee ? `<p class="pro-scard-idea">${escapeHtml(s.idee)}</p>` : ""}
    ${offer ? `<div class="pro-scard-offer">${offerChip(offer)}</div>` : ""}
    <div class="pro-scard-foot">
      <div class="pro-scard-rate"><b>${st.all.envoyes ? fmtPct(st.tauxAll) : "—"}</b><span>taux de réponse</span></div>
      <div class="pro-scard-spark">${miniBars(st.weeks.map((w) => w.envoyes), { w: board ? 84 : 120 })}<span>${fmtInt(st.all.envoyes)} envoyés · ${fmtInt(st.all.clients)} client${st.all.clients > 1 ? "s" : ""}</span></div>
    </div>`;
}

export function renderStrategies(root, data, ctx) {
  const { state } = ctx;
  if (state.detailId && data.strategies.some((s) => s.id === state.detailId)) return renderDetail(root, data, ctx);
  state.detailId = null;
  const stats = allStats(data);
  const offerOf = (s) => data.offers.find((o) => o.id === s.offer_id) || null;
  const mode = state.stratView === "kanban" ? "kanban" : "cards";
  root.innerHTML = `
    <div class="pro-toolbar pro-seq" style="--i:0">
      <div class="pro-seg" role="group" aria-label="Affichage"><button type="button" class="${mode === "cards" ? "on" : ""}" data-mode="cards" aria-pressed="${mode === "cards"}">Cartes</button><button type="button" class="${mode === "kanban" ? "on" : ""}" data-mode="kanban" aria-pressed="${mode === "kanban"}">Kanban</button></div>
      <button type="button" class="btn primary btn-sm" data-action="new">+ Nouvelle stratégie</button>
    </div>
    <div data-body></div>`;
  const body = root.querySelector("[data-body]");
  root.querySelector('[data-action="new"]').addEventListener("click", () => openStrategyModal(null, ctx, data));
  root.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { state.stratView = b.dataset.mode; ctx.rerender({ animate: false }); }));

  if (!stats.length) {
    body.innerHTML = `<div class="card">${emptyState({ title: "Aucune stratégie pour l'instant", text: "Une stratégie, c'est une façon d'aborder tes prospects : un canal, une cible, un script. Crée la première, puis compare-les avec des chiffres.", cta: "Créer ma première stratégie", action: "new2" })}</div>`;
    body.querySelector('[data-action="new2"]').addEventListener("click", () => openStrategyModal(null, ctx, data));
    return;
  }
  if (mode === "cards") {
    body.innerHTML = `<div class="pro-cards">${stats.map((st, i) => `<article class="card pro-scard pro-seq" style="--i:${i + 1}" data-id="${st.strategy.id}" tabindex="0" role="button" aria-label="Ouvrir ${escapeHtml(st.strategy.titre)}">${cardHtml(st, { offer: offerOf(st.strategy) })}</article>`).join("")}</div>`;
    body.querySelectorAll(".pro-scard").forEach((c) => {
      c.addEventListener("click", () => ctx.openStrategy(c.dataset.id));
      c.addEventListener("keydown", (e) => { if (e.key === "Enter") ctx.openStrategy(c.dataset.id); });
    });
  } else {
    const byId = Object.fromEntries(stats.map((s) => [s.strategy.id, s]));
    renderBoard(body, {
      columns: STATUTS, items: stats.map((s) => s.strategy), colOf: (s) => s.statut,
      cardHtml: (s) => `<div class="pro-scard">${cardHtml(byId[s.id], { board: true, offer: offerOf(s) })}</div>`,
      onMove: async (id, statut) => {
        const s = data.strategies.find((x) => x.id === id); const before = s.statut;
        s.statut = statut; ctx.rerender({ animate: false });
        try { await saveStrategy({ statut }, id); } catch (err) { s.statut = before; ctx.rerender({ animate: false }); toast(friendlyError(err), "error"); }
      },
      onOpen: (id) => ctx.openStrategy(id)
    });
  }
}

// ---------- Fenêtre création / modification ----------
export function openStrategyModal(strategy, ctx, data) {
  const s = strategy || { canal: "instagram", canaux: ["instagram"], statut: "a_tester" };
  const chosen = canauxOf(s);
  const { overlay, close } = openModal(`${modalHeader(strategy ? "Modifier la stratégie" : "Nouvelle stratégie")}
    <form data-form>
      ${field("Titre *", `<input type="text" name="titre" maxlength="120" required value="${escapeHtml(s.titre || "")}" placeholder="Ex : DM Instagram aux coiffeurs sans site">`)}
      <div class="pro-form-row">
        ${field("Statut", `<select name="statut">${options(STATUTS, s.statut)}</select>`)}
      </div>
      <fieldset class="pro-multi"><legend class="field-label">Canaux (un ou plusieurs)</legend>
        ${canalOptions.map((c) => `<label class="pro-pick"><input type="checkbox" data-canal="${c.key}"${chosen.includes(c.key) ? " checked" : ""}><span>${canalIcon(c.key, 15)} ${escapeHtml(c.label)}</span></label>`).join("")}
      </fieldset>
      ${field("Cible", `<input type="text" name="cible" maxlength="200" value="${escapeHtml(s.cible || "")}" placeholder="Ex : coiffeurs de Lyon, sans site web">`)}
      ${field("L'idée en bref (c'est quoi ?)", `<textarea name="idee" rows="3" maxlength="3000" placeholder="Ex : j'envoie un message Instagram aux coiffeurs qui n'ont pas de site, avec une maquette gratuite en accroche.">${escapeHtml(s.idee || "")}</textarea>`)}
      ${field("Offre que tu vends avec cette stratégie", `<select name="offer_id"><option value="">— Aucune offre choisie —</option>${(data.offers || []).map((o) => `<option value="${o.id}"${o.id === s.offer_id ? " selected" : ""}>${escapeHtml(o.nom)} · ${escapeHtml(offerPriceLabel(o))}</option>`).join("")}</select>${(data.offers || []).length ? "" : `<p class="pro-muted" style="margin:6px 0 0;">Tu n'as pas encore de pack : crée-en un dans « Scripts et offres ».</p>`}`)}
      <div class="error-msg" data-error></div>
      <div class="modal-actions">${strategy ? `<button type="button" class="btn danger" data-delete style="margin-right:auto;">Supprimer</button>` : ""}<button type="button" class="btn ghost" data-close>Annuler</button><button type="submit" class="btn primary">Enregistrer</button></div>
    </form>`, { maxWidth: 480 });
  const form = overlay.querySelector("[data-form]"), errorEl = overlay.querySelector("[data-error]");
  form.titre.focus();
  const draft = bindFormDraft(form, "strategy:" + (strategy ? strategy.id : "new"), { onReset: () => { close(); openStrategyModal(strategy, ctx, data); } });
  overlay.querySelector(".modal-actions [data-close]").addEventListener("click", () => draft.clear());
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = readForm(form);
    if (!v.titre) { errorEl.textContent = "Donne un titre à la stratégie."; return; }
    const canaux = [...form.querySelectorAll("[data-canal]:checked")].map((c) => c.dataset.canal);
    if (!canaux.length) { errorEl.textContent = "Choisis au moins un canal."; return; }
    v.canaux = canaux; v.canal = canaux[0]; // « canal » = canal principal
    try { const saved = await saveStrategy(v, strategy && strategy.id); draft.clear(); close(); toast("Stratégie enregistrée ✓"); await ctx.reload(); if (!strategy) ctx.openStrategy(saved.id); }
    catch (err) { errorEl.textContent = friendlyError(err); }
  });
  const del = overlay.querySelector("[data-delete]");
  if (del) del.addEventListener("click", async () => {
    const ok = await window.confirmDialog(`Supprimer « ${strategy.titre} » ? Ses scripts sont supprimés ; ses saisies restent comptées dans le tableau de bord sans stratégie.`, { danger: true, confirmLabel: "Supprimer" });
    if (!ok) return;
    try { await deleteStrategy(strategy.id); draft.clear(); close(); ctx.state.detailId = null; toast("Stratégie supprimée"); ctx.reload(); } catch (err) { errorEl.textContent = friendlyError(err); }
  });
}

export function openScriptModal(strategy, script, version, ctx) {
  const draftKey = `script:${strategy.id}:${version}`;
  const draft = draftGet(draftKey);
  const startText = draft && typeof draft.texte === "string" ? draft.texte : script ? script.texte : "";
  const { overlay, close } = openModal(`${modalHeader((script ? "Modifier" : "Ajouter") + " la version " + version)}
    <form data-form>
      ${field("Message", `<textarea name="texte" rows="8" maxlength="4000" required placeholder="Bonjour {prénom}, j'ai vu que…">${escapeHtml(startText)}</textarea>`)}
      ${draft ? `<p class="pro-draft-note" role="status"><span>Brouillon retrouvé : ton texte non enregistré a été restauré.</span></p>` : ""}
      <div class="error-msg" data-error></div>
      <div class="modal-actions">${script ? `<button type="button" class="btn danger" data-delete style="margin-right:auto;">Supprimer</button>` : ""}<button type="button" class="btn ghost" data-close>Annuler</button><button type="submit" class="btn primary">Enregistrer</button></div>
    </form>`, { maxWidth: 520, lockOutside: true });
  const form = overlay.querySelector("[data-form]"), errorEl = overlay.querySelector("[data-error]");
  form.texte.focus();
  const save = debounce(() => draftSet(draftKey, { texte: form.texte.value }), 400);
  form.texte.addEventListener("input", save);
  overlay.querySelector(".modal-actions [data-close]").addEventListener("click", () => draftClear(draftKey));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const texte = form.texte.value.trim();
    if (!texte) { errorEl.textContent = "Écris le message."; return; }
    try { await saveScript(strategy.id, version, texte, script && script.id); draftClear(draftKey); close(); toast("Script enregistré ✓"); ctx.reload(); } catch (err) { errorEl.textContent = friendlyError(err); }
  });
  const del = overlay.querySelector("[data-delete]");
  if (del) del.addEventListener("click", async () => {
    const ok = await window.confirmDialog(`Supprimer la version ${version} ? Les chiffres déjà saisis restent comptés pour la stratégie.`, { danger: true, confirmLabel: "Supprimer" });
    if (!ok) return;
    try { await deleteScript(script.id); draftClear(draftKey); close(); ctx.reload(); } catch (err) { errorEl.textContent = friendlyError(err); }
  });
}

// ---------- Page détail ----------
function renderDetail(root, data, ctx) {
  const s = data.strategies.find((x) => x.id === ctx.state.detailId);
  const st = allStats(data).find((x) => x.strategy.id === s.id);
  const scripts = data.scripts.filter((x) => x.strategy_id === s.id).sort((a, b) => a.version.localeCompare(b.version));
  const logs = data.logs.filter((l) => l.strategy_id === s.id);
  const weeks = weeklySeries(logs, 10, mondayOf());

  const versionStats = scripts.map((sc) => {
    const t = sum(data.logs.filter((l) => l.script_id === sc.id));
    return { sc, t, taux: rate(t.reponses, t.envoyes) };
  });
  const eligible = versionStats.filter((v) => v.t.envoyes >= 10);
  const winner = versionStats.length > 1 && eligible.length > 1 ? eligible.reduce((a, b) => (b.taux > a.taux ? b : a)) : null;
  const nextVersion = ["A", "B", "C", "D"].find((v) => !scripts.some((x) => x.version === v));

  root.innerHTML = `
    <button type="button" class="btn ghost btn-sm pro-back" data-back>← Toutes les stratégies</button>
    <header class="pro-detail-head pro-seq" style="--i:0">
      <div><div class="pro-detail-meta">${canauxChips(s, { max: 7 })}${pill(s.statut)}${offerChip(data.offers.find((o) => o.id === s.offer_id))}</div>
        <h2 class="pro-detail-title">${escapeHtml(s.titre)}</h2>
        <p class="pro-muted">${s.cible ? "Cible : " + escapeHtml(s.cible) : "Aucune cible précisée"}</p></div>
      <div class="pro-detail-actions"><button type="button" class="btn ghost btn-sm" data-edit>Modifier</button><button type="button" class="btn primary btn-sm" data-log>+ Noter des messages</button></div>
    </header>

    <section class="pro-grid2 pro-seq" style="--i:1">
      <div class="card pro-panel"><h2 class="panel-title">L'idée</h2><p class="pro-muted pro-panel-sub">C'est quoi, cette stratégie ?</p>
        <textarea class="pro-notes" data-field="idee" rows="6" maxlength="3000" placeholder="Explique la stratégie en quelques phrases : à qui tu t'adresses, avec quel message, pourquoi ça devrait marcher." aria-label="L'idée de la stratégie">${escapeHtml(s.idee || "")}</textarea>
        <div class="pro-saved" data-saved="idee" aria-live="polite"></div></div>
      <div class="card pro-panel"><h2 class="panel-title">Le déroulé</h2><p class="pro-muted pro-panel-sub">Comment ça se passe, étape par étape ?</p>
        <textarea class="pro-notes" data-field="deroule" rows="6" maxlength="6000" placeholder="Les étapes, dans l'ordre :&#10;1. Repérer les prospects&#10;2. Envoyer le premier message&#10;3. Relancer au bout de 3 jours&#10;4. Proposer un appel" aria-label="Le déroulé de la stratégie">${escapeHtml(s.deroule || "")}</textarea>
        <div class="pro-saved" data-saved="deroule" aria-live="polite"></div></div>
    </section>

    <div class="pro-kpis four">
      ${[["Envoyés", st.all.envoyes, 0], ["Réponses", st.all.reponses, 0], ["Taux de réponse", st.tauxAll, 1, " %"], ["Clients", st.all.clients, 0]].map(([l, v, d, suf], i) =>
        `<div class="card pro-kpi pro-seq" style="--i:${i + 1}"><div class="pro-kpi-label">${l}</div><div class="pro-kpi-value"><b data-count="${v}" data-dec="${d}" data-suffix="${suf || ""}">0</b></div></div>`).join("")}
    </div>

    <section class="card pro-panel pro-seq" style="--i:5">
      <div class="pro-panel-head"><h2 class="panel-title">Courbe de performance</h2>
        <div class="pro-legend-inline"><span><i style="background:var(--warm-1)"></i>Envoyés</span><span><i style="background:var(--gold)"></i>Réponses</span></div></div>
      ${logs.length ? `<div class="pro-chart" data-chart></div>` : `<p class="pro-muted">La courbe apparaît dès les premières saisies rattachées à cette stratégie.</p>`}
    </section>

    <section class="pro-seq" style="--i:6">
      <div class="pro-panel-head"><h2 class="panel-title">Script et versions A/B</h2>${nextVersion && scripts.length ? `<button type="button" class="btn ghost btn-sm" data-add-version="${nextVersion}">+ Version ${nextVersion}</button>` : ""}</div>
      ${scripts.length ? `<div class="pro-versions n${scripts.length}">${versionStats.map(({ sc, t, taux }) => `
        <article class="card pro-version${winner && winner.sc.id === sc.id ? " win" : ""}">
          <div class="pro-version-head"><span class="pro-vbadge">${sc.version}</span>${winner && winner.sc.id === sc.id ? `<span class="pro-win">★ Meilleure version</span>` : ""}
            <span class="pro-version-btns"><button type="button" class="btn ghost btn-sm" data-copy="${sc.id}">Copier</button><button type="button" class="icon-btn" data-edit-script="${sc.id}" aria-label="Modifier la version ${sc.version}">✎</button></span></div>
          <div class="pro-bubble">${escapeHtml(sc.texte).replace(/\n/g, "<br>")}</div>
          <dl class="pro-vstats"><div><dt>Envoyés</dt><dd>${fmtInt(t.envoyes)}</dd></div><div><dt>Réponses</dt><dd>${fmtInt(t.reponses)}</dd></div><div><dt>Taux</dt><dd class="big">${t.envoyes ? fmtPct(taux) : "—"}</dd></div></dl>
        </article>`).join("")}</div>`
        : `<div class="card">${emptyState({ title: "Pas encore de script", text: "Écris le message de cette stratégie. Ajoute ensuite une version B pour savoir laquelle fonctionne le mieux.", cta: "Écrire le script (version A)", action: "add-a" })}</div>`}
    </section>

    <div class="pro-grid2">
      <section class="card pro-panel pro-seq" style="--i:7">
        <h2 class="panel-title">Notes d'apprentissage</h2>
        <textarea class="pro-notes" rows="7" maxlength="4000" placeholder="Ce que cette stratégie t'apprend : ce qui accroche, ce qui bloque, ce que tu changerais…" aria-label="Notes d'apprentissage">${escapeHtml(s.notes || "")}</textarea>
        <div class="pro-saved" data-saved aria-live="polite"></div>
      </section>
      <section class="card pro-panel pro-seq" style="--i:8">
        <h2 class="panel-title">Historique</h2>
        ${logs.length ? `<ul class="pro-history">${logs.slice(0, 12).map((l) => `<li><span class="pro-hist-day">${shortDay(parseKey(l.jour))}</span>
          <span class="pro-hist-vals"><b>${l.envoyes}</b> env. · <b>${l.reponses}</b> rép.${l.interesses ? ` · ${l.interesses} int.` : ""}${l.audits ? ` · ${l.audits} audit${l.audits > 1 ? "s" : ""}` : ""}${l.clients ? ` · ${l.clients} client${l.clients > 1 ? "s" : ""}` : ""}</span>
          <button type="button" class="icon-btn" data-del-log="${l.id}" aria-label="Supprimer cette saisie">✕</button></li>`).join("")}</ul>${logs.length > 12 ? `<p class="pro-muted">+ ${logs.length - 12} saisies plus anciennes</p>` : ""}`
          : `<p class="pro-muted">Aucune saisie pour l'instant.</p>`}
      </section>
    </div>`;

  root.querySelector("[data-back]").addEventListener("click", () => ctx.openStrategy(null));
  root.querySelector("[data-edit]").addEventListener("click", () => openStrategyModal(s, ctx, data));
  root.querySelector("[data-log]").addEventListener("click", () => ctx.openQuick(s.id));
  const add = (v) => openScriptModal(s, null, v, ctx);
  const addA = root.querySelector('[data-action="add-a"]'); if (addA) addA.addEventListener("click", () => add("A"));
  const addV = root.querySelector("[data-add-version]"); if (addV) addV.addEventListener("click", () => add(addV.dataset.addVersion));
  root.querySelectorAll("[data-edit-script]").forEach((b) => b.addEventListener("click", () => { const sc = scripts.find((x) => x.id === b.dataset.editScript); openScriptModal(s, sc, sc.version, ctx); }));
  root.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => { const sc = scripts.find((x) => x.id === b.dataset.copy); toast((await copyText(sc.texte)) ? "Message copié ✓" : "Copie impossible", "ok"); }));
  root.querySelectorAll("[data-del-log]").forEach((b) => b.addEventListener("click", async () => {
    const ok = await window.confirmDialog("Supprimer cette saisie ?", { danger: true, confirmLabel: "Supprimer" });
    if (!ok) return;
    try { await deleteLog(b.dataset.delLog); ctx.reload(); } catch (err) { toast(friendlyError(err), "error"); }
  }));
  // L'idée et le déroulé s'enregistrent tout seuls (quelques secondes après la dernière frappe, et en quittant le champ).
  root.querySelectorAll("textarea[data-field]").forEach((ta) => {
    const field = ta.dataset.field, status = root.querySelector(`[data-saved="${field}"]`);
    const save = async () => {
      const value = ta.value.trim() || null;
      if (value === (s[field] || null)) return;
      try { await saveStrategy({ [field]: value }, s.id); s[field] = value; status.textContent = "Enregistré ✓"; setTimeout(() => (status.textContent = ""), 1800); }
      catch (err) { status.textContent = friendlyError(err); }
    };
    const later = debounce(save, 1500);
    ta.addEventListener("input", later);
    ta.addEventListener("blur", () => { later.cancel(); save(); });
  });
  const notes = root.querySelector('.pro-notes:not([data-field])'), saved = root.querySelector('[data-saved=""], .pro-saved:not([data-saved])');
  notes.addEventListener("blur", async () => {
    if (notes.value === (s.notes || "")) return;
    try { await saveStrategy({ notes: notes.value.trim() || null }, s.id); s.notes = notes.value.trim() || null; saved.textContent = "Enregistré ✓"; setTimeout(() => (saved.textContent = ""), 1800); } catch (err) { saved.textContent = friendlyError(err); }
  });
  const chart = root.querySelector("[data-chart]");
  if (chart) lineChart(chart, {
    labels: weeks.map((w) => shortDay(parseKey(w.monday))), tipLabels: weeks.map((w) => "Semaine du " + shortDay(parseKey(w.monday))),
    series: [{ name: "Envoyés", color: "var(--warm-1)", values: weeks.map((w) => w.envoyes), fill: true }, { name: "Réponses", color: "var(--gold)", values: weeks.map((w) => w.reponses) }]
  });
  runCounters(root);
}
