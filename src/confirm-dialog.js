// Modale de confirmation générique, réutilisable (ex: zenoaConfirm("Supprimer ?")).
// Portée depuis l'ancien confirm-dialog-widget.js avec les classes du nouveau
// design system (.card au lieu de .glass-card, etc.).
let overlay = null;
let titleEl = null;
let cancelBtn = null;
let okBtn = null;
let pendingResolve = null;

function build() {
  if (overlay) return;
  overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "confirm-overlay";
  overlay.innerHTML = `
    <div class="card modal-box" style="max-width:360px;">
      <h2 id="confirm-text" style="letter-spacing:normal;text-transform:none;font-size:15px;line-height:1.5;font-weight:500;">Es-tu sûr ?</h2>
      <div class="modal-actions">
        <button class="btn ghost" id="confirm-cancel">Annuler</button>
        <button class="btn primary" id="confirm-ok">Confirmer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  titleEl = overlay.querySelector("#confirm-text");
  cancelBtn = overlay.querySelector("#confirm-cancel");
  okBtn = overlay.querySelector("#confirm-ok");

  cancelBtn.addEventListener("click", () => settle(false));
  okBtn.addEventListener("click", () => settle(true));
  overlay.addEventListener("click", (e) => { if (e.target === overlay) settle(false); });
  document.addEventListener("keydown", (e) => {
    if (!overlay.classList.contains("open")) return;
    if (e.key === "Escape") settle(false);
    if (e.key === "Enter") settle(true);
  });
}

function settle(result) {
  if (!pendingResolve) return;
  overlay.classList.remove("open");
  const resolve = pendingResolve;
  pendingResolve = null;
  resolve(result);
}

export function confirmDialog(message, opts = {}) {
  build();
  if (opts.html) titleEl.innerHTML = opts.html;
  else titleEl.textContent = message || "Es-tu sûr ?";
  okBtn.textContent = opts.confirmLabel || "Confirmer";
  okBtn.className = opts.danger === false ? "btn primary" : "btn danger";
  if (opts.hideCancel) {
    cancelBtn.style.display = "none";
  } else {
    cancelBtn.style.display = "";
    cancelBtn.textContent = opts.cancelLabel || "Annuler";
  }
  return new Promise((resolve) => {
    if (pendingResolve) pendingResolve(false);
    pendingResolve = resolve;
    overlay.classList.add("open");
    okBtn.focus();
  });
}
