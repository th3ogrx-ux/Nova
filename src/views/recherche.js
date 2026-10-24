// Radar — prospection automatique quotidienne. À la première
// ouverture de la journée, les prospects du jour sont générés (voir
// src/radar-generate.js) : aucune recherche à lancer soi-même.
import { supabase } from "../supabase.js";
import { getCurrentUser } from "../session.js";
import { readCache, writeCache, sameData } from "../data-cache.js";
import { generateTodayLeadsIfNeeded } from "../radar-generate.js";
import { CATEGORY_INFO, qualifyLead } from "../radar-categories.js";

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
    <h1 class="page-title">Radar</h1>

    <div style="margin-top:4px;">
      <div style="display:flex;gap:8px;margin-bottom:14px;">
        <button type="button" class="btn btn-sm primary" id="tab-en-attente">En attente</button>
        <button type="button" class="btn btn-sm ghost" id="tab-historique">Historique</button>
      </div>
      <div id="leads-status"></div>
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

  const statusEl = root.querySelector("#leads-status");
  let activeTab = "en_attente";
  let shownKey = null; // onglet (et données) actuellement affichés

  async function fetchLeads(userId, tab) {
    let query = supabase.from("radar_leads").select("*").eq("user_id", userId);
    query = tab === "historique"
      ? query.in("status", HISTORY_STATUSES).order("updated_at", { ascending: false })
      : query.eq("status", "en_attente").order("created_at", { ascending: false });
    return query;
  }

  // Affiche tout de suite les derniers prospects connus de l'onglet, puis
  // la liste à jour. `useCache: false` après un clic sur une fiche : on
  // garde l'écran tel quel jusqu'à la liste à jour (pas de retour en arrière).
  async function loadTab(tab, { useCache = true } = {}) {
    activeTab = tab;
    setActiveTab(tab);
    const user = await getCurrentUser();
    const cacheKey = `radar:${tab}:${user.id}`;
    const cached = useCache ? readCache(cacheKey) : null;
    if (cached) {
      renderLeads(listEl, cached, tab, () => loadTab(tab, { useCache: false }));
      shownKey = tab;
    } else if (shownKey !== tab) {
      listEl.innerHTML = `<p style="color:var(--light-text-dim);font-size:13.5px;">Chargement...</p>`;
    }

    const { data: leads, error } = await fetchLeads(user.id, tab);
    if (activeTab !== tab) return; // on a changé d'onglet entre-temps
    if (error) {
      if (!cached) listEl.innerHTML = `<p class="error-msg">Erreur : ${escapeHtml(error.message)}</p>`;
      return;
    }
    writeCache(cacheKey, leads || []);
    if (!cached || !sameData(cached, leads || []) || shownKey !== tab) {
      renderLeads(listEl, leads || [], tab, () => loadTab(tab, { useCache: false }));
    }
    shownKey = tab;
  }

  // Prospects du jour : cherchés en arrière-plan, au-dessus de la liste,
  // sans bloquer la page (la recherche OpenStreetMap peut prendre du temps).
  async function generateToday() {
    const user = await getCurrentUser();
    try {
      const added = await generateTodayLeadsIfNeeded(user.id, (message) => {
        statusEl.innerHTML = `<p class="radar-status"><span class="book-spinner" style="width:16px;height:16px;border-width:2px;"></span>${escapeHtml(message)}</p>`;
      });
      statusEl.innerHTML = "";
      if (added && activeTab === "en_attente") await loadTab("en_attente", { useCache: false });
    } catch (err) {
      statusEl.innerHTML = `<p class="error-msg" style="margin-bottom:12px;">${escapeHtml(err.message)}</p>`;
    }
  }

  tabEnAttente.addEventListener("click", () => loadTab("en_attente"));
  tabHistorique.addEventListener("click", () => loadTab("historique"));

  return Promise.all([loadTab("en_attente"), generateToday()]);
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
    wireQual(card, lead);
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

// Lien vers la fiche Google de l'entreprise : une recherche Google Maps sur son nom et son adresse
// (adresse officielle de Google Maps, sans clé ni compte). On y voit la note, les avis et les photos.
function googleMapsUrl(lead) {
  const query = [lead.name, lead.address].filter(Boolean).join(" ");
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);
}

// ---------- Qualification avec la fiche Google (saisie à la main) ----------
const VERDICT = {
  ok: { text: "✓ Qualifié", cls: "ok" },
  ko: { text: "✗ Hors critères", cls: "danger" },
  incomplete: { text: "", cls: "warning" },
  none: { text: "À qualifier", cls: "neutral" }
};
const triState = (v) => (v === true ? "true" : v === false ? "false" : "");

