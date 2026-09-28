(function () {
  "use strict";

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function (err) {
        console.error("[ZENOA] échec d'enregistrement du service worker :", err);
      });
    });
  }

  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true;
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  }

  function init() {
    var tile = document.getElementById("settings-install-app");
    if (!tile || isStandalone()) return;

    var deferredPrompt = null;

    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      tile.style.display = "";
    });

    window.addEventListener("appinstalled", function () {
      deferredPrompt = null;
      tile.style.display = "none";
    });

    if (isIOS()) tile.style.display = "";

    tile.addEventListener("click", function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () { deferredPrompt = null; });
        return;
      }
      if (isIOS()) {
        zenoaConfirm("", {
          html: "Pour installer ZENOA sur ton écran d'accueil : appuie sur l'icône Partager (le carré avec une flèche vers le haut) en bas de Safari, puis choisis <strong>« Sur l'écran d'accueil »</strong>.",
          confirmLabel: "Compris",
          hideCancel: true,
          danger: false
        });
        return;
      }
      zenoaConfirm("", {
        html: "Ouvre le menu de ton navigateur et choisis <strong>« Installer l'application »</strong> ou <strong>« Ajouter à l'écran d'accueil »</strong>.",
        confirmLabel: "Compris",
        hideCancel: true,
        danger: false
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
