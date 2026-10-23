// Page « Calendrier » : le calendrier de création de contenu (vidéos du mois, scripts, avancement).
// Les écrans sont dans pro-content.js ; cette page s'occupe du chargement et de l'état.
import { loadVideos, escapeHtml, MISSING_MESSAGE } from "./pro-data.js";
import { skeleton, toast } from "./pro-ui.js";
import { renderContent } from "./pro-content.js";

// L'état (mois affiché, vue) survit aux rafraîchissements de la page.
const state = { contentMonth: null, contentView: "calendar" };

export async function renderCalendrier(root) {
  root.innerHTML = `
    <h1 class="page-title">Calendrier</h1>
    <div class="pro-body" data-body aria-live="polite">${skeleton("dashboard")}</div>`;
  const body = root.querySelector("[data-body]");
  let data = null, animateNext = true;

  const ctx = {
    state,
    get animate() { return animateNext; },
    reload: async () => {
      try { data = await loadVideos(); } catch (err) { console.error("[Calendrier]", err); toast("Impossible de recharger le calendrier.", "error"); return; }
      draw({ animate: false });
    },
    rerender: ({ animate = false } = {}) => draw({ animate })
  };

  function draw({ animate }) {
    animateNext = animate;
    const main = root.closest(".main"), scroll = main ? main.scrollTop : 0;
    body.className = "pro-body" + (animate ? "" : " pro-still");
    body.innerHTML = "";
    const pane = document.createElement("div");
    pane.className = "pro-pane";
    body.appendChild(pane);
    renderContent(pane, data, ctx);
    if (!animate && main) main.scrollTop = scroll;
  }

  try {
    data = await loadVideos();
  } catch (err) {
    console.error("[Calendrier]", err);
    body.innerHTML = `<div class="card"><p class="error-msg" style="margin:0;">${escapeHtml("Impossible de charger le calendrier pour le moment. Recharge la page.")}</p></div>`;
    return;
  }
  draw({ animate: true });
}
