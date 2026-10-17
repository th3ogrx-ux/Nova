// CRM – Agence Web : suivi de l'activité de création de sites pour les
// entreprises locales. En haut, un tableau de bord ; dessous, les
// prospects & clients (pipeline en colonnes, relances du jour, tableau
// complet) et les projets des clients gagnés. Tables : crm-agence.sql.
import { supabase } from "../supabase.js";
import {
  ETAPES, STATUTS, ETAPE_COLORS, STATUT_PILLS, PROJETS_TABLE,
  escapeHtml, dateKey, addDays, shortDate, formatEuros, normalize, isRelanceDue,
  isMissingTable, MISSING_TABLE_MESSAGE, loadCrm, saveProspect, seedExamplesIfNeeded
} from "./crm-data.js";
import { openProspectModal, openProjetModal } from "./crm-modals.js";

const VIEW_KEY = "zenoa-crm-vue";
const VIEWS = [
  { id: "pipeline", label: "Pipeline" },
  { id: "relances", label: "Relances du jour" },
  { id: "tableau", label: "Tableau complet" }
];

function readSavedView() {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return VIEWS.some((x) => x.id === v) ? v : "pipeline";
  } catch {
    return "pipeline";
  }
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function etapeDot(etape) {
  return `<span class="crm-dot" style="background:${ETAPE_COLORS[etape] || "#8e86a3"};"></span>`;
}

function etapePill(etape) {
  return `<span class="crm-etape">${etapeDot(etape)}${escapeHtml(etape)}</span>`;
}

// "Aujourd'hui" ou "En retard de 3 j" pour une relance due.
function relanceLabel(key, today) {
  if (key === today) return "Aujourd'hui";
  const days = Math.round((new Date(today) - new Date(key)) / 86400000);
  return `En retard de ${days} j`;
}

function sortedRelances(prospects, today) {
  return prospects
    .filter((p) => isRelanceDue(p, today))
    .sort((a, b) => a.prochaine_relance.localeCompare(b.prochaine_relance));
}

