// Zenoa Radar — prospection automatique quotidienne (voir
// supabase/functions/radar-daily). Entièrement automatique : aucune
// recherche à lancer soi-même, aucune catégorie/ville à choisir.
import { supabase } from "../supabase.js";

const QUALITY_LABELS = {
  no_site: { label: "Pas de site", cls: "danger" },
  needs_update: { label: "Site à moderniser", cls: "warning" },
  good: { label: "Site correct", cls: "ok" }
};

const LEAD_STATUS_LABELS = {
  interesse: { label: "Intéressé", cls: "ok" },
  pas_interesse: { label: "Pas intéressé", cls: "danger" }
};

export function renderRecherche(root) {
  root.innerHTML = `
    <h1 class="page-title">Zenoa Radar</h1>
    <p style="color:var(--light-text-dim);font-size:14px;margin-bottom:20px;">
      Chaque jour à minuit, Zenoa Radar te propose automatiquement 50 nouvelles entreprises à démarcher, partout en France.
    </p>

    <div style="margin-top:4px;">
      <div style="display:flex;gap:8px;margin-bottom:14px;">
        <button type="button" class="btn btn-sm primary" id="tab-en-attente">En attente</button>
        <button type="button" class="btn btn-sm ghost" id="tab-historique">Historique</button>
      </div>
      <div id="leads-list"></div>
    </div>
  `;

  initLeadsTabs(root);
}

// ---------- Onglets "En attente" / "Historique" ----------
function initLeadsTabs(root) {
  const tabEnAttente = root.querySelector("#tab-en-attente");
  const tabHistorique = root.querySelector("#tab-historique");
  const listEl = root.querySelector("#leads-list");

  function setActiveTab(tab) {
    tabEnAttente.classList.toggle("primary", tab === "en_attente");
    tabEnAttente.classList.toggle("ghost", tab !== "en_attente");
    tabHistorique.classList.toggle("primary", tab === "historique");
    tabHistorique.classList.toggle("ghost", tab !== "historique");
  }

  async function loadTab(tab) {
    setActiveTab(tab);
    listEl.innerHTML = `<p style="color:var(--light-text-dim);font-size:13.5px;">Chargement...</p>`;

    const { data: { user } } = await supabase.auth.getUser();
    let query = supabase.from("radar_leads").select("*").eq("user_id", user.id);
    query = tab === "historique"
      ? query.in("status", ["interesse", "pas_interesse"]).order("updated_at", { ascending: false })
      : query.eq("status", "en_attente").order("created_at", { ascending: false });

    const { data: leads, error } = await query;
    if (error) {
      listEl.innerHTML = `<p class="error-msg">Erreur : ${escapeHtml(error.message)}</p>`;
      return;
    }

    renderLeads(listEl, leads || [], tab, () => loadTab(tab));
  }

  tabEnAttente.addEventListener("click", () => loadTab("en_attente"));
  tabHistorique.addEventListener("click", () => loadTab("historique"));

  loadTab("en_attente");
}

function renderLeads(container, leads, tab, onChanged) {
  if (!leads.length) {
    container.innerHTML = tab === "historique"
      ? `<p style="color:var(--light-text-dim);font-size:13.5px;">Aucun prospect traité pour l'instant.</p>`
      : `<p style="color:var(--light-text-dim);font-size:13.5px;">Aucun prospect en attente pour l'instant — reviens demain, Zenoa Radar en génère chaque nuit.</p>`;
    return;
  }

  container.innerHTML = leads.map((lead) => leadCardHtml(lead, tab)).join("");

  if (tab === "en_attente") {
    leads.forEach((lead) => {
      const card = container.querySelector(`[data-lead-id="${lead.id}"]`);
      if (!card) return;
      card.querySelector('[data-action="interesse"]').addEventListener("click", (e) => setLeadStatus(e.target, lead.id, "interesse", onChanged));
      card.querySelector('[data-action="pas_interesse"]').addEventListener("click", (e) => setLeadStatus(e.target, lead.id, "pas_interesse", onChanged));
    });
  }
}

function leadCardHtml(lead, tab) {
  const quality = QUALITY_LABELS[lead.site_quality] || QUALITY_LABELS.no_site;
  const statusBadge = tab === "historique" && LEAD_STATUS_LABELS[lead.status]
    ? `<span class="status-pill ${LEAD_STATUS_LABELS[lead.status].cls}">${LEAD_STATUS_LABELS[lead.status].label}</span>`
    : `<span class="status-pill neutral">${quality.label}</span>`;

  return `
    <div class="card" data-lead-id="${lead.id}" style="margin-bottom:10px;padding:16px 18px;display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;">
      <div style="flex:1;min-width:220px;">
        <div style="font-weight:700;font-size:14.5px;">${escapeHtml(lead.name)}</div>
        ${lead.address ? `<div style="font-size:12.5px;color:var(--light-text-dim);margin-top:3px;">${escapeHtml(lead.address)}</div>` : ""}
        <div style="font-size:12.5px;color:var(--light-text-dim);margin-top:4px;display:flex;gap:12px;flex-wrap:wrap;">
          ${lead.phone ? `<span>📞 ${escapeHtml(lead.phone)}</span>` : ""}
          ${lead.website ? `<a href="${escapeHtml(lead.website)}" target="_blank" rel="noopener" style="color:var(--accent-blue-1);">🔗 Site web</a>` : ""}
          ${lead.email ? `<span>✉️ ${escapeHtml(lead.email)}</span>` : ""}
        </div>
      </div>
      ${statusBadge}
      ${tab === "en_attente" ? `
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn-sm btn primary" data-action="interesse">Intéressé</button>
          <button type="button" class="btn-sm btn ghost" data-action="pas_interesse">Pas intéressé</button>
        </div>
      ` : ""}
    </div>
  `;
}

async function setLeadStatus(btn, leadId, status, onChanged) {
  btn.disabled = true;
  const { error } = await supabase
    .from("radar_leads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", leadId);

  if (error) {
    btn.disabled = false;
    return;
  }
  onChanged();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
