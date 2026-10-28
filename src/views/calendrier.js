// Page « Calendrier » : tout ce qui est important pour chaque prospect et chaque mannequin
// (rendez-vous, appels, relances, livrables, shootings, paiements). Un mois en grille + la liste « À venir ».
import { supabase } from "../supabase.js";
import { getDataOwnerId, can } from "../session.js";
import { dateKey, parseKey, addDays, escapeHtml } from "./pro-data.js";
import { skeleton, emptyState, openModal, modalHeader, field, options, toast, friendlyError } from "./pro-ui.js";

export const AGENDA_TYPES = [
  { key: "rdv", label: "Rendez-vous", color: "var(--warm-1)", icon: "📅" },
  { key: "appel", label: "Appel", color: "#4c9aff", icon: "📞" },
  { key: "relance", label: "Relance", color: "var(--warning)", icon: "🔔" },
  { key: "livrable", label: "À rendre", color: "var(--gold)", icon: "📦" },
  { key: "shooting", label: "Shooting", color: "#b072ff", icon: "📸" },
  { key: "paiement", label: "Paiement", color: "var(--ok)", icon: "💶" },
  { key: "autre", label: "Autre", color: "#8a8f99", icon: "•" }
];
const typeOf = (k) => AGENDA_TYPES.find((t) => t.key === k) || AGENDA_TYPES[AGENDA_TYPES.length - 1];
const MONTH_FMT = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const DAY_FMT = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const monthKeyOf = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
const monthStart = (key) => { const [y, m] = key.split("-").map(Number); return new Date(y, m - 1, 1); };
const shiftMonth = (key, n) => { const d = monthStart(key); d.setMonth(d.getMonth() + n); return monthKeyOf(d); };
const DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// L'état (mois affiché, filtre) survit aux changements d'onglet.
const state = { month: null, who: "all" };

async function load() {
  const [ev, biz] = await Promise.all([
    supabase.from("agenda_events").select("*").order("jour").order("heure", { nullsFirst: true }).limit(3000),
    supabase.from("espace_businesses").select("id, nom").order("nom")
  ]);
  if (ev.error) { const missing = /agenda_events|schema cache|does not exist/i.test(ev.error.message || ""); if (missing) return { missing: true, events: [], clients: [] }; throw ev.error; }
  return { missing: false, events: ev.data || [], clients: (biz.data || []) };
}

const whoLabel = (e, clients) => e.kind === "client" ? ((clients.find((c) => c.id === e.business_id) || {}).nom || "Mannequin") : e.kind === "prospect" ? (e.prospect || "Prospect") : "";
const whoBadge = (e) => e.kind === "client" ? "Mannequin" : e.kind === "prospect" ? "Prospect" : "";

