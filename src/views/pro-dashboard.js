// Prospection > Tableau de bord : chiffres clés, entonnoir, objectif, évolution, calendrier de chaleur, classement.
import {
  CANAUX, sum, rate, weeklySeries, strategyStats, bestStrategy, dayTotals, inRange, variation, mondayOf, addDays, dateKey,
  escapeHtml, fmtInt, fmtPct, canalIcon, shortDay, parseKey, saveObjectif
} from "./pro-data.js";
import { sparkline, funnel, ring, lineChart, heatmap, runCounters } from "./pro-charts.js";
import { emptyState, openModal, modalHeader, toast, friendlyError } from "./pro-ui.js";

const PERIODS = [{ key: "7", label: "7 jours", days: 7 }, { key: "30", label: "30 jours", days: 30 }, { key: "all", label: "Tout", days: 3650 }];

function delta(cur, prev, { points = false } = {}) {
  let pct;
  if (points) pct = Math.round((cur - prev) * 10) / 10; else pct = variation(cur, prev);
  if (pct === null) return `<span class="pro-delta">nouveau</span>`;
  if (pct === 0) return `<span class="pro-delta">= stable</span>`;
  const up = pct > 0;
  return `<span class="pro-delta ${up ? "up" : "down"}">${up ? "▲ +" : "▼ "}${String(pct).replace(".", ",")}${points ? " pts" : " %"}<em> vs sem. préc.</em></span>`;
}

function kpi(i, label, valueHtml, deltaHtml, sparkHtml) {
  return `<div class="card pro-kpi pro-seq" style="--i:${i}"><div class="pro-kpi-label">${label}</div><div class="pro-kpi-value">${valueHtml}</div><div class="pro-kpi-foot">${deltaHtml}${sparkHtml}</div></div>`;
}