function qualChecksHtml(lead) {
  const q = qualifyLead(lead);
  return q.checks.map((c) => `<li class="${c.ok === true ? "ok" : c.ok === false ? "ko" : "na"}"><b aria-hidden="true">${c.ok === true ? "✓" : c.ok === false ? "✗" : "○"}</b><span>${escapeHtml(c.label)}</span></li>`).join("");
}
function qualPillHtml(lead) {
  const q = qualifyLead(lead), v = VERDICT[q.verdict];
  const text = q.verdict === "incomplete" ? `${q.filled}/${q.total} renseignés` : v.text;
  return `<span class="status-pill ${v.cls}" data-qual-pill>${escapeHtml(text)}</span>`;
}
function qualHtml(lead) {
  const val = (v) => (v === null || v === undefined ? "" : escapeHtml(v));
  return `<details class="radar-qual" data-qual style="flex-basis:100%;">
    <summary>Qualifier avec la fiche Google ${qualPillHtml(lead)}</summary>
    <div class="radar-qual-body">
      <p class="radar-qual-help">Ouvre la fiche (lien « ⭐ Fiche Google ») puis note ce que tu vois : le Radar vérifie tes critères.</p>
      <div class="radar-qual-grid">
        <label>Nombre d'avis<input type="number" min="0" inputmode="numeric" data-q="g_avis" value="${val(lead.g_avis)}"></label>
        <label>Note (sur 5)<input type="number" min="1" max="5" step="0.1" inputmode="decimal" data-q="g_note" value="${val(lead.g_note)}"></label>
        <label>Nombre de photos<input type="number" min="0" inputmode="numeric" data-q="g_photos" value="${val(lead.g_photos)}"></label>
        <label>Description présente ?<select data-q="g_description"><option value=""${triState(lead.g_description) === "" ? " selected" : ""}>—</option><option value="true"${triState(lead.g_description) === "true" ? " selected" : ""}>Oui</option><option value="false"${triState(lead.g_description) === "false" ? " selected" : ""}>Non</option></select></label>
        <label>Des avis sans réponse ?<select data-q="g_sans_reponse"><option value=""${triState(lead.g_sans_reponse) === "" ? " selected" : ""}>—</option><option value="true"${triState(lead.g_sans_reponse) === "true" ? " selected" : ""}>Oui</option><option value="false"${triState(lead.g_sans_reponse) === "false" ? " selected" : ""}>Non</option></select></label>
        <label>Date du dernier avis<input type="date" data-q="g_dernier_avis" value="${val(lead.g_dernier_avis)}"></label>
      </div>
      <ul class="radar-qual-checks" data-qual-checks>${qualChecksHtml(lead)}</ul>
      <div class="radar-qual-status" data-qual-status aria-live="polite"></div>
    </div></details>`;
}

// Enregistre chaque saisie (au bout de 600 ms) et met le verdict à jour tout de suite, sans recharger la liste.
function wireQual(card, lead) {
  const statusEl = card.querySelector("[data-qual-status]");
  let timer = null, pending = Promise.resolve();
  const read = () => {
    const out = {};
    card.querySelectorAll("[data-q]").forEach((el) => {
      const key = el.dataset.q, raw = el.value.trim();
      if (key === "g_description" || key === "g_sans_reponse") out[key] = raw === "" ? null : raw === "true";
      else if (key === "g_dernier_avis") out[key] = raw || null;
      else out[key] = raw === "" ? null : Number(raw);
    });
    return out;
  };
  const refreshView = () => {
    card.querySelector("[data-qual-pill]").outerHTML = qualPillHtml(lead);
    card.querySelector("[data-qual-checks]").innerHTML = qualChecksHtml(lead);
  };
  async function save() {
    const values = read();
    const { error } = await supabase.from("radar_leads").update(values).eq("id", lead.id);
    statusEl.textContent = error
      ? (/g_|column|schema cache/i.test(error.message || "") ? "Non enregistré : colle radar-qualification.sql dans Supabase (SQL Editor > Run), puis recharge." : "Non enregistré : " + error.message)
      : "Enregistré ✓";
  }
  const onChange = () => {
    Object.assign(lead, read());
    refreshView();
    statusEl.textContent = "";
    clearTimeout(timer);
    timer = setTimeout(() => { pending = pending.then(save); }, 600);
  };
  card.querySelectorAll("[data-q]").forEach((el) => { el.addEventListener("input", onChange); el.addEventListener("change", onChange); });
}

// Métier du prospect ; une étoile signale les métiers prioritaires (ceux qui vivent de Google Maps).
function categoryPill(lead) {
  const info = CATEGORY_INFO[lead.category];
  if (!info) return "";
  return `<span class="status-pill ${info.priority === 1 ? "warning" : "neutral"}" title="${info.priority === 1 ? "Priorité 1" : info.priority === 2 ? "Priorité 2" : "Ancien métier"}">${info.priority === 1 ? "★ " : ""}${escapeHtml(info.label)}</span>`;
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
          <a href="${escapeHtml(googleMapsUrl(lead))}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-blue-1);" title="Voir la fiche Google, la note et les avis">⭐ Fiche Google</a>
          ${lead.website && safeHttpUrl(lead.website) ? `<a href="${escapeHtml(safeHttpUrl(lead.website))}" target="_blank" rel="noopener" style="color:var(--accent-blue-1);">🔗 Site web</a>` : ""}
        </div>
        ${lead.address ? `<div style="font-size:11px;color:var(--light-text-dim);margin-top:5px;opacity:.8;">📍 ${escapeHtml(lead.address)}</div>` : ""}
      </div>
      ${categoryPill(lead)}
      <span class="status-pill neutral">${quality.label}</span>
      <div style="display:flex;gap:8px;">${actions}</div>
      ${qualHtml(lead)}
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
      (error ? error.message : "modification non autorisée") + "). Colle le correctif SQL du Radar dans Supabase.";
    return;
  }
  onChanged();
}

// Le site vient d'OpenStreetMap (donnée externe) : on n'accepte que http(s),
// jamais "javascript:" ou "data:".
function safeHttpUrl(value) {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : "https://" + value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
