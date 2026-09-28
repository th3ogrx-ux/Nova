(function () {
  "use strict";

  var CSS =
    "#zenoa-splash{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:#04010a;opacity:1;transition:opacity .45s ease;}" +
    "#zenoa-splash.zenoa-splash-out{opacity:0;pointer-events:none;}" +
    "#zenoa-splash img{width:120px;height:120px;opacity:0;transform:scale(.55) rotate(-8deg);animation:zenoa-splash-in .7s cubic-bezier(.2,.9,.3,1.4) forwards,zenoa-splash-pulse 1.6s ease-in-out .7s infinite;filter:drop-shadow(0 0 18px rgba(191,90,242,.55));}" +
    "@keyframes zenoa-splash-in{0%{opacity:0;transform:scale(.55) rotate(-8deg);}60%{opacity:1;transform:scale(1.08) rotate(2deg);}100%{opacity:1;transform:scale(1) rotate(0deg);}}" +
    "@keyframes zenoa-splash-pulse{0%,100%{filter:drop-shadow(0 0 18px rgba(191,90,242,.55));}50%{filter:drop-shadow(0 0 34px rgba(191,90,242,.9));}}";

  var styleInjected = false;
  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  window.zenoaShowWelcomeSplash = function () {
    if (document.getElementById("zenoa-splash")) return;
    injectStyle();

    var overlay = document.createElement("div");
    overlay.id = "zenoa-splash";
    var img = document.createElement("img");
    img.src = "/zenoa-icon.png";
    img.alt = "";
    overlay.appendChild(img);
    document.body.appendChild(overlay);

    setTimeout(function () {
      overlay.classList.add("zenoa-splash-out");
    }, 1550);
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 2000);
  };
})();
