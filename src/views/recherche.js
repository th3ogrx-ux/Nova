// Zenoa Radar — prospection automatique quotidienne. À la première
// ouverture de la journée, les prospects du jour sont générés (voir
// src/radar-generate.js) : aucune recherche à lancer soi-même.
import { supabase } from "../supabase.js";
import { generateTodayLeadsIfNeeded } from "../radar-generate.js";

const QUALITY_LABELS = {
  no_site: { label: "Pas de site", cls: "danger" },
  needs_update: { label: "Site à moderniser", cls: "warning" },
  good: { label: "Site correct", cls: "ok" }
};

// Parcours d'un prospect : "en_attente" (à contacter) -> bouton
// "Contacté" -> Historique, où l'on indique "interesse" ou
// "pas_interesse" (modifiable ; "contacte" = pas encore tranché).
const HISTORY_STATUSES = ["contacte", "interesse", "pas_interesse"];

export function renderRecherche(root) {
  root.innerHTML = `
    <h1 class="page-title">Zenoa Radar</h1>

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

  let generationNotice = "";

  async function loadTab(tab, { generate = false } = {}) {
    setActiveTab(tab);
    listEl.innerHTML = `<p style="color:var(--light-text-dim);font-size:13.5px;">Chargement...</p>`;

    const { data: { user } } = await supabase.auth.getUser();

    if (generate) {
      try {
        await generateTodayLeadsIfNeeded(user.id, (message) => {
          listEl.innerHTML = `<p style="color:var(--light-text-dim);font-size:13.5px;">${escapeHtml(message)}</p>`;
        });
      } catch (err) {
        generationNotice = `<p class="error-msg" style="margin-bottom:12px;">${escapeHtml(err.message)}</p>`;
      }
    }

    let query = supabase.from("radar_leads").select("*").eq("user_id", user.id);
    query = tab === "historique"
      ? query.in("status", HISTORY_STATUSES).order("updated_at", { ascending: false })
      : query.eq("status", "en_attente").order("created_at", { ascending: false });

    const { data: leads, error } = await query;
    if (error) {
      listEl.innerHTML = `<p class="error-msg">Erreur : ${escapeHtml(error.message)}</p>`;
      return;
    }

    renderLeads(listEl, leads || [], tab, () => loadTab(tab));
    if (tab === "en_attente" && generationNotice) listEl.insertAdjacentHTML("afterbegin", generationNotice);
  }

  tabEnAttente.addEventListener("click", () => loadTab("en_attente"));
  tabHistorique.addEventListener("click", () => loadTab("historique"));

  loadTab("en_attente", { generate: true });
}

function renderLeads(container, leads, tab, onChanged) {
  if (!leads.length) {
    container.innerHTML = tab === "historique"
      ? `<p style="color:var(--light-text-dim);font-size:13.5px;">Aucun prospect contacté pour l'instant.</p>`
      : `<p style="color:var(--light-text-dim);font-size:13.5px;">Aucun prospect en attente — de nouvelles entreprises arrivent chaque jour à ta première visite.</p>`;
    return;
  }

  container.innerHTML = leads.map((lead) => leadCardHtml(lead, tab)).join("");

  leads.forEach((lead) => {
    const card = container.querySelector(`[data-lead-id="${lead.id}"]`);
    if (!card) return;
    card.querySelectorAll("[data-status]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.status !== lead.status) setLeadStatus(btn, lead.id, btn.dataset.status, onChanged);
      });
    });
  });
}

function leadCardHtml(lead, tab) {
  const quality = QUALITY_LABELS[lead.site_quality] || QUALITY_LABELS.no_site;
  const actions = tab === "en_attente"
    ? `<button type="button" class="btn-sm btn primary" data-status="contacte">Contacté</button>`
    : `<button type="button" class="btn-sm btn ${lead.status === "interesse" ? "primary" : "ghost"}" data-status="interesse">Intéressé</button>
       <button type="button" class="btn-sm btn ${lead.status === "pas_interesse" ? "danger" : "ghost"}" data-status="pas_interesse">Pas intéressé</button>`;

  return `
    <div class="card" data-lead-id="${lead.id}" style="margin-bottom:10px;padding:16px 18px;display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;">
      <div style="flex:1;min-width:220px;">
        <div style="font-weight:700;font-size:14.5px;">${escapeHtml(lead.name)}</div>
        <div style="font-size:12.5px;color:var(--light-text-dim);margin-top:4px;display:flex;gap:12px;flex-wrap:wrap;">
          ${lead.phone ? `<span style="color:var(--ok);font-weight:600;">📞 ${escapeHtml(lead.phone)}</span>` : ""}
          ${lead.website ? `<a href="${escapeHtml(lead.website)}" target="_blank" rel="noopener" style="color:var(--accent-blue-1);">🔗 Site web</a>` : ""}
          ${lead.email ? `<span style="color:var(--accent-blue-2);font-weight:600;">✉️ ${escapeHtml(lead.email)}</span>` : ""}
        </div>
      </div>
      <span class="status-pill neutral">${quality.label}</span>
      <div style="display:flex;gap:8px;">${actions}</div>
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
