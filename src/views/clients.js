// Espace admin — gestion des mannequins : liste, création de compte, et fiche
// (réseaux, calendrier, collaborations, partenaires, tâches, infos et accès). Réservé à l'admin :
// les droits sont dans la base (espace.sql) et dans la fonction "espace-admin".
import { supabase } from "../supabase.js";
import { openModal } from "../modal.js";
import { callAdmin, notifyEspaceChanged } from "./espace-admin-api.js";
import { escapeHtml, formatDate, monthLabel, currentMonthKey, RESEAUX, reseauxOf, formatNumber } from "./espace-data.js";
import { tabReseaux, tabCalendrier, tabCollabs, tabPartenaires, isMissing as isSocialMissing, MISSING as SOCIAL_MISSING } from "./clients-social.js";
import { dueInfo, addOneMonth, daysUntil, dateKeyOf } from "./due.js";

const TABS = [
  { id: "reseaux", label: "Réseaux" },
  { id: "calendrier", label: "Calendrier" },
  { id: "collabs", label: "Collaborations" },
  { id: "partenaires", label: "Partenaires" },
  { id: "taches", label: "Tâches" },
  { id: "infos", label: "Infos & accès" }
];
const STATUTS = [
  { key: "a_venir", label: "À venir" },
  { key: "en_cours", label: "En cours" },
  { key: "fait", label: "Fait" }
];

const monthKeyOf = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-01";
const todayKey = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const previousMonthKey = () => { const d = new Date(); return monthKeyOf(new Date(d.getFullYear(), d.getMonth() - 1, 1)); };

