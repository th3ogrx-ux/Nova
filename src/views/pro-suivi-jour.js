// Offres > Suivi quotidien : chaque jour, combien de personnes prospectées (Google, Instagram), de réponses,
// d'audits envoyés et de ventes. Saisie en 10 secondes, puis chiffres clés, entonnoir et courbe d'évolution.
import { supabase } from "../supabase.js";
import { getDataOwnerId, can } from "../session.js";
import { dateKey, parseKey, addDays, mondayOf, escapeHtml, fmtInt, fmtPct, shortDay } from "./pro-data.js";
import { sparkline, funnel, lineChart, runCounters } from "./pro-charts.js";
import { skeleton, toast, friendlyError } from "./pro-ui.js";

const FIELDS = [
  { key: "google", label: "Prospectés sur Google", hint: "Personnes contactées via Google", color: "var(--warm-1)" },
  { key: "instagram", label: "Prospectés sur Instagram", hint: "Personnes contactées sur Insta", color: "var(--gold)" },
  { key: "reponses", label: "Réponses reçues", hint: "Qui t'a répondu", color: "#4c9aff" },
  { key: "audits", label: "Audits envoyés", hint: "À qui tu as envoyé un audit", color: "#b072ff" },
  { key: "ventes", label: "Ventes", hint: "À qui tu as vendu", color: "var(--ok)" }
];
const PERIODS = [{ key: "7", label: "7 jours", days: 7 }, { key: "30", label: "30 jours", days: 30 }, { key: "all", label: "Tout", days: 365 }];
const state = { period: "30", day: null };
const DAY_FMT = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const zero = () => ({ google: 0, instagram: 0, reponses: 0, audits: 0, ventes: 0 });
const add = (a, r) => { FIELDS.forEach((f) => { a[f.key] += Number(r[f.key]) || 0; }); return a; };
const prosp = (t) => t.google + t.instagram;

async function load() {
  const since = dateKey(addDays(new Date(), -365));
  const { data, error } = await supabase.from("suivi_jours").select("*").gte("jour", since).order("jour");
  if (error) {
    if (/suivi_jours|schema cache|does not exist/i.test(error.message || "")) return { missing: true, rows: [] };
    throw error;
  }
  return { missing: false, rows: data || [] };
}

