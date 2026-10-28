// Graphiques de l'espace client, dessinés en SVG (même technique que le
// Tableau de bord, aucune bibliothèque). Les couleurs viennent du thème.
import { escapeHtml, shortMonth, monthLabel, formatNumber } from "./espace-data.js";

const SVG_NS = "http://www.w3.org/2000/svg";
// Dimensions réelles du conteneur : le dessin n'est jamais "réduit", donc les
// textes gardent leur taille sur téléphone (voir size()).
let W = 640, H = 250;
let PAD = { left: 44, right: 44, top: 16, bottom: 30 };
function size(container) {
  const w = container.clientWidth;
  W = w >= 150 ? Math.min(Math.round(w), 760) : 640;
  const narrow = W < 480;
  H = narrow ? 230 : 250;
  PAD = narrow ? { left: 34, right: 30, top: 18, bottom: 28 } : { left: 44, right: 44, top: 16, bottom: 30 };
}
const GOLD = "#d4a24c";

function el(tag, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

// Graduations "rondes" (0, 25, 50, 75, 100...) pour un maximum donné.
function niceScale(max, steps = 4) {
  if (max <= 0) return { max: 1, ticks: [0, 1] };
  const rough = max / steps;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const unit = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((u) => u >= rough) || 10 * pow;
  const top = Math.ceil(max / unit) * unit;
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += unit) ticks.push(Math.round(v * 100) / 100);
  return { max: top, ticks };
}

function frame(label, months) {
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": label, class: "espace-chart-svg" });
  const innerW = W - PAD.left - PAD.right;
  const slot = innerW / months.length;
  const xCenter = (i) => PAD.left + slot * (i + 0.5);
  const baseline = H - PAD.bottom;
  const innerH = baseline - PAD.top;
  // Mois trop serrés : un libellé sur deux.
  const step = Math.max(1, Math.ceil(28 / slot));
  months.forEach((mois, i) => {
    if (i % step !== (months.length - 1) % step) return;
    const t = el("text", { x: xCenter(i), y: baseline + 18, "text-anchor": "middle", class: "espace-axis" }, svg);
    t.textContent = shortMonth(mois);
  });
  return { svg, xCenter, slot, baseline, innerH, innerW };
}

function gridLine(svg, y, label, side) {
  el("line", { x1: PAD.left, x2: W - PAD.right, y1: y, y2: y, class: "espace-grid-line" }, svg);
  if (label == null) return;
  const t = el("text", {
    x: side === "right" ? W - PAD.right + 8 : PAD.left - 8, y: y + 3.5,
    "text-anchor": side === "right" ? "start" : "end", class: "espace-axis"
  }, svg);
  t.textContent = label;
}

function legend(items) {
  return `<div class="espace-legend">${items.map((i) => `<span><i style="background:${i.color};${i.round ? "border-radius:50%;" : ""}"></i>${escapeHtml(i.label)}</span>`).join("")}</div>`;
}

// Graphique : un ou plusieurs chiffres mensuels, mois par mois (une courbe par réseau).
// `series` : [{ key, label, color }] (les chiffres choisis pour ce client).
export const SERIES_COLORS = { appels: "var(--warm-1)", itineraires: GOLD, vues_fiche: "#e8b4a0", visites_site: "#9fb4c7" };

export function renderCallsChart(container, stats, series) {
  size(container);
  if (!stats.length) {
    container.innerHTML = `<p class="espace-empty">Les premiers chiffres mensuels arrivent bientôt.</p>`;
    return;
  }
  const months = stats.map((s) => s.mois);
  const label = series.map((s) => s.label.toLowerCase()).join(" et ");
  const { svg, xCenter, baseline, innerH } = frame(`Évolution : ${label}, par mois`, months);
  const scale = niceScale(Math.max(...stats.map((s) => Math.max(...series.map((serie) => s[serie.key] || 0)))), 4);
  const y = (v) => baseline - (v / scale.max) * innerH;
  scale.ticks.forEach((v) => gridLine(svg, y(v), formatNumber(v), "left"));

  series.forEach((serie, si) => {
    const pts = stats.map((s, i) => ({ x: xCenter(i), y: y(s[serie.key] || 0), v: s[serie.key] || 0, mois: s.mois }));
    el("polyline", {
      points: pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
      fill: "none", stroke: serie.color, "stroke-width": 2.5, "stroke-linecap": "round", "stroke-linejoin": "round", class: "espace-line", pathLength: 1
    }, svg).setAttribute("aria-hidden", "true");
    pts.forEach((p, i) => {
      const dot = el("circle", { cx: p.x, cy: p.y, r: 4, fill: serie.color, stroke: "var(--light-card-bg)", "stroke-width": 2, class: "espace-dot" }, svg);
      dot.style.animationDelay = `${300 + i * 50 + si * 120}ms`;
      el("title", {}, dot).textContent = `${monthLabel(p.mois)} : ${formatNumber(p.v)} ${serie.label.toLowerCase()}`;
      if (i === pts.length - 1) {
        const t = el("text", { x: p.x, y: p.y - 10, "text-anchor": "middle", class: "espace-point-label" }, svg);
        t.textContent = formatNumber(p.v);
      }
    });
  });

  container.innerHTML = "";
  container.appendChild(svg);
  if (series.length > 1) container.insertAdjacentHTML("beforeend", legend(series.map((s) => ({ label: s.label, color: s.color, round: true }))));
}
