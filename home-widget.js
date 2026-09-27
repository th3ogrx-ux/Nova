(function () {
  "use strict";

  var SUPABASE_URL = "https://mfdqxzccmzumxiichdqw.supabase.co";
  var SUPABASE_KEY = "sb_publishable_Qes5VQ0OcaAEVh_kMjej6A_HJ6yxY3T";

  function loadSupabase(cb) {
    if (window.supabase && window.supabase.createClient) return cb();
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
    s.onload = cb;
    document.head.appendChild(s);
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

  var CSS = "\n.home-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:18px;}\n.home-tile{aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:18px;border-radius:18px;background:rgba(255,255,255,.05);border:1px solid rgba(199,194,219,.14);cursor:pointer;}\n.home-tile:hover{background:rgba(255,255,255,.09);}\n.home-tile-label{font-size:14px;opacity:.7;font-weight:600;}\n.home-tile-value{font-size:32px;font-weight:700;background:linear-gradient(180deg,var(--metal-2) 0%,var(--warm-1) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;}\n.home-tile-stack{gap:6px;}\n.home-tile-stat-row{display:flex;align-items:baseline;gap:8px;}\n.home-tile-stat-row span{font-size:22px;font-weight:700;background:linear-gradient(180deg,var(--metal-2) 0%,var(--warm-1) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;min-width:28px;text-align:right;}\n.home-tile-stat-row small{font-size:12px;opacity:.65;}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var existingKey = findExistingStorageKey();
    var clientOpts = existingKey ? { auth: { storageKey: existingKey } } : {};
    var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, clientOpts);

    var me = null;
    var homeGrid = document.getElementById("home-grid");
    var caValueEl = document.getElementById("home-ca-value");
    var activityDmEl = document.getElementById("home-activity-dm");
    var activityRepliedEl = document.getElementById("home-activity-replied");
    var activitySoldEl = document.getElementById("home-activity-sold");
    var boxmailValueEl = document.getElementById("home-boxmail-value");

    if (!homeGrid) return;

    homeGrid.querySelectorAll(".home-tile").forEach(function (tile) {
      tile.addEventListener("click", function () {
        var view = tile.getAttribute("data-view");
        var navEl = document.querySelector('.nav-item[data-view="' + view + '"]');
        if (navEl) navEl.click();
      });
    });

    function loadCaTotal() {
      if (!caValueEl) return;
      Promise.all([
        supabase.from("clients").select("entries"),
        supabase.from("one_shot_sales").select("amount")
      ]).then(function (results) {
        var clientRows = (results[0] && results[0].data) || [];
        var saleRows = (results[1] && results[1].data) || [];
        var total = 0;
        clientRows.forEach(function (c) {
          (c.entries || []).forEach(function (e) { total += Number(e.amount) || 0; });
        });
        saleRows.forEach(function (s) { total += Number(s.amount) || 0; });
        caValueEl.textContent = fmtEUR(total);
      });
    }

    function loadActivity() {
      if (!activityDmEl) return;
      var midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      supabase.from("prospects").select("status").gte("created_at", midnight.toISOString()).then(function (res) {
        var rows = (res && res.data) || [];
        var replied = 0, sold = 0;
        rows.forEach(function (r) {
          if (r.status === "replied") replied++;
          else if (r.status === "sold") sold++;
        });
        activityDmEl.textContent = rows.length;
        activityRepliedEl.textContent = replied;
        activitySoldEl.textContent = sold;
      });
    }

    function loadBoxmail() {
      if (!boxmailValueEl || !me) return;
      supabase.from("boxmails").select("id", { count: "exact", head: true })
        .eq("recipient_id", me.id).is("read_at", null).is("validated_at", null)
        .then(function (res) {
          var count = (res && res.count) || 0;
          boxmailValueEl.textContent = count + (count > 1 ? " non lus" : " non lu");
        });
    }

    function switchToAccueil() {
      document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
      var navEl = document.getElementById("nav-accueil");
      if (navEl) navEl.classList.add("active");
      document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
      var v = document.getElementById("view-accueil");
      if (v) v.classList.add("active");
    }

    function boot(userId) {
      supabase.from("profiles").select("id,role").eq("id", userId).single().then(function (res) {
        if (!res || !res.data) return;
        me = res.data;

        if (me.role === "chef") {
          switchToAccueil();
        }

        loadCaTotal();
        loadActivity();
        loadBoxmail();
      });
    }

    supabase.auth.getSession().then(function (res) {
      var session = res && res.data && res.data.session;
      if (session && session.user) boot(session.user.id);
    });
    supabase.auth.onAuthStateChange(function (event, session) {
      if (session && session.user && !me) boot(session.user.id);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { loadSupabase(init); });
  } else {
    loadSupabase(init);
  }
})();