export async function renderSuiviJour(root) {
  const canEdit = can("prospection", "edit");
  root.innerHTML = skeleton("dashboard");
  let data;
  try { data = await load(); } catch (err) { console.error("[Suivi]", err); root.innerHTML = `<div class="card"><p class="error-msg" style="margin:0;">Impossible de charger le suivi pour le moment. Recharge la page.</p></div>`; return; }
  if (data.missing) { root.innerHTML = `<div class="card"><p class="error-msg" style="margin:0;">Le suivi quotidien n'est pas encore installé : colle le fichier suivi-quotidien.sql dans Supabase (SQL Editor &gt; Run), puis recharge la page.</p></div>`; return; }
  if (!state.day) state.day = dateKey();
  let rows = data.rows, first = true;
  const byDay = () => new Map(rows.map((r) => [r.jour, r]));

  function draw() {
    const map = byDay(), today = dateKey();
    const period = PERIODS.find((p) => p.key === state.period) || PERIODS[1];
    const from = dateKey(addDays(new Date(), -(period.days - 1)));
    const inPeriod = rows.filter((r) => r.jour >= from && r.jour <= today);
    const tot = inPeriod.reduce(add, zero());
    const cur = map.get(state.day) || zero();
    const P = prosp(tot);

    // Séries : un point par jour (7 / 30 jours) ou par semaine (« Tout »).
    let buckets;
    if (period.key === "all") {
      const start = inPeriod.length ? parseKey(inPeriod[0].jour) : new Date();
      const byWeek = new Map();
      for (let d = mondayOf(start); dateKey(d) <= today; d = addDays(d, 7)) byWeek.set(dateKey(d), zero());
      inPeriod.forEach((r) => add(byWeek.get(dateKey(mondayOf(parseKey(r.jour)))), r));
      buckets = [...byWeek].map(([k, v]) => ({ k, label: shortDay(parseKey(k)), tip: "Semaine du " + shortDay(parseKey(k)), ...v }));
    } else {
      buckets = Array.from({ length: period.days }, (_, i) => dateKey(addDays(new Date(), i - (period.days - 1)))).map((k) => ({ k, label: shortDay(parseKey(k)), tip: cap(DAY_FMT.format(parseKey(k))), ...(map.get(k) || zero()) }));
    }
    const series = (fn) => buckets.map(fn);
    const sparkData = buckets.slice(-14);
    const kpi = (i, label, valueHtml, foot, spark) => `<div class="card pro-kpi pro-seq" style="--i:${i}"><div class="pro-kpi-label">${label}</div><div class="pro-kpi-value">${valueHtml}</div><div class="pro-kpi-foot"><span class="pro-delta">${foot}</span>${spark}</div></div>`;
    const recent = [...rows].sort((a, b) => b.jour.localeCompare(a.jour)).slice(0, 12);
    const gShare = P ? Math.round((tot.google / P) * 100) : 0;

    root.innerHTML = `
      <section class="card pro-panel sj-form-card pro-seq" style="--i:0">
        <div class="pro-panel-head"><h2 class="panel-title">Mes chiffres du jour</h2>
          <div class="sj-dayrow"><button type="button" class="btn ghost btn-sm" data-day-nav="-1" aria-label="Jour précédent">‹</button>
            <input type="date" class="sj-date" data-day max="${today}" value="${state.day}" aria-label="Jour">
            <button type="button" class="btn ghost btn-sm" data-day-nav="1" aria-label="Jour suivant"${state.day >= today ? " disabled" : ""}>›</button></div></div>
        <p class="pro-muted sj-daylabel">${escapeHtml(cap(DAY_FMT.format(parseKey(state.day))))}${state.day === today ? " (aujourd'hui)" : ""}${map.has(state.day) ? "" : " · rien de noté"}</p>
        <form data-form class="sj-grid">
          ${FIELDS.map((f) => `<div class="sj-field" style="--c:${f.color}">
            <label for="sj-${f.key}"><i></i>${f.label}</label>
            <div class="sj-step"><button type="button" data-step="-1" data-for="${f.key}" aria-label="Retirer 1"${canEdit ? "" : " disabled"}>−</button>
              <input id="sj-${f.key}" name="${f.key}" type="number" inputmode="numeric" min="0" max="100000" value="${cur[f.key] || 0}"${canEdit ? "" : " disabled"}>
              <button type="button" data-step="1" data-for="${f.key}" aria-label="Ajouter 1"${canEdit ? "" : " disabled"}>+</button></div>
            <small>${f.hint}</small></div>`).join("")}
          ${canEdit ? `<div class="sj-actions"><button type="submit" class="btn primary">Enregistrer la journée</button><span class="pro-muted" data-msg></span></div>` : ""}
        </form>
      </section>

      <div class="pro-periodbar pro-seq" style="--i:1"><span class="pro-periodbar-label">Période</span>
        <div class="pro-seg" role="group" aria-label="Période">${PERIODS.map((p) => `<button type="button" class="${p.key === period.key ? "on" : ""}" data-period="${p.key}" aria-pressed="${p.key === period.key}">${p.label}</button>`).join("")}</div></div>

      <div class="pro-kpis sj-kpis">
        ${kpi(2, "Prospectés", `<b data-count="${P}">0</b>`, `Google ${fmtInt(tot.google)} · Insta ${fmtInt(tot.instagram)}`, sparkline(sparkData.map((b) => b.google + b.instagram)))}
        ${kpi(3, "Réponses", `<b data-count="${tot.reponses}">0</b>`, `${P ? fmtPct(Math.round((tot.reponses / P) * 1000) / 10) : "—"} de réponse`, sparkline(sparkData.map((b) => b.reponses), { color: "#4c9aff" }))}
        ${kpi(4, "Audits envoyés", `<b data-count="${tot.audits}">0</b>`, `${tot.reponses ? fmtPct(Math.round((tot.audits / tot.reponses) * 1000) / 10) : "—"} des réponses`, sparkline(sparkData.map((b) => b.audits), { color: "#b072ff" }))}
        ${kpi(5, "Ventes", `<b data-count="${tot.ventes}">0</b>`, `${P ? fmtPct(Math.round((tot.ventes / P) * 1000) / 10) : "—"} des prospectés`, sparkline(sparkData.map((b) => b.ventes), { color: "var(--ok)" }))}
      </div>

      <div class="pro-grid2">
        <section class="card pro-panel pro-seq" style="--i:6">
          <h2 class="panel-title">Entonnoir</h2>
          ${P ? funnel([
            { label: "Prospectés", value: P, color: "var(--warm-1)" },
            { label: "Réponses", value: tot.reponses, color: "#4c9aff" },
            { label: "Audits", value: tot.audits, color: "#b072ff" },
            { label: "Ventes", value: tot.ventes, color: "var(--ok)" }
          ]) : `<p class="pro-muted">Note tes premiers chiffres ci-dessus : l'entonnoir apparaît ici.</p>`}
        </section>
        <section class="card pro-panel pro-seq" style="--i:7">
          <h2 class="panel-title">Google ou Instagram ?</h2>
          ${P ? `<div class="sj-split"><div class="sj-split-bar"><i style="width:${gShare}%;background:var(--warm-1)"></i><i style="width:${100 - gShare}%;background:var(--gold)"></i></div>
            <div class="sj-split-legend"><span><i style="background:var(--warm-1)"></i>Google <b>${fmtInt(tot.google)}</b> (${gShare} %)</span><span><i style="background:var(--gold)"></i>Instagram <b>${fmtInt(tot.instagram)}</b> (${100 - gShare} %)</span></div></div>
            <p class="pro-muted sj-best">Moyenne : <b>${(P / Math.max(1, inPeriod.length)).toFixed(1).replace(".", ",")}</b> prospectés par jour noté · <b>${inPeriod.length}</b> jour${inPeriod.length > 1 ? "s" : ""} noté${inPeriod.length > 1 ? "s" : ""}</p>`
            : `<p class="pro-muted">Rien à comparer pour l'instant.</p>`}
        </section>
      </div>

      <section class="card pro-panel pro-seq" style="--i:8">
        <div class="pro-panel-head"><h2 class="panel-title">Évolution</h2>
          <div class="pro-legend-inline">${[["Prospectés", "var(--warm-1)"], ["Réponses", "#4c9aff"], ["Audits", "#b072ff"], ["Ventes", "var(--ok)"]].map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join("")}</div></div>
        <div class="pro-chart" data-chart></div>
      </section>

      <section class="card pro-panel pro-seq" style="--i:9">
        <h2 class="panel-title">Derniers jours</h2>
        ${recent.length ? `<div class="sj-table-wrap"><table class="sj-table"><thead><tr><th>Jour</th><th>Google</th><th>Insta</th><th>Réponses</th><th>Audits</th><th>Ventes</th></tr></thead><tbody>
          ${recent.map((r) => `<tr data-pick="${r.jour}" tabindex="0"><td>${escapeHtml(cap(shortDay(parseKey(r.jour))))}</td><td>${r.google}</td><td>${r.instagram}</td><td>${r.reponses}</td><td>${r.audits}</td><td><b>${r.ventes}</b></td></tr>`).join("")}
          </tbody></table></div><p class="pro-muted sj-hint">Clique une ligne pour la corriger.</p>` : `<p class="pro-muted">Aucun jour noté pour l'instant.</p>`}
      </section>`;

    lineChart(root.querySelector("[data-chart]"), {
      labels: buckets.map((b) => b.label), tipLabels: buckets.map((b) => b.tip),
      series: [
        { name: "Prospectés", color: "var(--warm-1)", values: series((b) => b.google + b.instagram), fill: true },
        { name: "Réponses", color: "#4c9aff", values: series((b) => b.reponses) },
        { name: "Audits", color: "#b072ff", values: series((b) => b.audits) },
        { name: "Ventes", color: "var(--ok)", values: series((b) => b.ventes) }
      ]
    });
    if (first) { runCounters(root); first = false; } else root.querySelectorAll("[data-count]").forEach((el) => { el.textContent = fmtInt(el.dataset.count); });
    bind();
  }

  function bind() {
    const form = root.querySelector("[data-form]"), msg = root.querySelector("[data-msg]");
    root.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => {
      const input = form.elements[b.dataset.for]; input.value = Math.max(0, Math.min(100000, (Number(input.value) || 0) + Number(b.dataset.step)));
    }));
    const goDay = (k) => { state.day = k > dateKey() ? dateKey() : k; draw(); };
    root.querySelector("[data-day]").addEventListener("change", (e) => { if (e.target.value) goDay(e.target.value); });
    root.querySelectorAll("[data-day-nav]").forEach((b) => b.addEventListener("click", () => goDay(dateKey(addDays(parseKey(state.day), Number(b.dataset.dayNav))))));
    root.querySelectorAll("[data-period]").forEach((b) => b.addEventListener("click", () => { state.period = b.dataset.period; draw(); }));
    root.querySelectorAll("[data-pick]").forEach((tr) => {
      const pick = () => { state.day = tr.dataset.pick; draw(); root.scrollIntoView?.({ block: "start" }); const main = root.closest(".main"); if (main) main.scrollTop = 0; };
      tr.addEventListener("click", pick);
      tr.addEventListener("keydown", (e) => { if (e.key === "Enter") pick(); });
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!canEdit) return;
      const values = Object.fromEntries(FIELDS.map((f) => [f.key, Math.max(0, Math.min(100000, Math.round(Number(form.elements[f.key].value) || 0)))]));
      const btn = form.querySelector('[type="submit"]'); btn.disabled = true;
      const user = getDataOwnerId() || (await supabase.auth.getUser()).data.user.id;
      const { data: saved, error } = await supabase.from("suivi_jours").upsert({ user_id: user, jour: state.day, ...values, updated_at: new Date().toISOString() }, { onConflict: "user_id,jour" }).select().single();
      btn.disabled = false;
      if (error) { msg.textContent = friendlyError(error); msg.classList.add("error-msg"); return; }
      rows = rows.filter((r) => r.jour !== state.day).concat(saved || { jour: state.day, ...values }).sort((a, b) => a.jour.localeCompare(b.jour));
      toast("Journée enregistrée ✓");
      draw();
    });
  }
  draw();
}
