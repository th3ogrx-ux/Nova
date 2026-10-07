(function () {
  "use strict";

  var BOOKS = [
    {
      id: "prospection-telephonique",
      title: "Guide de prospection téléphonique",
      pageCount: 34,
      pagePath: function (n) {
        var num = n < 10 ? "0" + n : "" + n;
        return "/resources/prospection-pages/page-" + num + ".jpg";
      }
    }
  ];

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  var CSS = "\n.res-book-card{width:150px;cursor:pointer;}\n.res-book-cover{width:100%;aspect-ratio:595/842;border-radius:10px;overflow:hidden;box-shadow:0 14px 34px rgba(0,0,0,.55);border:1px solid rgba(199,194,219,.16);transition:transform .2s ease,box-shadow .2s ease;}\n.res-book-card:hover .res-book-cover{transform:translateY(-3px);box-shadow:0 20px 44px rgba(0,0,0,.65);}\n.res-book-cover img{width:100%;height:100%;object-fit:cover;display:block;}\n.res-book-title{margin-top:9px;font-size:12.5px;font-weight:600;color:var(--metal-2);text-align:center;line-height:1.3;}\n.book-overlay{position:fixed;inset:0;z-index:999;background:rgba(4,1,10,.92);display:flex;align-items:center;justify-content:center;flex-direction:column;padding:22px 16px;}\n.book-overlay.hidden{display:none;}\n.book-top-row{display:flex;align-items:center;justify-content:space-between;gap:14px;width:100%;max-width:460px;margin-bottom:14px;}\n.book-title{font-family:'Playfair Display',Georgia,serif;font-size:16px;color:#fff;font-weight:600;}\n.book-close{width:32px;height:32px;border-radius:50%;flex-shrink:0;border:1px solid rgba(199,194,219,.3);background:rgba(255,255,255,.06);color:#fff;font-size:14px;display:flex;align-items:center;justify-content:center;cursor:pointer;}\n.book-close:hover{background:rgba(255,255,255,.14);}\n.book-stage-row{display:flex;align-items:center;gap:12px;width:100%;max-width:460px;}\n.book-arrow{width:40px;height:40px;border-radius:50%;flex-shrink:0;border:1px solid rgba(199,194,219,.3);background:rgba(255,255,255,.06);color:#fff;font-size:19px;display:flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;transition:background .15s ease;}\n.book-arrow:hover{background:rgba(255,255,255,.14);}\n.book-arrow.disabled{opacity:.22;pointer-events:none;}\n.book-stage{position:relative;flex:1;aspect-ratio:595/842;perspective:1800px;border-radius:10px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.7);background:#0c0518;}\n.book-page-static{position:absolute;inset:0;}\n.book-page-static img{width:100%;height:100%;object-fit:cover;display:block;}\n.book-flip{position:absolute;inset:0;transform-style:preserve-3d;transform-origin:left center;will-change:transform;}\n.book-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;will-change:transform;}\n.book-face img{width:100%;height:100%;object-fit:cover;display:block;}\n.book-face-back{transform:rotateY(180deg);background:linear-gradient(120deg,#150e24,#1f1436);}\n.book-shade{position:absolute;inset:0;pointer-events:none;opacity:0;z-index:5;}\n.book-counter{margin-top:14px;font-size:12px;letter-spacing:.04em;color:var(--text-dim);}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var grid = document.getElementById("res-book-grid");
    if (!grid) return;

    BOOKS.forEach(function (book) {
      var card = el("div", { class: "res-book-card" });
      var cover = el("div", { class: "res-book-cover" });
      cover.appendChild(el("img", { src: book.pagePath(1), alt: book.title, decoding: "async" }));
      card.appendChild(cover);
      card.appendChild(el("div", { class: "res-book-title" }, book.title));
      card.addEventListener("click", function () { openBook(book); });
      grid.appendChild(card);
    });

    var overlay, stage, pageStaticImg, flipDiv, flipFrontImg, shadeDiv, counterEl, prevBtn, nextBtn, closeBtn, titleEl;
    var currentBook = null, currentIndex = 0, animating = false;
    var preloadCache = {};

    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function preloadPage(book, index) {
      if (index < 0 || index >= book.pageCount) return;
      var src = book.pagePath(index + 1);
      if (preloadCache[src]) return;
      var img = new Image();
      img.decoding = "async";
      img.src = src;
      preloadCache[src] = img;
    }

    function preloadAround(book, index) {
      preloadPage(book, index - 1);
      preloadPage(book, index);
      preloadPage(book, index + 1);
    }

    function buildOverlay() {
      overlay = el("div", { class: "book-overlay hidden" });

      var topRow = el("div", { class: "book-top-row" });
      titleEl = el("div", { class: "book-title" });
      closeBtn = el("div", { class: "book-close" }, "✕");
      topRow.appendChild(titleEl);
      topRow.appendChild(closeBtn);

      var stageRow = el("div", { class: "book-stage-row" });
      prevBtn = el("div", { class: "book-arrow" }, "‹");
      nextBtn = el("div", { class: "book-arrow" }, "›");

      stage = el("div", { class: "book-stage" });
      var pageStatic = el("div", { class: "book-page-static" });
      pageStaticImg = el("img", { decoding: "async" });
      pageStatic.appendChild(pageStaticImg);

      flipDiv = el("div", { class: "book-flip" });
      var faceFront = el("div", { class: "book-face book-face-front" });
      flipFrontImg = el("img", { decoding: "async" });
      faceFront.appendChild(flipFrontImg);
      var faceBack = el("div", { class: "book-face book-face-back" });
      flipDiv.appendChild(faceFront);
      flipDiv.appendChild(faceBack);

      shadeDiv = el("div", { class: "book-shade" });

      stage.appendChild(pageStatic);
      stage.appendChild(flipDiv);
      stage.appendChild(shadeDiv);

      stageRow.appendChild(prevBtn);
      stageRow.appendChild(stage);
      stageRow.appendChild(nextBtn);

      counterEl = el("div", { class: "book-counter" });

      overlay.appendChild(topRow);
      overlay.appendChild(stageRow);
      overlay.appendChild(counterEl);
      document.body.appendChild(overlay);

      closeBtn.addEventListener("click", closeBook);
      overlay.addEventListener("click", function (e) { if (e.target === overlay) closeBook(); });
      prevBtn.addEventListener("click", function () { flip(-1); });
      nextBtn.addEventListener("click", function () { flip(1); });
      document.addEventListener("keydown", function (e) {
        if (overlay.classList.contains("hidden")) return;
        if (e.key === "ArrowLeft") flip(-1);
        else if (e.key === "ArrowRight") flip(1);
        else if (e.key === "Escape") closeBook();
      });
    }

    function updateUI() {
      counterEl.textContent = (currentIndex + 1) + " / " + currentBook.pageCount;
      prevBtn.classList.toggle("disabled", currentIndex <= 0);
      nextBtn.classList.toggle("disabled", currentIndex >= currentBook.pageCount - 1);
    }

    function openBook(book) {
      if (!overlay) buildOverlay();
      currentBook = book;
      currentIndex = 0;
      animating = false;
      titleEl.textContent = book.title;
      flipDiv.style.transform = "rotateY(0deg)";
      shadeDiv.style.opacity = "0";
      flipFrontImg.src = book.pagePath(1);
      pageStaticImg.src = book.pagePath(1);
      updateUI();
      overlay.classList.remove("hidden");
      document.body.style.overflow = "hidden";
      preloadAround(book, 0);
    }

    function closeBook() {
      overlay.classList.add("hidden");
      document.body.style.overflow = "";
    }

    function flip(dir) {
      if (animating || !currentBook) return;
      var targetIndex = currentIndex + dir;
      if (targetIndex < 0 || targetIndex >= currentBook.pageCount) return;
      animating = true;

      var book = currentBook;
      var targetSrc = book.pagePath(targetIndex + 1);
      var currentSrc = book.pagePath(currentIndex + 1);

      function startAnim() {
        pageStaticImg.src = targetSrc;
        flipFrontImg.src = currentSrc;

        flipDiv.style.transformOrigin = dir > 0 ? "left center" : "right center";
        shadeDiv.style.background = dir > 0
          ? "linear-gradient(90deg, rgba(0,0,0,.6), rgba(0,0,0,0) 58%)"
          : "linear-gradient(270deg, rgba(0,0,0,.6), rgba(0,0,0,0) 58%)";

        var duration = 650;
        var start = null;
        var toAngle = dir > 0 ? -180 : 180;

        function step(ts) {
          if (!start) start = ts;
          var t = Math.min(1, (ts - start) / duration);
          var eased = easeInOutCubic(t);
          var bend = Math.sin(eased * Math.PI);
          // Le rotateX ajoute un léger "gondolement" (la page n'est pas
          // un plan rigide), et le shade + box-shadow simulent l'ombre
          // que projette une vraie page de papier qui se courbe en se
          // tournant, au lieu d'un flip plat et raide.
          flipDiv.style.transform = "rotateY(" + (toAngle * eased) + "deg) rotateX(" + (bend * 2.5) + "deg)";
          shadeDiv.style.opacity = (bend * 0.78).toFixed(2);
          stage.style.boxShadow = "0 " + Math.round(28 + bend * 26) + "px " + Math.round(70 + bend * 70) + "px rgba(0,0,0," + (0.68 + bend * 0.2).toFixed(2) + ")";
          if (t < 1) {
            requestAnimationFrame(step);
          } else {
            currentIndex = targetIndex;
            flipDiv.style.transform = "rotateY(0deg)";
            shadeDiv.style.opacity = "0";
            flipFrontImg.src = book.pagePath(currentIndex + 1);
            updateUI();
            animating = false;
            preloadAround(book, currentIndex);
          }
        }
        requestAnimationFrame(step);
      }

      // Si la page cible est déjà préchargée, on attend qu'elle soit
      // décodée avant de lancer l'animation : ça évite le décodage de
      // l'image de pile au milieu du flip, qui saccadait la rotation.
      var cached = preloadCache[targetSrc];
      if (cached && cached.decode) {
        cached.decode().then(startAnim).catch(startAnim);
      } else {
        startAnim();
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
