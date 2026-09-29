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

  function todayStr() {
    var t = new Date();
    return t.getFullYear() + "-" + pad2(t.getMonth() + 1) + "-" + pad2(t.getDate());
  }

  var CSS = "\n.home-hero{margin-bottom:30px;}\n.home-hero-greeting{font-size:13.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-dim);}\n.home-hero-name{font-family:'Playfair Display',Georgia,serif;font-size:34px;font-weight:700;line-height:1.2;margin:4px 0 8px;background:linear-gradient(120deg,var(--metal-2) 20%,var(--warm-2) 60%,var(--warm-1) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;}\n.home-hero-date{font-size:13px;color:var(--text-mid);text-transform:capitalize;}\n.home-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:18px;}\n.home-tile{display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:10px;text-align:left;padding:22px;border-radius:18px;background:radial-gradient(ellipse at 100% 0%,#bf5af21a,transparent 60%),rgba(255,255,255,.045);border:1px solid rgba(199,194,219,.14);cursor:default;}\n.home-tile-icon{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--warm-1),var(--cool-1));color:#fff;flex-shrink:0;}\n.home-tile-icon svg{width:19px;height:19px;}\n.home-tile-label{font-size:13.5px;opacity:.7;font-weight:600;}\n.home-tile-value{font-size:30px;font-weight:700;background:linear-gradient(180deg,var(--metal-2) 0%,var(--warm-1) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;}\n.home-tile-stack{gap:8px;width:100%;}\n.home-tile-stat-row{display:flex;align-items:baseline;gap:8px;width:100%;}\n.home-tile-stat-row span{font-size:20px;font-weight:700;background:linear-gradient(180deg,var(--metal-2) 0%,var(--warm-1) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;min-width:26px;text-align:right;}\n.home-tile-stat-row small{font-size:12px;opacity:.65;}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var supabase = getSupabaseClient();

    var me = null;
    var homeGrid = document.getElementById("home-grid");
    var caValueEl = document.getElementById("home-ca-value");
    var activityDmEl = document.getElementById("home-activity-dm");
    var activityRepliedEl = document.getElementById("home-activity-replied");
    var activitySoldEl = document.getElementById("home-activity-sold");
    var boxmailValueEl = document.getElementById("home-boxmail-value");
    var greetingEl = document.getElementById("home-greeting");
    var heroNameEl = document.getElementById("home-hero-name");
    var heroDateEl = document.getElementById("home-hero-date");
    var radarInterestedEl = document.getElementById("home-radar-interested");
    var radarNotInterestedEl = document.getElementById("home-radar-not-interested");
    var radarPendingEl = document.getElementById("home-radar-pending");

    if (!homeGrid) return;

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
      Promise.all([
        supabase.from("prospects").select("status,setter_id").gte("created_at", midnight.toISOString()),
        loadActiveProfileIds()
      ]).then(function (results) {
        var activeIds = results[1];
        var rows = ((results[0] && results[0].data) || []).filter(function (r) { return activeIds[r.setter_id]; });
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

    function loadActiveProfileIds() {
      return supabase.from("profiles").select("id").eq("is_active", true).then(function (res) {
        var ids = {};
        ((res && res.data) || []).forEach(function (p) { ids[p.id] = true; });
        return ids;
      });
    }

    function loadRadarStatus() {
      if (!radarInterestedEl) return;
      Promise.all([
        supabase.from("radar_leads").select("status,status_set_by").eq("sent_date", todayStr()),
        loadActiveProfileIds()
      ]).then(function (results) {
        var activeIds = results[1];
        var rows = ((results[0] && results[0].data) || []).filter(function (r) { return activeIds[r.status_set_by]; });
        var interested = 0, notInterested = 0, pending = 0;
        rows.forEach(function (r) {
          if (r.status === "interested") interested++;
          else if (r.status === "not_interested") notInterested++;
          else if (r.status === "pending") pending++;
        });
        radarInterestedEl.textContent = interested;
        radarNotInterestedEl.textContent = notInterested;
        radarPendingEl.textContent = pending;
      });
    }

    function scheduleMidnightReset() {
      var now = new Date();
      var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5, 0);
      setTimeout(function () {
        renderHero(me && me.pseudo);
        loadActivity();
        loadRadarStatus();
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
        loadActivity();
        loadBoxmail();
        loadRadarStatus();
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