export function renderDashboard(root, data, ctx) {
  const { state } = ctx;
  if (!data.logs.length) {
    root.innerHTML = `<div class="card">${emptyState({ title: "Ton tableau de bord attend ses premiers chiffres", text: "Note les messages que tu envoies chaque jour : les courbes, l'entonnoir et le classement de tes stratégies se construisent tout seuls.", cta: "Noter mes premiers messages", action: "quick" })}</div>`;
    root.querySelector('[data-action="quick"]').addEventListener("click", () => ctx.openQuick());
    return;
  }
  const monday = mondayOf(), weeks = weeklySeries(data.logs, 12, monday);
  const cur = weeks[weeks.length - 1];
  // La semaine en cours n'est pas finie : on la compare aux MÊMES jours de la semaine précédente.
  const elapsed = ((new Date().getDay() + 6) % 7) + 1;
  const prevMonday = addDays(monday, -7);
  const prev = sum(inRange(data.logs, dateKey(prevMonday), dateKey(addDays(prevMonday, elapsed - 1))));
  const tauxCur = rate(cur.reponses, cur.envoyes), tauxPrev = rate(prev.reponses, prev.envoyes);
  const last8 = weeks.slice(-8);
  const period = PERIODS.find((p) => p.key === state.period) || PERIODS[1];
  const toKey = dateKey(), fromKey = dateKey(addDays(new Date(), -(period.days - 1)));
  const stats = strategyStats(data, fromKey, toKey);
  const best = bestStrategy(strategyStats(data, "2000-01-01", toKey));
  const totals = sum(inRange(data.logs, fromKey, toKey));
  const clientsTotal = sum(data.logs).clients;
  const daysLeft = 7 - ((new Date().getDay() + 6) % 7);

  const bestHtml = best
    ? kpi(3, "Meilleure stratégie", `<span class="pro-kpi-text" title="${escapeHtml(best.strategy.titre)}">${escapeHtml(best.strategy.titre)}</span><small class="pro-kpi-sub">${canalIcon(best.strategy.canal, 14)} <b data-count="${best.tauxAll}" data-dec="1" data-suffix=" %">0</b> de réponses</small>`,
        `<span class="pro-delta">${fmtInt(best.all.envoyes)} messages</span>`, sparkline(best.weeks.map((w) => rate(w.reponses, w.envoyes)), { color: "var(--gold)" }))
    : kpi(3, "Meilleure stratégie", `<span class="pro-kpi-text muted">—</span><small class="pro-kpi-sub">Dès 10 messages sur une stratégie</small>`, "", "");

  root.innerHTML = `
    <div class="pro-kpis">
      ${kpi(0, "Messages envoyés", `<b data-count="${cur.envoyes}">0</b>`, delta(cur.envoyes, prev.envoyes), sparkline(last8.map((w) => w.envoyes)))}
      ${kpi(1, "Taux de réponse", `<b data-count="${tauxCur}" data-dec="1" data-suffix=" %">0</b>`, delta(tauxCur, tauxPrev, { points: true }), sparkline(last8.map((w) => rate(w.reponses, w.envoyes)), { color: "var(--gold)" }))}
      ${kpi(2, "Clients signés", `<b data-count="${cur.clients}">0</b>`, `<span class="pro-delta">${fmtInt(clientsTotal)} au total</span>`, sparkline(last8.map((w) => w.clients), { color: "var(--ok)" }))}
      ${bestHtml}
    </div>

    <div class="pro-periodbar pro-seq" style="--i:4">
      <span class="pro-periodbar-label">Période</span>
      <div class="pro-seg" role="group" aria-label="Période">${PERIODS.map((p) => `<button type="button" class="${p.key === period.key ? "on" : ""}" data-period="${p.key}" aria-pressed="${p.key === period.key}">${p.label}</button>`).join("")}</div>
    </div>

    <div class="pro-grid2">
      <section class="card pro-panel">
        <h2 class="panel-title">Entonnoir de prospection</h2>
        ${totals.envoyes ? funnel([
          { label: "Envoyés", value: totals.envoyes, color: "var(--warm-1)" },
          { label: "Réponses", value: totals.reponses, color: "var(--warm-2)" },
          { label: "Intéressés", value: totals.interesses, color: "var(--warning)" },
          { label: "Audits", value: totals.audits, color: "var(--gold)" },
          { label: "Clients", value: totals.clients, color: "var(--ok)" }
        ]) : `<p class="pro-muted">Rien à afficher sur cette période.</p>`}
      </section>

      <section class="card pro-panel pro-goal pro-seq" style="--i:5">
        <h2 class="panel-title">Objectif de la semaine</h2>
        <div class="pro-goal-body">
          <div class="pro-ring-wrap">${ring(cur.envoyes, data.objectif)}<div class="pro-ring-center"><b data-count="${cur.envoyes}">0</b><span>sur ${fmtInt(data.objectif)}</span></div></div>
          <div class="pro-goal-text">
            ${cur.envoyes >= data.objectif
              ? `<p class="pro-goal-ok">Objectif atteint, bravo.</p><p class="pro-muted">${fmtInt(cur.envoyes - data.objectif)} message${cur.envoyes - data.objectif > 1 ? "s" : ""} d'avance.</p>`
              : `<p><b>${fmtInt(data.objectif - cur.envoyes)}</b> message${data.objectif - cur.envoyes > 1 ? "s" : ""} à envoyer</p><p class="pro-muted">Soit environ ${Math.ceil((data.objectif - cur.envoyes) / daysLeft)} par jour (il reste ${daysLeft} jour${daysLeft > 1 ? "s" : ""}).</p>`}
            <button type="button" class="btn ghost btn-sm" data-action="goal">Modifier l'objectif</button>
          </div>
        </div>
      </section>
    </div>

    <section class="card pro-panel pro-seq" style="--i:6">
      <div class="pro-panel-head"><h2 class="panel-title">Évolution sur 12 semaines</h2>
        <div class="pro-legend-inline"><span><i style="background:var(--warm-1)"></i>Envoyés</span><span><i style="background:var(--gold)"></i>Réponses</span></div></div>
      <div class="pro-chart" data-chart></div>
    </section>

    <div class="pro-grid2">
      <section class="card pro-panel pro-seq" style="--i:7">
        <h2 class="panel-title">Activité jour par jour</h2>
        <div class="pro-heat" data-heat></div>
      </section>

      <section class="card pro-panel pro-seq" style="--i:8">
        <h2 class="panel-title">Classement des stratégies</h2>
        <div data-ranking></div>
      </section>
    </div>`;

  // Classement : barre = taux de réponse sur la période, tendance vs la période précédente.
  const ranked = stats.filter((s) => s.envoyes > 0).sort((a, b) => b.taux - a.taux);
  const maxTaux = Math.max(...ranked.map((s) => s.taux), 1);
  const rankingEl = root.querySelector("[data-ranking]");
  rankingEl.innerHTML = ranked.length ? `<ol class="pro-rank">${ranked.map((s, i) => `
    <li class="pro-rank-row">
      <span class="pro-rank-n">${i + 1}</span>
      <div class="pro-rank-main">
        <div class="pro-rank-top"><button type="button" class="pro-link" data-open="${s.strategy.id}">${escapeHtml(s.strategy.titre)}</button><span class="pro-rank-rate">${fmtPct(s.taux)}</span></div>
        <div class="pro-rank-track"><div class="pro-rank-bar" style="--w:${Math.max(3, (s.taux / maxTaux) * 100)}%"></div></div>
        <div class="pro-rank-foot"><span>${canalIcon(s.strategy.canal, 13)} ${escapeHtml(CANAUX[s.strategy.canal].label)} · ${fmtInt(s.envoyes)} envoyés</span>
          <span class="pro-trend ${s.trend}" title="Par rapport à la période précédente">${s.trend === "up" ? "▲ en hausse" : s.trend === "down" ? "▼ en baisse" : "● stable"}</span></div>
      </div>
    </li>`).join("")}</ol>`
    : `<p class="pro-muted">Aucune stratégie n'a de messages sur cette période. Rattache tes saisies à une stratégie pour les comparer.</p>`;

  lineChart(root.querySelector("[data-chart]"), {
    labels: weeks.map((w) => shortDay(parseKey(w.monday))),
    tipLabels: weeks.map((w) => "Semaine du " + shortDay(parseKey(w.monday))),
    series: [
      { name: "Envoyés", color: "var(--warm-1)", values: weeks.map((w) => w.envoyes), fill: true },
      { name: "Réponses", color: "var(--gold)", values: weeks.map((w) => w.reponses) }
    ]
  });
  heatmap(root.querySelector("[data-heat]"), dayTotals(data.logs));

  root.querySelectorAll("[data-period]").forEach((b) => b.addEventListener("click", () => { state.period = b.dataset.period; ctx.rerender({ animate: false }); }));
  root.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => ctx.openStrategy(b.dataset.open)));
  root.querySelector('[data-action="goal"]').addEventListener("click", () => openGoalModal(data, ctx));
  if (ctx.animate) runCounters(root); else root.querySelectorAll("[data-count]").forEach((el) => { el.textContent = (el.dataset.dec ? Number(el.dataset.count).toFixed(1).replace(".", ",") : fmtInt(el.dataset.count)) + (el.dataset.suffix || ""); });
  if (!ctx.animate) root.querySelectorAll(".pro-ring-arc").forEach((a) => a.setAttribute("stroke-dashoffset", a.dataset.target));
}

function openGoalModal(data, ctx) {
  const { overlay, close } = openModal(`${modalHeader("Objectif de la semaine")}
    <form data-form>
      <div class="field"><label class="field-label" for="goal-n">Messages à envoyer par semaine</label><input type="number" id="goal-n" min="1" max="10000" value="${data.objectif}" required></div>
      <div class="error-msg" data-error></div>
      <div class="modal-actions"><button type="button" class="btn ghost" data-close>Annuler</button><button type="submit" class="btn primary">Enregistrer</button></div>
    </form>`, { maxWidth: 380 });
  overlay.querySelector("#goal-n").focus();
  overlay.querySelector("[data-form]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const n = Math.floor(Number(overlay.querySelector("#goal-n").value));
    if (!(n >= 1 && n <= 10000)) { overlay.querySelector("[data-error]").textContent = "Indique un nombre entre 1 et 10 000."; return; }
    try { await saveObjectif(n); close(); toast("Objectif enregistré ✓"); ctx.reload(); } catch (err) { overlay.querySelector("[data-error]").textContent = friendlyError(err); }
  });
}
