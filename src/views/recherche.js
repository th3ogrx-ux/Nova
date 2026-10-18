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

  return initLeadsTabs(root);
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

  return loadTab("en_attente", { generate: true });
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
    const note = tab === "historique" ? wireNote(card, lead) : null;
    card.querySelectorAll("[data-status]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (btn.dataset.status === lead.status) return;
        // La liste est rechargée après le changement de statut : on
        // enregistre d'abord une note en cours de frappe pour ne pas la perdre.
        if (note) await note.flush();
        setLeadStatus(btn, lead.id, btn.dataset.status, onChanged);
      });
    });
  });
}

// Note libre sous une fiche de l'Historique, enregistrée automatiquement
// pendant la frappe. N'actualise pas updated_at : écrire une note n'est
// pas un traitement (ni remontée dans la liste, ni point sur le graphique
// du Tableau de bord).
function wireNote(card, lead) {
  const textarea = card.querySelector("[data-note]");
  const statusEl = card.querySelector("[data-note-status]");
  let saved = lead.note || "";
  let timer = null;
  let pending = Promise.resolve();

  async function save() {
    clearTimeout(timer);
    timer = null;
    const value = textarea.value.trim();
    if (value === saved) return;
    statusEl.textContent = "Enregistrement…";
    const { error } = await supabase.from("radar_leads").update({ note: value || null }).eq("id", lead.id);
    if (error) {
      statusEl.textContent = /note/.test(error.message || "")
        ? "Note non enregistrée : la colonne « note » manque dans Supabase (voir radar-auto-prospecting.sql)."
        : "Note non enregistrée : " + error.message;
      return;
    }
    saved = value;
    lead.note = value;
    statusEl.textContent = "Note enregistrée ✓";
  }

  const queueSave = () => { pending = pending.then(save); return pending; };
  textarea.addEventListener("input", () => {
    statusEl.textContent = "";
    clearTimeout(timer);
    timer = setTimeout(queueSave, 800);
  });
  textarea.addEventListener("blur", queueSave);

  return { flush: queueSave };
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
          ${lead.email ? `<span style="color:var(--accent-blue-2);font-weight:600;">✉️ ${escapeHtml(lead.email)}</span>` : ""}
          ${lead.website ? `<a href="${escapeHtml(lead.website)}" target="_blank" rel="noopener" style="color:var(--accent-blue-1);">🔗 Site web</a>` : ""}
        </div>
        ${lead.address ? `<div style="font-size:11px;color:var(--light-text-dim);margin-top:5px;opacity:.8;">📍 ${escapeHtml(lead.address)}</div>` : ""}
      </div>
      <span class="status-pill neutral">${quality.label}</span>
      <div style="display:flex;gap:8px;">${actions}</div>
      ${tab === "historique" ? `
        <div style="flex-basis:100%;">
          <textarea data-note rows="2" maxlength="2000" placeholder="Ajouter une note…" style="font-size:13px;padding:9px 12px;resize:vertical;min-height:40px;">${escapeHtml(lead.note || "")}</textarea>
          <div data-note-status style="font-size:11px;color:var(--light-text-dim);margin-top:3px;min-height:14px;"></div>
        </div>
      ` : ""}
    </div>
  `;
}

// Si Supabase refuse la modification, on l'affiche sous la fiche au lieu
// de ne rien faire (sans `.select()`, une modification bloquée par les
// droits de la base ne renvoie même pas d'erreur).
async function setLeadStatus(btn, leadId, status, onChanged) {
  btn.disabled = true;
  const { data, error } = await supabase
    .from("radar_leads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .select("id");

  if (error || !data || !data.length) {
    btn.disabled = false;
    const card = btn.closest("[data-lead-id]");
    let msg = card.querySelector("[data-status-error]");
    if (!msg) {
      msg = document.createElement("div");
      msg.dataset.statusError = "";
      msg.className = "error-msg";
      msg.style.cssText = "flex-basis:100%;margin-top:0;";
      card.appendChild(msg);
    }
    msg.textContent = "Pas enregistré : ta base Supabase refuse ce changement (" +
      (error ? error.message : "modification non autorisée") + "). Colle le correctif SQL de Zenoa Radar dans Supabase.";
    return;
  }
  onChanged();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
