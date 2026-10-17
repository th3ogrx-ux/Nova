// Ressources — liens et PDF, avec page de couverture et recherche.
// Les PDF et leurs couvertures sont stockés dans le bucket privé
// "resources" (un dossier par utilisateur, voir resources.sql) et lus via
// des liens signés temporaires.
import { supabase } from "../supabase.js";

const BUCKET = "resources";
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const SIGNED_URL_SECONDS = 60 * 60;
const COVER_WIDTH = 600;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// Uniquement des adresses http(s) : elles finissent dans des href,
// window.open et des <img>, pas question d'accepter "javascript:".
function safeHttpUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : "https://" + value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function youtubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (/(^|\.)youtube\.com$/.test(u.hostname)) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(shorts|embed)\/([\w-]+)/);
      return m ? m[2] : null;
    }
  } catch { /* adresse invalide */ }
  return null;
}

function normalize(str) {
  return (str || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// ---------- Aperçu d'un lien ----------
// YouTube : miniature officielle. Autres sites : image et titre de la page
// via Microlink (gratuit, sans clé ; le navigateur ne peut pas lire
// lui-même une autre page web à cause du CORS). En cas d'échec, la carte
// affiche simplement l'icône du site.
async function fetchLinkPreview(url) {
  const id = youtubeId(url);
  const preview = { title: null, image: id ? `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg` : null };
  try {
    const res = await fetch("https://api.microlink.io/?url=" + encodeURIComponent(url), { signal: AbortSignal.timeout(8000) });
    const json = await res.json();
    if (json && json.status === "success" && json.data) {
      preview.title = typeof json.data.title === "string" ? json.data.title.slice(0, 200) : null;
      if (!preview.image) preview.image = safeHttpUrl(json.data.image && json.data.image.url);
    }
  } catch { /* pas d'aperçu : la carte affichera l'icône du site */ }
  return preview;
}

// ---------- PDF : couverture (rendu de la 1re page) + titre interne ----------
async function readPdf(file) {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
  try {
    let title = null;
    try {
      const meta = await doc.getMetadata();
      const raw = meta && meta.info && typeof meta.info.Title === "string" ? meta.info.Title.trim() : "";
      if (raw) title = raw.slice(0, 200);
    } catch { /* pas de métadonnées */ }

    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: COVER_WIDTH / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const cover = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return { cover, title };
  } finally {
    doc.destroy();
  }
}

// ---------- Fenêtres (ajout, lecture) ----------
// z-index sous celui de la confirmation (60), pour qu'elle passe devant.
function openModal(innerHtml, { wide = false } = {}) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay open";
  overlay.style.zIndex = "59";
  overlay.innerHTML = `<div class="card modal-box" style="max-width:${wide ? "min(1100px, 96vw)" : "460px"};${wide ? "padding:16px;" : ""}">${innerHtml}</div>`;
  document.body.appendChild(overlay);

  const onKey = (e) => {
    if (e.key === "Escape" && !document.querySelector("#confirm-overlay.open")) close();
  };
  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  }
  document.addEventListener("keydown", onKey);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  overlay.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
  return { overlay, close };
}

function openViewer(title, src, externalUrl) {
  openModal(`
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;">
      <h2 style="font-size:15px;font-weight:700;letter-spacing:normal;text-transform:none;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(title)}</h2>
      <div style="display:flex;gap:8px;flex-shrink:0;">
        <a class="btn ghost btn-sm" href="${escapeHtml(externalUrl)}" target="_blank" rel="noopener">Ouvrir dans un onglet</a>
        <button type="button" class="icon-btn" data-close title="Fermer" style="width:32px;height:32px;">✕</button>
      </div>
    </div>
    <iframe src="${escapeHtml(src)}" title="${escapeHtml(title)}" style="width:100%;height:78vh;border:0;border-radius:10px;background:#fff;" allow="fullscreen"></iframe>
  `, { wide: true });
}

