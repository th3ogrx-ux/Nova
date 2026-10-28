// Espace mannequin : réseaux sociaux, calendrier de contenu, collaborations et partenaires.
// - Mannequin : voit uniquement SON espace (la base de données filtre).
// - Admin     : "Aperçu mannequin" — choisit un mannequin et voit ce qu'il verra.
// - Partenaire : voit son propre espace (voir espace-partner.js).
// Lecture seule : aucune modification ici (la saisie se fait côté admin).
import { supabase } from "../supabase.js";
import { getCurrentRole, getCurrentBusinessId } from "../session.js";
import { readCache, writeCache, sameData } from "../data-cache.js";
import { escapeHtml, loadEspaceData, reseauxOf } from "./espace-data.js";
import { socialHtml, drawSocialCharts, calendarHtml, collabsHtml, partnersHtml } from "./espace-social.js";

// Période des graphiques (6 ou 12 mois), gardée d'une visite à l'autre.
const RANGE_KEY = "zenoa-espace-periode";
let chartRange = (() => { try { return localStorage.getItem(RANGE_KEY) === "12" ? 12 : 6; } catch { return 6; } })();

const STATUS_COLUMNS = [
  { key: "fait", label: "Fait", color: "var(--ok)" },
  { key: "en_cours", label: "En cours", color: "var(--warning)" },
  { key: "a_venir", label: "À venir", color: "var(--light-text-dim)" }
];

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

function dashboardHtml(data) {
  const { business, tasks } = data;
  const subtitle = [business.ville].filter(Boolean).join(" · ");
  const rangeHtml = `<div class="espace-range" role="group" aria-label="Période des graphiques">
      <span>Évolution sur</span>
      <button type="button" class="btn btn-sm ${chartRange === 6 ? "primary" : "ghost"}" data-range="6">6 mois</button>
      <button type="button" class="btn btn-sm ${chartRange === 12 ? "primary" : "ghost"}" data-range="12">12 mois</button>
    </div>`;
  return `
    <h1 class="page-title">${escapeHtml(business.nom)}</h1>
    ${subtitle ? `<p style="color:var(--light-text-dim);font-size:14px;margin-bottom:20px;">${escapeHtml(subtitle)}</p>` : ""}
    ${reseauxOf(business).length ? socialHtml(data, rangeHtml) : ""}
    ${calendarHtml(data)}
    ${collabsHtml(data)}
    ${partnersHtml(data)}
    <div class="card espace-card" style="padding:20px;margin-bottom:24px;">
      <div class="panel-title">Tâches ce mois-ci</div>
      ${tasksHtml(tasks)}
    </div>`;
}

export async function renderEspace(root) {
  const role = getCurrentRole();
  if (role === "partner") {
    const m = await import("./espace-partner.js");
    return m.renderPartnerSpace(root);
  }
  const isAdmin = role === "admin";
  root.innerHTML = `
    <div id="espace-picker"></div>
    <div id="espace-body"><p style="color:var(--light-text-dim);font-size:14px;">Chargement…</p></div>
  `;
  const picker = root.querySelector("#espace-picker");
  const body = root.querySelector("#espace-body");

  // Quel mannequin afficher ? Mannequin : le sien. Admin : celui qu'il choisit.
  let businessId = getCurrentBusinessId();
  if (isAdmin) {
    const { data: list, error } = await supabase.from("espace_businesses").select("id, nom, is_example").order("nom");
    if (error || !list || !list.length) {
      body.innerHTML = `
        <h1 class="page-title">Aperçu mannequin</h1>
        <div class="card espace-card" style="padding:20px;"><p style="color:var(--light-text-dim);font-size:14px;">${error
          ? "Impossible de charger les mannequins."
          : "Aucun mannequin pour l'instant. Crée-en un dans la page Mannequins."}</p></div>`;
      return;
    }
    const saved = (() => { try { return localStorage.getItem("zenoa-espace-apercu"); } catch { return null; } })();
    businessId = list.some((b) => b.id === saved) ? saved : list[0].id;
    picker.innerHTML = `
      <div class="espace-preview-bar">
        <span>👁 Aperçu mannequin — ce que voit le mannequin, en lecture seule</span>
        <select id="espace-business" aria-label="Mannequin affiché">${list.map((b) => `<option value="${b.id}"${b.id === businessId ? " selected" : ""}>${escapeHtml(b.nom)}</option>`).join("")}</select>
      </div>`;
    // "Voir comme le mannequin" depuis sa fiche (page Mannequins).
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
      <div class="card espace-card" style="padding:20px;"><p style="color:var(--light-text-dim);font-size:14px;">Ton espace n'est pas encore rattaché à ce compte. Contacte Zenoa.</p></div>`;
    return;
  }

  // Les graphiques se redessinent quand la largeur change (rotation du téléphone, fenêtre redimensionnée).
  let currentData = null;
  let drawnWidth = 0;
  new ResizeObserver(() => {
    const box = body.querySelector(".espace-chart");
    if (!currentData || !box) return;
    const w = box.clientWidth;
    if (w > 0 && Math.abs(w - drawnWidth) >= 24) { drawnWidth = w; drawSocialCharts(body, currentData, chartRange); }
  }).observe(body);

  function draw(data) {
    currentData = data;
    body.innerHTML = dashboardHtml(data);
    const firstChart = body.querySelector(".espace-chart"); drawnWidth = firstChart ? firstChart.clientWidth : 0;
    drawSocialCharts(body, data, chartRange);
    body.querySelectorAll("[data-range]").forEach((btn) => btn.addEventListener("click", () => {
      chartRange = Number(btn.dataset.range);
      try { localStorage.setItem(RANGE_KEY, String(chartRange)); } catch { /* pas grave */ }
      body.querySelectorAll("[data-range]").forEach((b) => { b.classList.toggle("primary", b === btn); b.classList.toggle("ghost", b !== btn); });
      drawSocialCharts(body, data, chartRange);
    }));
  }

  // Dernières données connues tout de suite, puis données à jour.
  async function show() {
    const id = businessId;
    const cacheKey = "espace2:" + id;
    const cached = readCache(cacheKey);
    if (cached) draw(cached);
    try {
      const data = await loadEspaceData(id);
      if (id !== businessId) return; // l'admin a changé de mannequin entre-temps
      if (!data.business) throw new Error("mannequin introuvable");
      writeCache(cacheKey, data);
      if (!cached || !sameData(cached, data)) draw(data);
    } catch (err) {
      console.error("[Espace]", err);
      if (!cached && id === businessId) body.innerHTML = `<h1 class="page-title">Mon espace</h1><p class="error-msg">Impossible de charger ton espace pour le moment.</p>`;
    }
  }
  await show();
}
