// Module Prospection : graphiques dessinés en SVG (aucune bibliothèque), couleurs du thème.
// Les courbes se dessinent à l'ouverture (classe .pro-draw) ; tout est désactivé si
// l'utilisateur demande moins d'animations (voir prospection.css).
import { escapeHtml, fmtInt, reducedMotion, parseKey, shortDay, addDays, dateKey } from "./pro-data.js";

const f = (n) => Math.round(n * 10) / 10;

// Courbe lissée (Catmull-Rom converti en Bézier) passant par tous les points.
export function smoothPath(pts) {
  if (!pts.length) return "";
  if (pts.length === 1) return `M${f(pts[0][0])},${f(pts[0][1])}`;
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

let gradSeq = 0;

// Mini-courbe d'une carte de chiffre clé.
export function sparkline(values, { color = "var(--warm-1)", w = 110, h = 34 } = {}) {
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => [3 + (i * (w - 6)) / Math.max(1, values.length - 1), h - 4 - ((v - min) / span) * (h - 8)]);
  const id = "sg" + ++gradSeq;
  const line = smoothPath(pts);
  const last = pts[pts.length - 1];
  return `<svg class="pro-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Évolution sur ${values.length} semaines" preserveAspectRatio="none">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path class="pro-fade" d="${line} L${f(last[0])},${h} L${f(pts[0][0])},${h} Z" fill="url(#${id})" style="--d:500"/>
    <path class="pro-draw" pathLength="1" d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" style="--d:150"/>
    <circle class="pro-fade" cx="${f(last[0])}" cy="${f(last[1])}" r="3" fill="${color}" style="--d:900"/>
  </svg>`;
}

// Mini histogramme (cartes de stratégie).
export function miniBars(values, { color = "var(--warm-1)", w = 120, h = 36 } = {}) {
  const max = Math.max(...values, 1), n = values.length, gap = 3, bw = (w - gap * (n - 1)) / n;
  return `<svg class="pro-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Messages envoyés par semaine" preserveAspectRatio="none">${values.map((v, i) => {
    const bh = Math.max(v ? 3 : 1.5, (v / max) * (h - 2));
    return `<rect class="pro-grow" x="${f(i * (bw + gap))}" y="${f(h - bh)}" width="${f(bw)}" height="${f(bh)}" rx="2" fill="${color}" opacity="${v ? (i === n - 1 ? 1 : 0.55) : 0.2}" style="--d:${i * 50}"/>`;
  }).join("")}</svg>`;
}

