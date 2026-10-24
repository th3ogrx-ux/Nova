// Audits : affichage d'un audit (aperçu et page publique). Rien ici ne dépend de l'éditeur.
import { escapeHtml } from "./pro-data.js";

const e = escapeHtml;
export const safeUrl = (url) => { try { const u = new URL(String(url || "").trim()); return /^https?:$/.test(u.protocol) ? u.href : ""; } catch { return ""; } };

// Texte riche : seules quelques balises passent, aucun attribut sauf href (http/https/mailto) sur les liens.
const ALLOWED = new Set(["B", "STRONG", "I", "EM", "U", "BR", "P", "UL", "OL", "LI", "A", "H3", "DIV", "SPAN"]);
export function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(`<body>${html || ""}</body>`, "text/html");
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) return;
      if (child.nodeType !== 1) { child.remove(); return; }
      if (!ALLOWED.has(child.tagName)) {
        if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|SVG|MATH|TEMPLATE)$/i.test(child.tagName)) { child.remove(); return; }
        walk(child); child.replaceWith(...child.childNodes); return;
      }
      const href = child.tagName === "A" ? child.getAttribute("href") : null;
      [...child.attributes].forEach((a) => child.removeAttribute(a.name));
      if (child.tagName === "A") {
        const ok = href && (/^mailto:/i.test(href) || safeUrl(href));
        if (ok) { child.setAttribute("href", /^mailto:/i.test(href) ? href : safeUrl(href)); child.setAttribute("target", "_blank"); child.setAttribute("rel", "noopener noreferrer"); }
      }
      walk(child);
    });
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

export const PRIORITIES = { high: "Haute", medium: "Moyenne", low: "Basse" };

// Les blocs : chacun sait s'afficher. u(chemin) donne l'adresse d'une image.
const RENDER = {
  title: (b) => `<h2 class="pub-h2" data-toc="${e(b.text)}">${e(b.text)}</h2>${b.sub ? `<p class="pub-sub">${e(b.sub)}</p>` : ""}`,
  text: (b) => `<div class="pub-text">${sanitizeHtml(b.html)}</div>`,
  image: (b, u) => b.path ? `<figure class="pub-fig"><img src="${e(u(b.path))}" alt="${e(b.caption || "")}" loading="lazy">${b.caption ? `<figcaption>${e(b.caption)}</figcaption>` : ""}</figure>` : "",
  table: (b) => {
    const rows = Array.isArray(b.rows) ? b.rows : [];
    if (!rows.length) return "";
    const head = b.header !== false;
    return `<div class="pub-table-wrap"><table class="pub-table">${rows.map((r, i) => `<tr>${r.map((c) => (head && i === 0) ? `<th>${e(c)}</th>` : `<td>${e(c)}</td>`).join("")}</tr>`).join("")}</table></div>`;
  },
  recos: (b) => `<ul class="pub-recos">${(b.items || []).filter((i) => i.text).map((i) => `<li class="pub-reco ${e(i.priority || "medium")}"><span class="pub-prio">${PRIORITIES[i.priority] || "Moyenne"}</span><span>${e(i.text)}</span></li>`).join("")}</ul>`,
  quote: (b) => b.style === "callout"
    ? `<div class="pub-callout">${e(b.text).replace(/\n/g, "<br>")}</div>`
    : `<blockquote class="pub-quote"><p>${e(b.text).replace(/\n/g, "<br>")}</p>${b.author ? `<cite>${e(b.author)}</cite>` : ""}</blockquote>`,
  separator: () => `<hr class="pub-sep">`,
  cta: (b) => { const href = safeUrl(b.url); return b.label && href ? `<p class="pub-cta"><a class="pub-btn" href="${e(href)}" target="_blank" rel="noopener noreferrer">${e(b.label)}</a></p>` : ""; }
};