function openAddModal(userId, onAdded) {
  const { overlay, close } = openModal(`
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;">
      <h2 style="font-size:16px;font-weight:700;letter-spacing:normal;text-transform:none;margin:0;">Ajouter une ressource</h2>
      <button type="button" class="icon-btn" data-close title="Fermer" style="width:30px;height:30px;">✕</button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button type="button" class="btn btn-sm primary" data-kind="link">🔗 Lien</button>
      <button type="button" class="btn btn-sm ghost" data-kind="pdf">📄 PDF</button>
    </div>
    <form data-form>
      <div class="field" data-for="link">
        <label class="field-label">Lien</label>
        <input type="text" data-url placeholder="https://…" autocomplete="off">
      </div>
      <div class="field" data-for="pdf" style="display:none;">
        <label class="field-label">Fichier PDF (25 Mo max)</label>
        <input type="file" data-file accept="application/pdf,.pdf">
      </div>
      <div class="field">
        <label class="field-label">Titre (facultatif)</label>
        <input type="text" data-title maxlength="200" placeholder="Rempli automatiquement si vide">
      </div>
      <div class="error-msg" data-error></div>
      <div data-progress style="font-size:12.5px;color:var(--text-dim);min-height:16px;margin-bottom:6px;"></div>
      <div class="modal-actions" style="margin-top:10px;">
        <button type="button" class="btn ghost" data-close>Annuler</button>
        <button type="submit" class="btn primary" data-submit>Ajouter</button>
      </div>
    </form>
  `);

  let kind = "link";
  const errorEl = overlay.querySelector("[data-error]");
  const progressEl = overlay.querySelector("[data-progress]");
  const submitBtn = overlay.querySelector("[data-submit]");

  overlay.querySelectorAll("[data-kind]").forEach((btn) => {
    btn.addEventListener("click", () => {
      kind = btn.dataset.kind;
      overlay.querySelectorAll("[data-kind]").forEach((b) => {
        b.classList.toggle("primary", b === btn);
        b.classList.toggle("ghost", b !== btn);
      });
      overlay.querySelectorAll("[data-for]").forEach((f) => { f.style.display = f.dataset.for === kind ? "" : "none"; });
      errorEl.textContent = "";
    });
  });

  overlay.querySelector("[data-form]").addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    const typedTitle = overlay.querySelector("[data-title]").value.trim();
    submitBtn.disabled = true;
    try {
      if (kind === "link") {
        const url = safeHttpUrl(overlay.querySelector("[data-url]").value);
        if (!url) throw new Error("Colle un lien valide (https://…).");
        progressEl.textContent = "Récupération de l'aperçu…";
        const preview = await fetchLinkPreview(url);
        const { error } = await supabase.from("resources").insert({
          user_id: userId,
          kind: "link",
          title: (typedTitle || preview.title || hostOf(url) || url).slice(0, 200),
          url,
          cover_url: preview.image
        });
        if (error) throw error;
      } else {
        const file = overlay.querySelector("[data-file]").files[0];
        if (!file) throw new Error("Choisis un fichier PDF.");
        if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) throw new Error("Ce fichier n'est pas un PDF.");
        if (file.size > MAX_PDF_BYTES) throw new Error("PDF trop lourd (25 Mo maximum).");

        const id = crypto.randomUUID();
        const filePath = `${userId}/${id}.pdf`;
        let coverPath = null;

        progressEl.textContent = "Création de la page de couverture…";
        let cover = null;
        let pdfTitle = null;
        try {
          ({ cover, title: pdfTitle } = await readPdf(file));
        } catch (err) {
          console.warn("[Ressources] couverture impossible :", err);
        }

        progressEl.textContent = "Envoi du PDF…";
        const up = await supabase.storage.from(BUCKET).upload(filePath, file, { contentType: "application/pdf" });
        if (up.error) throw up.error;
        if (cover) {
          const coverUp = await supabase.storage.from(BUCKET).upload(`${userId}/${id}-cover.jpg`, cover, { contentType: "image/jpeg" });
          if (!coverUp.error) coverPath = `${userId}/${id}-cover.jpg`;
        }

        const { error } = await supabase.from("resources").insert({
          user_id: userId,
          kind: "pdf",
          title: (typedTitle || pdfTitle || file.name.replace(/\.pdf$/i, "")).slice(0, 200),
          file_path: filePath,
          cover_path: coverPath
        });
        if (error) {
          await supabase.storage.from(BUCKET).remove([filePath, coverPath].filter(Boolean));
          throw error;
        }
      }
      close();
      onAdded();
    } catch (err) {
      const message = err.message || String(err);
      errorEl.textContent = /resources|bucket/i.test(message)
        ? "La partie Ressources n'est pas encore installée dans Supabase : colle resources.sql dans le SQL Editor, puis réessaie. (" + message + ")"
        : message;
      progressEl.textContent = "";
      submitBtn.disabled = false;
    }
  });
}

// ---------- Page ----------
function coverHtml(item, signedCovers) {
  if (item.kind === "pdf") {
    const src = item.cover_path && signedCovers[item.cover_path];
    return src
      ? `<img src="${escapeHtml(src)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;object-position:top;">`
      : `<div style="font-size:42px;">📄</div>`;
  }
  if (item.cover_url) {
    return `<img src="${escapeHtml(item.cover_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;" onerror="this.replaceWith(Object.assign(document.createElement('div'),{textContent:'🔗',style:'font-size:42px'}))">`;
  }
  const host = hostOf(item.url);
  return `<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128" alt="" loading="lazy" style="width:56px;height:56px;border-radius:12px;">`;
}