// Anneau de progression (objectif de la semaine).
export function ring(value, goal, { size = 150, stroke = 13 } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, pct = Math.min(1, goal ? value / goal : 0);
  return `<svg class="pro-ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${fmtInt(value)} sur ${fmtInt(goal)} messages">
    <defs><linearGradient id="ring-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--warm-2)"/><stop offset="1" stop-color="var(--warm-1)"/></linearGradient></defs>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--light-border)" stroke-width="${stroke}"/>
    <circle class="pro-ring-arc" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${pct >= 1 ? "var(--ok)" : "url(#ring-g)"}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${f(c)}" stroke-dashoffset="${f(c)}" data-target="${f(c * (1 - pct))}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}

// Entonnoir : une barre par étape, de plus en plus étroite, avec le % de passage entre deux étapes.
export function funnel(steps) {
  const max = Math.max(...steps.map((s) => s.value), 1);
  return `<div class="pro-funnel">${steps.map((s, i) => {
    const prev = steps[i - 1];
    const pass = prev ? (prev.value ? Math.round((s.value / prev.value) * 100) : 0) : null;
    return `${prev ? `<div class="pro-funnel-pass" aria-label="${pass} % passent à l'étape suivante"><span>↓ ${pass} %</span></div>` : ""}
      <div class="pro-funnel-row pro-seq" style="--i:${i + 3}">
        <div class="pro-funnel-label">${escapeHtml(s.label)}</div>
        <div class="pro-funnel-track"><div class="pro-funnel-bar" style="--w:${Math.max(s.value ? 4 : 0, (s.value / max) * 100)}%;--c:${s.color}"></div></div>
        <div class="pro-funnel-value"><b data-count="${s.value}">0</b></div>
      </div>`;
  }).join("")}</div>`;
}

// Dessine un graphique quand son conteneur est visible (largeur connue), et le redessine si la largeur change.
function whenSized(container, draw) {
  let lastW = 0, first = true;
  const go = () => {
    const w = Math.round(container.clientWidth);
    if (w < 60 || w === lastW) return;
    lastW = w;
    draw(w, first);
    first = false;
  };
  go();
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => { if (!container.isConnected) { ro.disconnect(); return; } go(); });
    ro.observe(container);
  }
}

// Courbes d'évolution : lissées, remplissage dégradé, point final mis en valeur, infobulle au survol/toucher.
export function lineChart(container, { labels, series, tipLabels }) {
  whenSized(container, (W, first) => {
    const H = W < 480 ? 220 : 260, pad = { l: 38, r: 16, t: 16, b: 28 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const rawMax = Math.max(...series.flatMap((s) => s.values), 1);
    const unit = Math.pow(10, Math.floor(Math.log10(rawMax)));
    const max = Math.ceil(rawMax / (unit / 2)) * (unit / 2);
    const x = (i) => pad.l + (labels.length === 1 ? iw / 2 : (i * iw) / (labels.length - 1));
    const y = (v) => pad.t + ih - (v / max) * ih;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
    const step = Math.max(1, Math.ceil(labels.length / Math.floor(iw / 54)));
    const uid = ++gradSeq;
    const paths = series.map((s, si) => {
      const pts = s.values.map((v, i) => [x(i), y(v)]);
      const line = smoothPath(pts), last = pts[pts.length - 1];
      return `<defs><linearGradient id="lg${uid}-${si}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity="${s.fill ? 0.38 : 0.12}"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient></defs>
        <path class="pro-fade" d="${line} L${f(last[0])},${pad.t + ih} L${f(pts[0][0])},${pad.t + ih} Z" fill="url(#lg${uid}-${si})" style="--d:700"/>
        <path class="pro-draw" pathLength="1" d="${line}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="--d:200"/>
        <circle class="pro-end-halo" cx="${f(last[0])}" cy="${f(last[1])}" r="9" fill="${s.color}" opacity=".22"/>
        <circle class="pro-fade" cx="${f(last[0])}" cy="${f(last[1])}" r="4.5" fill="${s.color}" stroke="var(--light-card-bg)" stroke-width="2" style="--d:1100"/>`;
    }).join("");
    container.innerHTML = `<div class="pro-chart-wrap">
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Évolution sur ${labels.length} semaines">
        ${ticks.map((t) => `<line class="pro-grid" x1="${pad.l}" x2="${W - pad.r}" y1="${f(y(t))}" y2="${f(y(t))}"/><text class="pro-axis" x="${pad.l - 8}" y="${f(y(t)) + 4}" text-anchor="end">${fmtInt(t)}</text>`).join("")}
        ${labels.map((l, i) => (i % step === (labels.length - 1) % step ? `<text class="pro-axis" x="${f(x(i))}" y="${H - 8}" text-anchor="middle">${escapeHtml(l)}</text>` : "")).join("")}
        ${paths}
        <line class="pro-cursor" x1="0" x2="0" y1="${pad.t}" y2="${pad.t + ih}" opacity="0"/>
        ${series.map((s, si) => `<circle class="pro-hover-dot" data-s="${si}" r="5" fill="${s.color}" stroke="var(--light-card-bg)" stroke-width="2" opacity="0"/>`).join("")}
        <rect class="pro-hit" x="${pad.l}" y="${pad.t}" width="${iw}" height="${ih}" fill="transparent"/>
      </svg>
      <div class="pro-tip" role="status" hidden></div>
    </div>`;
    if (!first) container.classList.add("pro-no-anim");
    const svg = container.querySelector("svg"), tip = container.querySelector(".pro-tip"), cursor = svg.querySelector(".pro-cursor");
    const dots = [...svg.querySelectorAll(".pro-hover-dot")], hit = svg.querySelector(".pro-hit");
    const show = (clientX) => {
      const rect = svg.getBoundingClientRect(), px = ((clientX - rect.left) / rect.width) * W;
      const i = Math.max(0, Math.min(labels.length - 1, Math.round(((px - pad.l) / iw) * (labels.length - 1))));
      cursor.setAttribute("x1", x(i)); cursor.setAttribute("x2", x(i)); cursor.setAttribute("opacity", ".5");
      dots.forEach((d, si) => { d.setAttribute("cx", x(i)); d.setAttribute("cy", y(series[si].values[i])); d.setAttribute("opacity", "1"); });
      tip.hidden = false;
      tip.innerHTML = `<b>${escapeHtml((tipLabels || labels)[i])}</b>${series.map((s) => `<span><i style="background:${s.color}"></i>${escapeHtml(s.name)} <strong>${s.format ? s.format(s.values[i]) : fmtInt(s.values[i])}</strong></span>`).join("")}`;
      const tw = tip.offsetWidth, left = (x(i) / W) * rect.width;
      tip.style.left = Math.max(4, Math.min(rect.width - tw - 4, left - tw / 2)) + "px";
    };
    const hide = () => { tip.hidden = true; cursor.setAttribute("opacity", "0"); dots.forEach((d) => d.setAttribute("opacity", "0")); };
    hit.addEventListener("pointermove", (e) => show(e.clientX));
    hit.addEventListener("pointerdown", (e) => show(e.clientX));
    hit.addEventListener("pointerleave", hide);
  });
}

// Calendrier de chaleur (comme les contributions GitHub) : une colonne par semaine, une ligne par jour.
export function heatmap(container, dayMap, { onPick } = {}) {
  whenSized(container, (W) => {
    const gap = 3, labelW = 26;
    const weeks = W < 420 ? 15 : 26;
    const cell = Math.max(10, Math.min(20, Math.floor((W - labelW) / weeks) - gap));
    const today = new Date(), start = addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7)), -7 * (weeks - 1));
    const todayKey = dateKey(today);
    const vals = Object.values(dayMap).filter((v) => v > 0).sort((a, b) => a - b);
    const q = (p) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] || 1;
    const lvl = (v) => (!v ? 0 : v <= q(0.25) ? 1 : v <= q(0.5) ? 2 : v <= q(0.75) ? 3 : 4);
    let cells = "", months = "", lastMonth = -1;
    for (let w = 0; w < weeks; w++) {
      const monday = addDays(start, w * 7);
      if (monday.getMonth() !== lastMonth && w < weeks - 1) {
        lastMonth = monday.getMonth();
        months += `<text class="pro-axis" x="${labelW + w * (cell + gap)}" y="10">${new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(monday).replace(".", "")}</text>`;
      }
      for (let d = 0; d < 7; d++) {
        const day = addDays(monday, d), key = dateKey(day);
        if (key > todayKey) continue;
        const v = dayMap[key] || 0;
        cells += `<rect class="pro-cell l${lvl(v)}" x="${labelW + w * (cell + gap)}" y="${16 + d * (cell + gap)}" width="${cell}" height="${cell}" rx="3" data-day="${key}" data-v="${v}" style="--d:${w * 14 + d * 4}"><title>${shortDay(day)} : ${v} message${v > 1 ? "s" : ""}</title></rect>`;
      }
    }
    const H = 16 + 7 * (cell + gap);
    const dayLabels = ["L", "", "M", "", "V", "", "D"].map((l, d) => (l ? `<text class="pro-axis" x="0" y="${16 + d * (cell + gap) + cell - 2}">${l}</text>` : "")).join("");
    container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${labelW + weeks * (cell + gap)}" height="${H}" role="img" aria-label="Activité de prospection, jour par jour">${months}${dayLabels}${cells}</svg>
      <div class="pro-legend"><span>Moins</span>${[0, 1, 2, 3, 4].map((l) => `<i class="pro-cell l${l}"></i>`).join("")}<span>Plus</span></div>`;
    if (onPick) container.querySelectorAll(".pro-cell[data-day]").forEach((c) => c.addEventListener("click", () => onPick(c.dataset.day, Number(c.dataset.v))));
  });
}

// Compteurs qui montent jusqu'à leur valeur, l'un après l'autre (une seule séquence orchestrée).
export function runCounters(root, { start = 250, gap = 70 } = {}) {
  const items = [...root.querySelectorAll("[data-count]")];
  items.forEach((el, i) => {
    const target = Number(el.dataset.count) || 0, dec = Number(el.dataset.dec) || 0, suffix = el.dataset.suffix || "";
    const fmt = (v) => (dec ? v.toFixed(dec).replace(".", ",") : fmtInt(v)) + suffix;
    if (reducedMotion() || !target) { el.textContent = fmt(target); return; }
    el.textContent = fmt(0);
    setTimeout(() => {
      const t0 = performance.now(), dur = 900;
      const tick = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        el.textContent = fmt(target * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, start + i * gap);
  });
  // anneaux
  root.querySelectorAll(".pro-ring-arc").forEach((arc) => {
    const target = arc.dataset.target;
    if (reducedMotion()) { arc.setAttribute("stroke-dashoffset", target); return; }
    setTimeout(() => { arc.style.transition = "stroke-dashoffset 1.2s cubic-bezier(.2,.7,.2,1)"; arc.setAttribute("stroke-dashoffset", target); }, start + 200);
  });
}