// ---- blocs avancés ----
export function videoEmbed(url) {
  const href = safeUrl(url); if (!href) return "";
  const u = new URL(href), host = u.hostname.replace(/^www\./, "");
  let id = "";
  if (host === "loom.com") { const m = u.pathname.match(/^\/(?:share|embed)\/([A-Za-z0-9]{10,64})/); if (m) return `https://www.loom.com/embed/${m[1]}`; }
  if (host === "youtu.be") id = u.pathname.slice(1);
  else if (host === "youtube.com" || host === "m.youtube.com") id = u.searchParams.get("v") || (u.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/) || [])[1] || "";
  return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : "";
}
const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
export function gaugeSvg(value) {
  const v = Math.max(0, Math.min(100, num(value)));
  const color = v < 40 ? "var(--danger)" : v < 70 ? "var(--warning)" : "var(--ok)";
  const r = 80, len = Math.PI * r;
  return `<svg class="pub-gauge" viewBox="0 0 200 118" role="img" aria-label="Score ${Math.round(v)} sur 100"><path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--p-line)" stroke-width="16" stroke-linecap="round"/><path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="${color}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${(len * v / 100).toFixed(1)} ${len.toFixed(1)}"/><text x="100" y="94" text-anchor="middle" class="pub-gauge-n">${Math.round(v)}</text><text x="100" y="112" text-anchor="middle" class="pub-gauge-s">/ 100</text></svg>`;
}
export function chartSvg(b) {
  const pts = (b.points || []).filter((p) => p && (p.label || p.value !== "" && p.value != null)).slice(0, 14).map((p) => ({ label: String(p.label || ""), value: num(p.value) }));
  if (!pts.length) return "";
  const W = 560, H = 240, L = 40, R = 12, T = 14, B = 44, max = Math.max(...pts.map((p) => p.value), 1) * 1.1, min = 0;
  const x = (i) => L + (pts.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (pts.length - 1));
  const y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min));
  const grid = [0, .5, 1].map((f) => { const v = max * f, yy = y(v); return `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" class="pub-grid"/><text x="${L - 6}" y="${yy + 4}" text-anchor="end" class="pub-axis">${Math.round(v * 10) / 10}</text>`; }).join("");
  let marks;
  if (b.kind === "line") {
    const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
    marks = `<path d="${d}" fill="none" stroke="var(--warm-1)" stroke-width="3" stroke-linejoin="round"/>` + pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="4.5" fill="var(--warm-1)"><title>${e(p.label)} : ${p.value}</title></circle>`).join("");
  } else {
    const bw = Math.min(46, (W - L - R) / pts.length * 0.62), step = (W - L - R) / pts.length;
    marks = pts.map((p, i) => { const cx = L + step * (i + 0.5), top = y(p.value); return `<rect x="${(cx - bw / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${(y(0) - top).toFixed(1)}" rx="4" fill="var(--warm-1)"><title>${e(p.label)} : ${p.value}</title></rect>`; }).join("");
    pts.forEach((p, i) => { p.cx = L + step * (i + 0.5); });
  }
  const labels = pts.map((p, i) => `<text x="${(p.cx ?? x(i)).toFixed(1)}" y="${H - 22}" text-anchor="middle" class="pub-axis">${e(p.label.slice(0, 12))}</text>`).join("");
  return `<svg class="pub-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${e(b.title || "Graphique")}">${grid}${marks}${labels}</svg>`;
}
Object.assign(RENDER, {
  gallery: (b, u) => { const items = (b.items || []).filter((i) => i && i.path); return items.length ? `<div class="pub-gallery">${items.map((i) => `<figure class="pub-fig"><img src="${e(u(i.path))}" alt="${e(i.caption || "")}" loading="lazy">${i.caption ? `<figcaption>${e(i.caption)}</figcaption>` : ""}</figure>`).join("")}</div>` : ""; },
  annotated: (b, u) => {
    if (!b.path) return "";
    const notes = (b.notes || []).filter((n) => n);
    return `<figure class="pub-fig pub-annot"><div class="pub-annot-img"><img src="${e(u(b.path))}" alt="${e(b.caption || "Capture annotée")}" loading="lazy">${notes.map((n, i) => `<span class="pub-pin" style="left:${Math.max(0, Math.min(100, num(n.x)))}%;top:${Math.max(0, Math.min(100, num(n.y)))}%">${i + 1}</span>`).join("")}</div>${b.caption ? `<figcaption>${e(b.caption)}</figcaption>` : ""}${notes.length ? `<ol class="pub-annot-list">${notes.map((n) => `<li>${e(n.text)}</li>`).join("")}</ol>` : ""}</figure>`;
  },
  score: (b) => `<div class="pub-score">${gaugeSvg(b.value)}<div><strong>${e(b.label || "Score")}</strong>${b.comment ? `<p>${e(b.comment)}</p>` : ""}</div></div>`,
  chart: (b) => { const svg = chartSvg(b); return svg ? `<figure class="pub-fig">${b.title ? `<figcaption class="pub-chart-title">${e(b.title)}</figcaption>` : ""}${svg}</figure>` : ""; },
  video: (b) => { const src = videoEmbed(b.url); return src ? `<figure class="pub-fig"><div class="pub-video"><iframe src="${e(src)}" title="${e(b.caption || "Vidéo")}" loading="lazy" allowfullscreen referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"></iframe></div>${b.caption ? `<figcaption>${e(b.caption)}</figcaption>` : ""}</figure>` : ""; }
});

