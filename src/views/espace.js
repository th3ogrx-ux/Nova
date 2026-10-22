// Espace client : tableau de bord de visibilité Google d'un commerce.
// - Client : voit uniquement SON commerce (la base de données filtre).
// - Admin  : "Aperçu client" — choisit un commerce et voit ce que le client verra.
// Lecture seule : aucune modification ici (la saisie des chiffres est côté admin).
import { supabase } from "../supabase.js";
import { getCurrentRole, getCurrentBusinessId } from "../session.js";
import { readCache, writeCache, sameData } from "../data-cache.js";
import {
  escapeHtml, loadEspaceData, summarize, monthLabel, formatDate, formatNumber, formatRating, variation, reviewSeries, statSeries
} from "./espace-data.js";
import { renderReviewsChart, renderCallsChart } from "./espace-charts.js";

// Période des graphiques (6 ou 12 mois), gardée d'une visite à l'autre.
const RANGE_KEY = "zenoa-espace-periode";
let chartRange = (() => { try { return localStorage.getItem(RANGE_KEY) === "12" ? 12 : 6; } catch { return 6; } })();

const STATUS_COLUMNS = [
  { key: "fait", label: "Fait", color: "var(--ok)" },
  { key: "en_cours", label: "En cours", color: "var(--warning)" },
  { key: "a_venir", label: "À venir", color: "var(--light-text-dim)" }
];

const reducedMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function stars(note) {
  return `<span class="espace-stars" role="img" aria-label="${note} sur 5">${"★".repeat(note)}<span class="espace-stars-off">${"★".repeat(5 - note)}</span></span>`;
}

function deltaHtml(current, previous) {
  const pct = variation(current, previous);
  if (pct === null) return `<span class="espace-delta">—</span>`;
  if (pct === 0) return `<span class="espace-delta">= stable</span>`;
  const up = pct > 0;
  return `<span class="espace-delta ${up ? "up" : "down"}">${up ? "▲ +" : "▼ "}${pct} %<span class="espace-delta-note"> vs mois précédent</span></span>`;
}

