(function () {
  "use strict";

  var overlay = null;
  var titleEl = null;
  var cancelBtn = null;
  var okBtn = null;
  var pendingResolve = null;

  function build() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "zenoa-confirm-overlay";
    overlay.innerHTML =
      '<div class="glass-card modal-box" style="max-width:360px;">' +
        '<h2 id="zenoa-confirm-text" style="letter-spacing:normal;text-transform:none;font-size:15px;line-height:1.5;font-weight:500;">Es-tu sûr ?</h2>' +
        '<div class="modal-actions">' +
          '<button class="btn ghost" id="zenoa-confirm-cancel">Annuler</button>' +
          '<button class="btn primary" id="zenoa-confirm-ok">Confirmer</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(overlay);

    titleEl = overlay.querySelector("#zenoa-confirm-text");
    cancelBtn = overlay.querySelector("#zenoa-confirm-cancel");
    okBtn = overlay.querySelector("#zenoa-confirm-ok");

    cancelBtn.addEventListener("click", function () { settle(false); });
    okBtn.addEventListener("click", function () { settle(true); });
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) settle(false);
    });
    document.addEventListener("keydown", function (e) {
      if (!overlay.classList.contains("open")) return;
      if (e.key === "Escape") settle(false);
      if (e.key === "Enter") settle(true);
    });
  }

  function settle(result) {
    if (!pendingResolve) return;
    overlay.classList.remove("open");
    var resolve = pendingResolve;
    pendingResolve = null;
    resolve(result);
  }

  window.zenoaConfirm = function (message, opts) {
    build();
    if (opts && opts.html) titleEl.innerHTML = opts.html;
    else titleEl.textContent = message || "Es-tu sûr ?";
    okBtn.textContent = (opts && opts.confirmLabel) || "Confirmer";
    okBtn.className = (opts && opts.danger === false) ? "btn primary" : "btn danger";
    if (opts && opts.hideCancel) {
      cancelBtn.style.display = "none";
    } else {
      cancelBtn.style.display = "";
      cancelBtn.textContent = (opts && opts.cancelLabel) || "Annuler";
    }
    return new Promise(function (resolve) {
      if (pendingResolve) pendingResolve(false);
      pendingResolve = resolve;
      overlay.classList.add("open");
      okBtn.focus();
    });
  };
})();
