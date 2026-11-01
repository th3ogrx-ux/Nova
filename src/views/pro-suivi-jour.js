// Offres > Suivi quotidien : chaque jour, pour chaque stratégie (Insta 1, Insta 2…), combien de DM envoyés, de réponses,
// d'audits, d'offres et de ventes. Saisie en quelques secondes, puis chiffres clés, entonnoir, comparaison des stratégies et courbe.
import { supabase } from "../supabase.js";
import { getDataOwnerId, can } from "../session.js";
import { dateKey, parseKey, addDays, mondayOf, escapeHtml, fmtInt, fmtPct, shortDay } from "./pro-data.js";
import { sparkline, funnel, lineChart, runCounters } from "./pro-charts.js";
import { skeleton, toast, friendlyError, openModal, modalHeader } from "./pro-ui.js";

const FIELDS = [
  { key: "dm", label: "DM envoyés", color: "var(--warm-1)" },
  { key: "reponses", label: "Réponses", color: "#4c9aff" },
  { key: "audits", label: "Audits envoyés", color: "#b072ff" },
  { key: "offres", label: "Offres envoyées", color: "var(--gold)" },
  { key: "ventes", label: "Ventes", color: "var(--ok)" }
];
const PERIODS = [{ key: "7", label: "7 jours", days: 7 }, { key: "30", label: "30 jours", days: 30 }, { key: "all", label: "Tout", days: 365 }];
const MIN_DM = 20; // en dessous, on ne compare pas les stratégies
const state = { period: "30", day: null };
const DAY_FMT = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const zero = () => ({ dm: 0, reponses: 0, audits: 0, offres: 0, ventes: 0 });
const add = (a, r) => { FIELDS.forEach((f) => { a[f.key] += Number(r[f.key]) || 0; }); return a; };
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
const pctTxt = (a, b) => (b ? fmtPct(pct(a, b)) : "—");
const MISSING = /suivi_strategies|suivi_lignes|schema cache|does not exist|PGRST205/i;

async function load() {
  const since = dateKey(addDays(new Date(), -365));
  const [st, li] = await Promise.all([
    supabase.from("suivi_strategies").select("*").order("position").order("created_at"),
    supabase.from("suivi_lignes").select("*").gte("jour", since).order("jour")
  ]);
  const err = st.error || li.error;
  if (err) { if (MISSING.test(err.message || "")) return { missing: true }; throw err; }
  return { missing: false, strategies: st.data || [], rows: li.data || [] };
}
const owner = async () => getDataOwnerId() || (await supabase.auth.getUser()).data.user.id;

