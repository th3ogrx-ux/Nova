// Page « Prospection » : onglets, chargement avec squelettes, bouton flottant de saisie rapide.
import { loadAll, isMissingTable, MISSING_MESSAGE, escapeHtml } from "./pro-data.js";
import { skeleton, toast } from "./pro-ui.js";
import { renderScripts } from "./pro-scripts.js";

const TABS = [
  { key: "scripts", label: "Offres", render: renderScripts, skel: "dashboard" }
];
const TAB_KEY = "zenoa-pro-tab";

// L'état (onglet, vue, période…) survit aux rafraîchissements de la page.
const state = { tab: "scripts", detailId: null, stratView: "cards", period: "30", reviewOffset: 0 };
try { const t = localStorage.getItem(TAB_KEY); if (TABS.some((x) => x.key === t)) state.tab = t; } catch { /* pas grave */ }

export async function renderProspection(root) {
  root.innerHTML = `
    <h1 class="page-title">Offres</h1>
        <div class="pro-body" data-body aria-live="polite">${skeleton(TABS.find((t) => t.key === state.tab).skel)}</div>`;
  const body = root.querySelector("[data-body]");
  let data = null, animateNext = true;

  const ctx = {
    state,
    get animate() { return animateNext; },
    reload: async () => { try { data = await loadAll(); } catch (err) { console.error("[Prospection]", err); toast("Impossible de recharger les données.", "error"); return; } draw({ animate: false }); },
    rerender: ({ animate = false } = {}) => draw({ animate }),
    openQuick: (strategyId) => openQuickEntry(data, { strategyId, onSaved: () => ctx.reload() }),
    openStrategy: (id) => { state.tab = "strategies"; state.detailId = id; save(); draw({ animate: true }); root.closest(".main") && (root.closest(".main").scrollTop = 0); },
    goTab: (key) => { state.tab = key; state.detailId = null; save(); draw({ animate: true }); }
  };
  const save = () => { try { localStorage.setItem(TAB_KEY, state.tab); } catch { /* pas grave */ } };

  function draw({ animate }) {
    animateNext = animate;
    root.querySelectorAll(".pro-tab").forEach((b) => { const on = b.dataset.tab === state.tab; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); });
    const tab = TABS.find((t) => t.key === state.tab);
    const scroll = root.closest(".main") ? root.closest(".main").scrollTop : 0;
    body.className = "pro-body" + (animate ? "" : " pro-still");
    body.innerHTML = "";
    const pane = document.createElement("div");
    pane.className = "pro-pane";
    body.appendChild(pane);
    tab.render(pane, data, ctx);
    if (!animate && root.closest(".main")) root.closest(".main").scrollTop = scroll;
  }

  root.querySelectorAll(".pro-tab").forEach((b) => b.addEventListener("click", () => { if (b.dataset.tab !== state.tab || state.detailId) ctx.goTab(b.dataset.tab); }));

  try {
    data = await loadAll();
  } catch (err) {
    body.innerHTML = `<div class="card"><p class="error-msg" style="margin:0;">${escapeHtml(isMissingTable(err) ? MISSING_MESSAGE : "Impossible de charger la prospection pour le moment. Recharge la page.")}</p></div>`;
    if (!isMissingTable(err)) console.error("[Prospection]", err);
    return;
  }
  draw({ animate: true });
}
