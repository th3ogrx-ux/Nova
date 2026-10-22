// Fenêtre modale simple (fond sombre, Échap pour fermer, clic à côté pour fermer).
// z-index sous celui de la confirmation (60), pour qu'elle passe devant.
export function openModal(innerHtml, { maxWidth = 520 } = {}) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay open";
  overlay.style.zIndex = "59";
  overlay.innerHTML = `<div class="card modal-box crm-modal" style="max-width:${maxWidth}px;">${innerHtml}</div>`;
  document.body.appendChild(overlay);

  const listeners = [];
  const onKey = (e) => {
    if (e.key === "Escape" && !document.querySelector("#confirm-overlay.open")) close();
  };
  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    listeners.forEach((fn) => fn());
  }
  document.addEventListener("keydown", onKey);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  overlay.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
  return { overlay, close, onClose: (fn) => listeners.push(fn) };
}
