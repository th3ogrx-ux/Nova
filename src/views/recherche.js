// Recherche d'entreprises locales (OpenStreetMap) — étape 2.
import { supabase } from "../supabase.js";
import { CATEGORIES } from "../categories.js";

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
      Trouve des entreprises locales à démarcher, par catégorie et par ville.
    </p>

    <div class="card">
      <form id="search-form" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
        <div class="field" style="flex:1;min-width:200px;margin-bottom:0;">
          <label class="field-label">Catégorie</label>
          <select id="search-category">
            ${CATEGORIES.map((c) => `<option value="${c.value}">${c.label}</option>`).join("")}
          </select>
        </div>
        <div class="field" style="flex:1;min-width:200px;margin-bottom:0;">
          <label class="field-label">Ville</label>
          <input type="text" id="search-city" placeholder="Ex: Lyon" required>
        </div>
        <button type="submit" class="btn primary" id="search-submit" style="margin:0;">Rechercher</button>
      </form>
      <div class="error-msg" id="search-error"></div>
    </div>

    <div id="search-results" style="margin-top:20px;"></div>

    <div class="card" style="margin-top:24px;">
      <div class="panel-title">Prospection automatique</div>
      <p style="color:var(--light-text-dim);font-size:13.5px;margin-bottom:16px;">
        Zenoa Radar cherche pour toi jusqu'à 20 nouvelles entreprises par jour, dans la catégorie et la ville choisies ci-dessous.
      </p>
      <form id="auto-settings-form" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
        <div class="field" style="flex:1;min-width:200px;margin-bottom:0;">
          <label class="field-label">Catégorie</label>
          <select id="auto-category">
            ${CATEGORIES.map((c) => `<option value="${c.value}">${c.label}</option>`).join("")}
          </select>
        </div>
        <div class="field" style="flex:1;min-width:200px;margin-bottom:0;">
          <label class="field-label">Ville</label>
          <input type="text" id="auto-city" placeholder="Ex: Lyon" required>
        </div>
        <button type="submit" class="btn primary btn-sm" id="auto-save" style="margin:0;">Enregistrer</button>
      </form>
      <div class="error-msg" id="auto-settings-error"></div>
      <span id="auto-settings-feedback" style="font-size:12px;color:var(--ok);margin-left:4px;"></span>
    </div>

    <div style="margin-top:24px;">
      <div style="display:flex;gap:8px;margin-bottom:14px;">
        <button type="button" class="btn btn-sm primary" id="tab-en-attente">En attente</button>
        <button type="button" class="btn btn-sm ghost" id="tab-historique">Historique</button>
      </div>
      <div id="leads-list"></div>
    </div>
  `;

  initAutoSettings(root);
  initLeadsTabs(root);

  const form = root.querySelector("#search-form");
  const resultsEl = root.querySelector("#search-results");
  const errorEl = root.querySelector("#search-error");
  const submitBtn = root.querySelector("#search-submit");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const category = root.querySelector("#search-category").value;
    const city = root.querySelector("#search-city").value.trim();
    if (!city) return;

    errorEl.textContent = "";
    submitBtn.disabled = true;
    submitBtn.textContent = "Recherche en cours...";
    resultsEl.innerHTML = `<p style="color:var(--light-text-dim);font-size:13.5px;">Recherche en cours — ça peut prendre quelques secondes (lecture des sites web pour trouver les emails)...</p>`;

    const { data, error } = await supabase.functions.invoke("osm-search", { body: { category, city } });

    submitBtn.disabled = false;
    submitBtn.textContent = "Rechercher";

    if (error) {
      resultsEl.innerHTML = "";
      errorEl.textContent = (data && data.error) || error.message || "La recherche a échoué.";
      return;
    }

    renderResults(resultsEl, data.results || [], category, city);
  });
}

function renderResults(container, results, category, city) {
  if (!results.length) {
    container.innerHTML = `<p style="color:var(--light-text-dim);font-size:13.5px;">Aucune entreprise trouvée pour cette recherche.</p>`;
    return;
  }

  container.innerHTML =
    `<p style="color:var(--light-text-dim);font-size:13px;margin-bottom:12px;">${results.length} résultat${results.length > 1 ? "s" : ""}</p>` +
    results.map((r, i) => resultCardHtml(r, i)).join("");

  results.forEach((r, i) => {
    const btn = container.querySelector(`[data-add-index="${i}"]`);
    if (!btn) return;
    btn.addEventListener("click", () => addToProspects(btn, r, category, city));
  });
}

function resultCardHtml(r, index) {
  const quality = QUALITY_LABELS[r.site_quality] || QUALITY_LABELS.no_site;
  return `
    <div class="card" style="margin-bottom:10px;padding:16px 18px;display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;">
      <div style="flex:1;min-width:220px;">
        <div style="font-weight:700;font-size:14.5px;">${escapeHtml(r.name)}</div>
        ${r.address ? `<div style="font-size:12.5px;color:var(--light-text-dim);margin-top:3px;">${escapeHtml(r.address)}</div>` : ""}
        <div style="font-size:12.5px;color:var(--light-text-dim);margin-top:4px;display:flex;gap:12px;flex-wrap:wrap;">
          ${r.phone ? `<span>📞 ${escapeHtml(r.phone)}</span>` : ""}
          ${r.website ? `<a href="${escapeHtml(r.website)}" target="_blank" rel="noopener" style="color:var(--accent-blue-1);">🔗 Site web</a>` : ""}
          ${r.email ? `<span>✉️ ${escapeHtml(r.email)}</span>` : ""}
        </div>
      </div>
      <span class="status-pill ${quality.cls}">${quality.label}</span>
      <button type="button" class="btn-sm btn blue" data-add-index="${index}" style="margin:0;">+ Ajouter aux prospects</button>
    </div>
  `;
}

async function addToProspects(btn, result, category, city) {
  btn.disabled = true;
  btn.textContent = "Ajout...";

  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("radar_prospects").insert({
    user_id: user.id,
    osm_id: result.osm_id,
    name: result.name,
    address: result.address,
    phone: result.phone,
    website: result.website,
    email: result.email,
    site_quality: result.site_quality,
    lat: result.lat,
    lon: result.lon,
    category,
    city
  });

  if (error) {
    // code 23505 = violation de contrainte unique (déjà ajouté)
    if (error.code === "23505") {
      btn.textContent = "Déjà ajouté";
    } else {
      btn.textContent = "Erreur";
      btn.disabled = false;
    }
    return;
  }

  btn.textContent = "✓ Ajouté";
}

// ---------- Réglages de la prospection automatique ----------
async function initAutoSettings(root) {
  const form = root.querySelector("#auto-settings-form");
  const errorEl = root.querySelector("#auto-settings-error");
  const feedbackEl = root.querySelector("#auto-settings-feedback");
  const categorySelect = root.querySelector("#auto-category");
  const cityInput = root.querySelector("#auto-city");

  const { data: { user } } = await supabase.auth.getUser();
  const { data: settings } = await supabase
    .from("radar_search_settings")
    .select("category, city")
    .eq("user_id", user.id)
    .maybeSingle();

  if (settings) {
    categorySelect.value = settings.category;
    cityInput.value = settings.city;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const category = categorySelect.value;
    const city = cityInput.value.trim();
    errorEl.textContent = "";
    feedbackEl.textContent = "";
    if (!city) return;

    const { error } = await supabase
      .from("radar_search_settings")
      .upsert({ user_id: user.id, category, city, updated_at: new Date().toISOString() });

    if (error) {
      errorEl.textContent = "Erreur : " + error.message;
      return;
    }
    feedbackEl.textContent = "Enregistré ✓ — les prochains prospects arriveront automatiquement.";
  });
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
      : `<p style="color:var(--light-text-dim);font-size:13.5px;">Aucun prospect en attente. Configure la prospection automatique ci-dessus pour que Zenoa Radar t'en propose chaque jour.</p>`;
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