function cardHtml(item, signedCovers) {
  const meta = item.kind === "pdf" ? "PDF" : hostOf(item.url);
  return `
    <div class="card resource-card" data-resource-id="${item.id}" tabindex="0" role="button" aria-label="Ouvrir ${escapeHtml(item.title)}">
      <div class="resource-cover">${coverHtml(item, signedCovers)}</div>
      <div style="padding:12px 14px;">
        <div style="font-weight:700;font-size:13.5px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(item.title)}</div>
        <div style="font-size:11.5px;color:var(--light-text-dim);margin-top:4px;">${item.kind === "pdf" ? "📄" : "🔗"} ${escapeHtml(meta)}</div>
      </div>
      <button type="button" class="icon-btn resource-delete" data-delete title="Supprimer">✕</button>
    </div>
  `;
}

export async function renderRessources(root) {
  root.innerHTML = `
    <h1 class="page-title">Ressources</h1>
    <div style="display:flex;gap:10px;margin-bottom:18px;">
      <input type="search" id="resource-search" placeholder="Rechercher une ressource…" style="flex:1;">
      <button type="button" class="btn primary" id="resource-add" title="Ajouter un lien ou un PDF" style="margin:0;padding:0 20px;font-size:20px;">+</button>
    </div>
    <div id="resource-list"><p style="color:var(--light-text-dim);font-size:13.5px;">Chargement…</p></div>
  `;

  const listEl = root.querySelector("#resource-list");
  const searchEl = root.querySelector("#resource-search");
  const { data: { user } } = await supabase.auth.getUser();
  let items = [];
  let signedCovers = {};

  function draw() {
    const q = normalize(searchEl.value.trim());
    const shown = q ? items.filter((i) => normalize(i.title + " " + (i.url ? hostOf(i.url) : "pdf")).includes(q)) : items;
    if (!items.length) {
      listEl.innerHTML = `<p style="color:var(--light-text-dim);font-size:13.5px;">Aucune ressource pour l'instant — clique sur <b>+</b> pour ajouter un lien ou un PDF.</p>`;
      return;
    }
    if (!shown.length) {
      listEl.innerHTML = `<p style="color:var(--light-text-dim);font-size:13.5px;">Aucune ressource ne correspond à « ${escapeHtml(searchEl.value.trim())} ».</p>`;
      return;
    }
    listEl.innerHTML = `<div class="resource-grid">${shown.map((i) => cardHtml(i, signedCovers)).join("")}</div>`;
    listEl.querySelectorAll("[data-resource-id]").forEach((card) => {
      const item = items.find((i) => i.id === card.dataset.resourceId);
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-delete]")) return;
        openItem(item);
      });
      card.addEventListener("keydown", (e) => { if (e.key === "Enter") openItem(item); });
      card.querySelector("[data-delete]").addEventListener("click", () => deleteItem(item));
    });
  }

  async function load() {
    const { data, error } = await supabase
      .from("resources")
      .select("id, kind, title, url, file_path, cover_url, cover_path, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      listEl.innerHTML = `<p class="error-msg">${/resources/.test(error.message || "")
        ? "La partie Ressources n'est pas encore installée : colle le fichier resources.sql dans Supabase (SQL Editor), puis recharge la page."
        : "Impossible de charger les ressources."}</p>`;
      return;
    }
    items = data || [];
    const coverPaths = items.map((i) => i.cover_path).filter(Boolean);
    signedCovers = {};
    if (coverPaths.length) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(coverPaths, SIGNED_URL_SECONDS);
      (signed || []).forEach((s) => { if (s.signedUrl) signedCovers[s.path] = s.signedUrl; });
    }
    draw();
  }

  async function openItem(item) {
    if (item.kind === "pdf") {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(item.file_path, SIGNED_URL_SECONDS);
      if (error || !data) return;
      openViewer(item.title, data.signedUrl, data.signedUrl);
      return;
    }
    const id = youtubeId(item.url);
    if (id) {
      openViewer(item.title, `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`, item.url);
      return;
    }
    // La plupart des sites interdisent l'affichage dans une autre page :
    // un lien s'ouvre donc dans un nouvel onglet.
    window.open(item.url, "_blank", "noopener");
  }

  async function deleteItem(item) {
    const ok = await window.confirmDialog(`Supprimer « ${item.title} » ?`, { danger: true, confirmLabel: "Supprimer" });
    if (!ok) return;
    const { error } = await supabase.from("resources").delete().eq("id", item.id);
    if (error) return;
    const files = [item.file_path, item.cover_path].filter(Boolean);
    if (files.length) await supabase.storage.from(BUCKET).remove(files);
    items = items.filter((i) => i.id !== item.id);
    draw();
  }

  searchEl.addEventListener("input", draw);
  root.querySelector("#resource-add").addEventListener("click", () => openAddModal(user.id, load));
  load();
}
