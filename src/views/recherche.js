// Recherche d'entreprises locales (OpenStreetMap) — étape 2.
import { supabase } from "../supabase.js";
import { CATEGORIES } from "../categories.js";

const QUALITY_LABELS = {
  no_site: { label: "Pas de site", cls: "danger" },
  needs_update: { label: "Site à moderniser", cls: "warning" },
  good: { label: "Site correct", cls: "ok" }
};

export function renderRecherche(root) {
  root.innerHTML = `
    <h1 class="page-title">Recherche</h1>
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
  `;

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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
