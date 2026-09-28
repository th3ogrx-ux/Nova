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

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var STATUS_OPTIONS = [
    { value: "interested", label: "Intéressé" },
    { value: "not_interested", label: "Non intéressé" },
    { value: "pending", label: "En attente" }
  ];

  function periodSince(period) {
    var now = new Date();
    if (period === "day") {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    }
    if (period === "week") {
      var day = now.getDay();
      var diffToMonday = day === 0 ? 6 : day - 1;
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday).toISOString();
    }
    if (period === "month") {
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    }
    return null;
  }

  function init() {
    var supabase = getSupabaseClient();

    var navEquipe = document.getElementById("nav-equipe");
    var navEquipeSublist = document.getElementById("nav-equipe-sublist");
    var navRadarJournal = document.getElementById("nav-radar-journal");
    var periodTabs = document.getElementById("radar-journal-period-tabs");
    var interestedEl = document.getElementById("radar-journal-interested");
    var notInterestedEl = document.getElementById("radar-journal-not-interested");
    var pendingEl = document.getElementById("radar-journal-pending");
    var listEl = document.getElementById("radar-journal-list");

    if (!navRadarJournal || !listEl) return;

    var currentPeriod = "day";

    function switchToView() {
      document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
      if (navEquipe) navEquipe.classList.add("active");
      if (navEquipeSublist) {
        navEquipeSublist.querySelectorAll(".nav-subitem").forEach(function (si) { si.classList.remove("active"); });
      }
      navRadarJournal.classList.add("active");
      document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
      var v = document.getElementById("view-radar-journal");
      if (v) v.classList.add("active");
      if (window.ZenoaNav) {
        window.ZenoaNav.closeSidebar();
        window.ZenoaNav.setLastView("radar-journal");
      }
    }

    function setStatus(id, status, row) {
      supabase.from("radar_leads").update({ status: status }).eq("id", id).then(function () {});
    }

    function renderCards(results) {
      listEl.innerHTML = "";
      if (!results.length) {
        listEl.appendChild(el("div", { class: "empty-note" }, "Aucun prospect sur cette période."));
        return;
      }
      results.forEach(function (r) {
        var card = el("div", { class: "radar-card" + (r.status ? " done" : "") });
        card.appendChild(el("div", { class: "radar-card-name" }, escapeHtml(r.name)));
        if (r.category_label) card.appendChild(el("div", { class: "radar-card-row" }, "🏷️ " + escapeHtml(r.category_label) + (r.city ? " — " + escapeHtml(r.city) : "")));
        if (r.address) card.appendChild(el("div", { class: "radar-card-row" }, "📍 " + escapeHtml(r.address)));
        if (r.phone) card.appendChild(el("div", { class: "radar-card-row" }, "📞 " + escapeHtml(r.phone)));
        if (r.website) {
          card.appendChild(el("div", { class: "radar-card-row" }, '🌐 <a href="' + escapeHtml(r.website) + '" target="_blank" rel="noopener">' + escapeHtml(r.website) + "</a>"));
        }
        card.appendChild(el("div", { class: "radar-card-row" }, "✉️ " + (r.email ? escapeHtml(r.email) : "Non trouvé")));

        var statusRow = el("div", { class: "radar-card-status" });
        STATUS_OPTIONS.forEach(function (opt) {
          var btn = el("div", { class: "radar-status-btn " + opt.value + (r.status === opt.value ? " active" : "") }, escapeHtml(opt.label));
          btn.addEventListener("click", function () {
            var next = r.status === opt.value ? null : opt.value;
            r.status = next;
            card.classList.toggle("done", !!next);
            statusRow.querySelectorAll(".radar-status-btn").forEach(function (b) { b.classList.remove("active"); });
            if (next) btn.classList.add("active");
            setStatus(r.id, next, r);
          });
          statusRow.appendChild(btn);
        });
        card.appendChild(statusRow);

        listEl.appendChild(card);
      });
    }

    function loadJournal() {
      var since = periodSince(currentPeriod);
      var query = supabase.from("radar_leads").select("*").order("created_at", { ascending: false });
      if (since) query = query.gte("created_at", since);
      query.then(function (res) {
        var rows = (res && res.data) || [];
        var interested = 0, notInterested = 0, pending = 0;
        rows.forEach(function (r) {
          if (r.status === "interested") interested++;
          else if (r.status === "not_interested") notInterested++;
          else if (r.status === "pending") pending++;
        });
        if (interestedEl) interestedEl.textContent = interested;
        if (notInterestedEl) notInterestedEl.textContent = notInterested;
        if (pendingEl) pendingEl.textContent = pending;
        renderCards(rows);
      });
    }

    if (periodTabs) {
      periodTabs.querySelectorAll(".period-tab").forEach(function (tab) {
        tab.addEventListener("click", function () {
          periodTabs.querySelectorAll(".period-tab").forEach(function (t) { t.classList.remove("active"); });
          tab.classList.add("active");
          currentPeriod = tab.getAttribute("data-period");
          loadJournal();
        });
      });
    }

    navRadarJournal.addEventListener("click", function () {
      switchToView();
      loadJournal();
    });

    var subscribed = false;
    function boot() {
      if (subscribed) return;
      subscribed = true;
      supabase.channel("nova-radar-journal")
        .on("postgres_changes", { event: "*", schema: "public", table: "radar_leads" }, function () {
          var v = document.getElementById("view-radar-journal");
          if (v && v.classList.contains("active")) loadJournal();
        })
        .subscribe();
    }

    supabase.auth.getSession().then(function (res) {
      var session = res && res.data && res.data.session;
      if (session && session.user) boot();
    });
    supabase.auth.onAuthStateChange(function (event, session) {
      if (session && session.user) boot();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { loadSupabase(init); });
  } else {
    loadSupabase(init);
  }
})();
