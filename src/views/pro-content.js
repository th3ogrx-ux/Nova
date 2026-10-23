// Prospection > Contenu : calendrier des vidéos du mois (plusieurs par jour), 3 types (viral, valeur, contenu perso),
// scripts, avancement, saisie en lot pour une journée de création.
import {
  VIDEO_TYPES, VIDEO_STATUTS, videoType, nextVideoStatut, MISSING_MESSAGE, saveVideo, addVideos, deleteVideo,
  dateKey, parseKey, addDays, mondayOf, escapeHtml, fmtInt
} from "./pro-data.js";
import { runCounters } from "./pro-charts.js";
import { bindFormDraft, draftGet, draftSet, draftClear, debounce } from "./pro-draft.js";
import { emptyState, openModal, modalHeader, field, options, toast, friendlyError, copyText } from "./pro-ui.js";

const MONTH_FMT = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const DAY_FMT = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const monthKeyOf = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
const monthStart = (key) => { const [y, m] = key.split("-").map(Number); return new Date(y, m - 1, 1); };
const shiftMonth = (key, n) => { const d = monthStart(key); d.setMonth(d.getMonth() + n); return monthKeyOf(d); };
const statutLabel = (key) => (VIDEO_STATUTS.find((x) => x.key === key) || VIDEO_STATUTS[0]).label;
const DONE = { a_tourner: "", tourne: "✓", publie: "★" };

function chip(v) {
  const t = videoType(v.type);
  return `<span class="pro-vchip st-${v.statut}" role="button" tabindex="0" draggable="true" data-video="${v.id}" style="--tc:${t.color}" title="${escapeHtml(t.label)} · ${escapeHtml(v.titre)}">
    <i></i><span>${escapeHtml(v.titre)}</span>${DONE[v.statut] ? `<b aria-hidden="true">${DONE[v.statut]}</b>` : ""}</span>`;
}
const pillsHtml = (selected) => `<div class="pro-types" role="radiogroup" aria-label="Type de vidéo">${VIDEO_TYPES.map((t) => `
  <button type="button" role="radio" class="pro-type${t.key === selected ? " on" : ""}" data-type="${t.key}" aria-checked="${t.key === selected}" style="--tc:${t.color}">
    <i></i><b>${escapeHtml(t.label)}</b><small>${escapeHtml(t.hint)}</small></button>`).join("")}</div>`;