// Liste de mois pour un <select> (du mois prochain aux 24 derniers mois) : plus fiable
// que <input type="month">, absent de certains navigateurs.
function monthOptions(selected) {
  const now = new Date();
  const keys = [];
  for (let i = -1; i < 24; i++) keys.push(monthKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  return keys.map((k) => `<option value="${k}"${k === selected ? " selected" : ""}>${escapeHtml(monthLabel(k))}</option>`).join("");
}

const field = (label, inner, { span = false } = {}) => `<div class="field${span ? " crm-span-2" : ""}"><label class="field-label">${label}</label>${inner}</div>`;
const stars = () => "";

// Texte du rappel "prochaine mise à jour des chiffres".
function dueLabel(info, key) {
  if (info.state === "none") return "Pas de date";
  if (info.state === "late") return `En retard de ${-info.days} j`;
  if (info.state === "today") return "Aujourd'hui";
  if (info.state === "soon") return `Dans ${info.days} j`;
  return formatDate(key);
}

// Pastille du menu "Clients" : nombre de clients à mettre à jour bientôt (en retard, aujourd'hui, dans 3 jours).
function publishDueCount(dates) {
  const count = dates.filter((k) => dueInfo(k).urgent).length;
  window.dispatchEvent(new CustomEvent("zenoa:due-count", { detail: { count } }));
}
async function refreshDueBadge() {
  const { data, error } = await supabase.from("espace_businesses").select("prochaine_maj");
  publishDueCount(error ? [] : (data || []).map((b) => b.prochaine_maj).filter(Boolean));
}

function setMsg(el, text, ok = false) {
  el.textContent = text;
  el.style.color = ok ? "var(--ok)" : "";
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// ---------- Fenêtre "identifiants à transmettre" ----------
function showCredentials({ title, email, tempPassword, note, onClose }) {
  const message = `Bonjour,\n\nVoici votre accès à Zenoa Espace, pour suivre vos réseaux sociaux, votre calendrier de contenu et vos collaborations :\n${location.origin}\n\nEmail : ${email}\nMot de passe temporaire : ${tempPassword}\n\nVous choisirez votre propre mot de passe à la première connexion.`;
  const { overlay, close, onClose: whenClosed } = openModal(`
    <h2 style="font-size:16px;font-weight:700;letter-spacing:normal;text-transform:none;margin:0 0 6px;">${escapeHtml(title)}</h2>
    <p style="font-size:13px;color:var(--text-dim);margin-bottom:16px;line-height:1.5;">
      Transmets ces identifiants au client. <b style="color:var(--warning);">Le mot de passe ne sera plus jamais affiché</b> :
      copie-le maintenant (tu pourras en générer un nouveau si besoin).
    </p>
    <div class="field"><label class="field-label">Email</label><input type="text" readonly value="${escapeHtml(email)}"></div>
    <div class="field"><label class="field-label">Mot de passe temporaire</label><input type="text" readonly id="cred-pw" value="${escapeHtml(tempPassword)}" style="font-family:var(--font-mono);font-size:16px;letter-spacing:.04em;"></div>
    ${note ? `<p style="font-size:12.5px;color:var(--warning);line-height:1.5;margin:0 0 8px;">${escapeHtml(note)}</p>` : ""}
    <div id="cred-msg" style="font-size:12.5px;color:var(--ok);min-height:18px;"></div>
    <div class="modal-actions" style="margin-top:8px;">
      <button type="button" class="btn ghost" data-close>Fermer</button>
      <button type="button" class="btn primary" id="cred-copy">Copier le message d'accueil</button>
    </div>`);
  overlay.querySelector("#cred-copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(message); }
    catch { const input = overlay.querySelector("#cred-pw"); input.select(); document.execCommand("copy"); }
    overlay.querySelector("#cred-msg").textContent = "Message copié ✓ — colle-le dans un mail ou un SMS.";
  });
  if (onClose) whenClosed(onClose);
  return close;
}

// ---------- Page ----------
export async function renderClients(root) {
  root.innerHTML = `<div id="clients-app"></div>`;
  const app = root.querySelector("#clients-app");
  let selected = null;     // commerce ouvert (objet) ou null = liste
  let tab = "infos";

  // =================== LISTE ===================
  async function showList() {
    selected = null;
    app.innerHTML = `<h1 class="page-title">Mannequins</h1><p style="color:var(--light-text-dim);font-size:14px;">Chargement…</p>`;
    const [biz, unread, socialStats] = await Promise.all([
      supabase.from("espace_businesses").select("*").order("nom"),
      supabase.from("espace_messages").select("business_id").eq("lu", false).eq("auteur", "client").limit(5000),
      supabase.from("espace_social_stats").select("business_id, mois, abonnes, updated_at").order("mois", { ascending: false }).limit(5000).then((r) => (r.error ? { data: [] } : r), () => ({ data: [] }))
    ]);
    const failed = biz.error || unread.error;
    if (failed) {
      app.innerHTML = `<h1 class="page-title">Clients</h1><p class="error-msg">Impossible de charger les clients.</p>`;
      return;
    }
    const rows = (biz.data || []).map((b) => {
      const lastSocial = (socialStats.data || []).find((x) => x.business_id === b.id);
      // Abonnés : total du dernier mois saisi, tous réseaux confondus.
      const followers = lastSocial ? (socialStats.data || []).filter((x) => x.business_id === b.id && x.mois === lastSocial.mois).reduce((sum, x) => sum + x.abonnes, 0) : null;
      return {
        b, followers,
        unread: (unread.data || []).filter((m) => m.business_id === b.id).length,
        updated: lastSocial ? lastSocial.updated_at.slice(0, 10) : null,
        due: dueInfo(b.prochaine_maj || null)
      };
    });
    // Les plus urgents d'abord (dates les plus proches), puis ceux sans date, par nom.
    rows.sort((x, y) => {
      const dx = x.b.prochaine_maj || "9999-99-99", dy = y.b.prochaine_maj || "9999-99-99";
      return dx.localeCompare(dy) || x.b.nom.localeCompare(y.b.nom);
    });
    publishDueCount(rows.map((r) => r.b.prochaine_maj).filter(Boolean));

    app.innerHTML = `
      <div class="clients-head">
        <div><h1 class="page-title">Mannequins</h1><p class="clients-sub">${rows.length} mannequin${rows.length > 1 ? "s" : ""}</p></div>
        <button type="button" class="btn primary" id="client-new" style="margin:0;">+ Nouveau mannequin</button>
      </div>
      ${rows.length ? `<div class="clients-list">${rows.map(({ b, unread: nu, updated, due, followers }) => `
        <button type="button" class="card client-row${due.urgent ? " due-urgent" : ""}${due.state === "late" ? " due-late" : ""}" data-id="${b.id}">
          <div class="client-main">
            <strong>${escapeHtml(b.nom)}${b.is_example ? ` <span class="status-pill neutral" style="margin-left:6px;">Exemple</span>` : ""}</strong>
            <span>${escapeHtml([b.ville, reseauxOf(b).map((n) => (b.comptes || {})[n]).filter(Boolean).join(" ")].filter(Boolean).join(" · ") || "—")}</span>
          </div>
          <div class="client-metric"><em>Abonnés</em>${followers === null ? "—" : `<b>${formatNumber(followers)}</b>`}</div>
          <div class="client-metric"><em>Messages non lus</em><b class="${nu ? "alert" : ""}">${nu}</b></div>
          <div class="client-metric"><em>Prochaine saisie des chiffres</em><span class="due-pill ${due.state}">${escapeHtml(dueLabel(due, b.prochaine_maj))}</span></div>
          <div class="client-metric"><em>Dernière mise à jour</em><b style="font-size:13px;">${updated ? formatDate(updated) : "Jamais"}</b></div>
        </button>`).join("")}</div>`
        : `<div class="card" style="padding:20px;"><p style="color:var(--light-text-dim);font-size:14px;">Aucun mannequin pour l'instant. Clique sur « + Nouveau mannequin » pour créer le premier.</p></div>`}
    `;
    app.querySelector("#client-new").addEventListener("click", openCreateModal);
    app.querySelectorAll(".client-row").forEach((btn) => btn.addEventListener("click", () => {
      const row = rows.find((r) => r.b.id === btn.dataset.id);
      if (row) showSheet(row.b);
    }));
  }

  // =================== CRÉATION ===================
  function openCreateModal() {
    const { overlay, close } = openModal(`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h2 style="font-size:16px;font-weight:700;letter-spacing:normal;text-transform:none;margin:0;">Nouveau mannequin</h2>
        <button type="button" class="icon-btn" data-close title="Fermer" style="width:30px;height:30px;">✕</button>
      </div>
      <form id="create-form">
        ${field("Nom *", `<input type="text" name="nom" maxlength="150" required autocomplete="off" placeholder="Prénom Nom ou nom de scène">`)}
        <div class="crm-form-grid">
          ${field("Ville", `<input type="text" name="ville" maxlength="80" autocomplete="off">`)}
          ${field("Email du mannequin *", `<input type="email" name="email" maxlength="200" required autocomplete="off" placeholder="contact@exemple.fr">`)}
        </div>
        <div class="field"><label class="field-label">Ses comptes (cochés = suivis)</label>
          ${RESEAUX.map((r) => `<div class="crm-form-grid" style="margin-bottom:6px;"><label class="crm-check" style="align-self:center;"><input type="checkbox" name="reseau" value="${r.key}"${r.key !== "linkedin" ? " checked" : ""}> ${r.label}</label><input type="text" name="compte_${r.key}" maxlength="80" placeholder="@pseudo" aria-label="Compte ${r.label}"></div>`).join("")}
        </div>
        ${field("Prochaine saisie de ses chiffres (rappel)", `<input type="date" name="prochaine_maj" min="${dateKeyOf(new Date())}">`)}
        <p style="font-size:12.5px;color:var(--text-dim);line-height:1.5;margin-bottom:6px;">
          Un compte est créé avec un mot de passe temporaire, que tu transmets au mannequin. Il devra en choisir un à lui à sa première connexion.
        </p>
        <div class="error-msg" id="create-error"></div>
        <div class="modal-actions"><button type="button" class="btn ghost" data-close>Annuler</button><button type="submit" class="btn primary" id="create-submit">Créer le mannequin</button></div>
      </form>`);
    overlay.querySelector("#create-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const errorEl = overlay.querySelector("#create-error");
      const btn = overlay.querySelector("#create-submit");
      errorEl.textContent = "";
      btn.disabled = true;
      btn.textContent = "Création…";
      try {
        const res = await callAdmin("create_client", { nom: f.nom.value, ville: f.ville.value, email: f.email.value });
        let note = null;
        const reseaux = [...f.querySelectorAll('input[name="reseau"]:checked')].map((i) => i.value);
        const comptes = Object.fromEntries(RESEAUX.map((r) => [r.key, f[`compte_${r.key}`].value.trim()]).filter(([, v]) => v));
        const patch = { type: "mannequin", reseaux, comptes, sections: ["reseaux", "calendrier", "collabs"] };
        if (f.prochaine_maj.value) patch.prochaine_maj = f.prochaine_maj.value;
        const { error: patchError } = await supabase.from("espace_businesses").update(patch).eq("id", res.business_id);
        if (patchError) note = "Le mannequin est créé, mais ses réseaux n'ont pas pu être enregistrés : colle espace-reseaux.sql (et espace-rappels.sql) dans Supabase, puis règle-les dans sa fiche.";
        else refreshDueBadge();
        close();
        showCredentials({
          title: "Mannequin créé ✓",
          email: res.email,
          tempPassword: res.temp_password,
          note,
          onClose: async () => {
            notifyEspaceChanged();
            const { data } = await supabase.from("espace_businesses").select("*").eq("id", res.business_id).maybeSingle();
            if (data) showSheet(data); else showList();
          }
        });
      } catch (err) {
        errorEl.textContent = err.message;
        btn.disabled = false;
        btn.textContent = "Créer le mannequin";
      }
    });
  }

  // =================== FICHE CLIENT ===================
  function showSheet(business) {
    selected = business;
    if (!TABS.some((t) => t.id === tab)) tab = TABS[0].id;
    app.innerHTML = `
      <button type="button" class="btn ghost btn-sm" id="back" style="margin-bottom:14px;">← Tous les mannequins</button>
      <div class="clients-head">
        <div><h1 class="page-title" id="sheet-title">${escapeHtml(business.nom)}</h1><p class="clients-sub">${escapeHtml([business.ville].filter(Boolean).join(" · "))}</p></div>
        <button type="button" class="btn ghost btn-sm" id="preview" style="margin:0;">👁 Voir comme le mannequin</button>
      </div>
      <div class="due-box" id="due-box">
        <label for="due-date">Prochaine saisie des chiffres</label>
        <input type="date" id="due-date" value="${escapeHtml(business.prochaine_maj || "")}">
        <span id="due-pill" class="due-pill none"></span>
        <button type="button" class="btn ghost btn-sm" id="due-next" title="Décale la date d'un mois, une fois les chiffres saisis">Fait → +1 mois</button>
        <button type="button" class="btn ghost btn-sm" id="due-clear">Effacer</button>
        <span id="due-msg" role="status"></span>
      </div>
      <div class="crm-tabs" role="tablist">${TABS.map((t) => `<button type="button" role="tab" class="btn btn-sm ${t.id === tab ? "primary" : "ghost"}" data-tab="${t.id}">${t.label}</button>`).join("")}</div>
      <div id="tab-body"></div>`;
    app.querySelector("#back").addEventListener("click", showList);
    app.querySelector("#preview").addEventListener("click", () => {
      try { localStorage.setItem("zenoa-espace-apercu", business.id); } catch { /* pas grave */ }
      window.dispatchEvent(new CustomEvent("zenoa:preview", { detail: { id: business.id } }));
      document.querySelector('.nav-item[data-view="espace"]').click();
    });
    // Rappel : se remplit directement ici, s'enregistre tout seul.
    const dueInput = app.querySelector("#due-date");
    const duePill = app.querySelector("#due-pill");
    const dueMsg = app.querySelector("#due-msg");
    const paintDue = () => {
      const info = dueInfo(business.prochaine_maj || null);
      duePill.className = "due-pill " + info.state;
      duePill.textContent = dueLabel(info, business.prochaine_maj);
      app.querySelector("#due-box").classList.toggle("urgent", info.urgent);
      app.querySelector("#due-box").classList.toggle("late", info.state === "late");
    };
    async function saveDue(value) {
      dueMsg.textContent = "";
      dueMsg.className = "";
      const { error } = await supabase.from("espace_businesses").update({ prochaine_maj: value || null }).eq("id", business.id);
      if (error) {
        dueMsg.className = "err";
        dueMsg.textContent = /prochaine_maj/i.test(error.message || "")
          ? "Le rappel n'est pas encore installé : colle espace-rappels.sql dans Supabase (SQL Editor), puis réessaie."
          : "Date non enregistrée : " + error.message;
        dueInput.value = business.prochaine_maj || "";
        return;
      }
      business.prochaine_maj = value || null;
      paintDue();
      refreshDueBadge();
      dueMsg.className = "ok";
      dueMsg.textContent = "Enregistré ✓";
      setTimeout(() => { if (dueMsg.className === "ok") dueMsg.textContent = ""; }, 2500);
    }
    paintDue();
    dueInput.addEventListener("change", () => saveDue(dueInput.value));
    app.querySelector("#due-next").addEventListener("click", () => {
      // +1 mois à partir de la date prévue ; si elle est déjà dépassée de plus d'un mois, on avance jusqu'à une date à venir.
      let next = addOneMonth(business.prochaine_maj || dateKeyOf(new Date()));
      while (daysUntil(next) < 0) next = addOneMonth(next);
      dueInput.value = next;
      saveDue(next);
    });
    app.querySelector("#due-clear").addEventListener("click", () => { dueInput.value = ""; saveDue(""); });

    app.querySelectorAll("[data-tab]").forEach((btn) => btn.addEventListener("click", () => {
      tab = btn.dataset.tab;
      app.querySelectorAll("[data-tab]").forEach((b) => { b.classList.toggle("primary", b === btn); b.classList.toggle("ghost", b !== btn); });
      drawTab();
    }));
    drawTab();
  }

  function drawTab() {
    const box = app.querySelector("#tab-body");
    const draw = { reseaux: tabReseaux, calendrier: tabCalendrier, collabs: tabCollabs, partenaires: tabPartenaires, taches: tabTaches, infos: tabInfos }[tab];
    box.innerHTML = `<p style="color:var(--light-text-dim);font-size:13.5px;">Chargement…</p>`;
    draw(box, selected).catch((err) => {
      console.error("[Clients]", err);
      box.innerHTML = `<p class="error-msg">${isSocialMissing(err) ? SOCIAL_MISSING : "Impossible de charger cet onglet. Réessaie dans un instant."}</p>`;
    });
  }

  // ---------- Onglet : tâches ----------
  async function tabTaches(box, biz) {
    const { data, error } = await supabase.from("espace_tasks").select("id, titre, statut, mois").eq("business_id", biz.id).order("mois", { ascending: false });
    if (error) throw error;
    const tasks = data || [];
    const months = [...new Set(tasks.map((t) => t.mois))].sort().reverse();

    box.innerHTML = `
      <div class="card admin-card">
        <div class="panel-title">Ajouter une tâche</div>
        <form id="task-form">
          <div class="crm-form-grid">
            ${field("Tâche *", `<input type="text" name="titre" maxlength="200" required autocomplete="off" placeholder="Ex : Mettre à jour les photos de la fiche">`, { span: true })}
            ${field("Statut", `<select name="statut">${STATUTS.map((s) => `<option value="${s.key}">${s.label}</option>`).join("")}</select>`)}
            ${field("Mois", `<select name="mois">${monthOptions(currentMonthKey())}</select>`)}
          </div>
          <div id="task-msg" class="error-msg" style="min-height:18px;"></div>
          <button type="submit" class="btn primary" id="task-add">Ajouter la tâche</button>
        </form>
      </div>
      <div class="card admin-card">
        <div class="panel-title">Tâches</div>
        ${months.length ? months.map((m) => `
          <div class="admin-month">${escapeHtml(monthLabel(m))}</div>
          ${tasks.filter((t) => t.mois === m).map((t) => `
            <div class="admin-task" data-id="${t.id}">
              <span class="admin-task-title">${escapeHtml(t.titre)}</span>
              <select data-status aria-label="Statut de la tâche" class="crm-inline-select">${STATUTS.map((s) => `<option value="${s.key}"${s.key === t.statut ? " selected" : ""}>${s.label}</option>`).join("")}</select>
              <button type="button" class="icon-btn" data-del title="Supprimer la tâche" style="flex-shrink:0;">✕</button>
            </div>`).join("")}`).join("") : `<p style="color:var(--light-text-dim);font-size:13.5px;">Aucune tâche pour l'instant.</p>`}
      </div>`;

    const msg = box.querySelector("#task-msg");
    box.querySelector("#task-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      setMsg(msg, "");
      const titre = f.titre.value.trim();
      if (!titre) { setMsg(msg, "Indique la tâche."); return; }
      const { error: addError } = await supabase.from("espace_tasks").insert({ business_id: biz.id, titre, statut: f.statut.value, mois: f.mois.value });
      if (addError) { setMsg(msg, "Ajout impossible : " + addError.message); return; }
      notifyEspaceChanged();
      await tabTaches(box, biz);
      setMsg(box.querySelector("#task-msg"), "Tâche ajoutée ✓", true);
    });
    box.querySelectorAll(".admin-task").forEach((row) => {
      const id = row.dataset.id;
      row.querySelector("[data-status]").addEventListener("change", async (e) => {
        const { error: upError } = await supabase.from("espace_tasks").update({ statut: e.target.value }).eq("id", id);
        if (upError) { setMsg(msg, "Modification impossible."); tabTaches(box, biz); return; }
        notifyEspaceChanged();
      });
      row.querySelector("[data-del]").addEventListener("click", async () => {
        const { error: delError } = await supabase.from("espace_tasks").delete().eq("id", id);
        if (delError) { setMsg(msg, "Suppression impossible."); return; }
        notifyEspaceChanged();
        tabTaches(box, biz);
      });
    });
  }

  // ---------- Onglet : infos et accès ----------
  async function tabInfos(box, biz) {
    // Notes privées : table réservée à l'admin (le mannequin ne peut pas les lire).
    const privRes = await supabase.from("espace_private").select("objectifs, notes").eq("business_id", biz.id).maybeSingle();
    const priv = (privRes.error ? null : privRes.data) || {};
    const nets = reseauxOf(biz);
    box.innerHTML = `
      <div class="card admin-card">
        <div class="panel-title">Informations du mannequin</div>
        <form id="info-form">
          <div class="crm-form-grid">
            ${field("Nom *", `<input type="text" name="nom" maxlength="150" required value="${escapeHtml(biz.nom)}">`, { span: true })}
            ${field("Ville", `<input type="text" name="ville" maxlength="80" value="${escapeHtml(biz.ville || "")}">`, { span: true })}
          </div>
          <div class="field" style="margin-top:6px;"><label class="field-label">Comptes suivis</label>
            ${RESEAUX.map((r) => `<div class="crm-form-grid" style="margin-bottom:6px;"><label class="crm-check" style="align-self:center;"><input type="checkbox" name="reseau" value="${r.key}"${nets.includes(r.key) ? " checked" : ""}> ${r.label}</label><input type="text" name="compte_${r.key}" maxlength="80" placeholder="@pseudo" aria-label="Compte ${r.label}" value="${escapeHtml((biz.comptes || {})[r.key] || "")}"></div>`).join("")}
          </div>
          <div class="crm-form-grid" style="margin-top:10px;">
            ${field("Objectifs du mannequin (privé)", `<textarea name="objectifs" rows="3" maxlength="2000" placeholder="Ce qu'il veut obtenir…">${escapeHtml(priv.objectifs || "")}</textarea>`, { span: true })}
            ${field("Notes importantes (privées)", `<textarea name="notes" rows="4" maxlength="4000" placeholder="Repris de la prospection, modifiable à tout moment">${escapeHtml(priv.notes || "")}</textarea>`, { span: true })}
          </div>
          <div class="admin-hint">Ces notes ne sont visibles que par toi, jamais par le mannequin.</div>
          <div id="info-msg" class="error-msg" style="min-height:18px;"></div>
          <button type="submit" class="btn primary" id="info-save">Enregistrer</button>
        </form>
      </div>
      <div class="card admin-card">
        <div class="panel-title">Accès du mannequin</div>
        <div id="account-box"><p style="color:var(--light-text-dim);font-size:13.5px;">Chargement…</p></div>
      </div>
      <div class="card admin-card">
        <div class="panel-title">Données personnelles (RGPD)</div>
        <p style="font-size:13px;color:var(--light-text-dim);margin-bottom:12px;max-width:520px;">Si ce mannequin demande une copie de ses données, télécharge-la ici (fichier JSON). Pour un droit à l'effacement, utilise « Supprimer ce mannequin » ci-dessous.</p>
        <div id="export-msg" class="error-msg" style="min-height:18px;"></div>
        <button type="button" class="btn ghost btn-sm" id="client-export">Exporter les données du mannequin</button>
      </div>
      <div class="card admin-card" style="border-color:#d9534f4d;">
        <div class="panel-title" style="color:var(--danger);">Zone dangereuse</div>
        <p style="font-size:13px;color:var(--light-text-dim);margin-bottom:12px;max-width:520px;">Supprime ce mannequin, son compte, ses statistiques, son calendrier, ses collaborations, ses tâches et ses messages. Cette action est irréversible.</p>
        <button type="button" class="btn danger btn-sm" id="client-delete">Supprimer ce mannequin</button>
      </div>`;

    const msg = box.querySelector("#info-msg");
    box.querySelector("#info-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      setMsg(msg, "");
      const nom = f.nom.value.trim();
      if (!nom) { setMsg(msg, "Le nom est obligatoire."); return; }
      const btn = box.querySelector("#info-save");
      const reseaux = [...f.querySelectorAll('input[name="reseau"]:checked')].map((i) => i.value);
      const comptes = Object.fromEntries(RESEAUX.map((r) => [r.key, f[`compte_${r.key}`].value.trim()]).filter(([, v]) => v));
      btn.disabled = true;
      const { data: saved, error: saveError } = await supabase.from("espace_businesses").update({ nom, ville: f.ville.value.trim() || null, reseaux, comptes }).eq("id", biz.id).select("*").single();
      // Notes privées dans leur table (la ligne est créée au premier enregistrement).
      let privError = null;
      if (!saveError) {
        const res = await supabase.from("espace_private").upsert({ business_id: biz.id, objectifs: f.objectifs.value.trim() || null, notes: f.notes.value.trim() || null }, { onConflict: "business_id" });
        privError = res.error;
      }
      btn.disabled = false;
      if (saveError || privError) {
        const err = saveError || privError;
        setMsg(msg, isSocialMissing(err) || /espace_private|reseaux|comptes/i.test(err.message || "") ? SOCIAL_MISSING + " (et partenaires.sql)" : "Enregistrement impossible : " + err.message);
        return;
      }
      selected = saved;
      Object.assign(biz, saved);
      notifyEspaceChanged();
      app.querySelector("#sheet-title").textContent = saved.nom;
      app.querySelector(".clients-sub").textContent = [saved.ville].filter(Boolean).join(" · ");
      setMsg(msg, "Informations enregistrées ✓", true);
    });

    // Accès : email, dernière connexion, mot de passe temporaire.
    const accountBox = box.querySelector("#account-box");
    callAdmin("get_account", { business_id: biz.id }).then((acc) => {
      if (!acc.email) {
        accountBox.innerHTML = `<p style="color:var(--light-text-dim);font-size:13.5px;">Aucun compte de connexion n'est rattaché à ce client (par exemple un exemple de démonstration).</p>`;
        return;
      }
      accountBox.innerHTML = `
        <div class="admin-account">
          <div><em>Email de connexion</em><b>${escapeHtml(acc.email)}</b></div>
          <div><em>Dernière connexion</em><b>${acc.last_sign_in_at ? formatDate(acc.last_sign_in_at.slice(0, 10)) : "Jamais connecté"}</b></div>
          <div><em>Mot de passe</em><b>${acc.must_change_password ? "Temporaire (à changer)" : "Choisi par le client"}</b></div>
        </div>
        <div id="account-msg" class="error-msg" style="min-height:18px;"></div>
        <button type="button" class="btn ghost btn-sm" id="reset-pw">Générer un nouveau mot de passe temporaire</button>`;
      accountBox.querySelector("#reset-pw").addEventListener("click", async () => {
        const ok = await window.confirmDialog("Générer un nouveau mot de passe temporaire ? L'ancien ne fonctionnera plus.", { confirmLabel: "Générer" });
        if (!ok) return;
        try {
          const res = await callAdmin("reset_password", { business_id: biz.id });
          showCredentials({ title: "Nouveau mot de passe", email: res.email, tempPassword: res.temp_password, onClose: () => drawTab() });
        } catch (err) {
          setMsg(accountBox.querySelector("#account-msg"), err.message);
        }
      });
    }).catch((err) => {
      accountBox.innerHTML = `<p class="error-msg">${escapeHtml(err.message)}</p>`;
    });

    box.querySelector("#client-export").addEventListener("click", async () => {
      const exportMsg = box.querySelector("#export-msg");
      setMsg(exportMsg, "");
      const { data, error } = await supabase.rpc("espace_export_business", { p_business_id: biz.id });
      if (error) { setMsg(exportMsg, "Export impossible (la mise à jour securite.sql est-elle installée ?)."); return; }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "export-" + biz.nom.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + "-" + new Date().toISOString().slice(0, 10) + ".json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      setMsg(exportMsg, "Export téléchargé ✓", true);
    });

    box.querySelector("#client-delete").addEventListener("click", async () => {
      const ok = await window.confirmDialog(`Supprimer « ${biz.nom} » ? Son compte, ses statistiques, son calendrier, ses collaborations, ses tâches et ses messages seront définitivement supprimés.`, { danger: true, confirmLabel: "Supprimer" });
      if (!ok) return;
      try {
        await callAdmin("delete_client", { business_id: biz.id });
        notifyEspaceChanged();
        showList();
      } catch (err) {
        setMsg(msg, err.message);
      }
    });
  }

  refreshDueBadge();
  await showList();
}