// Compteur qui monte de 0 à la valeur (désactivé si l'utilisateur limite les animations).
function countUp(el, target, { decimals = 0 } = {}) {
  const fmt = (v) => (decimals ? formatRating(v) : formatNumber(Math.round(v)));
  if (reducedMotion() || !target) { el.textContent = fmt(target); return; }
  const start = performance.now();
  const duration = 700;
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    el.textContent = fmt(target * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function statTile(label, valueHtml, subHtml) {
  return `<div class="card stat-tile espace-tile"><div class="stat-tile-value">${valueHtml}</div><div class="stat-tile-label">${label}</div><div style="margin-top:8px;">${subHtml}</div></div>`;
}

function reviewHtml(r) {
  return `
    <article class="espace-review${r.repondu ? "" : " to-answer"}">
      <div class="espace-review-head">
        ${stars(r.note)}
        <strong>${escapeHtml(r.auteur)}</strong>
        <span class="espace-review-date">${formatDate(r.date)}</span>
        ${r.repondu ? "" : `<span class="status-pill warning" style="margin-left:auto;">En attente de réponse</span>`}
      </div>
      ${r.texte ? `<p class="espace-review-text">${escapeHtml(r.texte)}</p>` : ""}
      ${r.repondu && r.reponse ? `<div class="espace-reply"><span>Réponse du commerce</span>${escapeHtml(r.reponse)}</div>` : ""}
    </article>`;
}

function tasksHtml(tasks) {
  if (!tasks.length) return `<p style="color:var(--light-text-dim);font-size:13.5px;">Aucune tâche prévue ce mois-ci.</p>`;
  return `<div class="espace-tasks">${STATUS_COLUMNS.map((col) => {
    const list = tasks.filter((t) => t.statut === col.key);
    return `
      <div class="espace-task-col">
        <div class="espace-task-head"><span class="crm-dot" style="background:${col.color};"></span>${col.label}<b>${list.length}</b></div>
        ${list.map((t) => `<div class="espace-task">${escapeHtml(t.titre)}</div>`).join("") || `<div class="espace-task empty">—</div>`}
      </div>`;
  }).join("")}</div>`;
}

function reviewRequestHtml(business) {
  const link = business.lien_avis_google && safeHttpUrl(business.lien_avis_google);
  if (!link) {
    return `<p style="color:var(--light-text-dim);font-size:13.5px;">Le lien d'avis Google de ton commerce n'est pas encore renseigné. Contacte Zenoa pour l'ajouter.</p>`;
  }
  return `
    <div class="espace-request">
      <div class="espace-qr-box"><img id="espace-qr" alt="QR code du lien d'avis Google" width="168" height="168"></div>
      <div style="flex:1;min-width:220px;">
        <p style="font-size:13.5px;color:var(--light-text-dim);margin-bottom:12px;">
          Montre ce QR code en caisse ou envoie le lien à tes clients satisfaits : ils laissent un avis en quelques secondes.
        </p>
        <input type="text" readonly id="espace-link" value="${escapeHtml(link)}" aria-label="Lien d'avis Google" style="font-size:13px;margin-bottom:12px;">
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button type="button" class="btn primary btn-sm" id="espace-copy">Copier le lien</button>
          <button type="button" class="btn ghost btn-sm" id="espace-download">Télécharger le QR (PNG)</button>
        </div>
        <div id="espace-copy-msg" style="font-size:12px;color:var(--ok);min-height:16px;margin-top:8px;"></div>
      </div>
    </div>`;
}

// QR code : bibliothèque chargée seulement quand on en a besoin.
async function setupQr(root, business) {
  const link = business.lien_avis_google && safeHttpUrl(business.lien_avis_google);
  const img = root.querySelector("#espace-qr");
  if (!link || !img) return;
  const QRCode = (await import("qrcode")).default;
  const opts = { margin: 2, color: { dark: "#0A0A0B", light: "#FFFFFF" } };
  img.src = await QRCode.toDataURL(link, { ...opts, width: 336 });

  root.querySelector("#espace-copy").addEventListener("click", async () => {
    const msg = root.querySelector("#espace-copy-msg");
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const input = root.querySelector("#espace-link");
      input.select();
      document.execCommand("copy");
    }
    msg.textContent = "Lien copié ✓";
    setTimeout(() => { msg.textContent = ""; }, 2500);
  });

  root.querySelector("#espace-download").addEventListener("click", async () => {
    const png = await QRCode.toDataURL(link, { ...opts, width: 800 });
    const a = document.createElement("a");
    a.href = png;
    a.download = "qr-avis-google-" + (business.nom || "commerce").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".png";
    a.click();
  });
}

function dashboardHtml(data) {
  const { business, reviews, tasks } = data;
  const s = summarize(data);
  const latest = s.latest;
  const subtitle = [business.secteur, business.ville].filter(Boolean).join(" · ");
  const monthTitle = latest ? monthLabel(latest.mois) : null;
  const prev = s.previous;

  return `
    <h1 class="page-title">${escapeHtml(business.nom)}</h1>
    ${subtitle ? `<p style="color:var(--light-text-dim);font-size:14px;margin-bottom:20px;">${escapeHtml(subtitle)}</p>` : ""}

    <div class="stat-grid espace-grid" style="margin-bottom:24px;">
      ${statTile("Note moyenne",
        s.average === null ? "—" : `<span data-count="${s.average}" data-decimals="1">${formatRating(s.average)}</span><span class="espace-star-big"> ★</span>`,
        `<span class="espace-delta">${s.count} avis${s.toAnswerCount ? ` · <b style="color:var(--warning);">${s.toAnswerCount} à répondre</b>` : ""}</span>`)}
      ${latest ? statTile("Appels", `<span data-count="${latest.appels}">${formatNumber(latest.appels)}</span>`, deltaHtml(latest.appels, prev && prev.appels)) : ""}
      ${latest ? statTile("Itinéraires", `<span data-count="${latest.itineraires}">${formatNumber(latest.itineraires)}</span>`, deltaHtml(latest.itineraires, prev && prev.itineraires)) : ""}
      ${latest ? statTile("Vues de la fiche", `<span data-count="${latest.vues_fiche}">${formatNumber(latest.vues_fiche)}</span>`, deltaHtml(latest.vues_fiche, prev && prev.vues_fiche)) : ""}
    </div>
    ${latest
      ? `<p class="espace-month-note">Chiffres de <b>${escapeHtml(monthTitle)}</b></p>`
      : `<p class="espace-month-note">Les premiers chiffres du mois arrivent bientôt.</p>`}

    <div class="espace-range" role="group" aria-label="Période des graphiques">
      <span>Évolution sur</span>
      <button type="button" class="btn btn-sm ${chartRange === 6 ? "primary" : "ghost"}" data-range="6">6 mois</button>
      <button type="button" class="btn btn-sm ${chartRange === 12 ? "primary" : "ghost"}" data-range="12">12 mois</button>
    </div>
    <div class="espace-charts">
      <div class="card espace-card" style="padding:20px;">
        <div class="panel-title">Note et avis</div>
        <div id="espace-chart-reviews" class="espace-chart"></div>
      </div>
      <div class="card espace-card" style="padding:20px;">
        <div class="panel-title">Appels et itinéraires</div>
        <div id="espace-chart-calls" class="espace-chart"></div>
      </div>
    </div>

    <div class="card espace-card" style="padding:20px;margin-bottom:24px;">
      <div class="panel-title">Demander des avis</div>
      ${reviewRequestHtml(business)}
    </div>

    <div class="card espace-card" style="padding:20px;margin-bottom:24px;">
      <div class="panel-title">Tâches ce mois-ci</div>
      ${tasksHtml(tasks)}
    </div>

    <div class="card espace-card" style="padding:20px;">
      <div class="panel-title">Avis (${reviews.length})</div>
      ${reviews.length ? reviews.slice().sort((a, b) => Number(a.repondu) - Number(b.repondu) || b.date.localeCompare(a.date)).map(reviewHtml).join("") : `<p style="color:var(--light-text-dim);font-size:13.5px;">Aucun avis pour l'instant.</p>`}
    </div>
  `;
}

export async function renderEspace(root) {
  const isAdmin = getCurrentRole() === "admin";
  root.innerHTML = `
    <div id="espace-picker"></div>
    <div id="espace-body"><p style="color:var(--light-text-dim);font-size:14px;">Chargement…</p></div>
  `;
  const picker = root.querySelector("#espace-picker");
  const body = root.querySelector("#espace-body");

  // Quel commerce afficher ? Client : le sien. Admin : celui qu'il choisit.
  let businessId = getCurrentBusinessId();
  if (isAdmin) {
    const { data: list, error } = await supabase.from("espace_businesses").select("id, nom, is_example").order("nom");
    if (error || !list || !list.length) {
      body.innerHTML = `
        <h1 class="page-title">Aperçu client</h1>
        <div class="card espace-card" style="padding:20px;"><p style="color:var(--light-text-dim);font-size:14px;">${error
          ? "Impossible de charger les commerces."
          : "Aucun commerce pour l'instant. Colle espace-demo.sql dans Supabase pour voir des exemples."}</p></div>`;
      return;
    }
    const saved = (() => { try { return localStorage.getItem("zenoa-espace-apercu"); } catch { return null; } })();
    businessId = list.some((b) => b.id === saved) ? saved : list[0].id;
    picker.innerHTML = `
      <div class="espace-preview-bar">
        <span>👁 Aperçu client — ce que voit le client, en lecture seule</span>
        <select id="espace-business" aria-label="Commerce affiché">${list.map((b) => `<option value="${b.id}"${b.id === businessId ? " selected" : ""}>${escapeHtml(b.nom)}</option>`).join("")}</select>
      </div>`;
    // "Voir comme le client" depuis la fiche d'un client (page Clients).
    const onPreview = (e) => {
      if (!root.isConnected) { window.removeEventListener("zenoa:preview", onPreview); return; }
      const select = picker.querySelector("#espace-business");
      if (select && [...select.options].some((o) => o.value === e.detail.id)) { select.value = e.detail.id; select.dispatchEvent(new Event("change")); }
    };
    window.addEventListener("zenoa:preview", onPreview);
    picker.querySelector("#espace-business").addEventListener("change", (e) => {
      businessId = e.target.value;
      try { localStorage.setItem("zenoa-espace-apercu", businessId); } catch { /* pas grave */ }
      show();
    });
  }

  if (!businessId) {
    body.innerHTML = `
      <h1 class="page-title">Mon espace</h1>
      <div class="card espace-card" style="padding:20px;"><p style="color:var(--light-text-dim);font-size:14px;">Ton commerce n'est pas encore rattaché à ce compte. Contacte Zenoa.</p></div>`;
    return;
  }

  function drawCharts(data) {
    renderReviewsChart(body.querySelector("#espace-chart-reviews"), reviewSeries(data.reviews, chartRange));
    renderCallsChart(body.querySelector("#espace-chart-calls"), statSeries(data.stats, chartRange));
  }

  // Les graphiques se redessinent quand la largeur change (rotation du
  // téléphone, fenêtre redimensionnée, page qui redevient visible).
  let currentData = null;
  let drawnWidth = 0;
  new ResizeObserver(() => {
    const box = body.querySelector("#espace-chart-reviews");
    if (!currentData || !box) return;
    const w = box.clientWidth;
    if (w > 0 && Math.abs(w - drawnWidth) >= 24) { drawnWidth = w; drawCharts(currentData); }
  }).observe(body);

  function draw(data) {
    currentData = data;
    body.innerHTML = dashboardHtml(data);
    body.querySelectorAll("[data-count]").forEach((el) => countUp(el, Number(el.dataset.count), { decimals: Number(el.dataset.decimals || 0) }));
    drawnWidth = body.querySelector("#espace-chart-reviews").clientWidth;
    drawCharts(data);
    body.querySelectorAll("[data-range]").forEach((btn) => btn.addEventListener("click", () => {
      chartRange = Number(btn.dataset.range);
      try { localStorage.setItem(RANGE_KEY, String(chartRange)); } catch { /* pas grave */ }
      body.querySelectorAll("[data-range]").forEach((b) => {
        b.classList.toggle("primary", b === btn);
        b.classList.toggle("ghost", b !== btn);
      });
      drawCharts(data);
    }));
    setupQr(body, data.business).catch((err) => console.error("[Espace] QR code :", err));
  }

  // Dernières données connues tout de suite, puis données à jour.
  async function show() {
    const id = businessId;
    const cacheKey = "espace:" + id;
    const cached = readCache(cacheKey);
    if (cached) draw(cached);
    try {
      const data = await loadEspaceData(id);
      if (id !== businessId) return; // l'admin a changé de commerce entre-temps
      if (!data.business) throw new Error("commerce introuvable");
      writeCache(cacheKey, data);
      if (!cached || !sameData(cached, data)) draw(data);
    } catch (err) {
      console.error("[Espace]", err);
      if (!cached && id === businessId) body.innerHTML = `<h1 class="page-title">Mon espace</h1><p class="error-msg">Impossible de charger ton espace pour le moment.</p>`;
    }
  }
  await show();
}
