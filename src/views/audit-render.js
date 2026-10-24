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
