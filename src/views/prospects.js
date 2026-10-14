// Mini CRM prospects — étape 3.
import { supabase } from "../supabase.js";

const STATUS_META = {
  a_contacter: { label: "À contacter", cls: "neutral" },
  contacte: { label: "Contacté", cls: "blue" },
  veut_maquette: { label: "Veut une maquette", cls: "purple" },
  maquette_envoyee: { label: "Maquette envoyée", cls: "warning" },
  client: { label: "Client", cls: "ok" },
  pas_interesse: { label: "Pas intéressé", cls: "danger" }
};

let allProspects = [];
let expandedId = null;

export async function renderProspects(root) {
  root.innerHTML = `
    <h1 class="page-title">Prospects</h1>

    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
        <div class="field" style="margin-bottom:0;min-width:160px;">
          <label class="field-label">Statut</label>
          <select id="filter-status">
            <option value="">Tous</option>
            ${Object.entries(STATUS_META).map(([v, m]) => `<option value="${v}">${m.label}</option>`).join("")}
          </select>
        </div>
        <div class="field" style="margin-bottom:0;min-width:140px;">
          <label class="field-label">Ville</label>
          <input type="text" id="filter-city" placeholder="Toutes">
        </div>
        <div class="field" style="margin-bottom:0;min-width:160px;">
          <label class="field-label">Catégorie</label>
          <select id="filter-category"><option value="">Toutes</option></select>
        </div>
        <button type="button" class="btn ghost btn-sm" id="filter-reset" style="margin:0;">Réinitialiser</button>
        <button type="button" class="btn blue btn-sm" id="export-csv" style="margin:0 0 0 auto;">Exporter en CSV</button>
      </div>
    </div>

    <div id="followup-banner"></div>
    <div id="prospects-list"></div>
  `;

  const { data, error } = await supabase
    .from("radar_prospects")
    .select("*")
    .order("next_followup_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    root.querySelector("#prospects-list").innerHTML = `<p class="error-msg">Impossible de charger les prospects : ${error.message}</p>`;
    return;
  }

  allProspects = data || [];
  populateCategoryFilter(root);
  wireFilters(root);
  applyFiltersAndRender(root);
}

function populateCategoryFilter(root) {
  const categories = [...new Set(allProspects.map((p) => p.category).filter(Boolean))].sort();
  const select = root.querySelector("#filter-category");
  categories.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  });
}

function wireFilters(root) {
  root.querySelector("#filter-status").addEventListener("change", () => applyFiltersAndRender(root));
  root.querySelector("#filter-city").addEventListener("input", () => applyFiltersAndRender(root));
  root.querySelector("#filter-category").addEventListener("change", () => applyFiltersAndRender(root));
  root.querySelector("#filter-reset").addEventListener("click", () => {
    root.querySelector("#filter-status").value = "";
    root.querySelector("#filter-city").value = "";
    root.querySelector("#filter-category").value = "";
    applyFiltersAndRender(root);
  });
  root.querySelector("#export-csv").addEventListener("click", () => exportCsv(getFiltered(root)));
}

