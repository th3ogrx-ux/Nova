// Lecture d'un PDF façon livre : les pages se tournent avec une animation
// (flèches à l'écran, ← / → au clavier, ou en attrapant le coin d'une
// page). Rendu des pages par pdf.js, animation par StPageFlip (MIT).
// Les pages ne sont dessinées qu'autour de la page courante, pour ouvrir
// vite même un gros PDF.
import { loadPdfWorker, getPdfDocument } from "../pdf-loader.js";

const loadPageFlip = () => import("page-flip/dist/js/page-flip.module.js");

// Télécharge le lecteur (pdf.js, son worker, l'animation) en avance, pour
// que le premier livre s'ouvre sans attendre.
export function preloadBookReader() {
  loadPdfWorker().catch(() => {});
  loadPageFlip().catch(() => {});
}

const RENDER_AHEAD = 3;
const MAX_PIXEL_RATIO = 2;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// `url` : adresse du PDF, ou promesse de l'adresse (la fenêtre s'ouvre
// tout de suite, sans attendre le lien signé).
export function openPdfBook({ title, url }) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay open book-overlay";
  overlay.style.zIndex = "59";
  overlay.innerHTML = `
    <div class="book-header">
      <div class="book-title">${escapeHtml(title)}</div>
      <div class="book-counter" data-counter></div>
      <div style="display:flex;gap:8px;flex-shrink:0;">
        <a class="btn ghost btn-sm" data-tab-link target="_blank" rel="noopener" style="display:none;">Ouvrir dans un onglet</a>
        <button type="button" class="icon-btn" data-close title="Fermer (Échap)" style="width:32px;height:32px;">✕</button>
      </div>
    </div>
    <div class="book-stage" data-stage>
      <button type="button" class="book-nav book-nav-prev" data-prev title="Page précédente (←)" aria-label="Page précédente">‹</button>
      <div class="book-container" data-book><div class="book-loading"><span class="book-spinner"></span>Ouverture du livre…</div></div>
      <button type="button" class="book-nav book-nav-next" data-next title="Page suivante (→)" aria-label="Page suivante">›</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const counterEl = overlay.querySelector("[data-counter]");
  const bookEl = overlay.querySelector("[data-book]");
  const prevBtn = overlay.querySelector("[data-prev]");
  const nextBtn = overlay.querySelector("[data-next]");
  let pageFlip = null;
  let doc = null;
  let closed = false;

  function close() {
    closed = true;
    document.removeEventListener("keydown", onKey);
    try { if (pageFlip) pageFlip.destroy(); } catch { /* déjà détruit */ }
    overlay.remove();
  }

  function onKey(e) {
    if (document.querySelector("#confirm-overlay.open")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight" && pageFlip) { e.preventDefault(); pageFlip.flipNext(); }
    else if (e.key === "ArrowLeft" && pageFlip) { e.preventDefault(); pageFlip.flipPrev(); }
  }

  document.addEventListener("keydown", onKey);
  overlay.querySelector("[data-close]").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  prevBtn.addEventListener("click", () => pageFlip && pageFlip.flipPrev());
  nextBtn.addEventListener("click", () => pageFlip && pageFlip.flipNext());

  let pdfUrl = null;
  (async () => {
    try {
      pdfUrl = await url;
      const tabLink = overlay.querySelector("[data-tab-link]");
      tabLink.href = pdfUrl;
      tabLink.style.display = "";
      const [{ PageFlip }, loadedDoc] = await Promise.all([loadPageFlip(), getPdfDocument(pdfUrl)]);
      doc = loadedDoc;
      if (closed) return;

      const pageCount = doc.numPages;
      const first = (await doc.getPage(1)).getViewport({ scale: 1 });
      const ratio = first.width / first.height;

      // Taille d'une page : la plus grande qui tient à l'écran, en
      // double page (livre ouvert) quand la largeur le permet.
      const stageRect = overlay.querySelector("[data-stage]").getBoundingClientRect();
      const maxH = Math.max(200, stageRect.height - 24);
      const maxW = Math.max(150, (stageRect.width - 120) / (window.innerWidth > 700 ? 2 : 1));
      const pageH = Math.floor(Math.min(maxH, maxW / ratio));
      const pageW = Math.floor(pageH * ratio);

      const pageEls = [];
      for (let i = 0; i < pageCount; i++) {
        const el = document.createElement("div");
        el.className = "book-page";
        el.innerHTML = `<canvas></canvas><span class="book-page-number">${i + 1}</span>`;
        pageEls.push(el);
      }
      bookEl.innerHTML = "";
      pageEls.forEach((el) => bookEl.appendChild(el));

      const rendered = new Set();
      async function renderPage(index) {
        if (index < 0 || index >= pageCount || rendered.has(index) || closed) return;
        rendered.add(index);
        const page = await doc.getPage(index + 1);
        const scale = (pageW * Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)) / page.getViewport({ scale: 1 }).width;
        const viewport = page.getViewport({ scale });
        const canvas = pageEls[index].querySelector("canvas");
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
      }
      // Une page à la fois, la page affichée d'abord : plus rapide que de
      // toutes les dessiner en même temps.
      let queue = Promise.resolve();
      const renderAround = (index) => {
        const order = [index, index + 1, index - 1];
        for (let i = 2; i <= RENDER_AHEAD; i++) order.push(index + i);
        order.forEach((i) => { queue = queue.then(() => renderPage(i)).catch(() => {}); });
      };

      function updateControls(index) {
        const last = pageCount - 1;
        const spread = pageFlip.getOrientation() === "landscape" && index > 0 && index < last ? Math.min(index + 2, pageCount) : index + 1;
        counterEl.textContent = spread > index + 1 ? `Pages ${index + 1}–${spread} / ${pageCount}` : `Page ${index + 1} / ${pageCount}`;
        prevBtn.disabled = index <= 0;
        nextBtn.disabled = index >= last || (pageFlip.getOrientation() === "landscape" && index > 0 && index + 1 >= last);
      }

      await renderPage(0); // la couverture s'affiche déjà dessinée
      if (closed) return;
      renderAround(0);
      pageFlip = new PageFlip(bookEl, {
        width: pageW,
        height: pageH,
        size: "fixed",
        showCover: true,
        usePortrait: true,
        maxShadowOpacity: 0.45,
        flippingTime: 800,
        mobileScrollSupport: false,
        startZIndex: 1
      });
      pageFlip.loadFromHTML(pageEls);
      pageFlip.on("flip", (e) => {
        renderAround(e.data);
        updateControls(e.data);
      });
      pageFlip.on("changeOrientation", () => updateControls(pageFlip.getCurrentPageIndex()));
      updateControls(0);
    } catch (err) {
      console.error("[Livre PDF]", err);
      if (!closed) {
        bookEl.innerHTML = pdfUrl
          ? `<p class="book-loading">Impossible d'afficher ce PDF en mode livre. <a href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener" style="color:var(--warm-2);">L'ouvrir dans un onglet</a></p>`
          : `<p class="book-loading">Impossible d'ouvrir ce PDF pour le moment. Réessaie dans un instant.</p>`;
      }
    }
  })();

  return { close };
}