export const renderBlock = (b, u) => (RENDER[b.type] ? RENDER[b.type](b, u) : "");
export const extendRenderers = (more) => Object.assign(RENDER, more);

export function collectImagePaths(audit) {
  const paths = new Set();
  const add = (p) => { if (p) paths.add(p); };
  add(audit.cover_path); add(audit.logo_path);
  ((audit.content && audit.content.pages) || []).forEach((pg) => (pg.blocks || []).forEach((b) => {
    add(b.path); (b.items || []).forEach((i) => add(i && i.path));
  }));
  return [...paths];
}

// Page complète : en-tête (logo agence, couverture, titre, client), sommaire automatique, une section par page.
export function renderAuditHtml(audit, urlOf, { agencyName = "Zenoa Agency" } = {}) {
  const u = (p) => urlOf(p) || "";
  const pages = ((audit.content && audit.content.pages) || []).filter((p) => p);
  const toc = pages.map((pg, i) => {
    const subs = (pg.blocks || []).filter((b) => b.type === "title" && b.text).map((b) => b.text);
    return `<li><a href="#sec-${i}">${e(pg.title || "Page " + (i + 1))}</a>${subs.length ? `<ul>${subs.map((s) => `<li>${e(s)}</li>`).join("")}</ul>` : ""}</li>`;
  }).join("");
  return `
    <header class="pub-head">
      ${audit.cover_path ? `<div class="pub-cover" style="background-image:url('${e(u(audit.cover_path)).replace(/'/g, "%27")}')"></div>` : ""}
      <div class="pub-head-in">
        <div class="pub-brand"><span class="pub-brand-name">${e(agencyName)}</span>${audit.logo_path ? `<img class="pub-client-logo" src="${e(u(audit.logo_path))}" alt="">` : ""}</div>
        <h1 class="pub-title">${e(audit.title)}</h1>
        ${audit.client_name ? `<p class="pub-for">Audit réalisé pour <strong>${e(audit.client_name)}</strong></p>` : ""}
      </div>
    </header>
    <div class="pub-layout">
      ${pages.length > 1 || pages.some((p) => (p.blocks || []).some((b) => b.type === "title")) ? `<nav class="pub-toc" aria-label="Sommaire"><h2>Sommaire</h2><ol>${toc}</ol></nav>` : ""}
      <main class="pub-main">
        ${pages.map((pg, i) => `<section class="pub-section" id="sec-${i}">${pages.length > 1 ? `<h2 class="pub-page-title">${e(pg.title || "Page " + (i + 1))}</h2>` : ""}${(pg.blocks || []).map((b) => `<div class="pub-block">${renderBlock(b, u)}</div>`).join("")}</section>`).join("")}
      </main>
    </div>
    <footer class="pub-foot">${e(agencyName)}</footer>`;
}