export async function renderSuiviJour(root) {
  const canEdit = can("prospection", "edit");
  root.innerHTML = skeleton("dashboard");
  let data;
  try { data = await load(); } catch (err) { console.error("[Suivi]", err); root.innerHTML = `<div class="card"><p class="error-msg" style="margin:0;">Impossible de charger le suivi pour le moment. Recharge la page.</p></div>`; return; }
  if (data.missing) { root.innerHTML = `<div class="card"><p class="error-msg" style="margin:0;">Le suivi par stratégie n'est pas encore installé : colle le fichier suivi-strategies.sql dans Supabase (SQL Editor &gt; Run), puis recharge la page.</p></div>`; return; }
  if (!state.day) state.day = dateKey();
  let { strategies, rows } = data, first = true;

  // Stratégies affichées dans la saisie : toutes, sauf « Sans stratégie » (visible seulement si elle contient des chiffres).
  const hasData = (id, jour) => rows.some((r) => r.strategie_id === id && r.jour === jour && FIELDS.some((f) => r[f.key] > 0));
  const entryStrategies = () => strategies.filter((s) => !s.systeme || hasData(s.id, state.day));
  const lineOf = (sid, jour) => rows.find((r) => r.strategie_id === sid && r.jour === jour) || zero();

  function draw() {
    const today = dateKey(), period = PERIODS.find((p) => p.key === state.period) || PERIODS[1];
    const from = dateKey(addDays(new Date(), -(period.days - 1)));
    const inPeriod = rows.filter((r) => r.jour >= from && r.jour <= today);
    const tot = inPeriod.reduce(add, zero());
    const dayKeys = [...new Set(inPeriod.map((r) => r.jour))];
    const perDay = new Map();
    inPeriod.forEach((r) => { const t = perDay.get(r.jour) || zero(); perDay.set(r.jour, add(t, r)); });
    const dayHasNotes = rows.some((r) => r.jour === state.day);

    let buckets;
    if (period.key === "all") {
      const start = inPeriod.length ? parseKey(inPeriod[0].jour) : new Date();
      const byWeek = new Map();
      for (let d = mondayOf(start); dateKey(d) <= today; d = addDays(d, 7)) byWeek.set(dateKey(d), zero());
      inPeriod.forEach((r) => add(byWeek.get(dateKey(mondayOf(parseKey(r.jour)))), r));
      buckets = [...byWeek].map(([k, v]) => ({ k, label: shortDay(parseKey(k)), tip: "Semaine du " + shortDay(parseKey(k)), ...v }));
    } else {
      buckets = Array.from({ length: period.days }, (_, i) => dateKey(addDays(new Date(), i - (period.days - 1)))).map((k) => ({ k, label: shortDay(parseKey(k)), tip: cap(DAY_FMT.format(parseKey(k))), ...(perDay.get(k) || zero()) }));
    }
    const sparkData = buckets.slice(-14);
    const kpi = (i, label, valueHtml, foot, spark) => `<div class="card pro-kpi pro-seq" style="--i:${i}"><div class="pro-kpi-label">${label}</div><div class="pro-kpi-value">${valueHtml}</div><div class="pro-kpi-foot"><span class="pro-delta">${foot}</span>${spark}</div></div>`;
    // Historique : une ligne par jour ET par stratégie (plus récent en haut), pour voir où chaque chiffre a été noté.
    const order = new Map(strategies.map((st, i) => [st.id, i]));
    const nameOf = new Map(strategies.map((st) => [st.id, st.nom]));
    const recent = rows.filter((r) => FIELDS.some((f) => r[f.key] > 0))
      .sort((a, b) => b.jour.localeCompare(a.jour) || (order.get(a.strategie_id) ?? 0) - (order.get(b.strategie_id) ?? 0)).slice(0, 25);

    // Comparaison des stratégies sur la période.
    const stats = strategies.map((s) => {
      const t = inPeriod.filter((r) => r.strategie_id === s.id).reduce(add, zero());
      return { s, t, enough: t.dm >= MIN_DM, rate: pct(t.reponses, t.dm) };
    }).filter((x) => x.t.dm > 0 || !x.s.systeme).sort((a, b) => (b.t.dm - a.t.dm));
    const comparable = stats.filter((x) => x.enough && x.rate !== null);
    const best = comparable.length >= 2 ? comparable.reduce((a, b) => (b.rate > a.rate ? b : a)) : null;
    const todayDm = rows.filter((r) => r.jour === today).reduce((a, r) => a + r.dm, 0);

    const list = entryStrategies();
    root.innerHTML = `
      <section class="card pro-panel sj-form-card pro-seq" style="--i:0">
        <div class="pro-panel-head"><h2 class="panel-title">Mes chiffres du jour</h2>
          <div class="sj-dayrow"><button type="button" class="btn ghost btn-sm" data-day-nav="-1" aria-label="Jour précédent">‹</button>
            <input type="date" class="sj-date" data-day max="${today}" value="${state.day}" aria-label="Jour">
            <button type="button" class="btn ghost btn-sm" data-day-nav="1" aria-label="Jour suivant"${state.day >= today ? " disabled" : ""}>›</button></div></div>
        <p class="pro-muted sj-daylabel">${escapeHtml(cap(DAY_FMT.format(parseKey(state.day))))}${state.day === today ? " (aujourd'hui)" : ""}${dayHasNotes ? "" : " · rien de noté"}</p>
        ${state.day === today && todayDm >= 15 ? `<div class="sj-warn" role="status">⚠ Tu as déjà envoyé <b>${todayDm}</b> DM aujourd'hui : fais attention à ne pas dépasser la limite d'envoi.</div>` : ""}
        ${list.length ? `<form data-form>
          <div class="sj-lines">
            <div class="sj-line sj-line-head" aria-hidden="true"><span>Stratégie</span>${FIELDS.map((f) => `<span>${f.label}</span>`).join("")}</div>
            ${list.map((s) => { const l = lineOf(s.id, state.day); return `
            <div class="sj-line" data-sid="${s.id}">
              <div class="sj-line-name"><b>${escapeHtml(s.nom)}</b>${s.note ? `<small>${escapeHtml(s.note)}</small>` : ""}</div>
              ${FIELDS.map((f) => `<div class="sj-cell" style="--c:${f.color}" data-label="${f.label}">
                <div class="sj-step"><button type="button" data-step="-1" aria-label="Retirer 1 : ${escapeHtml(s.nom)}, ${f.label}"${canEdit ? "" : " disabled"}>−</button>
                  <input name="${f.key}" type="number" inputmode="numeric" min="0" max="100000" value="${l[f.key] || 0}" aria-label="${escapeHtml(s.nom)} : ${f.label}"${canEdit ? "" : " disabled"}>
                  <button type="button" data-step="1" aria-label="Ajouter 1 : ${escapeHtml(s.nom)}, ${f.label}"${canEdit ? "" : " disabled"}>+</button></div></div>`).join("")}
            </div>`; }).join("")}
            <div class="sj-line sj-line-total"><div class="sj-line-name"><b>Total du jour</b></div>${FIELDS.map((f) => `<div class="sj-cell" data-label="${f.label}"><b data-total="${f.key}">0</b></div>`).join("")}</div>
          </div>
          <div class="sj-actions">${canEdit ? `<button type="submit" class="btn primary">Enregistrer la journée</button><button type="button" class="btn ghost btn-sm" data-manage>Gérer mes stratégies</button>` : ""}<span class="pro-muted" data-msg></span></div>
        </form>` : `<p class="pro-muted">Tu n'as pas encore de stratégie.</p>${canEdit ? `<div class="sj-actions"><button type="button" class="btn primary" data-manage>Créer mes stratégies</button></div>` : ""}`}
      </section>

      <div class="pro-periodbar pro-seq" style="--i:1"><span class="pro-periodbar-label">Période</span>
        <div class="pro-seg" role="group" aria-label="Période">${PERIODS.map((p) => `<button type="button" class="${p.key === period.key ? "on" : ""}" data-period="${p.key}" aria-pressed="${p.key === period.key}">${p.label}</button>`).join("")}</div></div>

      <div class="pro-kpis sj-kpis">
        ${kpi(2, "DM envoyés", `<b data-count="${tot.dm}">0</b>`, `${fmtInt(todayDm)} aujourd'hui`, sparkline(sparkData.map((b) => b.dm)))}
        ${kpi(3, "Réponses", `<b data-count="${tot.reponses}">0</b>`, `${pctTxt(tot.reponses, tot.dm)} de réponse`, sparkline(sparkData.map((b) => b.reponses), { color: "#4c9aff" }))}
        ${kpi(4, "Audits envoyés", `<b data-count="${tot.audits}">0</b>`, `${pctTxt(tot.audits, tot.reponses)} des réponses`, sparkline(sparkData.map((b) => b.audits), { color: "#b072ff" }))}
        ${kpi(5, "Ventes", `<b data-count="${tot.ventes}">0</b>`, `${pctTxt(tot.ventes, tot.dm)} des DM`, sparkline(sparkData.map((b) => b.ventes), { color: "var(--ok)" }))}
      </div>

      <div class="pro-grid2">
        <section class="card pro-panel pro-seq" style="--i:6">
          <h2 class="panel-title">Entonnoir</h2>
          ${tot.dm ? funnel([
            { label: "DM envoyés", value: tot.dm, color: "var(--warm-1)" },
            { label: "Réponses", value: tot.reponses, color: "#4c9aff" },
            { label: "Audits", value: tot.audits, color: "#b072ff" },
            { label: "Offres", value: tot.offres, color: "var(--gold)" },
            { label: "Ventes", value: tot.ventes, color: "var(--ok)" }
          ]) : `<p class="pro-muted">Note tes premiers chiffres ci-dessus : l'entonnoir apparaît ici.</p>`}
        </section>
        <section class="card pro-panel pro-seq" style="--i:7">
          <h2 class="panel-title">Meilleure stratégie</h2>
          ${best ? `<div class="sj-best-card"><span class="sj-best-badge">★ Meilleur taux de réponse</span><b class="sj-best-name">${escapeHtml(best.s.nom)}</b>
              <div class="sj-best-rate">${fmtPct(best.rate)}</div><p class="pro-muted">${fmtInt(best.t.reponses)} réponses pour ${fmtInt(best.t.dm)} DM sur la période.</p></div>`
            : `<p class="pro-muted">${tot.dm ? `Trop peu de données pour comparer : il faut au moins ${MIN_DM} DM sur au moins deux stratégies.` : "Rien à comparer pour l'instant."}</p>`}
        </section>
      </div>

      <section class="card pro-panel pro-seq" style="--i:8">
        <h2 class="panel-title">Résultats par stratégie</h2>
        ${stats.length ? `<div class="sj-table-wrap"><table class="sj-table sj-results"><thead><tr><th>Stratégie</th><th>DM</th><th>Réponses</th><th>Audits</th><th>Offres</th><th>Signés</th></tr></thead><tbody>
          ${stats.map(({ s, t, enough, rate }) => `<tr class="${best && best.s.id === s.id ? "best" : ""}"><td>${escapeHtml(s.nom)}${best && best.s.id === s.id ? ` <span class="sj-star" title="Meilleur taux de réponse">★</span>` : ""}${!enough && t.dm ? `<small class="sj-few">trop peu de données pour comparer</small>` : ""}</td>
            <td>${fmtInt(t.dm)}</td>${cell(t.reponses, t.dm, enough)}${cell(t.audits, t.reponses, enough)}${cell(t.offres, t.audits, enough)}${cell(t.ventes, t.offres, enough)}</tr>`).join("")}
          </tbody><tfoot><tr><td>Total</td><td>${fmtInt(tot.dm)}</td>${cell(tot.reponses, tot.dm, true)}${cell(tot.audits, tot.reponses, true)}${cell(tot.offres, tot.audits, true)}${cell(tot.ventes, tot.offres, true)}</tr></tfoot></table></div>
          <p class="pro-muted sj-hint">Le petit pourcentage compare avec l'étape d'avant. Sous ${MIN_DM} DM, une stratégie n'est pas comparée.</p>` : `<p class="pro-muted">Aucun chiffre sur cette période.</p>`}
      </section>

      <section class="card pro-panel pro-seq" style="--i:9">
        <div class="pro-panel-head"><h2 class="panel-title">Évolution</h2>
          <div class="pro-legend-inline">${[["DM envoyés", "var(--warm-1)"], ["Réponses", "#4c9aff"], ["Audits", "#b072ff"], ["Ventes", "var(--ok)"]].map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join("")}</div></div>
        <div class="pro-chart" data-chart></div>
      </section>

      <section class="card pro-panel pro-seq" style="--i:10">
        <h2 class="panel-title">Historique</h2>
        ${recent.length ? `<div class="sj-table-wrap"><table class="sj-table sj-history"><thead><tr><th>Jour</th><th>Stratégie</th><th>DM</th><th>Réponses</th><th>Audits</th><th>Offres</th><th>Ventes</th></tr></thead><tbody>
          ${recent.map((r) => `<tr data-pick="${r.jour}" tabindex="0"><td>${escapeHtml(cap(shortDay(parseKey(r.jour))))}</td><td class="sj-h-strat">${escapeHtml(nameOf.get(r.strategie_id) || "—")}</td><td>${r.dm}</td><td>${r.reponses}</td><td>${r.audits}</td><td>${r.offres}</td><td><b>${r.ventes}</b></td></tr>`).join("")}
          </tbody></table></div><p class="pro-muted sj-hint">Clique une ligne pour corriger ce jour-là.</p>` : `<p class="pro-muted">Aucun jour noté pour l'instant.</p>`}
      </section>`;

    lineChart(root.querySelector("[data-chart]"), {
      labels: buckets.map((b) => b.label), tipLabels: buckets.map((b) => b.tip),
      series: [
        { name: "DM envoyés", color: "var(--warm-1)", values: buckets.map((b) => b.dm), fill: true },
        { name: "Réponses", color: "#4c9aff", values: buckets.map((b) => b.reponses) },
        { name: "Audits", color: "#b072ff", values: buckets.map((b) => b.audits) },
        { name: "Ventes", color: "var(--ok)", values: buckets.map((b) => b.ventes) }
      ]
    });
    if (first) { runCounters(root); first = false; } else root.querySelectorAll("[data-count]").forEach((el) => { el.textContent = fmtInt(el.dataset.count); });
    bind();
  }

  // Une cellule de résultat : le nombre, et en petit le % par rapport à l'étape d'avant.
  function cell(n, base, enough) { return `<td>${fmtInt(n)}${base && enough ? `<small class="sj-pc">${fmtPct(pct(n, base))}</small>` : ""}</td>`; }

  function bind() {
    const form = root.querySelector("[data-form]"), msg = root.querySelector("[data-msg]");
    if (form) {
      const refreshTotals = () => FIELDS.forEach((f) => {
        form.querySelector(`[data-total="${f.key}"]`).textContent = fmtInt([...form.querySelectorAll(`.sj-line[data-sid] input[name="${f.key}"]`)].reduce((a, i) => a + (Number(i.value) || 0), 0));
      });
      refreshTotals();
      form.addEventListener("input", refreshTotals);
      form.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => {
        const input = b.parentElement.querySelector("input");
        input.value = Math.max(0, Math.min(100000, (Number(input.value) || 0) + Number(b.dataset.step))); refreshTotals();
      }));
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!canEdit) return;
        const user = await owner(), now = new Date().toISOString();
        const exists = (sid) => rows.some((r) => r.jour === state.day && r.strategie_id === sid);
        const payload = [...form.querySelectorAll(".sj-line[data-sid]")].map((line) => ({
          user_id: user, jour: state.day, strategie_id: line.dataset.sid, updated_at: now,
          ...Object.fromEntries(FIELDS.map((f) => [f.key, Math.max(0, Math.min(100000, Math.round(Number(line.querySelector(`input[name="${f.key}"]`).value) || 0)))]))
        })).filter((p) => exists(p.strategie_id) || FIELDS.some((f) => p[f.key] > 0)); // pas de ligne vide inutile
        if (!payload.length) { msg.textContent = "Rien à enregistrer pour ce jour."; return; }
        const btn = form.querySelector('[type="submit"]'); btn.disabled = true;
        const { data: saved, error } = await supabase.from("suivi_lignes").upsert(payload, { onConflict: "user_id,jour,strategie_id" }).select();
        btn.disabled = false;
        if (error) { msg.textContent = friendlyError(error); msg.classList.add("error-msg"); return; }
        const ids = new Set(payload.map((p) => p.strategie_id));
        rows = rows.filter((r) => !(r.jour === state.day && ids.has(r.strategie_id))).concat(saved && saved.length ? saved : payload).sort((a, b) => a.jour.localeCompare(b.jour));
        toast("Journée enregistrée ✓");
        draw();
      });
    }
    const goDay = (k) => { state.day = k > dateKey() ? dateKey() : k; draw(); };
    root.querySelector("[data-day]").addEventListener("change", (e) => { if (e.target.value) goDay(e.target.value); });
    root.querySelectorAll("[data-day-nav]").forEach((b) => b.addEventListener("click", () => goDay(dateKey(addDays(parseKey(state.day), Number(b.dataset.dayNav))))));
    root.querySelectorAll("[data-period]").forEach((b) => b.addEventListener("click", () => { state.period = b.dataset.period; draw(); }));
    root.querySelectorAll("[data-manage]").forEach((b) => b.addEventListener("click", manage));
    root.querySelectorAll("[data-pick]").forEach((tr) => {
      const pick = () => { state.day = tr.dataset.pick; draw(); const main = root.closest(".main"); if (main) main.scrollTop = 0; };
      tr.addEventListener("click", pick);
      tr.addEventListener("keydown", (e) => { if (e.key === "Enter") pick(); });
    });
  }

  // Fenêtre « Gérer mes stratégies » : renommer, décrire, ajouter, supprimer.
  function manage() {
    const editable = strategies.filter((s) => !s.systeme);
    const rowHtml = (s) => `<div class="sj-mrow" data-id="${s ? s.id : ""}">
      <div class="sj-mrow-top"><input type="text" data-f="nom" maxlength="80" placeholder="Ex : Insta 1 : compliment + audit" value="${escapeHtml(s ? s.nom : "")}" aria-label="Nom de la stratégie">
        <button type="button" class="btn ghost btn-sm sj-mdel" data-del aria-label="Supprimer cette stratégie">✕</button></div>
      <input type="text" data-f="note" maxlength="500" placeholder="En quoi elle consiste : le message utilisé, la cible…" value="${escapeHtml(s && s.note ? s.note : "")}" aria-label="Description"></div>`;
    const { overlay, close } = openModal(`${modalHeader("Mes stratégies")}
      <p class="pro-muted" style="margin:0 0 12px;">Renomme-les, décris-les en une phrase, ajoutes-en ou supprime-en. Supprimer une stratégie supprime aussi ses chiffres.</p>
      <form data-mform><div data-mlist>${editable.map(rowHtml).join("")}</div>
        <button type="button" class="btn ghost btn-sm" data-madd>+ Ajouter une stratégie</button>
        <div class="error-msg" data-merr></div>
        <div class="modal-actions"><button type="button" class="btn ghost" data-close>Annuler</button><button type="submit" class="btn primary">Enregistrer</button></div></form>`, { maxWidth: 520, lockOutside: true });
    const listEl = overlay.querySelector("[data-mlist]"), err = overlay.querySelector("[data-merr]");
    const wireDel = (el) => el.querySelector("[data-del]").addEventListener("click", () => {
      if (!el.dataset.id) { el.remove(); return; }            // nouvelle ligne pas encore enregistrée : on l'enlève simplement
      el.dataset.removed = "1"; el.hidden = true; el.style.display = "none"; // ancienne : supprimée à l'enregistrement
    });
    listEl.querySelectorAll(".sj-mrow").forEach(wireDel);
    overlay.querySelector("[data-madd]").addEventListener("click", () => {
      const n = editable.length + listEl.querySelectorAll(".sj-mrow:not([data-id])").length + 1;
      const d = document.createElement("div"); d.innerHTML = rowHtml(null).replace('value=""', `value="Insta ${n}"`);
      const el = d.firstElementChild; listEl.appendChild(el); wireDel(el); el.querySelector("input").focus();
    });
    overlay.querySelector("[data-mform]").addEventListener("submit", async (e) => {
      e.preventDefault(); err.textContent = "";
      const user = await owner();
      const items = [...listEl.querySelectorAll(".sj-mrow")].map((el, i) => ({ el, id: el.dataset.id || null, removed: !!el.dataset.removed, nom: el.querySelector('[data-f="nom"]').value.trim(), note: el.querySelector('[data-f="note"]').value.trim() || null, position: i }));
      const live = items.filter((x) => !x.removed);
      if (live.some((x) => !x.nom)) { err.textContent = "Chaque stratégie doit avoir un nom."; return; }
      const names = live.map((x) => x.nom.toLowerCase());
      if (new Set(names).size !== names.length || names.includes("sans stratégie")) { err.textContent = "Deux stratégies ne peuvent pas avoir le même nom."; return; }
      const dels = items.filter((x) => x.removed && x.id);
      if (dels.length && !(await window.confirmDialog(`Supprimer ${dels.length > 1 ? "ces stratégies" : "cette stratégie"} et ses chiffres ?`, { danger: true, confirmLabel: "Supprimer" }))) return;
      const btn = overlay.querySelector('[type="submit"]'); btn.disabled = true;
      try {
        for (const x of dels) { const { error } = await supabase.from("suivi_strategies").delete().eq("id", x.id); if (error) throw error; }
        // Renommage en deux temps : évite un conflit de nom quand on échange deux noms.
        for (const x of live.filter((y) => y.id)) { const { error } = await supabase.from("suivi_strategies").update({ nom: x.nom + "​", note: x.note, position: x.position }).eq("id", x.id); if (error) throw error; }
        for (const x of live.filter((y) => y.id)) { const { error } = await supabase.from("suivi_strategies").update({ nom: x.nom }).eq("id", x.id); if (error) throw error; }
        const fresh = live.filter((y) => !y.id);
        if (fresh.length) { const { error } = await supabase.from("suivi_strategies").insert(fresh.map((x) => ({ user_id: user, nom: x.nom, note: x.note, position: x.position }))); if (error) throw error; }
        const reloaded = await load();
        strategies = reloaded.strategies; rows = reloaded.rows;
        close(); toast("Stratégies enregistrées ✓"); draw();
      } catch (ex) { btn.disabled = false; err.textContent = /duplicate|unique/i.test(ex.message || "") ? "Deux stratégies ne peuvent pas avoir le même nom." : friendlyError(ex); }
    });
  }
  draw();
}
