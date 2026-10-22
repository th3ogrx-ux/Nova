// Espace admin — gestion des clients : liste, création de compte, et fiche
// client (chiffres du mois, avis, tâches, infos et accès). Réservé à l'admin :
// les droits sont dans la base (espace.sql) et dans la fonction "espace-admin".
import { supabase } from "../supabase.js";
import { openModal } from "../modal.js";
import { callAdmin, notifyEspaceChanged } from "./espace-admin-api.js";
import { escapeHtml, formatDate, formatRating, monthLabel, currentMonthKey, METRICS, enabledMetrics } from "./espace-data.js";

const TABS = [
  { id: "chiffres", label: "Chiffres du mois" },
  { id: "avis", label: "Avis" },
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
const numField = (name, label, value = "") => field(label, `<input type="number" name="${name}" min="0" max="100000000" step="1" inputmode="numeric" required value="${escapeHtml(value)}">`);
const stars = (n) => `<span class="espace-stars" role="img" aria-label="${n} sur 5">${"★".repeat(n)}<span class="espace-stars-off">${"★".repeat(5 - n)}</span></span>`;

// Cases "chiffres à suivre" (création et fiche d'un client).
function metricChecks(selected) {
  return `<div class="metric-checks" role="group" aria-label="Chiffres à suivre">${METRICS.map((m) => `
    <label class="crm-check"><input type="checkbox" name="metrique" value="${m.key}"${selected.includes(m.key) ? " checked" : ""}> ${m.label}</label>`).join("")}</div>`;
}
const readMetrics = (form) => [...form.querySelectorAll('input[name="metrique"]:checked')].map((i) => i.value);
const sameMetrics = (a, b) => a.length === b.length && a.every((k) => b.includes(k));

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
  const message = `Bonjour,\n\nVoici votre accès à Zenoa Espace, pour suivre la visibilité Google de votre commerce :\n${location.origin}\n\nEmail : ${email}\nMot de passe temporaire : ${tempPassword}\n\nVous choisirez votre propre mot de passe à la première connexion.`;
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
  let tab = "chiffres";

  // =================== LISTE ===================
  async function showList() {
    selected = null;
    app.innerHTML = `<h1 class="page-title">Clients</h1><p style="color:var(--light-text-dim);font-size:14px;">Chargement…</p>`;
    const [biz, reviews, unread, stats] = await Promise.all([
      supabase.from("espace_businesses").select("*").order("nom"), // "*" : fonctionne aussi avant l'ajout de la colonne "metriques"
      supabase.from("espace_reviews").select("business_id, note, repondu").limit(5000),
      supabase.from("espace_messages").select("business_id").eq("lu", false).eq("auteur", "client").limit(5000),
      supabase.from("espace_monthly_stats").select("business_id, updated_at").order("updated_at", { ascending: false }).limit(5000)
    ]);
    const failed = biz.error || reviews.error || unread.error || stats.error;
    if (failed) {
      app.innerHTML = `<h1 class="page-title">Clients</h1><p class="error-msg">Impossible de charger les clients.</p>`;
      return;
    }
    const rows = (biz.data || []).map((b) => {
      const rs = (reviews.data || []).filter((r) => r.business_id === b.id);
      const lastStat = (stats.data || []).find((s) => s.business_id === b.id);
      return {
        b,
        count: rs.length,
        avg: rs.length ? rs.reduce((sum, r) => sum + r.note, 0) / rs.length : null,
        toAnswer: rs.filter((r) => !r.repondu).length,
        unread: (unread.data || []).filter((m) => m.business_id === b.id).length,
        updated: lastStat ? lastStat.updated_at.slice(0, 10) : null
      };
    });

    app.innerHTML = `
      <div class="clients-head">
        <div><h1 class="page-title">Clients</h1><p class="clients-sub">${rows.length} commerce${rows.length > 1 ? "s" : ""}</p></div>
        <button type="button" class="btn primary" id="client-new" style="margin:0;">+ Nouveau client</button>
      </div>
      ${rows.length ? `<div class="clients-list">${rows.map(({ b, count, avg, toAnswer, unread: nu, updated }) => `
        <button type="button" class="card client-row" data-id="${b.id}">
          <div class="client-main">
            <strong>${escapeHtml(b.nom)}${b.is_example ? ` <span class="status-pill neutral" style="margin-left:6px;">Exemple</span>` : ""}</strong>
            <span>${escapeHtml([b.secteur, b.ville].filter(Boolean).join(" · ") || "—")}</span>
          </div>
          <div class="client-metric"><em>Note moyenne</em>${avg === null ? "—" : `<b>${formatRating(avg)} <span style="color:#f4b740;">★</span></b><small>${count} avis</small>`}</div>
          <div class="client-metric"><em>Avis à répondre</em><b class="${toAnswer ? "warn" : ""}">${toAnswer}</b></div>
          <div class="client-metric"><em>Messages non lus</em><b class="${nu ? "alert" : ""}">${nu}</b></div>
          <div class="client-metric"><em>Dernière mise à jour</em><b style="font-size:13px;">${updated ? formatDate(updated) : "Jamais"}</b></div>
        </button>`).join("")}</div>`
        : `<div class="card" style="padding:20px;"><p style="color:var(--light-text-dim);font-size:14px;">Aucun client pour l'instant. Clique sur « + Nouveau client » pour créer le premier.</p></div>`}
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
        <h2 style="font-size:16px;font-weight:700;letter-spacing:normal;text-transform:none;margin:0;">Nouveau client</h2>
        <button type="button" class="icon-btn" data-close title="Fermer" style="width:30px;height:30px;">✕</button>
      </div>
      <form id="create-form">
        ${field("Nom du commerce *", `<input type="text" name="nom" maxlength="150" required autocomplete="off">`)}
        <div class="crm-form-grid">
          ${field("Secteur", `<input type="text" name="secteur" maxlength="80" placeholder="Barbier, plombier…" autocomplete="off">`)}
          ${field("Ville", `<input type="text" name="ville" maxlength="80" autocomplete="off">`)}
        </div>
        ${field("Email du contact *", `<input type="email" name="email" maxlength="200" required autocomplete="off" placeholder="contact@commerce.fr">`)}
        <div class="field"><label class="field-label" id="metrics-label">Chiffres à suivre pour ce client</label>${metricChecks(METRICS.map((m) => m.key))}
          <p style="font-size:12px;color:var(--text-dim);margin:4px 0 0;">Décoche ceux qui n'ont pas de sens pour ce commerce (ex. « Itinéraires » pour un électricien).</p></div>
        <p style="font-size:12.5px;color:var(--text-dim);line-height:1.5;margin-bottom:6px;">
          Un compte est créé avec un mot de passe temporaire, que tu transmets au client. Il devra en choisir un à lui à sa première connexion.
        </p>
        <div class="error-msg" id="create-error"></div>
        <div class="modal-actions"><button type="button" class="btn ghost" data-close>Annuler</button><button type="submit" class="btn primary" id="create-submit">Créer le client</button></div>
      </form>`);
    overlay.querySelector("#create-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const errorEl = overlay.querySelector("#create-error");
      const btn = overlay.querySelector("#create-submit");
      errorEl.textContent = "";
      const metrics = readMetrics(f);
      if (!metrics.length) { errorEl.textContent = "Garde au moins un chiffre à suivre."; return; }
      btn.disabled = true;
      btn.textContent = "Création…";
      try {
        const res = await callAdmin("create_client", { nom: f.nom.value, secteur: f.secteur.value, ville: f.ville.value, email: f.email.value });
        // Chiffres choisis pour ce client (tous cochés = réglage par défaut, rien à enregistrer).
        let note = null;
        if (!sameMetrics(metrics, METRICS.map((m) => m.key))) {
          const { error: metricsError } = await supabase.from("espace_businesses").update({ metriques: metrics }).eq("id", res.business_id);
          if (metricsError) note = "Le client est créé, mais le choix des chiffres n'a pas pu être enregistré : colle d'abord espace-metriques.sql dans Supabase, puis règle-le dans sa fiche (onglet « Infos & accès »).";
        }
        close();
        showCredentials({
          title: "Client créé ✓",
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
        btn.textContent = "Créer le client";
      }
    });
  }

  // =================== FICHE CLIENT ===================
  function showSheet(business) {
    selected = business;
    app.innerHTML = `
      <button type="button" class="btn ghost btn-sm" id="back" style="margin-bottom:14px;">← Tous les clients</button>
      <div class="clients-head">
        <div><h1 class="page-title" id="sheet-title">${escapeHtml(business.nom)}</h1><p class="clients-sub">${escapeHtml([business.secteur, business.ville].filter(Boolean).join(" · "))}</p></div>
        <button type="button" class="btn ghost btn-sm" id="preview" style="margin:0;">👁 Voir comme le client</button>
      </div>
      <div class="crm-tabs" role="tablist">${TABS.map((t) => `<button type="button" role="tab" class="btn btn-sm ${t.id === tab ? "primary" : "ghost"}" data-tab="${t.id}">${t.label}</button>`).join("")}</div>
      <div id="tab-body"></div>`;
    app.querySelector("#back").addEventListener("click", showList);
    app.querySelector("#preview").addEventListener("click", () => {
      try { localStorage.setItem("zenoa-espace-apercu", business.id); } catch { /* pas grave */ }
      window.dispatchEvent(new CustomEvent("zenoa:preview", { detail: { id: business.id } }));
      document.querySelector('.nav-item[data-view="espace"]').click();
    });
    app.querySelectorAll("[data-tab]").forEach((btn) => btn.addEventListener("click", () => {
      tab = btn.dataset.tab;
      app.querySelectorAll("[data-tab]").forEach((b) => { b.classList.toggle("primary", b === btn); b.classList.toggle("ghost", b !== btn); });
      drawTab();
    }));
    drawTab();
  }

  function drawTab() {
    const box = app.querySelector("#tab-body");
    const draw = { chiffres: tabChiffres, avis: tabAvis, taches: tabTaches, infos: tabInfos }[tab];
    box.innerHTML = `<p style="color:var(--light-text-dim);font-size:13.5px;">Chargement…</p>`;
    draw(box, selected).catch((err) => {
      console.error("[Clients]", err);
      box.innerHTML = `<p class="error-msg">Impossible de charger cet onglet. Réessaie dans un instant.</p>`;
    });
  }

  // ---------- Onglet : chiffres du mois ----------
  async function tabChiffres(box, biz) {
    const { data, error } = await supabase.from("espace_monthly_stats").select("*").eq("business_id", biz.id).order("mois", { ascending: false }).limit(36);
    if (error) throw error;
    const stats = data || [];
    const byMonth = Object.fromEntries(stats.map((s) => [s.mois, s]));
    const start = previousMonthKey();
    const shown = METRICS.filter((m) => enabledMetrics(biz).includes(m.key)); // chiffres suivis pour ce client

    box.innerHTML = `
      <div class="card admin-card">
        <div class="panel-title">Saisir les chiffres d'un mois</div>
        <form id="stats-form">
          <div class="crm-form-grid">
            ${field("Mois", `<select name="mois">${monthOptions(start)}</select>`, { span: true })}
            ${shown.map((m) => numField(m.key, m.label)).join("")}
          </div>
          <div id="stats-hint" class="admin-hint"></div>
          <div id="stats-msg" class="error-msg" style="min-height:18px;"></div>
          <button type="submit" class="btn primary" id="stats-save">Enregistrer</button>
        </form>
      </div>
      <div class="card admin-card">
        <div class="panel-title">Mois déjà saisis</div>
        ${stats.length ? `<div class="crm-table-wrap" style="border:0;"><table class="crm-table">
          <thead><tr><th>Mois</th>${shown.map((m) => `<th>${escapeHtml(m.label)}</th>`).join("")}<th><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>${stats.map((s) => `<tr data-mois="${s.mois}"><td style="font-weight:700;">${escapeHtml(monthLabel(s.mois))}</td>${shown.map((m) => `<td>${s[m.key]}</td>`).join("")}
            <td style="text-align:right;white-space:nowrap;"><button type="button" class="btn btn-sm ghost" data-edit>Modifier</button> <button type="button" class="icon-btn" data-del title="Supprimer" style="display:inline-flex;">✕</button></td></tr>`).join("")}</tbody></table></div>`
          : `<p style="color:var(--light-text-dim);font-size:13.5px;">Aucun chiffre saisi pour l'instant.</p>`}
      </div>`;

    const form = box.querySelector("#stats-form");
    const hint = box.querySelector("#stats-hint");
    const msg = box.querySelector("#stats-msg");
    const fill = () => {
      const existing = byMonth[form.mois.value];
      shown.forEach((m) => { form[m.key].value = existing ? existing[m.key] : ""; });
      hint.textContent = existing ? "Ce mois est déjà saisi : l'enregistrement va le modifier." : "";
    };
    form.mois.addEventListener("change", fill);
    form.addEventListener("input", () => setMsg(msg, ""));
    fill();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setMsg(msg, "");
      // Seuls les chiffres suivis sont envoyés : les autres gardent leur valeur actuelle.
      const values = Object.fromEntries(shown.map((m) => [m.key, Number(form[m.key].value)]));
      if (Object.values(values).some((v) => !Number.isInteger(v) || v < 0)) { setMsg(msg, "Indique des nombres entiers positifs."); return; }
      const btn = box.querySelector("#stats-save");
      btn.disabled = true;
      const { error: saveError } = await supabase.from("espace_monthly_stats").upsert(
        { business_id: biz.id, mois: form.mois.value, ...values, updated_at: new Date().toISOString() },
        { onConflict: "business_id,mois" }
      );
      btn.disabled = false;
      if (saveError) { setMsg(msg, "Enregistrement impossible : " + saveError.message); return; }
      notifyEspaceChanged();
      await tabChiffres(box, biz);
      setMsg(box.querySelector("#stats-msg"), "Chiffres enregistrés ✓", true);
    });

    box.querySelectorAll("tr[data-mois]").forEach((tr) => {
      tr.querySelector("[data-edit]").addEventListener("click", () => {
        form.mois.value = tr.dataset.mois; fill();
        form.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      tr.querySelector("[data-del]").addEventListener("click", async () => {
        const ok = await window.confirmDialog(`Supprimer les chiffres de ${monthLabel(tr.dataset.mois)} ?`, { danger: true, confirmLabel: "Supprimer" });
        if (!ok) return;
        const { error: delError } = await supabase.from("espace_monthly_stats").delete().eq("business_id", biz.id).eq("mois", tr.dataset.mois);
        if (delError) { setMsg(msg, "Suppression impossible."); return; }
        notifyEspaceChanged();
        tabChiffres(box, biz);
      });
    });
  }

  // ---------- Onglet : avis ----------
  let reviewFilter = "all";
  async function tabAvis(box, biz) {
    const { data, error } = await supabase.from("espace_reviews").select("id, auteur, note, texte, date, repondu, reponse").eq("business_id", biz.id).order("date", { ascending: false });
    if (error) throw error;
    const reviews = data || [];
    const toAnswer = reviews.filter((r) => !r.repondu).length;
    const shown = reviewFilter === "toanswer" ? reviews.filter((r) => !r.repondu) : reviews;

    box.innerHTML = `
      <div class="card admin-card">
        <div class="panel-title">Ajouter un avis</div>
        <form id="review-form">
          <div class="crm-form-grid">
            ${field("Prénom ou pseudo *", `<input type="text" name="auteur" maxlength="80" required autocomplete="off">`)}
            ${field("Note *", `<select name="note">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${"★".repeat(n)}${"☆".repeat(5 - n)}  (${n})</option>`).join("")}</select>`)}
            ${field("Date", `<input type="date" name="date" value="${todayKey()}" max="${todayKey()}" required>`, { span: true })}
            ${field("Texte de l'avis", `<textarea name="texte" rows="3" maxlength="2000"></textarea>`, { span: true })}
          </div>
          <div id="review-msg" class="error-msg" style="min-height:18px;"></div>
          <button type="submit" class="btn primary" id="review-add">Ajouter l'avis</button>
        </form>
      </div>
      <div class="card admin-card">
        <div class="admin-toolbar">
          <div class="panel-title" style="margin:0;">Avis (${reviews.length})</div>
          <div class="crm-views">
            <button type="button" class="crm-view-btn${reviewFilter === "all" ? " active" : ""}" data-filter="all">Tous</button>
            <button type="button" class="crm-view-btn${reviewFilter === "toanswer" ? " active" : ""}" data-filter="toanswer">À répondre${toAnswer ? ` <span class="crm-badge">${toAnswer}</span>` : ""}</button>
          </div>
        </div>
        ${shown.length ? shown.map((r) => `
          <article class="espace-review${r.repondu ? "" : " to-answer"}" data-id="${r.id}">
            <div class="espace-review-head">${stars(r.note)}<strong>${escapeHtml(r.auteur)}</strong><span class="espace-review-date">${formatDate(r.date)}</span>
              ${r.repondu ? "" : `<span class="status-pill warning" style="margin-left:auto;">En attente de réponse</span>`}</div>
            ${r.texte ? `<p class="espace-review-text">${escapeHtml(r.texte)}</p>` : ""}
            ${r.repondu && r.reponse ? `<div class="espace-reply" data-reply-view><span>Ta réponse</span>${escapeHtml(r.reponse)}</div>` : ""}
            <div data-reply-box ${r.repondu ? "hidden" : ""} style="margin-top:10px;">
              <textarea rows="2" maxlength="2000" data-reply placeholder="Ta réponse à cet avis…">${escapeHtml(r.reponse || "")}</textarea>
            </div>
            <div class="admin-actions">
              <button type="button" class="btn btn-sm primary" data-save-reply ${r.repondu ? "hidden" : ""}>Publier la réponse</button>
              ${r.repondu ? `<button type="button" class="btn btn-sm ghost" data-edit-reply>Modifier la réponse</button>` : ""}
              <button type="button" class="btn btn-sm danger" data-delete-review style="margin-left:auto;">Supprimer</button>
            </div>
          </article>`).join("") : `<p style="color:var(--light-text-dim);font-size:13.5px;">${reviewFilter === "toanswer" ? "Aucun avis en attente de réponse 🎉" : "Aucun avis pour l'instant."}</p>`}
      </div>`;

    const msg = box.querySelector("#review-msg");
    box.querySelector("#review-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      setMsg(msg, "");
      const auteur = f.auteur.value.trim();
      if (!auteur) { setMsg(msg, "Indique le prénom ou le pseudo."); return; }
      const btn = box.querySelector("#review-add");
      btn.disabled = true;
      const { error: addError } = await supabase.from("espace_reviews").insert({
        business_id: biz.id, auteur, note: Number(f.note.value), date: f.date.value, texte: f.texte.value.trim() || null
      });
      btn.disabled = false;
      if (addError) { setMsg(msg, "Ajout impossible : " + addError.message); return; }
      notifyEspaceChanged();
      await tabAvis(box, biz);
      setMsg(box.querySelector("#review-msg"), "Avis ajouté ✓", true);
    });
    box.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => { reviewFilter = b.dataset.filter; tabAvis(box, biz); }));

    box.querySelectorAll("article[data-id]").forEach((card) => {
      const id = card.dataset.id;
      const replyBox = card.querySelector("[data-reply-box]");
      const saveBtn = card.querySelector("[data-save-reply]");
      const editBtn = card.querySelector("[data-edit-reply]");
      if (editBtn) editBtn.addEventListener("click", () => {
        replyBox.hidden = false; saveBtn.hidden = false; editBtn.hidden = true;
        card.querySelector("[data-reply-view]")?.setAttribute("hidden", "");
        card.querySelector("[data-reply]").focus();
      });
      saveBtn.addEventListener("click", async () => {
        const reponse = card.querySelector("[data-reply]").value.trim();
        saveBtn.disabled = true;
        const { error: replyError } = await supabase.from("espace_reviews").update({ repondu: !!reponse, reponse: reponse || null }).eq("id", id);
        if (replyError) { saveBtn.disabled = false; setMsg(msg, "Réponse non enregistrée : " + replyError.message); return; }
        notifyEspaceChanged();
        tabAvis(box, biz);
      });
      card.querySelector("[data-delete-review]").addEventListener("click", async () => {
        const ok = await window.confirmDialog("Supprimer cet avis ?", { danger: true, confirmLabel: "Supprimer" });
        if (!ok) return;
        const { error: delError } = await supabase.from("espace_reviews").delete().eq("id", id);
        if (delError) { setMsg(msg, "Suppression impossible."); return; }
        notifyEspaceChanged();
        tabAvis(box, biz);
      });
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
    box.innerHTML = `
      <div class="card admin-card">
        <div class="panel-title">Informations du commerce</div>
        <form id="info-form">
          <div class="crm-form-grid">
            ${field("Nom du commerce *", `<input type="text" name="nom" maxlength="150" required value="${escapeHtml(biz.nom)}">`, { span: true })}
            ${field("Secteur", `<input type="text" name="secteur" maxlength="80" value="${escapeHtml(biz.secteur || "")}">`)}
            ${field("Ville", `<input type="text" name="ville" maxlength="80" value="${escapeHtml(biz.ville || "")}">`)}
            ${field("Lien d'avis Google", `<input type="url" name="lien" maxlength="500" placeholder="https://search.google.com/local/writereview?placeid=…" value="${escapeHtml(biz.lien_avis_google || "")}">`, { span: true })}
          </div>
          <div class="admin-hint">Ce lien sert au QR code « Demander des avis » que voit le client.</div>
          <div class="field" style="margin-top:10px;"><label class="field-label">Chiffres à suivre pour ce client</label>${metricChecks(enabledMetrics(biz))}
            <div class="admin-hint">Seuls les chiffres cochés sont affichés au client et à saisir chaque mois. Les autres ne sont pas supprimés : tu peux les ré-afficher quand tu veux.</div></div>
          <div id="info-msg" class="error-msg" style="min-height:18px;"></div>
          <button type="submit" class="btn primary" id="info-save">Enregistrer</button>
        </form>
      </div>
      <div class="card admin-card">
        <div class="panel-title">Accès du client</div>
        <div id="account-box"><p style="color:var(--light-text-dim);font-size:13.5px;">Chargement…</p></div>
      </div>
      <div class="card admin-card" style="border-color:#d9534f4d;">
        <div class="panel-title" style="color:var(--danger);">Zone dangereuse</div>
        <p style="font-size:13px;color:var(--light-text-dim);margin-bottom:12px;max-width:520px;">Supprime ce client, son compte, ses chiffres, ses avis, ses tâches et ses messages. Cette action est irréversible.</p>
        <button type="button" class="btn danger btn-sm" id="client-delete">Supprimer ce client</button>
      </div>`;

    const msg = box.querySelector("#info-msg");
    box.querySelector("#info-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      setMsg(msg, "");
      const nom = f.nom.value.trim();
      const lien = f.lien.value.trim();
      if (!nom) { setMsg(msg, "Le nom du commerce est obligatoire."); return; }
      if (lien && !safeHttpUrl(lien)) { setMsg(msg, "Le lien doit commencer par https://"); return; }
      const btn = box.querySelector("#info-save");
      const metrics = readMetrics(f);
      if (!metrics.length) { setMsg(msg, "Garde au moins un chiffre à suivre."); return; }
      const patch = { nom, secteur: f.secteur.value.trim() || null, ville: f.ville.value.trim() || null, lien_avis_google: lien || null };
      if (!sameMetrics(metrics, enabledMetrics(biz))) patch.metriques = metrics; // seulement si modifié
      btn.disabled = true;
      const { data: saved, error: saveError } = await supabase.from("espace_businesses").update(patch).eq("id", biz.id).select("*").single();
      btn.disabled = false;
      if (saveError) {
        setMsg(msg, /metriques/i.test(saveError.message || "")
          ? "Le choix des chiffres n'est pas encore installé : colle espace-metriques.sql dans Supabase (SQL Editor), puis réessaie."
          : "Enregistrement impossible : " + saveError.message);
        return;
      }
      selected = saved;
      Object.assign(biz, saved);
      app.querySelector("#sheet-title").textContent = saved.nom;
      app.querySelector(".clients-sub").textContent = [saved.secteur, saved.ville].filter(Boolean).join(" · ");
      notifyEspaceChanged();
      setMsg(msg, "Informations enregistrées ✓", true);
    });

    // Accès : email, dernière connexion, mot de passe temporaire.
    const accountBox = box.querySelector("#account-box");
    callAdmin("get_account", { business_id: biz.id }).then((acc) => {
      if (!acc.email) {
        accountBox.innerHTML = `<p style="color:var(--light-text-dim);font-size:13.5px;">Aucun compte de connexion n'est rattaché à ce commerce (par exemple un exemple de démonstration).</p>`;
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

    box.querySelector("#client-delete").addEventListener("click", async () => {
      const ok = await window.confirmDialog(`Supprimer « ${biz.nom} » ? Son compte, ses chiffres, ses avis, ses tâches et ses messages seront définitivement supprimés.`, { danger: true, confirmLabel: "Supprimer" });
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

  await showList();
}
