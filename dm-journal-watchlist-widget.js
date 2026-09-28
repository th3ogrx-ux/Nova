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

  var CSS = "\n.dm-access-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;border-radius:8px;background:rgba(255,255,255,.04);margin-bottom:6px;font-size:13.5px;}\n.dm-access-remove{flex-shrink:0;opacity:.5;cursor:pointer;font-size:16px;padding:0 4px;}\n.dm-access-remove:hover{opacity:1;color:#e88783;}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var supabase = getSupabaseClient();
    var me = null;
    var allProfiles = [];
    var watchedIds = [];

    var panel = document.getElementById("dm-access-panel");
    var listEl = document.getElementById("dm-access-list");
    var picker = document.getElementById("dm-access-picker");
    var addBtn = document.getElementById("dm-access-add-btn");

    if (!panel || !listEl || !picker || !addBtn) return;

    function renderPicker() {
      picker.innerHTML = "";
      var available = allProfiles.filter(function (p) { return watchedIds.indexOf(p.id) === -1; });
      if (!available.length) {
        picker.appendChild(el("div", { class: "empty-note" }, "Tout le monde est déjà ajouté."));
        return;
      }
      available.forEach(function (p) {
        var item = el("div", { class: "rj-picker-item" }, "+ " + escapeHtml(p.pseudo || "Compte incomplet"));
        item.addEventListener("click", function () {
          supabase.from("dm_journal_watchlist").insert({ profile_id: p.id }).then(function (res) {
            if (res && res.error) { alert("Erreur : " + res.error.message); return; }
            loadWatchlist();
          });
        });
        picker.appendChild(item);
      });
    }

    function renderList() {
      listEl.innerHTML = "";
      if (!watchedIds.length) {
        listEl.appendChild(el("div", { class: "empty-note" }, "Personne n'est autorisé pour l'instant."));
        return;
      }
      watchedIds.forEach(function (id) {
        var p = allProfiles.filter(function (x) { return x.id === id; })[0];
        if (!p) return;
        var row = el("div", { class: "dm-access-row" });
        row.appendChild(el("div", {}, escapeHtml(p.pseudo || "Compte incomplet")));
        var remove = el("div", { class: "dm-access-remove", title: "Retirer" }, "×");
        remove.addEventListener("click", function () {
          supabase.from("dm_journal_watchlist").delete().eq("profile_id", id).then(function (res) {
            if (res && res.error) { alert("Erreur : " + res.error.message); return; }
            loadWatchlist();
          });
        });
        row.appendChild(remove);
        listEl.appendChild(row);
      });
    }

    function loadWatchlist() {
      supabase.from("dm_journal_watchlist").select("profile_id").then(function (res) {
        watchedIds = ((res && res.data) || []).map(function (r) { return r.profile_id; });
        renderList();
        if (picker.classList.contains("open")) renderPicker();
      });
    }

    function loadProfiles() {
      return supabase.from("profiles").select("id,pseudo").eq("is_active", true).order("pseudo").then(function (res) {
        allProfiles = (res && res.data) || [];
      });
    }

    addBtn.addEventListener("click", function () {
      var isOpen = picker.classList.toggle("open");
      if (isOpen) renderPicker();
    });

    var booted = false;
    function boot(userId) {
      if (booted) return;
      booted = true;
      supabase.from("profiles").select("id,role").eq("id", userId).single().then(function (res) {
        if (!res || !res.data || res.data.role !== "chef") return;
        me = res.data;
        loadProfiles().then(loadWatchlist);
      });
      supabase.channel("nova-dm-journal-watchlist")
        .on("postgres_changes", { event: "*", schema: "public", table: "dm_journal_watchlist" }, function () {
          if (me) loadWatchlist();
        })
        .subscribe();
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