export async function renderCalendrier(root) {
  const canEdit = can("calendrier", "edit");
  root.innerHTML = `<h1 class="page-title">Calendrier</h1><div class="pro-body" data-body>${skeleton("dashboard")}</div>`;
  const body = root.querySelector("[data-body]");
  let data;
  try { data = await load(); } catch (err) { console.error("[Calendrier]", err); body.innerHTML = `<div class="card"><p class="error-msg" style="margin:0;">Impossible de charger le calendrier pour le moment. Recharge la page.</p></div>`; return; }
  if (data.missing) { body.innerHTML = `<div class="card"><p class="error-msg" style="margin:0;">Le calendrier n'est pas encore installé : colle le fichier agenda.sql dans Supabase (SQL Editor &gt; Run), puis recharge la page.</p></div>`; return; }
  if (!state.month) state.month = monthKeyOf(new Date());

  const reload = async () => { try { data = await load(); } catch { toast("Impossible de recharger.", "error"); return; } draw(); };
  const visible = () => data.events.filter((e) => state.who === "all" || (state.who === "prospects" ? e.kind === "prospect" : e.business_id === state.who));

  function draw() {
    const events = visible(), today = dateKey(), start = monthStart(state.month);
    const byDay = new Map();
    events.forEach((e) => { (byDay.get(e.jour) || byDay.set(e.jour, []).get(e.jour)).push(e); });
    const lead = (start.getDay() + 6) % 7, days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(`<div class="pro-day blank"></div>`);
    for (let d = 1; d <= days; d++) {
      const key = state.month + "-" + String(d).padStart(2, "0"), list = byDay.get(key) || [];
      const late = key < today && list.some((e) => !e.fait);
      cells.push(`<div class="pro-day${key === today ? " today" : ""}${key < today ? " past" : ""}${late ? " over" : ""}" data-day="${key}" role="button" tabindex="0" aria-label="${escapeHtml(DAY_FMT.format(parseKey(key)))}">
        <span class="pro-day-n">${d}</span>${list.length ? `<span class="pro-day-count">${list.length}</span>` : ""}
        <div class="pro-day-chips">${list.slice(0, 3).map((e) => chip(e, data.clients)).join("")}${list.length > 3 ? `<span class="pro-more">+${list.length - 3} autres</span>` : ""}</div>
        <div class="pro-day-dots">${list.slice(0, 4).map((e) => `<i style="background:${typeOf(e.type).color}"></i>`).join("")}</div>
      </div>`);
    }
    // À venir : en retard (non faits) + 30 jours.
    const limit = dateKey(addDays(new Date(), 30));
    const late = events.filter((e) => !e.fait && e.jour < today);
    const soon = events.filter((e) => !e.fait && e.jour >= today && e.jour <= limit);
    const people = [...new Set(events.filter((e) => e.kind === "prospect" && e.prospect).map((e) => e.prospect))];
    body.innerHTML = `
      <div class="ag-bar">
        <div class="pro-monthnav"><button type="button" class="btn ghost btn-sm" data-nav="-1" aria-label="Mois précédent">‹</button><h2>${escapeHtml(cap(MONTH_FMT.format(start)))}</h2><button type="button" class="btn ghost btn-sm" data-nav="1" aria-label="Mois suivant">›</button><button type="button" class="btn ghost btn-sm" data-nav="0">Aujourd'hui</button></div>
        <div class="pro-toolbar-right">
          <select class="ag-who" data-who aria-label="Filtrer par personne"><option value="all">Tout le monde</option>${data.clients.length ? `<optgroup label="Mannequins">${data.clients.map((c) => `<option value="${c.id}"${state.who === c.id ? " selected" : ""}>${escapeHtml(c.nom)}</option>`).join("")}</optgroup>` : ""}<option value="prospects"${state.who === "prospects" ? " selected" : ""}>Prospects</option></select>
          ${canEdit ? `<button type="button" class="btn primary btn-sm" data-add>+ Ajouter</button>` : ""}
        </div>
      </div>
      <div class="ag-layout">
        <div class="card pro-calendar"><div class="pro-cal-grid">${DOW.map((d) => `<div class="pro-dow">${d}</div>`).join("")}${cells.join("")}</div>
          <div class="pro-cal-legend ag-legend">${AGENDA_TYPES.map((t) => `<span class="pro-muted"><i class="ag-dot" style="background:${t.color}"></i>${t.label}</span>`).join("")}</div></div>
        <aside class="card ag-side">
          <h3 class="ag-side-title">À venir</h3>
          ${late.length ? `<h4 class="ag-late">En retard · ${late.length}</h4><ul class="ag-list">${late.map((e) => item(e, data.clients, true)).join("")}</ul>` : ""}
          ${soon.length ? `${late.length ? `<h4 class="ag-late ag-next">Prochainement</h4>` : ""}<ul class="ag-list">${soon.map((e) => item(e, data.clients)).join("")}</ul>`
            : (late.length ? "" : emptyState({ title: "Rien de prévu", text: "Note ici les rendez-vous, relances et dates importantes de tes prospects et de tes mannequins.", cta: canEdit ? "Ajouter un événement" : "", action: "empty-add" }))}
        </aside>
      </div>`;
    bind(people);
  }

  const chip = (e, clients) => { const t = typeOf(e.type), w = whoLabel(e, clients); return `<span class="pro-vchip${e.fait ? " st-publie" : ""}" role="button" tabindex="0" data-ev="${e.id}" style="--tc:${t.color}" title="${escapeHtml(t.label + (w ? " · " + w : "") + " · " + e.titre)}"><span>${e.heure ? escapeHtml(e.heure) + " " : ""}${escapeHtml(e.titre)}</span>${e.fait ? `<b aria-hidden="true">✓</b>` : ""}</span>`; };
  const item = (e, clients, late = false) => { const t = typeOf(e.type), w = whoLabel(e, clients); return `
    <li class="ag-item${late ? " late" : ""}" style="--tc:${t.color}">
      <button type="button" class="ag-check${e.fait ? " on" : ""}" data-done="${e.id}" aria-label="Marquer comme fait" ${canEdit ? "" : "disabled"}>${e.fait ? "✓" : ""}</button>
      <button type="button" class="ag-body" data-ev="${e.id}">
        <b>${t.icon} ${escapeHtml(e.titre)}</b>
        <small>${escapeHtml(cap(DAY_FMT.format(parseKey(e.jour))))}${e.heure ? " · " + escapeHtml(e.heure) : ""}</small>
        ${w ? `<span class="ag-who-tag ${e.kind}">${escapeHtml(w)}</span>` : ""}
      </button></li>`; };

  function bind() {
    body.querySelectorAll("[data-nav]").forEach((b) => b.addEventListener("click", () => { const n = Number(b.dataset.nav); state.month = n === 0 ? monthKeyOf(new Date()) : shiftMonth(state.month, n); draw(); }));
    const who = body.querySelector("[data-who]"); who.addEventListener("change", () => { state.who = who.value; draw(); });
    const add = body.querySelector("[data-add]"); if (add) add.addEventListener("click", () => openEvent(null, dateKey()));
    const empty = body.querySelector('[data-action="empty-add"]'); if (empty) empty.addEventListener("click", () => openEvent(null, dateKey()));
    body.querySelectorAll("[data-day]").forEach((d) => {
      const go = (ev) => { if (ev.target.closest("[data-ev]") || !canEdit) return; openEvent(null, d.dataset.day); };
      d.addEventListener("click", go);
      d.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && ev.target === d) go(ev); });
    });
    body.querySelectorAll("[data-ev]").forEach((b) => {
      const open = (ev) => { ev.stopPropagation(); openEvent(data.events.find((x) => x.id === b.dataset.ev)); };
      b.addEventListener("click", open);
      b.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); open(ev); } });
    });
    body.querySelectorAll("[data-done]").forEach((b) => b.addEventListener("click", async () => {
      const e = data.events.find((x) => x.id === b.dataset.done); if (!e) return;
      const { error } = await supabase.from("agenda_events").update({ fait: !e.fait }).eq("id", e.id);
      if (error) { toast(friendlyError(error), "error"); return; }
      e.fait = !e.fait; draw();
    }));
  }

  function openEvent(ev, day) {
    const e = ev || { jour: day, type: "rdv", kind: "client", titre: "", heure: "", prospect: "", note: "", fait: false, business_id: data.clients[0] ? data.clients[0].id : null };
    if (!ev && !data.clients.length) e.kind = "prospect";
    const prospects = [...new Set(data.events.filter((x) => x.kind === "prospect" && x.prospect).map((x) => x.prospect))];
    const { overlay, close } = openModal(`${modalHeader(ev ? "Modifier" : "Nouvel événement")}
      <form data-form>
        <div class="field"><label class="field-label">C'est pour</label>
          <div class="ag-kinds" role="radiogroup">${[["client", "Un mannequin"], ["prospect", "Un prospect"], ["autre", "Autre"]].map(([k, l]) => `<button type="button" role="radio" class="ag-kind${e.kind === k ? " on" : ""}" data-kind="${k}" aria-checked="${e.kind === k}">${l}</button>`).join("")}</div></div>
        <div data-for-client ${e.kind === "client" ? "" : "hidden"}>${field("Mannequin", data.clients.length ? `<select name="business_id">${data.clients.map((c) => `<option value="${c.id}"${c.id === e.business_id ? " selected" : ""}>${escapeHtml(c.nom)}</option>`).join("")}</select>` : `<p class="pro-muted" style="margin:0;">Aucun mannequin pour l'instant.</p>`)}</div>
        <div data-for-prospect ${e.kind === "prospect" ? "" : "hidden"}>${field("Nom du prospect", `<input type="text" name="prospect" maxlength="120" list="ag-prospects" value="${escapeHtml(e.prospect || "")}" placeholder="Ex : Marque X, Léa Martin"><datalist id="ag-prospects">${prospects.map((p) => `<option value="${escapeHtml(p)}">`).join("")}</datalist>`)}</div>
        <div class="ag-types" role="radiogroup" aria-label="Type">${AGENDA_TYPES.map((t) => `<button type="button" role="radio" class="ag-type${t.key === e.type ? " on" : ""}" data-type="${t.key}" aria-checked="${t.key === e.type}" style="--tc:${t.color}">${t.icon} ${t.label}</button>`).join("")}</div>
        ${field("Quoi ? *", `<input type="text" name="titre" maxlength="160" required value="${escapeHtml(e.titre)}" placeholder="Ex : Appel de suivi, envoyer le media kit, shooting studio">`)}
        <div class="pro-form-row">${field("Jour *", `<input type="date" name="jour" required value="${escapeHtml(e.jour)}">`)}${field("Heure (facultatif)", `<input type="time" name="heure" value="${escapeHtml(e.heure || "")}">`)}</div>
        ${field("Note", `<textarea name="note" rows="3" maxlength="2000" placeholder="Détails, lien, adresse…">${escapeHtml(e.note || "")}</textarea>`)}
        <label class="ag-fait"><input type="checkbox" name="fait"${e.fait ? " checked" : ""}> Fait</label>
        <div class="error-msg" data-error></div>
        <div class="modal-actions">${ev && can("calendrier", "delete") ? `<button type="button" class="btn danger" data-delete style="margin-right:auto;">Supprimer</button>` : ""}<button type="button" class="btn ghost" data-close>Annuler</button>${canEdit ? `<button type="submit" class="btn primary">Enregistrer</button>` : ""}</div>
      </form>`, { maxWidth: 480, lockOutside: true });
    const form = overlay.querySelector("[data-form]"), err = overlay.querySelector("[data-error]");
    let kind = e.kind, type = e.type;
    const sync = () => {
      overlay.querySelectorAll("[data-kind]").forEach((b) => { const on = b.dataset.kind === kind; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); });
      overlay.querySelector("[data-for-client]").hidden = kind !== "client";
      overlay.querySelector("[data-for-prospect]").hidden = kind !== "prospect";
    };
    overlay.querySelectorAll("[data-kind]").forEach((b) => b.addEventListener("click", () => { kind = b.dataset.kind; sync(); }));
    overlay.querySelectorAll("[data-type]").forEach((b) => b.addEventListener("click", () => { type = b.dataset.type; overlay.querySelectorAll("[data-type]").forEach((x) => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-checked", String(on)); }); }));
    const del = overlay.querySelector("[data-delete]");
    if (del) del.addEventListener("click", async () => {
      if (!(await window.confirmDialog("Supprimer cet événement ?", { danger: true, confirmLabel: "Supprimer" }))) return;
      const { error } = await supabase.from("agenda_events").delete().eq("id", ev.id);
      if (error) { err.textContent = friendlyError(error); return; }
      close(); toast("Supprimé"); reload();
    });
    form.addEventListener("submit", async (s) => {
      s.preventDefault(); err.textContent = "";
      const titre = form.titre.value.trim();
      if (!titre) { err.textContent = "Écris ce qu'il faut faire."; return; }
      if (kind === "prospect" && !form.prospect.value.trim()) { err.textContent = "Indique le nom du prospect."; return; }
      if (kind === "client" && !(form.business_id && form.business_id.value)) { err.textContent = "Choisis un mannequin."; return; }
      const values = {
        titre, type, kind, jour: form.jour.value, heure: form.heure.value || null, note: form.note.value.trim() || null, fait: form.fait.checked,
        business_id: kind === "client" ? form.business_id.value : null, prospect: kind === "prospect" ? form.prospect.value.trim() : null
      };
      const btn = form.querySelector('[type="submit"]'); btn.disabled = true;
      const q = ev ? supabase.from("agenda_events").update(values).eq("id", ev.id) : supabase.from("agenda_events").insert({ ...values, user_id: getDataOwnerId() || (await supabase.auth.getUser()).data.user.id });
      const { error } = await q;
      btn.disabled = false;
      if (error) { err.textContent = friendlyError(error); return; }
      state.month = values.jour.slice(0, 7);
      close(); toast("Enregistré ✓"); reload();
    });
  }
  draw();
}
