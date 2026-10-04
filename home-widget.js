(function () {
  "use strict";

  var SUPABASE_URL = "https://mfdqxzccmzumxiichdqw.supabase.co";
  var SUPABASE_KEY = "sb_publishable_Qes5VQ0OcaAEVh_kMjej6A_HJ6yxY3T";

  function loadSupabase(cb) {
    if (window.supabase && window.supabase.createClient) return cb();
    if (window.__zenoaSupabaseLoadCbs) { window.__zenoaSupabaseLoadCbs.push(cb); return; }
    window.__zenoaSupabaseLoadCbs = [cb];
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
    s.onload = function () {
      var cbs = window.__zenoaSupabaseLoadCbs || [];
      window.__zenoaSupabaseLoadCbs = null;
      cbs.forEach(function (fn) { fn(); });
    };
    document.head.appendChild(s);
  }

  function getSupabaseClient() {
    if (!window.__zenoaSupabase) {
      var existingKey = findExistingStorageKey();
      var clientOpts = {
        auth: {
          flowType: "implicit",
          autoRefreshToken: false,
          persistSession: true,
          detectSessionInUrl: false
        }
      };
      if (existingKey) clientOpts.auth.storageKey = existingKey;
      window.__zenoaSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, clientOpts);
    }
    return window.__zenoaSupabase;
  }

  function findExistingStorageKey() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && /^sb-.*-auth-token$/.test(k)) return k;
      }
    } catch (e) {}
    return null;
  }

  function fmtEUR(n) {
    return (n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  }

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  var CSS = "\n.home-hero{margin-bottom:30px;}\n.home-hero-greeting{font-size:13.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-dim);}\n.home-hero-name{font-family:'Playfair Display',Georgia,serif;font-size:34px;font-weight:700;line-height:1.2;margin:4px 0 8px;background:linear-gradient(120deg,var(--metal-2) 20%,var(--warm-2) 60%,var(--warm-1) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;}\n.home-hero-date{font-size:13px;color:var(--text-mid);text-transform:capitalize;}\n.home-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:18px;}\n.home-tile{display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:10px;text-align:left;padding:22px;border-radius:18px;background:radial-gradient(ellipse at 100% 0%,#bf5af21a,transparent 60%),rgba(255,255,255,.045);border:1px solid rgba(199,194,219,.14);cursor:default;}\n.home-tile-label{font-size:13.5px;opacity:.7;font-weight:600;}\n.home-tile-value{font-size:30px;font-weight:700;background:linear-gradient(180deg,var(--metal-2) 0%,var(--warm-1) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;}\n.home-tile-chart{max-width:420px;}\n.home-tile-chart-wrap{margin-top:4px;width:100%;}\n.home-tile-chart-wrap svg{width:100%;height:auto;display:block;}\n.home-chart-axis{stroke:rgba(199,194,219,.14);stroke-width:1;}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var supabase = getSupabaseClient();

    var me = null;
    var homeGrid = document.getElementById("home-grid");
    var caValueEl = document.getElementById("home-ca-value");
    var caChartEl = document.getElementById("home-ca-chart");
    var greetingEl = document.getElementById("home-greeting");
    var heroNameEl = document.getElementById("home-hero-name");
    var heroDateEl = document.getElementById("home-hero-date");

    if (!homeGrid) return;

    function svgEl(tag, attrs) {
      var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
      if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    }

    function renderCaChart(dayTotals) {
      if (!caChartEl) return;
      var days = Object.keys(dayTotals).sort();
      var W = 420, H = 120, padL = 4, padR = 4, padT = 10, padB = 4;
      var plotW = W - padL - padR, plotH = H - padT - padB;
      var maxVal = Math.max(1, Math.max.apply(null, days.map(function (d) { return dayTotals[d]; })));
      var stepX = days.length > 1 ? plotW / (days.length - 1) : 0;
      function xAt(i) { return padL + i * stepX; }
      function yAt(v) { return padT + plotH * (1 - v / maxVal); }

      caChartEl.innerHTML = "";
      var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "xMinYMid meet" });
      svg.appendChild(svgEl("line", { class: "home-chart-axis", x1: padL, x2: W - padR, y1: H - padB, y2: H - padB }));

      var points = days.map(function (d, i) { return xAt(i).toFixed(1) + "," + yAt(dayTotals[d]).toFixed(1); }).join(" ");
      svg.appendChild(svgEl("polyline", {
        points: points,
        fill: "none",
        stroke: "#bf5af2",
        "stroke-width": "2.2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        style: "filter:drop-shadow(0 0 6px #bf5af2);"
      }));
      if (days.length) {
        var lastX = xAt(days.length - 1), lastY = yAt(dayTotals[days[days.length - 1]]);
        svg.appendChild(svgEl("circle", { cx: lastX, cy: lastY, r: 3.2, fill: "#f1eefb" }));
      }
      caChartEl.appendChild(svg);
    }

    function renderHero(pseudo) {
      if (greetingEl) {
        var hour = new Date().getHours();
        greetingEl.textContent = hour < 6 ? "Bonne nuit" : hour < 18 ? "Bonjour" : "Bonsoir";
      }
      if (heroNameEl) heroNameEl.textContent = pseudo || "";
      if (heroDateEl) {
        var dateStr = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
        heroDateEl.textContent = dateStr;
      }
    }


    function loadCaTotal() {
      if (!caValueEl) return;
      Promise.all([
        supabase.from("clients").select("entries"),
        supabase.from("one_shot_sales").select("amount,sale_date")
      ]).then(function (results) {
        var clientRows = (results[0] && results[0].data) || [];
        var saleRows = (results[1] && results[1].data) || [];
        var total = 0;
        var dayTotals = {};
        clientRows.forEach(function (c) {
          (c.entries || []).forEach(function (e) {
            var amt = Number(e.amount) || 0;
            total += amt;
            if (e.date) dayTotals[e.date] = (dayTotals[e.date] || 0) + amt;
          });
        });
        saleRows.forEach(function (s) {
          var amt = Number(s.amount) || 0;
          total += amt;
          if (s.sale_date) dayTotals[s.sale_date] = (dayTotals[s.sale_date] || 0) + amt;
        });
        caValueEl.textContent = fmtEUR(total);

        // courbe = 14 derniers jours, cumul progressif (évolution du total).
        var range = [];
        for (var i = 13; i >= 0; i--) {
          var d = new Date();
          d.setDate(d.getDate() - i);
          range.push(d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()));
        }
        var since = range[0];
        var before = 0;
        Object.keys(dayTotals).forEach(function (d) { if (d < since) before += dayTotals[d]; });
        var running = before;
        var cumul = {};
        range.forEach(function (d) {
          running += dayTotals[d] || 0;
          cumul[d] = running;
        });
        renderCaChart(cumul);
      });
    }

    function scheduleMidnightReset() {
      var now = new Date();
      var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5, 0);
      setTimeout(function () {
        renderHero(me && me.pseudo);
        loadCaTotal();
        scheduleMidnightReset();
      }, next.getTime() - now.getTime());
    }

    function switchToAccueil() {
      document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
      var navEl = document.getElementById("nav-accueil");
      if (navEl) navEl.classList.add("active");
      document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
      var v = document.getElementById("view-accueil");
      if (v) v.classList.add("active");
    }

    var booted = false;
    function boot(userId) {
      if (booted) return;
      booted = true;
      supabase.from("profiles").select("id,role,pseudo").eq("id", userId).single().then(function (res) {
        if (!res || !res.data) return;
        me = res.data;
        renderHero(me.pseudo);

        if (me.role === "chef") {
          switchToAccueil();
        }

        loadCaTotal();
        scheduleMidnightReset();
      });
    }

    supabase.auth.getSession().then(function (res) {
      var session = res && res.data && res.data.session;
      if (session && session.user) boot(session.user.id);
    });
    supabase.auth.onAuthStateChange(function (event, session) {
      if (session && session.user) boot(session.user.id);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { loadSupabase(init); });
  } else {
    loadSupabase(init);
  }
})();