export function renderContent(root, data, ctx) {
  const { state } = ctx;
  if (data.videosMissing) { root.innerHTML = `<div class="card"><p class="error-msg" style="margin:0;">${escapeHtml(MISSING_MESSAGE)}</p></div>`; return; }
  const month = state.contentMonth || (state.contentMonth = monthKeyOf(new Date()));
  const view = state.contentView === "list" ? "list" : "calendar";
  const first = monthStart(month), daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const todayKey = dateKey();
  const videos = data.videos.filter((v) => v.jour.startsWith(month));
  const byDay = {};
  videos.forEach((v) => (byDay[v.jour] = byDay[v.jour] || []).push(v));
  const count = (pred) => videos.filter(pred).length;
  const total = videos.length, done = count((v) => v.statut !== "a_tourner"), published = count((v) => v.statut === "publie");
  const mix = VIDEO_TYPES.map((t) => ({ ...t, n: count((v) => v.type === t.key) }));
  const emptyDays = Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`).filter((k) => k >= todayKey && !byDay[k]).length;

  root.innerHTML = `
    <div class="pro-toolbar pro-seq" style="--i:0">
      <div class="pro-monthnav">
        <button type="button" class="icon-btn" data-month="-1" aria-label="Mois précédent">‹</button>
        <h2>${escapeHtml(cap(MONTH_FMT.format(first)))}</h2>
        <button type="button" class="icon-btn" data-month="1" aria-label="Mois suivant">›</button>
        <button type="button" class="btn ghost btn-sm" data-month="today">Aujourd'hui</button>
      </div>
      <div class="pro-toolbar-right">
        <div class="pro-seg" role="group" aria-label="Affichage"><button type="button" class="${view === "calendar" ? "on" : ""}" data-cview="calendar" aria-pressed="${view === "calendar"}">Calendrier</button><button type="button" class="${view === "list" ? "on" : ""}" data-cview="list" aria-pressed="${view === "list"}">Programme</button></div>
        <button type="button" class="btn ghost btn-sm" data-action="batch">Saisie en lot</button>
        <button type="button" class="btn primary btn-sm" data-action="new">+ Vidéo</button>
      </div>
    </div>

    <div class="pro-kpis four pro-content-kpis">
      <div class="card pro-kpi pro-seq" style="--i:1"><div class="pro-kpi-label">Vidéos du mois</div><div class="pro-kpi-value"><b data-count="${total}">0</b></div><div class="pro-kpi-foot"><span class="pro-delta">${emptyDays ? `${emptyDays} jour${emptyDays > 1 ? "s" : ""} à venir sans vidéo` : total ? "Calendrier bien rempli" : "Rien de prévu"}</span></div></div>
      <div class="card pro-kpi pro-seq" style="--i:2"><div class="pro-kpi-label">Tournées</div><div class="pro-kpi-value"><b data-count="${done}">0</b><small class="pro-kpi-sub">sur ${fmtInt(total)}</small></div><div class="pro-meter" aria-hidden="true"><i style="--w:${total ? Math.round((done / total) * 100) : 0}%"></i></div></div>
      <div class="card pro-kpi pro-seq" style="--i:3"><div class="pro-kpi-label">Publiées</div><div class="pro-kpi-value"><b data-count="${published}">0</b><small class="pro-kpi-sub">sur ${fmtInt(total)}</small></div><div class="pro-meter" aria-hidden="true"><i style="--w:${total ? Math.round((published / total) * 100) : 0}%"></i></div></div>
      <div class="card pro-kpi pro-seq" style="--i:4"><div class="pro-kpi-label">Répartition</div>
        <div class="pro-mix" role="img" aria-label="${mix.map((m) => `${m.label} ${m.n}`).join(", ")}">${total ? mix.map((m) => `<i style="--tc:${m.color};flex:${m.n}" title="${escapeHtml(m.label)} : ${m.n}"></i>`).join("") : "<i style='flex:1'></i>"}</div>
        <div class="pro-mix-legend">${mix.map((m) => `<span><i style="background:${m.color}"></i>${escapeHtml(m.label)} <b>${m.n}</b></span>`).join("")}</div></div>
    </div>
    <div data-body></div>`;

  const body = root.querySelector("[data-body]");
  if (view === "calendar") {
    const lead = (first.getDay() + 6) % 7; // cases vides avant le 1er (semaine du lundi)
    let cells = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => `<div class="pro-dow">${d}</div>`).join("");
    for (let i = 0; i < lead; i++) cells += `<div class="pro-day blank" aria-hidden="true"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${month}-${String(d).padStart(2, "0")}`, list = byDay[key] || [];
      const dots = list.map((v) => `<i style="background:${videoType(v.type).color}"></i>`).join("");
      cells += `<div class="pro-day${key === todayKey ? " today" : ""}${key < todayKey ? " past" : ""}" data-day="${key}" tabindex="0" role="group" aria-label="${escapeHtml(cap(DAY_FMT.format(parseKey(key))))}, ${list.length} vidéo${list.length > 1 ? "s" : ""}">
        <span class="pro-day-n">${d}</span>${list.length ? `<span class="pro-day-count">${list.length}</span>` : ""}
        <div class="pro-day-chips">${list.slice(0, 3).map(chip).join("")}${list.length > 3 ? `<span class="pro-more">+${list.length - 3}</span>` : ""}</div>
        <div class="pro-day-dots">${dots}</div>
        <button type="button" class="pro-day-add" data-add="${key}" aria-label="Ajouter une vidéo le ${d}">+</button></div>`;
    }
    body.innerHTML = `<div class="card pro-calendar pro-seq" style="--i:5"><div class="pro-cal-grid">${cells}</div>
      <div class="pro-legend-inline pro-cal-legend">${VIDEO_TYPES.map((t) => `<span><i style="background:${t.color}"></i>${escapeHtml(t.label)}</span>`).join("")}<span class="pro-muted">✓ tournée · ★ publiée · glisse une vidéo sur un autre jour pour la déplacer</span></div></div>`;
    if (!total) body.querySelector(".pro-calendar").insertAdjacentHTML("afterbegin", `<p class="pro-cal-hint">Clique sur un jour pour ajouter une vidéo, ou utilise « Saisie en lot » pour planifier tout le mois en une fois.</p>`);
  } else {
    const days = Object.keys(byDay).sort();
    body.innerHTML = days.length ? days.map((k, gi) => `
      <section class="pro-prog-day pro-seq" style="--i:${Math.min(gi + 5, 12)}"><h3>${escapeHtml(cap(DAY_FMT.format(parseKey(k))))}<span class="pro-count">${byDay[k].length}</span></h3>
        <div class="pro-prog-list">${byDay[k].map((v) => { const t = videoType(v.type); return `
          <article class="card pro-video st-${v.statut}" style="--tc:${t.color}">
            <div class="pro-video-top"><span class="pro-tag" style="--tc:${t.color}"><i></i>${escapeHtml(t.label)}</span>
              <button type="button" class="pro-status" data-cycle="${v.id}" aria-label="Avancement : ${escapeHtml(statutLabel(v.statut))}. Cliquer pour changer">${escapeHtml(statutLabel(v.statut))}</button></div>
            <h4>${escapeHtml(v.titre)}</h4>
            ${v.script ? `<div class="pro-script clamp" data-expand tabindex="0" role="button" aria-expanded="false" title="Cliquer pour lire tout le script">${escapeHtml(v.script).replace(/\n/g, "<br>")}</div>` : `<p class="pro-muted">Pas encore de script.</p>`}
            <div class="pro-video-foot">${v.script ? `<button type="button" class="btn ghost btn-sm" data-copy="${v.id}">Copier le script</button>` : ""}<button type="button" class="btn ghost btn-sm" data-edit="${v.id}">Modifier</button></div>
          </article>`; }).join("")}</div></section>`).join("")
      : `<div class="card">${emptyState({ title: "Aucune vidéo ce mois-ci", text: "Planifie tes vidéos du mois avec leur script : tu les retrouves ici, jour par jour, prêtes à tourner.", cta: "Planifier des vidéos", action: "batch2" })}</div>`;
  }

  // ----- actions -----
  const rerender = ({ animate = false } = {}) => ctx.rerender({ animate });
  root.querySelectorAll("[data-month]").forEach((b) => b.addEventListener("click", () => { state.contentMonth = b.dataset.month === "today" ? monthKeyOf(new Date()) : shiftMonth(month, Number(b.dataset.month)); rerender(); }));
  root.querySelectorAll("[data-cview]").forEach((b) => b.addEventListener("click", () => { state.contentView = b.dataset.cview; rerender(); }));
  root.querySelector('[data-action="new"]').addEventListener("click", () => openVideoModal(null, { jour: month === monthKeyOf(new Date()) ? todayKey : `${month}-01` }, data, ctx));
  root.querySelector('[data-action="batch"]').addEventListener("click", () => openBatchModal(month, data, ctx));
  const b2 = root.querySelector('[data-action="batch2"]'); if (b2) b2.addEventListener("click", () => openBatchModal(month, data, ctx));
  const byId = Object.fromEntries(videos.map((v) => [v.id, v]));

  root.querySelectorAll(".pro-day[data-day]").forEach((cell) => {
    const open = () => openDayModal(cell.dataset.day, data, ctx);
    cell.addEventListener("click", (e) => {
      const add = e.target.closest("[data-add]");
      if (add) { e.stopPropagation(); openVideoModal(null, { jour: add.dataset.add }, data, ctx); return; }
      const c = e.target.closest("[data-video]");
      if (c) { e.stopPropagation(); openVideoModal(byId[c.dataset.video], {}, data, ctx); return; }
      open();
    });
    cell.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const c = e.target.closest("[data-video]");
      if (c) { openVideoModal(byId[c.dataset.video], {}, data, ctx); return; }
      if (e.target === cell) open();
    });
    // Glisser-déposer : changer le jour d'une vidéo
    cell.addEventListener("dragover", (e) => { e.preventDefault(); cell.classList.add("over"); });
    cell.addEventListener("dragleave", (e) => { if (!cell.contains(e.relatedTarget)) cell.classList.remove("over"); });
    cell.addEventListener("drop", async (e) => {
      e.preventDefault(); cell.classList.remove("over");
      const v = byId[e.dataTransfer.getData("text/plain")];
      if (!v || v.jour === cell.dataset.day) return;
      const before = v.jour; v.jour = cell.dataset.day; rerender();
      try { await saveVideo({ jour: v.jour }, v.id); } catch (err) { v.jour = before; rerender(); toast(friendlyError(err), "error"); }
    });
  });
  root.querySelectorAll(".pro-vchip").forEach((c) => c.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", c.dataset.video); e.dataTransfer.effectAllowed = "move"; }));

  root.querySelectorAll("[data-cycle]").forEach((b) => b.addEventListener("click", async () => {
    const v = byId[b.dataset.cycle], before = v.statut; v.statut = nextVideoStatut(before); rerender();
    try { await saveVideo({ statut: v.statut }, v.id); } catch (err) { v.statut = before; rerender(); toast(friendlyError(err), "error"); }
  }));
  root.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openVideoModal(byId[b.dataset.edit], {}, data, ctx)));
  root.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => toast((await copyText(byId[b.dataset.copy].script)) ? "Script copié ✓" : "Copie impossible")));
  root.querySelectorAll("[data-expand]").forEach((b) => {
    const toggle = () => { const open = b.classList.toggle("clamp") === false; b.setAttribute("aria-expanded", String(open)); };
    b.addEventListener("click", toggle);
    b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
  });
  if (ctx.animate) runCounters(root); else root.querySelectorAll("[data-count]").forEach((el) => { el.textContent = fmtInt(el.dataset.count); });
}

// ---------- Fenêtre d'un jour : toutes ses vidéos ----------
function openDayModal(day, data, ctx) {
  const list = data.videos.filter((v) => v.jour === day);
  const { overlay, close } = openModal(`${modalHeader(cap(DAY_FMT.format(parseKey(day))))}
    ${list.length ? `<ul class="pro-daylist">${list.map((v) => { const t = videoType(v.type); return `<li style="--tc:${t.color}"><span class="pro-tag" style="--tc:${t.color}"><i></i>${escapeHtml(t.label)}</span>
      <button type="button" class="pro-link" data-edit="${v.id}">${escapeHtml(v.titre)}</button><span class="pro-muted">${escapeHtml(statutLabel(v.statut))}</span></li>`; }).join("")}</ul>` : `<p class="pro-muted">Aucune vidéo ce jour-là.</p>`}
    <div class="modal-actions"><button type="button" class="btn ghost" data-close>Fermer</button><button type="button" class="btn primary" data-add>+ Ajouter une vidéo</button></div>`, { maxWidth: 480, lockOutside: false });
  overlay.querySelector("[data-add]").addEventListener("click", () => { close(); openVideoModal(null, { jour: day }, data, ctx); });
  overlay.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => { close(); openVideoModal(data.videos.find((v) => v.id === b.dataset.edit), {}, data, ctx); }));
}

// ---------- Fenêtre d'une vidéo ----------
export function openVideoModal(video, defaults, data, ctx) {
  const v = video || { type: "valeur", statut: "a_tourner", jour: dateKey(), ...defaults };
  const { overlay, close } = openModal(`${modalHeader(video ? "Modifier la vidéo" : "Nouvelle vidéo")}
    <form data-form>
      ${field("Titre *", `<input type="text" name="titre" maxlength="160" required value="${escapeHtml(v.titre || "")}" placeholder="Ex : 3 erreurs qui font fuir les clients sur Google">`)}
      <div class="pro-form-row">
        ${field("Jour", `<input type="date" name="jour" required value="${escapeHtml(v.jour)}">`)}
        ${field("Avancement", `<select name="statut">${options(VIDEO_STATUTS, v.statut)}</select>`)}
      </div>
      <div class="field"><label class="field-label">Type de vidéo</label>${pillsHtml(v.type)}<input type="hidden" name="type" value="${escapeHtml(v.type)}"></div>
      ${field("Script", `<textarea name="script" rows="8" maxlength="8000" placeholder="Accroche, développement, appel à l'action…">${escapeHtml(v.script || "")}</textarea>`)}
      <div class="error-msg" data-error></div>
      <div class="modal-actions">${video ? `<button type="button" class="btn danger" data-delete style="margin-right:auto;">Supprimer</button>` : ""}<button type="button" class="btn ghost" data-close>Annuler</button><button type="submit" class="btn primary">Enregistrer</button></div>
    </form>`, { maxWidth: 560 });
  const form = overlay.querySelector("[data-form]"), errorEl = overlay.querySelector("[data-error]");
  const syncPills = () => overlay.querySelectorAll(".pro-type").forEach((b) => { const on = b.dataset.type === form.type.value; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); });
  const draft = bindFormDraft(form, "video:" + (video ? video.id : "new"), { onReset: () => { close(); openVideoModal(video, defaults, data, ctx); } });
  syncPills();
  overlay.querySelectorAll(".pro-type").forEach((b) => b.addEventListener("click", () => { form.type.value = b.dataset.type; syncPills(); form.dispatchEvent(new Event("change", { bubbles: true })); }));
  overlay.querySelector(".modal-actions [data-close]").addEventListener("click", () => draft.clear());
  form.titre.focus();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const values = { titre: form.titre.value.trim(), jour: form.jour.value, statut: form.statut.value, type: form.type.value, script: form.script.value.trim() || null };
    if (!values.titre || !values.jour) { errorEl.textContent = "Indique un titre et un jour."; return; }
    try { await saveVideo(values, video && video.id); draft.clear(); close(); toast("Vidéo enregistrée ✓"); ctx.state.contentMonth = values.jour.slice(0, 7); ctx.reload(); } catch (err) { errorEl.textContent = friendlyError(err); }
  });
  const del = overlay.querySelector("[data-delete]");
  if (del) del.addEventListener("click", async () => {
    const ok = await window.confirmDialog(`Supprimer « ${video.titre} » ?`, { danger: true, confirmLabel: "Supprimer" });
    if (!ok) return;
    try { await deleteVideo(video.id); draft.clear(); close(); ctx.reload(); } catch (err) { errorEl.textContent = friendlyError(err); }
  });
}

// ---------- Saisie en lot : la journée où tu prépares toutes les vidéos du mois ----------
function openBatchModal(month, data, ctx) {
  const draftKey = "videos-batch";
  const saved = draftGet(draftKey);
  const defaultDay = (n) => { const t = dateKey(); return month === monthKeyOf(new Date()) && t.startsWith(month) ? t : `${month}-01`; };
  let rows = saved && Array.isArray(saved.rows) && saved.rows.length ? saved.rows : [{ jour: defaultDay(), titre: "", type: "valeur", script: "" }];
  const rowHtml = (r, i) => `<div class="pro-batch-row" data-row="${i}" style="--tc:${videoType(r.type).color}">
    <div class="pro-batch-head"><span class="pro-batch-n">${i + 1}</span><input type="date" data-f="jour" value="${escapeHtml(r.jour)}" aria-label="Jour de la vidéo ${i + 1}"><button type="button" class="icon-btn" data-rm aria-label="Retirer cette vidéo">✕</button></div>
    <input type="text" data-f="titre" maxlength="160" placeholder="Titre de la vidéo" value="${escapeHtml(r.titre)}" aria-label="Titre de la vidéo ${i + 1}">
    <div class="pro-types compact" role="radiogroup" aria-label="Type">${VIDEO_TYPES.map((t) => `<button type="button" role="radio" class="pro-type${t.key === r.type ? " on" : ""}" data-type="${t.key}" aria-checked="${t.key === r.type}" style="--tc:${t.color}"><i></i><b>${escapeHtml(t.label)}</b></button>`).join("")}</div>
    <textarea data-f="script" rows="3" maxlength="8000" placeholder="Script (facultatif, tu pourras le compléter plus tard)" aria-label="Script de la vidéo ${i + 1}">${escapeHtml(r.script || "")}</textarea></div>`;
  const { overlay, close } = openModal(`${modalHeader("Saisie en lot")}
    ${saved ? `<div class="pro-draft-note" role="status"><span>Brouillon retrouvé : tes vidéos non enregistrées sont restaurées.</span><button type="button" class="btn ghost btn-sm" data-drop>Repartir de zéro</button></div>` : ""}
    <p class="pro-muted" style="margin:0 0 12px;">Ajoute toutes tes vidéos d'un coup : une ligne par vidéo, plusieurs le même jour si tu veux.</p>
    <div data-rows>${rows.map(rowHtml).join("")}</div>
    <button type="button" class="btn ghost btn-sm" data-add-row>+ Ajouter une vidéo</button>
    <div class="error-msg" data-error></div>
    <div class="modal-actions"><button type="button" class="btn ghost" data-close>Annuler</button><button type="button" class="btn primary" data-save>Enregistrer tout</button></div>`, { maxWidth: 600 });
  const box = overlay.querySelector("[data-rows]"), errorEl = overlay.querySelector("[data-error]");
  const read = () => [...box.querySelectorAll("[data-row]")].map((row) => ({
    jour: row.querySelector('[data-f="jour"]').value, titre: row.querySelector('[data-f="titre"]').value,
    type: (row.querySelector(".pro-type.on") || { dataset: { type: "valeur" } }).dataset.type, script: row.querySelector('[data-f="script"]').value
  }));
  const persist = debounce(() => draftSet(draftKey, { rows: read() }), 400);
  const redraw = (list) => { rows = list; box.innerHTML = rows.map(rowHtml).join(""); };
  box.addEventListener("input", persist);
  box.addEventListener("change", persist);
  box.addEventListener("click", (e) => {
    const pick = e.target.closest(".pro-type");
    if (pick) { const row = pick.closest("[data-row]"); row.querySelectorAll(".pro-type").forEach((b) => { const on = b === pick; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); }); row.style.setProperty("--tc", videoType(pick.dataset.type).color); persist(); return; }
    const rm = e.target.closest("[data-rm]");
    if (rm) { const cur = read(); cur.splice(Number(rm.closest("[data-row]").dataset.row), 1); redraw(cur.length ? cur : [{ jour: defaultDay(), titre: "", type: "valeur", script: "" }]); persist(); }
  });
  overlay.querySelector("[data-add-row]").addEventListener("click", () => {
    const cur = read(), last = cur[cur.length - 1];
    if (cur.length >= 40) return;
    cur.push({ jour: last ? last.jour : defaultDay(), titre: "", type: last ? last.type : "valeur", script: "" }); // même jour et même type que la ligne d'avant
    redraw(cur); persist();
    box.lastElementChild.querySelector('[data-f="titre"]').focus();
  });
  const drop = overlay.querySelector("[data-drop]"); if (drop) drop.addEventListener("click", () => { draftClear(draftKey); close(); openBatchModal(month, data, ctx); });
  overlay.querySelector(".modal-actions [data-close]").addEventListener("click", () => draftClear(draftKey));
  overlay.querySelector("[data-save]").addEventListener("click", async (e) => {
    const list = read().filter((r) => r.titre.trim());
    if (!list.length) { errorEl.textContent = "Écris au moins un titre."; return; }
    if (list.some((r) => !r.jour)) { errorEl.textContent = "Chaque vidéo a besoin d'un jour."; return; }
    e.target.disabled = true; errorEl.textContent = "";
    try {
      await addVideos(list.map((r) => ({ jour: r.jour, titre: r.titre.trim(), type: r.type, script: r.script.trim() || null })));
      draftClear(draftKey); close(); toast(`${list.length} vidéo${list.length > 1 ? "s" : ""} enregistrée${list.length > 1 ? "s" : ""} ✓`);
      ctx.state.contentMonth = list[0].jour.slice(0, 7); ctx.reload();
    } catch (err) { errorEl.textContent = friendlyError(err); e.target.disabled = false; }
  });
}
