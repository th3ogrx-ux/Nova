// Tableau de bord — ventes (voir sales-card.js), puis suivi de Zenoa
// Radar : totaux par statut et graphique "Suivi" des 14 derniers jours
// (même principe que le graphique de l'ancienne appli).
import { supabase } from "../supabase.js";
import { renderSalesCard } from "./sales-card.js";

const DAYS = 14;
const SVG_NS = "http://www.w3.org/2000/svg";

// "Total traité" = toutes les fiches sur lesquelles un bouton a été
// cliqué (Contacté, Intéressé, Pas intéressé), comptées le jour du clic
// (updated_at). Les fiches juste générées, pas encore traitées, ne
// comptent dans aucune courbe.
const CHART_LINES = [
  { key: "total", label: "Total traité", color: "var(--warm-1)" },
  { key: "contacte", label: "Contacté", color: "var(--warning)" },
  { key: "interesse", label: "Intéressé", color: "var(--ok)" },
  { key: "pas_interesse", label: "Pas intéressé", color: "var(--danger)" }
];

const TILES = [
  { status: "en_attente", label: "En attente" },
  { status: "contacte", label: "Contactés" },
  { status: "interesse", label: "Intéressés" },
  { status: "pas_interesse", label: "Pas intéressés" }
];

function localDateKey(date) {
  const d = new Date(date);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function lastDays(count) {
  const days = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(localDateKey(d));
  }
  return days;
}

function buildSeries(leads) {
  const days = lastDays(DAYS);
  const byDay = Object.fromEntries(days.map((d) => [d, { total: 0, contacte: 0, interesse: 0, pas_interesse: 0 }]));
  for (const lead of leads) {
    const counts = byDay[localDateKey(lead.updated_at)];
    if (!counts || !(lead.status in counts)) continue;
    counts[lead.status]++;
    counts.total++;
  }
  return days.map((date) => ({ date, counts: byDay[date] }));
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function renderChart(container, series) {
  const W = 600, H = 200;
  const padL = 30, padR = 10, padT = 12, padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxVal = Math.max(1, ...series.flatMap((d) => CHART_LINES.map((l) => d.counts[l.key])));
  const xAt = (i) => padL + (series.length > 1 ? (i * plotW) / (series.length - 1) : 0);
  const yAt = (v) => padT + plotH * (1 - v / maxVal);
  const baseline = H - padB;

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Suivi des prospects traités sur 14 jours" });
  svg.style.width = "100%";
  svg.style.height = "auto";
  svg.style.display = "block";

  // Graduations : uniquement les valeurs réellement atteintes, pour lire
  // la hauteur exacte de chaque point.
  const yValues = new Set([0]);
  series.forEach((d) => CHART_LINES.forEach((l) => { if (d.counts[l.key] > 0) yValues.add(d.counts[l.key]); }));
  let lastLabelY = Infinity;
  [...yValues].sort((a, b) => a - b).forEach((v) => {
    const y = yAt(v);
    svg.appendChild(svgEl("line", { x1: padL, x2: W - padR, y1: y, y2: y, stroke: "var(--light-border)", "stroke-width": v === 0 ? "1.2" : "0.6" }));
    if (lastLabelY - y < 10) return; // libellé trop proche du précédent : on garde seulement la ligne
    lastLabelY = y;
    const label = svgEl("text", { x: padL - 6, y: y + 3, "text-anchor": "end", fill: "var(--light-text-dim)", "font-size": "9" });
    label.textContent = String(v);
    svg.appendChild(label);
  });
  svg.appendChild(svgEl("line", { x1: padL, x2: padL, y1: padT, y2: baseline, stroke: "var(--light-border)", "stroke-width": "1.2" }));

  series.forEach((d, i) => {
    if (i % 2 !== 0 && i !== series.length - 1) return;
    const [, month, day] = d.date.split("-");
    const anchor = i === series.length - 1 ? "end" : i === 0 ? "start" : "middle";
    const label = svgEl("text", { x: xAt(i), y: baseline + 14, "text-anchor": anchor, fill: "var(--light-text-dim)", "font-size": "9" });
    label.textContent = `${day}/${month}`;
    svg.appendChild(label);
  });

  CHART_LINES.forEach((line) => {
    series.forEach((d, i) => {
      const v = d.counts[line.key];
      if (v <= 0) return;
      svg.appendChild(svgEl("line", { x1: xAt(i), x2: xAt(i), y1: yAt(v), y2: baseline, stroke: line.color, "stroke-width": "1", opacity: "0.25" }));
    });
    svg.appendChild(svgEl("polyline", {
      points: series.map((d, i) => `${xAt(i).toFixed(1)},${yAt(d.counts[line.key]).toFixed(1)}`).join(" "),
      fill: "none",
      stroke: line.color,
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    }));
    series.forEach((d, i) => {
      const v = d.counts[line.key];
      if (v <= 0) return;
      const dot = svgEl("circle", { cx: xAt(i), cy: yAt(v), r: "3", fill: line.color });
      const title = svgEl("title", {});
      const [, month, day] = d.date.split("-");
      title.textContent = `${line.label} le ${day}/${month} : ${v}`;
      dot.appendChild(title);
      svg.appendChild(dot);
    });
  });

  container.appendChild(svg);

  const legend = document.createElement("div");
  legend.style.cssText = "display:flex;flex-wrap:wrap;gap:14px;margin-top:10px;font-size:12px;color:var(--light-text-dim);";
  legend.innerHTML = CHART_LINES.map((l) =>
    `<span style="display:flex;align-items:center;gap:6px;"><span style="width:9px;height:9px;border-radius:50%;background:${l.color};display:inline-block;"></span>${l.label}</span>`
  ).join("");
  container.appendChild(legend);
}

export async function renderDashboard(root) {
  root.innerHTML = `
    <h1 class="page-title">Tableau de bord</h1>
    <p style="color:var(--light-text-dim);font-size:14px;margin-bottom:20px;">Chargement des statistiques...</p>
  `;

  const { data: { user } } = await supabase.auth.getUser();
  const since = new Date();
  since.setDate(since.getDate() - (DAYS - 1));
  since.setHours(0, 0, 0, 0);

  const countQuery = (status) => supabase
    .from("radar_leads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", status);

  const [recentRes, ...countRes] = await Promise.all([
    supabase
      .from("radar_leads")
      .select("status, updated_at")
      .eq("user_id", user.id)
      .neq("status", "en_attente")
      .gte("updated_at", since.toISOString()),
    ...TILES.map((t) => countQuery(t.status))
  ]);

  if (recentRes.error || countRes.some((r) => r.error)) {
    root.innerHTML = `<h1 class="page-title">Tableau de bord</h1><p class="error-msg">Impossible de charger les statistiques.</p>`;
    return;
  }

  root.innerHTML = `
    <h1 class="page-title">Tableau de bord</h1>

    <div class="card" style="padding:20px;margin-bottom:24px;">
      <div class="panel-title">Ventes</div>
      <div id="dashboard-sales"></div>
    </div>

    <div class="stat-grid" style="margin-bottom:24px;">
      ${TILES.map((t, i) => `<div class="card stat-tile"><div class="stat-tile-value">${countRes[i].count || 0}</div><div class="stat-tile-label">${t.label}</div></div>`).join("")}
    </div>

    <div class="card" style="padding:20px;">
      <div class="panel-title">Suivi — 14 derniers jours</div>
      <div id="dashboard-chart"></div>
    </div>
  `;

  renderChart(root.querySelector("#dashboard-chart"), buildSeries(recentRes.data || []));
  renderSalesCard(root.querySelector("#dashboard-sales"), user.id);
}