export async function renderCrm(root) {
  root.innerHTML = `
    <h1 class="page-title">CRM – Agence Web</h1>
    <div id="crm-dashboard"><p style="color:var(--light-text-dim);font-size:13.5px;">Chargement…</p></div>
    <div id="crm-main"></div>
  `;

  const dashEl = root.querySelector("#crm-dashboard");
  const mainEl = root.querySelector("#crm-main");
  const { data: { user } } = await supabase.auth.getUser();

  let data = { prospects: [], projets: [] };
  let tab = "prospects";
  let view = readSavedView();
  let search = "";

  async function load() {
    try {
      data = await loadCrm(user.id);
      if (await seedExamplesIfNeeded(user.id, data)) data = await loadCrm(user.id);
    } catch (err) {
      dashEl.innerHTML = `<p class="error-msg">${isMissingTable(err) ? MISSING_TABLE_MESSAGE : "Impossible de charger le CRM : " + escapeHtml(err.message)}</p>`;
      mainEl.innerHTML = "";
      return;
    }
    renderAll();
  }

  const editProspect = (p) => openProspectModal(user.id, p, load);
  const clientsGagnes = () => data.prospects.filter((p) => p.etape === "Gagné");

  function renderAll() {
    renderDashboard();
    renderMain();
  }

  // ---------- Tableau de bord ----------
  function renderDashboard() {
    const today = dateKey();
    const monthStart = today.slice(0, 8) + "01";
    const gagnes = clientsGagnes();
    const gagnesMois = gagnes.filter((p) => p.gagne_le && p.gagne_le >= monthStart).length;
    const mrr = gagnes.reduce((sum, p) => sum + (Number(p.abonnement_mensuel) || 0), 0);
    const relances = sortedRelances(data.prospects, today);
    const counts = Object.fromEntries(ETAPES.map((e) => [e, 0]));
    data.prospects.forEach((p) => { if (p.etape in counts) counts[p.etape]++; });

    dashEl.innerHTML = `
      <div class="stat-grid" style="margin-bottom:14px;">
        <div class="card stat-tile"><div class="stat-tile-value" style="color:var(--ok);">${gagnesMois}</div><div class="stat-tile-label">Clients gagnés ce mois-ci</div></div>
        <div class="card stat-tile"><div class="stat-tile-value">${formatEuros(mrr)}<span style="font-size:14px;font-weight:600;color:var(--light-text-dim);"> /mois</span></div><div class="stat-tile-label">Revenu mensuel récurrent</div></div>
        <div class="card stat-tile"><div class="stat-tile-value" style="color:${relances.length ? "var(--warning)" : "inherit"};">${relances.length}</div><div class="stat-tile-label">Relances à faire</div></div>
      </div>

      <div class="crm-dash-row">
        <div class="card" style="padding:18px 20px;">
          <div class="panel-title">Prospects par étape</div>
          <div class="crm-etape-counts">
            ${ETAPES.map((e) => `<div class="crm-etape-count">${etapeDot(e)}<span>${escapeHtml(e)}</span><b>${counts[e]}</b></div>`).join("")}
          </div>
        </div>
        <div class="card" style="padding:18px 20px;">
          <div class="panel-title">Relances à faire aujourd'hui</div>
          ${relances.length ? `<div class="crm-relance-mini">
            ${relances.map((p) => `
              <button type="button" class="crm-relance-mini-item" data-open="${p.id}">
                <span style="font-weight:700;">${escapeHtml(p.entreprise)}</span>
                ${p.telephone ? `<span style="color:var(--ok);font-weight:600;">📞 ${escapeHtml(p.telephone)}</span>` : ""}
                <span class="crm-late${p.prochaine_relance < today ? " is-late" : ""}">${relanceLabel(p.prochaine_relance, today)}</span>
              </button>`).join("")}
          </div>` : `<p style="font-size:13px;color:var(--light-text-dim);">Rien à relancer aujourd'hui 🎉</p>`}
        </div>
      </div>
    `;
    dashEl.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", () => editProspect(data.prospects.find((p) => p.id === btn.dataset.open)));
    });
  }

  // ---------- Onglets + barre d'outils ----------
  function renderMain() {
    const today = dateKey();
    const relancesCount = sortedRelances(data.prospects, today).length;
    mainEl.innerHTML = `
      <div class="crm-tabs">
        <button type="button" class="btn btn-sm ${tab === "prospects" ? "primary" : "ghost"}" data-tab="prospects">Prospects & Clients (${data.prospects.length})</button>
        <button type="button" class="btn btn-sm ${tab === "projets" ? "primary" : "ghost"}" data-tab="projets">Projets (${data.projets.length})</button>
      </div>
      <div class="crm-toolbar">
        ${tab === "prospects" ? `<div class="crm-views">
          ${VIEWS.map((v) => `<button type="button" class="crm-view-btn${v.id === view ? " active" : ""}" data-view-id="${v.id}">${v.label}${v.id === "relances" && relancesCount ? ` <span class="crm-badge">${relancesCount}</span>` : ""}</button>`).join("")}
        </div>` : ""}
        <input type="search" data-search placeholder="Rechercher…" value="${escapeHtml(search)}">
        <button type="button" class="btn primary btn-sm" data-add>+ ${tab === "prospects" ? "Nouveau prospect" : "Nouveau projet"}</button>
      </div>
      <div data-body></div>
    `;

    mainEl.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; renderMain(); }));
    mainEl.querySelectorAll("[data-view-id]").forEach((b) => b.addEventListener("click", () => {
      view = b.dataset.viewId;
      try { localStorage.setItem(VIEW_KEY, view); } catch { /* pas grave */ }
      renderMain();
    }));
    const searchEl = mainEl.querySelector("[data-search]");
    searchEl.addEventListener("input", () => { search = searchEl.value; renderBody(); });
    mainEl.querySelector("[data-add]").addEventListener("click", () => {
      if (tab === "prospects") editProspect(null);
      else openProjetModal(user.id, null, clientsGagnes(), load);
    });
    renderBody();
  }

  function renderBody() {
    const body = mainEl.querySelector("[data-body]");
    const q = normalize(search.trim());
    if (tab === "projets") return renderProjets(body, q);

    const prospects = q
      ? data.prospects.filter((p) => normalize([p.entreprise, p.ville, p.gerant, p.secteur, p.telephone, p.email, p.notes].join(" ")).includes(q))
      : data.prospects;
    if (view === "pipeline") renderPipeline(body, prospects);
    else if (view === "relances") renderRelances(body, prospects);
    else renderTableau(body, prospects);
  }

  // ---------- Vue Pipeline (colonnes par étape, glisser-déposer) ----------
  function renderPipeline(body, prospects) {
    const today = dateKey();
    body.innerHTML = `
      <div class="crm-board">
        ${ETAPES.map((etape) => {
          const cards = prospects.filter((p) => p.etape === etape);
          return `
            <div class="crm-col" data-etape="${escapeHtml(etape)}">
              <div class="crm-col-head">${etapeDot(etape)}<span>${escapeHtml(etape)}</span><b>${cards.length}</b></div>
              ${cards.map((p) => `
                <div class="crm-card" draggable="true" data-id="${p.id}" tabindex="0">
                  <div style="font-weight:700;font-size:13.5px;">${escapeHtml(p.entreprise)}</div>
                  <div class="crm-card-meta">${escapeHtml([p.secteur, p.ville].filter(Boolean).join(" · "))}</div>
                  ${p.telephone ? `<div style="color:var(--ok);font-weight:600;font-size:12px;margin-top:6px;">📞 ${escapeHtml(p.telephone)}</div>` : ""}
                  <div class="crm-card-foot">
                    ${p.prochaine_relance ? `<span class="crm-late${isRelanceDue(p, today) ? " is-late" : ""}">⏰ ${shortDate(p.prochaine_relance).slice(0, 5)}</span>` : "<span></span>"}
                    ${p.abonnement_mensuel ? `<span>${formatEuros(p.abonnement_mensuel)}/mois</span>` : ""}
                  </div>
                </div>`).join("")}
            </div>`;
        }).join("")}
      </div>
      <p style="font-size:11.5px;color:var(--light-text-dim);margin-top:8px;">Astuce : fais glisser une fiche d'une colonne à l'autre pour changer son étape (ou ouvre-la pour la modifier).</p>
    `;

    body.querySelectorAll(".crm-card").forEach((card) => {
      const p = data.prospects.find((x) => x.id === card.dataset.id);
      card.addEventListener("click", () => editProspect(p));
      card.addEventListener("keydown", (e) => { if (e.key === "Enter") editProspect(p); });
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", p.id);
        e.dataTransfer.effectAllowed = "move";
        card.classList.add("dragging");
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
    });
    body.querySelectorAll(".crm-col").forEach((col) => {
      col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drag-over"); });
      col.addEventListener("dragleave", (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove("drag-over"); });
      col.addEventListener("drop", async (e) => {
        e.preventDefault();
        col.classList.remove("drag-over");
        const p = data.prospects.find((x) => x.id === e.dataTransfer.getData("text/plain"));
        if (!p || p.etape === col.dataset.etape) return;
        try {
          await saveProspect(user.id, { etape: col.dataset.etape }, p);
        } catch (err) {
          window.alert(err.message || String(err));
        }
        load();
      });
    });
  }

  // ---------- Vue Relances du jour ----------
  function renderRelances(body, prospects) {
    const today = dateKey();
    const list = sortedRelances(prospects, today);
    if (!list.length) {
      body.innerHTML = `<p style="color:var(--light-text-dim);font-size:13.5px;">Aucune relance aujourd'hui ni en retard.</p>`;
      return;
    }
    body.innerHTML = list.map((p) => `
      <div class="card crm-relance" data-id="${p.id}">
        <div style="flex:1;min-width:220px;">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="font-weight:700;font-size:14.5px;">${escapeHtml(p.entreprise)}</span>
            ${etapePill(p.etape)}
            <span class="crm-late${p.prochaine_relance < today ? " is-late" : ""}">${relanceLabel(p.prochaine_relance, today)}</span>
          </div>
          <div style="font-size:12.5px;margin-top:5px;display:flex;gap:12px;flex-wrap:wrap;">
            ${p.gerant ? `<span style="color:var(--light-text-dim);">👤 ${escapeHtml(p.gerant)}</span>` : ""}
            ${p.telephone ? `<span style="color:var(--ok);font-weight:600;">📞 ${escapeHtml(p.telephone)}</span>` : ""}
            ${p.email ? `<span style="color:var(--accent-blue-2);font-weight:600;">✉️ ${escapeHtml(p.email)}</span>` : ""}
          </div>
          ${p.notes ? `<div style="font-size:12px;color:var(--light-text-dim);margin-top:6px;white-space:pre-line;">${escapeHtml(p.notes)}</div>` : ""}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
          <span style="font-size:11px;color:var(--light-text-dim);">Relancé ✓ — prochaine relance dans :</span>
          <div style="display:flex;gap:6px;">
            <button type="button" class="btn btn-sm primary" data-relance="3">3 j</button>
            <button type="button" class="btn btn-sm primary" data-relance="7">7 j</button>
            <button type="button" class="btn btn-sm ghost" data-edit>Ouvrir</button>
          </div>
        </div>
      </div>
    `).join("");

    body.querySelectorAll(".crm-relance").forEach((card) => {
      const p = data.prospects.find((x) => x.id === card.dataset.id);
      card.querySelector("[data-edit]").addEventListener("click", () => editProspect(p));
      card.querySelectorAll("[data-relance]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          const values = { dernier_contact: dateKey(), prochaine_relance: addDays(Number(btn.dataset.relance)) };
          if (p.etape === "À contacter") values.etape = "Contacté";
          try {
            await saveProspect(user.id, values, p);
          } catch (err) {
            btn.disabled = false;
            window.alert(err.message || String(err));
            return;
          }
          load();
        });
      });
    });
  }

  // ---------- Vue Tableau complet ----------
  function renderTableau(body, prospects) {
    if (!prospects.length) {
      body.innerHTML = `<p style="color:var(--light-text-dim);font-size:13.5px;">Aucun prospect${search.trim() ? " ne correspond à ta recherche" : " pour l'instant"}.</p>`;
      return;
    }
    const today = dateKey();
    const cols = ["Entreprise", "Secteur", "Ville", "Gérant", "Téléphone", "Email", "Site actuel", "Note Google", "Source", "Étape", "Dernier contact", "Prochaine relance", "Prix création", "Abonnement", "Notes"];
    body.innerHTML = `
      <div class="card crm-table-wrap">
        <table class="crm-table">
          <thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
          <tbody>
            ${prospects.map((p) => `
              <tr data-id="${p.id}" tabindex="0">
                <td style="font-weight:700;">${escapeHtml(p.entreprise)}</td>
                <td>${escapeHtml(p.secteur)}</td>
                <td>${escapeHtml(p.ville)}</td>
                <td>${escapeHtml(p.gerant)}</td>
                <td style="color:var(--ok);font-weight:600;">${escapeHtml(p.telephone)}</td>
                <td style="color:var(--accent-blue-2);">${escapeHtml(p.email)}</td>
                <td>${escapeHtml(p.site_actuel)}</td>
                <td>${p.note_google != null ? `${String(p.note_google).replace(".", ",")} ★${p.nb_avis != null ? ` <span style="color:var(--light-text-dim);">(${p.nb_avis})</span>` : ""}` : ""}</td>
                <td>${escapeHtml(p.source)}</td>
                <td>${etapePill(p.etape)}</td>
                <td>${shortDate(p.dernier_contact)}</td>
                <td>${p.prochaine_relance ? `<span class="crm-late${isRelanceDue(p, today) ? " is-late" : ""}">${shortDate(p.prochaine_relance)}</span>` : ""}</td>
                <td>${p.prix_creation != null ? formatEuros(p.prix_creation) : ""}</td>
                <td>${p.abonnement_mensuel != null ? formatEuros(p.abonnement_mensuel) + "/mois" : ""}</td>
                <td class="crm-notes-cell" title="${escapeHtml(p.notes)}">${escapeHtml(p.notes)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    `;
    body.querySelectorAll("tr[data-id]").forEach((tr) => {
      const p = data.prospects.find((x) => x.id === tr.dataset.id);
      tr.addEventListener("click", () => editProspect(p));
      tr.addEventListener("keydown", (e) => { if (e.key === "Enter") editProspect(p); });
    });
  }

  // ---------- Projets ----------
  function renderProjets(body, q) {
    const byId = Object.fromEntries(data.prospects.map((p) => [p.id, p]));
    const projets = q
      ? data.projets.filter((pr) => normalize([byId[pr.prospect_id] && byId[pr.prospect_id].entreprise, pr.hebergeur_domaine, pr.lien_site, pr.statut].join(" ")).includes(q))
      : data.projets;
    if (!projets.length) {
      body.innerHTML = `<p style="color:var(--light-text-dim);font-size:13.5px;">${data.projets.length ? "Aucun projet ne correspond à ta recherche." : "Aucun projet pour l'instant. Un projet est créé automatiquement quand un prospect passe à l'étape « Gagné »."}</p>`;
      return;
    }
    body.innerHTML = `
      <div class="card crm-table-wrap">
        <table class="crm-table">
          <thead><tr><th>Client</th><th>Statut</th><th>Livraison prévue</th><th>Lien du site</th><th>Hébergeur / domaine</th><th>Acompte</th><th>Solde</th><th></th></tr></thead>
          <tbody>
            ${projets.map((pr) => {
              const client = byId[pr.prospect_id];
              const link = pr.lien_site && safeHttpUrl(pr.lien_site);
              return `
                <tr data-id="${pr.id}">
                  <td style="font-weight:700;">${escapeHtml(client ? client.entreprise : "—")}</td>
                  <td><select data-field="statut" class="crm-inline-select crm-pill-${STATUT_PILLS[pr.statut] || "neutral"}">${STATUTS.map((s) => `<option${s === pr.statut ? " selected" : ""}>${escapeHtml(s)}</option>`).join("")}</select></td>
                  <td>${shortDate(pr.livraison_prevue)}</td>
                  <td>${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener" style="color:var(--accent-blue-1);">${escapeHtml(link.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</a>` : ""}</td>
                  <td class="crm-wrap">${escapeHtml(pr.hebergeur_domaine)}</td>
                  <td><input type="checkbox" class="crm-checkbox" data-field="acompte_paye"${pr.acompte_paye ? " checked" : ""} aria-label="Acompte payé"></td>
                  <td><input type="checkbox" class="crm-checkbox" data-field="solde_paye"${pr.solde_paye ? " checked" : ""} aria-label="Solde payé"></td>
                  <td><button type="button" class="icon-btn" data-edit title="Modifier le projet" aria-label="Modifier le projet">✎</button></td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;

    body.querySelectorAll("tr[data-id]").forEach((tr) => {
      const pr = data.projets.find((x) => x.id === tr.dataset.id);
      tr.querySelector("[data-edit]").addEventListener("click", () => openProjetModal(user.id, pr, clientsGagnes(), load));
      tr.querySelectorAll("[data-field]").forEach((input) => {
        input.addEventListener("change", async () => {
          const field = input.dataset.field;
          const value = input.type === "checkbox" ? input.checked : input.value;
          input.disabled = true;
          const { error } = await supabase.from(PROJETS_TABLE).update({ [field]: value }).eq("id", pr.id);
          input.disabled = false;
          if (error) {
            window.alert(error.message);
            if (input.type === "checkbox") input.checked = !value; else input.value = pr[field];
            return;
          }
          pr[field] = value;
          if (field === "statut") input.className = `crm-inline-select crm-pill-${STATUT_PILLS[value] || "neutral"}`;
        });
      });
    });
  }

  load();
}