function getFiltered(root) {
  const status = root.querySelector("#filter-status").value;
  const city = root.querySelector("#filter-city").value.trim().toLowerCase();
  const category = root.querySelector("#filter-category").value;
  return allProspects.filter((p) => {
    if (status && p.status !== status) return false;
    if (city && !(p.city || "").toLowerCase().includes(city)) return false;
    if (category && p.category !== category) return false;
    return true;
  });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function applyFiltersAndRender(root) {
  const filtered = getFiltered(root);
  const today = todayStr();
  const dueToday = allProspects.filter((p) => p.next_followup_date && p.next_followup_date <= today);

  const banner = root.querySelector("#followup-banner");
  banner.innerHTML = dueToday.length
    ? `<div class="card" style="margin-bottom:16px;border-color:rgba(246,146,61,.4);background:rgba(246,146,61,.06);">
         <strong style="color:var(--warning);">⏰ ${dueToday.length} relance${dueToday.length > 1 ? "s" : ""} à faire aujourd'hui ou en retard</strong>
       </div>`
    : "";

  const listEl = root.querySelector("#prospects-list");
  if (!filtered.length) {
    listEl.innerHTML = `<p style="color:var(--light-text-dim);font-size:13.5px;">Aucun prospect pour ces filtres.</p>`;
    return;
  }

  listEl.innerHTML = filtered.map((p) => rowHtml(p, today)).join("");
  filtered.forEach((p) => wireRow(root, p));
}

function rowHtml(p, today) {
  const meta = STATUS_META[p.status] || STATUS_META.a_contacter;
  const isLate = p.next_followup_date && p.next_followup_date <= today;
  const expanded = expandedId === p.id;

  return `
    <div class="card" style="margin-bottom:10px;padding:16px 18px;" data-prospect-id="${p.id}">
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;cursor:pointer;" class="prospect-row-head">
        <div style="flex:1;min-width:200px;">
          <div style="font-weight:700;font-size:14.5px;">${escapeHtml(p.name)}</div>
          <div style="font-size:12px;color:var(--light-text-dim);margin-top:2px;">
            ${escapeHtml(p.city || "")}${p.category ? " · " + escapeHtml(p.category) : ""}
          </div>
        </div>
        ${p.next_followup_date ? `<span class="status-pill ${isLate ? "danger" : "neutral"}">Relance ${formatDate(p.next_followup_date)}</span>` : ""}
        <select class="prospect-status-select" data-id="${p.id}" style="width:auto;padding:6px 10px;font-size:12.5px;">
          ${Object.entries(STATUS_META).map(([v, m]) => `<option value="${v}" ${v === p.status ? "selected" : ""}>${m.label}</option>`).join("")}
        </select>
      </div>
      <div class="prospect-detail" style="margin-top:${expanded ? "14px" : "0"};display:${expanded ? "block" : "none"};border-top:1px solid var(--light-border);padding-top:14px;">
        <div style="font-size:12.5px;color:var(--light-text-dim);margin-bottom:10px;display:flex;gap:16px;flex-wrap:wrap;">
          ${p.phone ? `<span>📞 ${escapeHtml(p.phone)}</span>` : ""}
          ${p.website ? `<a href="${escapeHtml(p.website)}" target="_blank" rel="noopener" style="color:var(--accent-blue-1);">🔗 Site</a>` : ""}
          ${p.email ? `<span>✉️ ${escapeHtml(p.email)}</span>` : ""}
        </div>
        <div class="field">
          <label class="field-label">Date de relance</label>
          <input type="date" class="prospect-followup-input" data-id="${p.id}" value="${p.next_followup_date || ""}">
        </div>
        <div class="field">
          <label class="field-label">Notes</label>
          <textarea class="prospect-notes-input" data-id="${p.id}" rows="3" placeholder="Notes sur ce prospect...">${escapeHtml(p.notes || "")}</textarea>
        </div>
        <button type="button" class="btn primary btn-sm prospect-save-btn" data-id="${p.id}">Enregistrer</button>
        <span class="prospect-save-feedback" data-id="${p.id}" style="font-size:12px;color:var(--ok);margin-left:10px;"></span>
      </div>
    </div>
  `;
}

function wireRow(root, p) {
  const card = root.querySelector(`[data-prospect-id="${p.id}"]`);
  if (!card) return;

  card.querySelector(".prospect-row-head").addEventListener("click", () => {
    expandedId = expandedId === p.id ? null : p.id;
    applyFiltersAndRender(root);
  });

  card.querySelector(".prospect-status-select").addEventListener("click", (e) => e.stopPropagation());
  card.querySelector(".prospect-status-select").addEventListener("change", async (e) => {
    const newStatus = e.target.value;
    await supabase.from("radar_prospects").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", p.id);
    p.status = newStatus;
    applyFiltersAndRender(root);
  });

  const saveBtn = card.querySelector(".prospect-save-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const followup = card.querySelector(".prospect-followup-input").value || null;
      const notes = card.querySelector(".prospect-notes-input").value;
      const feedback = card.querySelector(".prospect-save-feedback");
      saveBtn.disabled = true;
      const { error } = await supabase
        .from("radar_prospects")
        .update({ next_followup_date: followup, notes, updated_at: new Date().toISOString() })
        .eq("id", p.id);
      saveBtn.disabled = false;
      if (error) {
        feedback.style.color = "var(--danger)";
        feedback.textContent = "Erreur lors de l'enregistrement.";
        return;
      }
      p.next_followup_date = followup;
      p.notes = notes;
      feedback.style.color = "var(--ok)";
      feedback.textContent = "Enregistré ✓";
      setTimeout(() => applyFiltersAndRender(root), 600);
    });
  }

  const detail = card.querySelector(".prospect-detail");
  if (detail) detail.addEventListener("click", (e) => e.stopPropagation());
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function exportCsv(rows) {
  const headers = ["Nom", "Adresse", "Téléphone", "Email", "Site web", "Ville", "Catégorie", "Statut", "Relance", "Notes"];
  const lines = [headers.join(";")];
  rows.forEach((p) => {
    const meta = STATUS_META[p.status] || STATUS_META.a_contacter;
    const cells = [
      p.name, p.address, p.phone, p.email, p.website, p.city, p.category,
      meta.label, p.next_followup_date, p.notes
    ].map((v) => `"${String(v || "").replace(/"/g, '""')}"`);
    lines.push(cells.join(";"));
  });

  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "prospects-zenoa-radar.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
