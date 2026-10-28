// Fiche client : onglets « Réseaux », « Calendrier » et « Collabs » (saisie par l'admin ; le client les voit en lecture seule).
import { supabase } from "../supabase.js";
import { notifyEspaceChanged } from "./espace-admin-api.js";
import {
  escapeHtml, monthLabel, formatDate, formatNumber, RESEAUX, reseauxOf, reseauLabel, SOCIAL_FIELDS, POST_FORMATS, formatLabel,
  COLLAB_STATUTS, COLLAB_NATURES, statutLabel, natureLabel, formatEuro
} from "./espace-data.js";

export const MISSING = "Les réseaux sociaux ne sont pas encore installés : colle espace-reseaux.sql dans Supabase (SQL Editor > Run), puis recharge la page.";
export const isMissing = (err) => !!err && /espace_social_stats|espace_posts|espace_collabs|schema cache|42P01|PGRST205/i.test(`${err.code || ""} ${err.message || ""}`);

const monthKeyOf = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-01";
const todayKey = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
function monthOptions(selected) {
  const now = new Date(), keys = [];
  for (let i = -1; i < 24; i++) keys.push(monthKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  return keys.map((k) => `<option value="${k}"${k === selected ? " selected" : ""}>${escapeHtml(monthLabel(k))}</option>`).join("");
}
const field = (label, inner, span = false) => `<div class="field${span ? " crm-span-2" : ""}"><label class="field-label">${label}</label>${inner}</div>`;
const opts = (list, selected) => list.map((o) => `<option value="${o.key}"${o.key === selected ? " selected" : ""}>${escapeHtml(o.label)}</option>`).join("");
const setMsg = (el, text, ok = false) => { el.textContent = text; el.style.color = ok ? "var(--ok)" : ""; };
const httpUrl = (v) => { try { const u = new URL(v); return /^https?:$/.test(u.protocol); } catch { return false; } };
const noNet = `<div class="card admin-card"><p style="color:var(--light-text-dim);font-size:13.5px;margin:0;">Aucun réseau choisi pour ce client. Coche Instagram, TikTok ou LinkedIn dans l'onglet « Infos &amp; accès ».</p></div>`;

// =================== Statistiques par réseau ===================
export async function tabReseaux(box, biz) {
  const nets = reseauxOf(biz);
  if (!nets.length) { box.innerHTML = noNet; return; }
  const { data, error } = await supabase.from("espace_social_stats").select("*").eq("business_id", biz.id).order("mois", { ascending: false }).limit(240);
  if (error) throw error;
  const rows = data || [];
  const months = [...new Set(rows.map((r) => r.mois))];
  const get = (mois, net) => rows.find((r) => r.mois === mois && r.reseau === net);
  const prevMonth = monthKeyOf(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));

  box.innerHTML = `
    <div class="card admin-card">
      <div class="panel-title">Saisir les chiffres d'un mois</div>
      <form id="social-form">
        ${field("Mois", `<select name="mois">${monthOptions(prevMonth)}</select>`)}
        ${nets.map((n) => `<fieldset class="soc-set"><legend>${escapeHtml(reseauLabel(n))}</legend><div class="crm-form-grid">
          ${SOCIAL_FIELDS.map((f) => field(f.label, `<input type="number" name="${n}__${f.key}" min="0" max="2000000000" step="1" inputmode="numeric" required>`)).join("")}
        </div></fieldset>`).join("")}
        <div id="social-hint" class="admin-hint"></div>
        <div id="social-msg" class="error-msg" style="min-height:18px;"></div>
        <button type="submit" class="btn primary" id="social-save">Enregistrer</button>
      </form>
    </div>
    <div class="card admin-card">
      <div class="panel-title">Mois déjà saisis</div>
      ${months.length ? `<div class="crm-table-wrap" style="border:0;"><table class="crm-table crm-stack"><thead><tr><th>Mois</th>${nets.map((n) => `<th>${escapeHtml(reseauLabel(n))} (abonnés · vues)</th>`).join("")}<th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${months.map((m) => `<tr data-mois="${m}"><td style="font-weight:700;">${escapeHtml(monthLabel(m))}</td>${nets.map((n) => { const r = get(m, n); return `<td data-label="${escapeHtml(reseauLabel(n))}">${r ? `${formatNumber(r.abonnes)} · ${formatNumber(r.vues)}` : "—"}</td>`; }).join("")}
          <td style="text-align:right;white-space:nowrap;"><button type="button" class="btn btn-sm ghost" data-edit>Modifier</button> <button type="button" class="icon-btn" data-del title="Supprimer" style="display:inline-flex;">✕</button></td></tr>`).join("")}</tbody></table></div>`
        : `<p style="color:var(--light-text-dim);font-size:13.5px;">Aucun chiffre saisi pour l'instant.</p>`}
    </div>`;

  const form = box.querySelector("#social-form"), hint = box.querySelector("#social-hint"), msg = box.querySelector("#social-msg");
  const fill = () => {
    let any = false;
    nets.forEach((n) => SOCIAL_FIELDS.forEach((f) => { const r = get(form.mois.value, n); form[`${n}__${f.key}`].value = r ? r[f.key] : ""; if (r) any = true; }));
    hint.textContent = any ? "Ce mois est déjà saisi : l'enregistrement va le modifier." : "";
  };
  form.mois.addEventListener("change", fill); form.addEventListener("input", () => setMsg(msg, "")); fill();

  form.addEventListener("submit", async (e) => {
    e.preventDefault(); setMsg(msg, "");
    const payload = nets.map((n) => ({
      business_id: biz.id, mois: form.mois.value, reseau: n, updated_at: new Date().toISOString(),
      ...Object.fromEntries(SOCIAL_FIELDS.map((f) => [f.key, Number(form[`${n}__${f.key}`].value)]))
    }));
    if (payload.some((r) => SOCIAL_FIELDS.some((f) => !Number.isInteger(r[f.key]) || r[f.key] < 0))) { setMsg(msg, "Indique des nombres entiers positifs."); return; }
    const btn = box.querySelector("#social-save"); btn.disabled = true;
    const { error: saveError } = await supabase.from("espace_social_stats").upsert(payload, { onConflict: "business_id,mois,reseau" });
    btn.disabled = false;
    if (saveError) { setMsg(msg, isMissing(saveError) ? MISSING : "Enregistrement impossible : " + saveError.message); return; }
    notifyEspaceChanged();
    await tabReseaux(box, biz);
    setMsg(box.querySelector("#social-msg"), "Chiffres enregistrés ✓", true);
  });
  box.querySelectorAll("tr[data-mois]").forEach((tr) => {
    tr.querySelector("[data-edit]").addEventListener("click", () => { form.mois.value = tr.dataset.mois; fill(); form.scrollIntoView({ behavior: "smooth", block: "center" }); });
    tr.querySelector("[data-del]").addEventListener("click", async () => {
      const ok = await window.confirmDialog(`Supprimer les chiffres de ${monthLabel(tr.dataset.mois)} ?`, { danger: true, confirmLabel: "Supprimer" });
      if (!ok) return;
      const { error: delError } = await supabase.from("espace_social_stats").delete().eq("business_id", biz.id).eq("mois", tr.dataset.mois);
      if (delError) { setMsg(msg, "Suppression impossible."); return; }
      notifyEspaceChanged(); tabReseaux(box, biz);
    });
  });
}

// =================== Calendrier de contenu ===================
export async function tabCalendrier(box, biz) {
  const { data, error } = await supabase.from("espace_posts").select("*").eq("business_id", biz.id).order("date_prevue", { ascending: false }).limit(400);
  if (error) throw error;
  const posts = data || [];
  const nets = reseauxOf(biz).length ? RESEAUX.filter((r) => reseauxOf(biz).includes(r.key)) : RESEAUX;
  let editing = null;

  box.innerHTML = `
    <div class="card admin-card">
      <div class="panel-title" id="post-title">Planifier un contenu</div>
      <form id="post-form">
        <div class="crm-form-grid">
          ${field("Date *", `<input type="date" name="date_prevue" required value="${todayKey()}">`)}
          ${field("Réseau", `<select name="reseau">${opts(nets, nets[0].key)}</select>`)}
          ${field("Format", `<select name="format">${opts(POST_FORMATS, "post")}</select>`)}
          ${field("Statut", `<select name="statut"><option value="prevu">Prévu</option><option value="publie">Publié</option></select>`)}
          ${field("Titre *", `<input type="text" name="titre" maxlength="160" required autocomplete="off" placeholder="Ex : Reel lancement collection">`, true)}
          ${field("Légende", `<textarea name="legende" rows="3" maxlength="2000"></textarea>`, true)}
          ${field("Lien du visuel (Drive, Canva…)", `<input type="url" name="visuel_url" maxlength="500" placeholder="https://…">`, true)}
        </div>
        <div id="post-msg" class="error-msg" style="min-height:18px;"></div>
        <button type="submit" class="btn primary" id="post-save">Ajouter au calendrier</button>
        <button type="button" class="btn ghost" id="post-cancel" hidden>Annuler la modification</button>
      </form>
    </div>
    <div class="card admin-card">
      <div class="panel-title">Contenus (${posts.length})</div>
      ${posts.length ? posts.map((p) => `
        <div class="admin-task" data-id="${p.id}">
          <span class="admin-task-title"><b>${escapeHtml(formatDate(p.date_prevue))}</b> · ${escapeHtml(reseauLabel(p.reseau))} · ${escapeHtml(formatLabel(p.format))} · ${escapeHtml(p.titre)}</span>
          <select data-status aria-label="Statut" class="crm-inline-select"><option value="prevu"${p.statut === "prevu" ? " selected" : ""}>Prévu</option><option value="publie"${p.statut === "publie" ? " selected" : ""}>Publié</option></select>
          <button type="button" class="btn btn-sm ghost" data-edit>Modifier</button>
          <button type="button" class="icon-btn" data-del title="Supprimer" style="flex-shrink:0;">✕</button>
        </div>`).join("") : `<p style="color:var(--light-text-dim);font-size:13.5px;">Aucun contenu planifié.</p>`}
    </div>`;

  const form = box.querySelector("#post-form"), msg = box.querySelector("#post-msg");
  const reset = () => { editing = null; form.reset(); form.date_prevue.value = todayKey(); box.querySelector("#post-title").textContent = "Planifier un contenu"; box.querySelector("#post-save").textContent = "Ajouter au calendrier"; box.querySelector("#post-cancel").hidden = true; };
  box.querySelector("#post-cancel").addEventListener("click", reset);
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); setMsg(msg, "");
    const titre = form.titre.value.trim(), url = form.visuel_url.value.trim();
    if (!titre) { setMsg(msg, "Indique un titre."); return; }
    if (url && !httpUrl(url)) { setMsg(msg, "Le lien doit commencer par https://"); return; }
    const row = { date_prevue: form.date_prevue.value, reseau: form.reseau.value, format: form.format.value, statut: form.statut.value, titre, legende: form.legende.value.trim() || null, visuel_url: url || null };
    const q = editing ? supabase.from("espace_posts").update(row).eq("id", editing) : supabase.from("espace_posts").insert({ ...row, business_id: biz.id });
    const { error: saveError } = await q;
    if (saveError) { setMsg(msg, isMissing(saveError) ? MISSING : "Enregistrement impossible : " + saveError.message); return; }
    notifyEspaceChanged(); await tabCalendrier(box, biz); setMsg(box.querySelector("#post-msg"), "Enregistré ✓", true);
  });
  box.querySelectorAll(".admin-task[data-id]").forEach((row) => {
    const p = posts.find((x) => x.id === row.dataset.id);
    row.querySelector("[data-status]").addEventListener("change", async (e) => {
      const { error: upError } = await supabase.from("espace_posts").update({ statut: e.target.value }).eq("id", p.id);
      if (upError) { setMsg(msg, "Modification impossible."); tabCalendrier(box, biz); return; }
      notifyEspaceChanged();
    });
    row.querySelector("[data-edit]").addEventListener("click", () => {
      editing = p.id;
      form.date_prevue.value = p.date_prevue; form.reseau.value = p.reseau; form.format.value = p.format; form.statut.value = p.statut;
      form.titre.value = p.titre; form.legende.value = p.legende || ""; form.visuel_url.value = p.visuel_url || "";
      box.querySelector("#post-title").textContent = "Modifier le contenu"; box.querySelector("#post-save").textContent = "Enregistrer"; box.querySelector("#post-cancel").hidden = false;
      form.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    row.querySelector("[data-del]").addEventListener("click", async () => {
      const ok = await window.confirmDialog(`Supprimer « ${p.titre} » ?`, { danger: true, confirmLabel: "Supprimer" });
      if (!ok) return;
      const { error: delError } = await supabase.from("espace_posts").delete().eq("id", p.id);
      if (delError) { setMsg(msg, "Suppression impossible."); return; }
      notifyEspaceChanged(); tabCalendrier(box, biz);
    });
  });
}

// =================== Collaborations : recherche et suivi en colonnes ===================
async function loadPartnerOptions() {
  const r = await supabase.from("espace_partners").select("id, nom, categorie").order("nom");
  return r.error ? [] : r.data || [];
}
export async function tabCollabs(box, biz) {
  const [{ data, error }, partners] = await Promise.all([
    supabase.from("espace_collabs").select("*").eq("business_id", biz.id).order("created_at", { ascending: false }).limit(300),
    loadPartnerOptions()
  ]);
  if (error) throw error;
  const list = data || [];
  let editing = null;
  const partnerName = (id) => (partners.find((p) => p.id === id) || {}).nom || null;

  const card = (c) => `<article class="kb-card" draggable="true" data-id="${c.id}">
      <strong>${escapeHtml(c.marque)}</strong>
      <span class="pro-muted">${escapeHtml(natureLabel(c.nature))}${c.date_prevue ? " · " + escapeHtml(formatDate(c.date_prevue)) : ""}</span>
      ${c.montant != null ? `<span class="kb-amount">${escapeHtml(formatEuro(c.montant))}</span>` : ""}
      <div class="kb-actions"><select data-status aria-label="Étape" class="crm-inline-select">${opts(COLLAB_STATUTS, c.statut)}</select>
        <button type="button" class="btn btn-sm ghost" data-edit>Modifier</button><button type="button" class="icon-btn" data-del title="Supprimer" style="flex-shrink:0;">✕</button></div>
    </article>`;

  box.innerHTML = `
    <div class="card admin-card">
      <div class="panel-title" id="collab-title">Ajouter une marque ou une collaboration</div>
      <form id="collab-form">
        <div class="crm-form-grid">
          ${field("Partenaire de l'annuaire", `<select name="partner_id"><option value="">— Aucun (saisie libre) —</option>${partners.map((p) => `<option value="${p.id}">${escapeHtml(p.nom)}</option>`).join("")}</select>`, true)}
          ${field("Marque / partenaire *", `<input type="text" name="marque" maxlength="120" required autocomplete="off" placeholder="Ex : Maison Lumière">`, true)}
          ${field("Nature", `<select name="nature">${opts(COLLAB_NATURES, "collab")}</select>`)}
          ${field("Étape", `<select name="statut">${opts(COLLAB_STATUTS, "a_contacter")}</select>`)}
          ${field("Montant (€)", `<input type="number" name="montant" min="0" step="1" inputmode="numeric" placeholder="Facultatif">`)}
          ${field("Date prévue", `<input type="date" name="date_prevue">`)}
          ${field("Notes (visibles par le mannequin dès la négociation)", `<textarea name="notes" rows="2" maxlength="1000"></textarea>`, true)}
        </div>
        <p class="admin-hint">Les étapes « à contacter », « contactée », « réponse reçue » et « refusée » restent internes : le mannequin ne les voit pas.</p>
        <div id="collab-msg" class="error-msg" style="min-height:18px;"></div>
        <button type="submit" class="btn primary" id="collab-save">Ajouter</button>
        <button type="button" class="btn ghost" id="collab-cancel" hidden>Annuler la modification</button>
      </form>
    </div>
    <div class="card admin-card">
      <div class="panel-title">Suivi (${list.length})</div>
      ${list.length ? `<div class="kb-board" role="list">${COLLAB_STATUTS.map((st) => { const items = list.filter((c) => c.statut === st.key); return `
        <section class="kb-col" data-col="${st.key}" role="listitem" aria-label="${escapeHtml(st.label)}"><h4>${escapeHtml(st.label)} <b>${items.length}</b></h4>${items.map(card).join("") || `<p class="kb-empty">—</p>`}</section>`; }).join("")}</div>`
        : `<p style="color:var(--light-text-dim);font-size:13.5px;">Aucune marque pour l'instant. Ajoute les marques que tu contactes pour ce mannequin.</p>`}
    </div>`;

  const form = box.querySelector("#collab-form"), msg = box.querySelector("#collab-msg");
  const reset = () => { editing = null; form.reset(); box.querySelector("#collab-title").textContent = "Ajouter une marque ou une collaboration"; box.querySelector("#collab-save").textContent = "Ajouter"; box.querySelector("#collab-cancel").hidden = true; };
  box.querySelector("#collab-cancel").addEventListener("click", reset);
  // Choisir un partenaire de l'annuaire remplit le nom.
  form.partner_id.addEventListener("change", () => { const n = partnerName(form.partner_id.value); if (n) form.marque.value = n; });
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); setMsg(msg, "");
    const marque = form.marque.value.trim();
    if (!marque) { setMsg(msg, "Indique la marque."); return; }
    const montant = form.montant.value === "" ? null : Number(form.montant.value);
    if (montant !== null && !(montant >= 0)) { setMsg(msg, "Montant invalide."); return; }
    const row = { marque, partner_id: form.partner_id.value || null, nature: form.nature.value, statut: form.statut.value, montant, date_prevue: form.date_prevue.value || null, notes: form.notes.value.trim() || null };
    const q = editing ? supabase.from("espace_collabs").update(row).eq("id", editing) : supabase.from("espace_collabs").insert({ ...row, business_id: biz.id });
    const { error: saveError } = await q;
    if (saveError) { setMsg(msg, isMissing(saveError) || /partner_id/i.test(saveError.message || "") ? MISSING + " (et partenaires.sql)" : "Enregistrement impossible : " + saveError.message); return; }
    notifyEspaceChanged(); await tabCollabs(box, biz); setMsg(box.querySelector("#collab-msg"), "Enregistré ✓", true);
  });

  const setStatus = async (c, statut) => {
    const { error: upError } = await supabase.from("espace_collabs").update({ statut }).eq("id", c.id);
    if (upError) { setMsg(msg, "Modification impossible."); }
    notifyEspaceChanged(); tabCollabs(box, biz);
  };
  box.querySelectorAll(".kb-card[data-id]").forEach((el) => {
    const c = list.find((x) => x.id === el.dataset.id);
    el.querySelector("[data-status]").addEventListener("change", (e) => setStatus(c, e.target.value));
    el.addEventListener("dragstart", (ev) => { ev.dataTransfer.setData("text/plain", c.id); ev.dataTransfer.effectAllowed = "move"; el.classList.add("dragging"); });
    el.addEventListener("dragend", () => el.classList.remove("dragging"));
    el.querySelector("[data-edit]").addEventListener("click", () => {
      editing = c.id;
      form.partner_id.value = c.partner_id || ""; form.marque.value = c.marque; form.nature.value = c.nature; form.statut.value = c.statut;
      form.montant.value = c.montant != null ? c.montant : ""; form.date_prevue.value = c.date_prevue || ""; form.notes.value = c.notes || "";
      box.querySelector("#collab-title").textContent = "Modifier"; box.querySelector("#collab-save").textContent = "Enregistrer"; box.querySelector("#collab-cancel").hidden = false;
      form.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    el.querySelector("[data-del]").addEventListener("click", async () => {
      const ok = await window.confirmDialog(`Supprimer « ${c.marque} » ?`, { danger: true, confirmLabel: "Supprimer" });
      if (!ok) return;
      const { error: delError } = await supabase.from("espace_collabs").delete().eq("id", c.id);
      if (delError) { setMsg(msg, "Suppression impossible."); return; }
      notifyEspaceChanged(); tabCollabs(box, biz);
    });
  });
  // Glisser une carte vers une autre colonne change son étape.
  box.querySelectorAll(".kb-col").forEach((col) => {
    col.addEventListener("dragover", (ev) => { ev.preventDefault(); col.classList.add("over"); });
    col.addEventListener("dragleave", () => col.classList.remove("over"));
    col.addEventListener("drop", (ev) => {
      ev.preventDefault(); col.classList.remove("over");
      const c = list.find((x) => x.id === ev.dataTransfer.getData("text/plain"));
      if (c && c.statut !== col.dataset.col) setStatus(c, col.dataset.col);
    });
  });
}

// =================== Partenaires associés au mannequin ===================
export async function tabPartenaires(box, biz) {
  const [pr, lr] = await Promise.all([
    supabase.from("espace_partners").select("id, nom, categorie, statut, email, instagram").order("nom"),
    supabase.from("espace_partner_links").select("partner_id").eq("business_id", biz.id)
  ]);
  if (pr.error || lr.error) throw pr.error || lr.error;
  const all = pr.data || [], linkedIds = new Set((lr.data || []).map((l) => l.partner_id));
  const linked = all.filter((p) => linkedIds.has(p.id)), free = all.filter((p) => !linkedIds.has(p.id));
  const { categorieLabel, partnerStatutLabel } = await import("./espace-data.js");
  const { addLink, removeLink } = await import("./partenaires-data.js");

  box.innerHTML = `
    <div class="card admin-card">
      <div class="panel-title">Associer un partenaire</div>
      ${free.length ? `<form id="link-form" class="aud-linkbox"><select name="partner">${free.map((p) => `<option value="${p.id}">${escapeHtml(p.nom)} · ${escapeHtml(categorieLabel(p.categorie))}</option>`).join("")}</select><button type="submit" class="btn primary btn-sm">Associer</button></form>`
        : `<p style="color:var(--light-text-dim);font-size:13.5px;margin:0;">${all.length ? "Tous tes partenaires sont déjà associés." : "Ton annuaire est vide : crée tes partenaires dans la page Partenaires."}</p>`}
      <div id="link-msg" class="error-msg" style="min-height:18px;"></div>
    </div>
    <div class="card admin-card">
      <div class="panel-title">Ses partenaires (${linked.length})</div>
      <p class="admin-hint" style="margin-top:0;">Le mannequin les voit dans son espace : nom, métier, statut et contacts (jamais les tarifs ni tes notes).</p>
      ${linked.length ? linked.map((p) => `<div class="admin-task" data-id="${p.id}"><span class="admin-task-title"><b>${escapeHtml(p.nom)}</b> · ${escapeHtml(categorieLabel(p.categorie))} · ${escapeHtml(partnerStatutLabel(p.statut))}</span><button type="button" class="btn btn-sm ghost" data-unlink>Retirer</button></div>`).join("") : `<p style="color:var(--light-text-dim);font-size:13.5px;margin:0;">Aucun partenaire associé.</p>`}
    </div>`;
  const msg = box.querySelector("#link-msg");
  box.querySelector("#link-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try { await addLink(biz.id, e.target.partner.value); notifyEspaceChanged(); tabPartenaires(box, biz); } catch (err) { setMsg(msg, "Association impossible : " + err.message); }
  });
  box.querySelectorAll(".admin-task[data-id]").forEach((row) => row.querySelector("[data-unlink]").addEventListener("click", async () => {
    try { await removeLink(biz.id, row.dataset.id); notifyEspaceChanged(); tabPartenaires(box, biz); } catch (err) { setMsg(msg, "Impossible : " + err.message); }
  }));
}
