// Accessibilité transversale (clavier, lecteurs d'écran), appliquée à toute l'appli :
// - chaque <label> est relié à son champ (même quand une page génère le HTML à la volée) ;
// - un champ sans étiquette reprend son placeholder comme nom accessible ;
// - le menu se manie au clavier (Tab, Entrée, Espace) ;
// - les fenêtres modales reçoivent le focus à l'ouverture et le rendent à la fermeture.
let counter = 0;
let scheduled = false;

function labelFields(root) {
  root.querySelectorAll("label.field-label:not([for])").forEach((label) => {
    const field = label.parentElement && label.parentElement.querySelector("input:not([type=hidden]), select, textarea");
    if (!field) return;
    if (!field.id) field.id = "f-" + ++counter;
    label.setAttribute("for", field.id);
  });
  root.querySelectorAll("input:not([type=hidden]):not([aria-label]), select:not([aria-label]), textarea:not([aria-label])").forEach((el) => {
    if (el.labels && el.labels.length) return;
    if (el.getAttribute("aria-labelledby")) return;
    const name = el.getAttribute("placeholder") || el.getAttribute("title");
    if (name) el.setAttribute("aria-label", name);
  });
  root.querySelectorAll("th:empty:not([aria-label])").forEach((th) => th.setAttribute("aria-label", "Actions"));
}

function makeNavKeyboardFriendly() {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.setAttribute("role", "link");
    item.tabIndex = 0;
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); item.click(); }
    });
  });
}

export function markActiveNav(name) {
  document.querySelectorAll(".nav-item").forEach((el) => {
    if (el.dataset.view === name) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
}

const FOCUSABLE = 'input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href]';

function decorateModals(nodes) {
  nodes.forEach((node) => {
    if (!(node instanceof HTMLElement) || !node.classList.contains("modal-overlay")) return;
    const box = node.querySelector(".modal-box");
    if (box) { box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); }
    const heading = node.querySelector("h2");
    if (box && heading) { heading.id = heading.id || "dlg-" + ++counter; box.setAttribute("aria-labelledby", heading.id); }
    const previous = document.activeElement;
    // 1er champ de saisie s'il y en a un, sinon 1er bouton.
    const target = node.querySelector("input:not([type=hidden]):not([readonly]), textarea, select") || node.querySelector(FOCUSABLE);
    if (target && !node.matches("#confirm-overlay")) setTimeout(() => target.focus({ preventScroll: true }), 30);
    const observer = new MutationObserver(() => {
      if (!node.isConnected) {
        observer.disconnect();
        if (previous && previous.isConnected) previous.focus({ preventScroll: true });
      }
    });
    observer.observe(document.body, { childList: true });
  });
}

export function initA11y() {
  makeNavKeyboardFriendly();
  labelFields(document);
  new MutationObserver((mutations) => {
    for (const m of mutations) decorateModals([...m.addedNodes]);
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; labelFields(document); });
  }).observe(document.body, { childList: true, subtree: true });
}
