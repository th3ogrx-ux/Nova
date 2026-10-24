// Éditeur d'audit : en-tête, pages, blocs (ajout, glisser-déposer, flèches, duplication, suppression), sauvegarde automatique.
import { getAudit, updateAudit, newId, isMissingTable, MISSING_MESSAGE } from "./audits-data.js";
import { renderAuditHtml, collectImagePaths } from "./audit-render.js";
import { signedUrls, uploadImage } from "./audit-assets.js";
import { BLOCK_TYPES, makeBlock, buildBlockEditor } from "./audit-blocks.js";
import { toast, skeleton } from "./pro-ui.js";
import { escapeHtml } from "./pro-data.js";

const clone = (o) => JSON.parse(JSON.stringify(o));

export async function renderEditor(root, id, back) {
  root.innerHTML = `<div class="pro-body">${skeleton("cols")}</div>`;
  let audit;
  try { audit = await getAudit(id); } catch (err) {
    root.innerHTML = `<div class="card"><p class="error-msg" style="margin:0;">${escapeHtml(isMissingTable(err) ? MISSING_MESSAGE : "Impossible d'ouvrir cet audit.")}</p><button type="button" class="btn ghost btn-sm" data-back style="margin-top:12px;">← Retour aux audits</button></div>`;
    root.querySelector("[data-back]").addEventListener("click", back); return;
  }
  const content = audit.content && Array.isArray(audit.content.pages) && audit.content.pages.length ? clone(audit.content) : { pages: [{ id: newId(), title: "Page 1", blocks: [] }] };
  const st = { page: 0, saving: false, dirty: false, timer: null, urlOf: () => "" };
  const fields = { title: audit.title, client_name: audit.client_name || "", cover_path: audit.cover_path, logo_path: audit.logo_path };

  root.innerHTML = `
    <div class="aud-ed">
      <div class="aud-ed-bar">
        <button type="button" class="btn ghost btn-sm" data-back>← Audits</button>
        <span class="aud-save" data-save aria-live="polite">Brouillon enregistré</span>
        <span class="aud-ed-bar-actions">
          <button type="button" class="btn ghost btn-sm" data-preview>Aperçu</button>
          <button type="button" class="btn primary btn-sm" data-publish>Publier</button>
        </span>
      </div>
      <section class="card aud-ed-head">
        <div class="aud-ed-fields">
          <label class="aud-lbl">Titre de l'audit<input type="text" name="title" maxlength="160" value="${escapeHtml(fields.title)}"></label>
          <label class="aud-lbl">Nom du client<input type="text" name="client_name" maxlength="160" value="${escapeHtml(fields.client_name)}"></label>
        </div>
        <div class="aud-ed-media">
          <div class="aud-media" data-media="logo_path"></div>
          <div class="aud-media" data-media="cover_path"></div>
        </div>
      </section>
      <div class="aud-pages" data-pages></div>
      <div class="aud-blocks" data-blocks></div>
    </div>`;

  const saveEl = root.querySelector("[data-save]");
  const setSave = (text, cls = "") => { saveEl.textContent = text; saveEl.className = "aud-save " + cls; };

  async function saveNow() {
    clearTimeout(st.timer); st.timer = null;
    if (!st.dirty) return true;
    if (st.saving) { st.timer = setTimeout(saveNow, 400); return false; }
    st.saving = true; st.dirty = false; setSave("Enregistrement…");
    try {
      await updateAudit(id, { title: fields.title.trim() || "Audit sans titre", client_name: fields.client_name.trim() || null, cover_path: fields.cover_path, logo_path: fields.logo_path, content });
      st.saving = false;
      setSave(audit.status === "published" ? "Enregistré · pas encore republié" : "Brouillon enregistré", "ok");
      return true;
    } catch (err) {
      st.saving = false; st.dirty = true; console.error("[Audits]", err);
      setSave("Échec de l'enregistrement : nouvel essai…", "err"); st.timer = setTimeout(saveNow, 4000);
      return false;
    }
  }
  const changed = () => { st.dirty = true; setSave("Modifications en cours…"); clearTimeout(st.timer); st.timer = setTimeout(saveNow, 900); };
  const beforeUnload = (e) => { if (st.dirty) { e.preventDefault(); e.returnValue = ""; } };
  window.addEventListener("beforeunload", beforeUnload);
  const leave = async () => { await saveNow(); window.removeEventListener("beforeunload", beforeUnload); back(); };
  root.querySelector("[data-back]").addEventListener("click", leave);

  // ---- en-tête
  root.querySelectorAll(".aud-ed-fields input").forEach((inp) => inp.addEventListener("input", () => { fields[inp.name] = inp.value; changed(); }));
  const mediaLabels = { logo_path: "Logo du client (facultatif)", cover_path: "Image de couverture (facultatif)" };
  async function refreshUrls() { st.urlOf = await signedUrls([...collectImagePaths({ ...fields, content })]); }
  function drawMedia() {
    root.querySelectorAll("[data-media]").forEach((box) => {
      const key = box.dataset.media, path = fields[key];
      box.innerHTML = `<span class="aud-lbl-t">${mediaLabels[key]}</span>
        ${path ? `<img class="aud-thumb" src="${escapeHtml(st.urlOf(path))}" alt="">` : ""}
        <span class="aud-media-btns"><label class="btn ghost btn-sm aud-file">${path ? "Changer" : "Ajouter"}<input type="file" accept="image/jpeg,image/png,image/webp" hidden></label>${path ? `<button type="button" class="btn ghost btn-sm" data-rm>Retirer</button>` : ""}</span>`;
      box.querySelector("input").addEventListener("change", async (ev) => {
        const f = ev.target.files[0]; if (!f) return;
        try { setSave("Envoi de l'image…"); fields[key] = await uploadImage(f, id); await refreshUrls(); drawMedia(); changed(); } catch (err) { toast(err.message, "error"); setSave("Brouillon enregistré"); }
      });
      box.querySelector("[data-rm]")?.addEventListener("click", () => { fields[key] = null; drawMedia(); changed(); });
    });
  }

  // ---- pages
  const pagesEl = root.querySelector("[data-pages]");
  function drawPages() {
    pagesEl.innerHTML = `<div class="aud-tabs" role="tablist">${content.pages.map((p, i) => `<button type="button" role="tab" class="pro-tab${i === st.page ? " on" : ""}" aria-selected="${i === st.page}" data-page="${i}">${escapeHtml(p.title || "Page " + (i + 1))}</button>`).join("")}<button type="button" class="pro-tab aud-addpage" data-addpage>+ Page</button></div>
      <div class="aud-pageedit"><input type="text" class="aud-pagetitle" maxlength="80" value="${escapeHtml(content.pages[st.page].title || "")}" aria-label="Titre de la page" placeholder="Titre de la page">
      ${content.pages.length > 1 ? `<button type="button" class="btn ghost btn-sm" data-delpage>Supprimer la page</button>` : ""}</div>`;
    pagesEl.querySelectorAll("[data-page]").forEach((b) => b.addEventListener("click", () => { st.page = +b.dataset.page; drawPages(); drawBlocks(); }));
    pagesEl.querySelector("[data-addpage]").addEventListener("click", () => { content.pages.push({ id: newId(), title: "Page " + (content.pages.length + 1), blocks: [] }); st.page = content.pages.length - 1; drawPages(); drawBlocks(); changed(); });
    pagesEl.querySelector(".aud-pagetitle").addEventListener("input", (ev) => { content.pages[st.page].title = ev.target.value; pagesEl.querySelector(`[data-page="${st.page}"]`).textContent = ev.target.value || "Page " + (st.page + 1); changed(); });
    pagesEl.querySelector("[data-delpage]")?.addEventListener("click", async () => {
      const ok = await window.confirmDialog("Supprimer cette page et tous ses blocs ?", { danger: true, confirmLabel: "Supprimer" });
      if (!ok) return;
      content.pages.splice(st.page, 1); st.page = Math.max(0, st.page - 1); drawPages(); drawBlocks(); changed();
    });
  }

  // ---- blocs
  const blocksEl = root.querySelector("[data-blocks]");
  const blocks = () => content.pages[st.page].blocks;
  const inserter = (index) => `<div class="aud-ins"><button type="button" class="aud-ins-btn" data-ins="${index}" aria-label="Ajouter un bloc ici">+ Ajouter un bloc</button></div>`;

  function drawBlocks() {
    const list = blocks();
    blocksEl.innerHTML = (list.length ? "" : `<div class="card aud-empty"><p>Cette page est vide. Ajoute ton premier bloc : titre, texte, image, tableau…</p></div>`) +
      inserter(0) + list.map((b, i) => `<div class="aud-blockwrap" data-i="${i}"></div>${inserter(i + 1)}`).join("");
    blocksEl.querySelectorAll("[data-ins]").forEach((btn) => btn.addEventListener("click", () => openPicker(+btn.dataset.ins)));
    list.forEach((b, i) => {
      const wrap = blocksEl.querySelector(`.aud-blockwrap[data-i="${i}"]`);
      const def = BLOCK_TYPES[b.type];
      wrap.className = "card aud-block";
      wrap.innerHTML = `<div class="aud-block-bar"><span class="aud-handle" data-handle title="Glisser pour déplacer" aria-label="Déplacer">⋮⋮</span><span class="aud-block-type">${escapeHtml(def ? def.label : b.type)}</span>
        <span class="aud-block-tools"><button type="button" class="aud-tool" data-up aria-label="Monter" ${i === 0 ? "disabled" : ""}>↑</button><button type="button" class="aud-tool" data-down aria-label="Descendre" ${i === list.length - 1 ? "disabled" : ""}>↓</button><button type="button" class="aud-tool" data-dup aria-label="Dupliquer">⧉</button><button type="button" class="aud-tool danger" data-del aria-label="Supprimer">✕</button></span></div>
        <div class="aud-block-body" data-body></div>`;
      buildBlockEditor(b, wrap.querySelector("[data-body]"), { onChange: changed, urlOf: (p) => st.urlOf(p), upload: async (f) => { const p = await uploadImage(f, id); await refreshUrls(); return p; }, toast });
      const move = (to) => { const [x] = list.splice(i, 1); list.splice(to, 0, x); drawBlocks(); changed(); };
      wrap.querySelector("[data-up]").addEventListener("click", () => move(i - 1));
      wrap.querySelector("[data-down]").addEventListener("click", () => move(i + 1));
      wrap.querySelector("[data-dup]").addEventListener("click", () => { const c = clone(b); c.id = newId(); list.splice(i + 1, 0, c); drawBlocks(); changed(); });
      wrap.querySelector("[data-del]").addEventListener("click", async () => {
        const ok = await window.confirmDialog("Supprimer ce bloc ?", { danger: true, confirmLabel: "Supprimer" });
        if (!ok) return; list.splice(i, 1); drawBlocks(); changed();
      });
      // Glisser-déposer : on ne peut attraper un bloc que par sa poignée (sinon on ne pourrait plus sélectionner du texte).
      const handle = wrap.querySelector("[data-handle]");
      handle.addEventListener("pointerdown", () => { wrap.draggable = true; });
      const stop = () => { wrap.draggable = false; };
      handle.addEventListener("pointerup", stop); handle.addEventListener("pointercancel", stop);
      wrap.addEventListener("dragstart", (ev) => { ev.dataTransfer.setData("text/plain", String(i)); ev.dataTransfer.effectAllowed = "move"; wrap.classList.add("dragging"); });
      wrap.addEventListener("dragend", () => { stop(); wrap.classList.remove("dragging"); blocksEl.querySelectorAll(".drop-before,.drop-after").forEach((x) => x.classList.remove("drop-before", "drop-after")); });
      wrap.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        const r = wrap.getBoundingClientRect(), after = ev.clientY > r.top + r.height / 2;
        wrap.classList.toggle("drop-after", after); wrap.classList.toggle("drop-before", !after);
      });
      wrap.addEventListener("dragleave", () => wrap.classList.remove("drop-before", "drop-after"));
      wrap.addEventListener("drop", (ev) => {
        ev.preventDefault();
        const from = parseInt(ev.dataTransfer.getData("text/plain"), 10);
        if (Number.isNaN(from)) return;
        const r = wrap.getBoundingClientRect(); let to = i + (ev.clientY > r.top + r.height / 2 ? 1 : 0);
        const [x] = list.splice(from, 1); if (from < to) to--; list.splice(to, 0, x);
        drawBlocks(); changed();
      });
    });
  }

  function openPicker(index) {
    document.querySelector(".aud-picker")?.remove();
    const pick = document.createElement("div");
    pick.className = "modal-overlay open aud-picker"; pick.style.zIndex = "59";
    pick.innerHTML = `<div class="card modal-box crm-modal" style="max-width:560px;"><div class="modal-header"><h2>Ajouter un bloc</h2><button type="button" class="icon-btn" data-close aria-label="Fermer">✕</button></div>
      <div class="aud-pick-grid">${Object.entries(BLOCK_TYPES).map(([type, d]) => `<button type="button" class="aud-pick" data-type="${type}"><strong>${escapeHtml(d.label)}</strong><span>${escapeHtml(d.hint)}</span></button>`).join("")}</div></div>`;
    document.body.appendChild(pick);
    const close = () => { pick.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (ev) => { if (ev.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    pick.addEventListener("click", (ev) => { if (ev.target === pick) close(); });
    pick.querySelector("[data-close]").addEventListener("click", close);
    pick.querySelectorAll("[data-type]").forEach((b) => b.addEventListener("click", () => { blocks().splice(index, 0, makeBlock(b.dataset.type)); close(); drawBlocks(); changed(); }));
  }

  // ---- aperçu / publication
  root.querySelector("[data-preview]").addEventListener("click", async () => { await refreshUrls(); showPreview({ ...audit, ...fields, title: fields.title || "Audit sans titre", content }, st.urlOf); });
  root.querySelector("[data-publish]").addEventListener("click", async () => {
    await saveNow();
    const m = await import("./audit-publish.js");
    m.openPublishDialog(audit, { onChange: (a) => { Object.assign(audit, a); setSave(a.status === "published" ? "Publié" : "Brouillon enregistré", "ok"); } });
  });

  await refreshUrls();
  drawMedia(); drawPages(); drawBlocks();
  setSave(audit.status === "published" ? "Publié" : "Brouillon enregistré", "ok");
}

export function showPreview(audit, urlOf) {
  document.querySelector(".aud-preview")?.remove();
  const ov = document.createElement("div");
  ov.className = "aud-preview pub";
  ov.innerHTML = `<div class="aud-preview-bar"><span>Aperçu · tel que le verra ton client</span><button type="button" class="btn ghost btn-sm" data-x>Fermer</button></div><div class="pub-scroll">${renderAuditHtml(audit, urlOf)}</div>`;
  document.body.appendChild(ov);
  const close = () => { ov.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (ev) => { if (ev.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  ov.querySelector("[data-x]").addEventListener("click", close);
  ov.querySelectorAll(".pub-toc a").forEach((a) => a.addEventListener("click", (ev) => { ev.preventDefault(); ov.querySelector(a.getAttribute("href"))?.scrollIntoView({ behavior: "smooth" }); }));
}

export async function openPreview(id) {
  try { const a = await getAudit(id); const u = await signedUrls(collectImagePaths(a)); showPreview(a, u); } catch { toast("Aperçu impossible.", "error"); }
}
