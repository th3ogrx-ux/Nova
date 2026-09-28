(function () {
  "use strict";
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function (err) {
      console.error("[ZENOA] échec d'enregistrement du service worker :", err);
    });
  });
})();
