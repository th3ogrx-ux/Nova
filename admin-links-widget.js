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

  function fmtDateTime(ts) {
    if (!ts) return "";
    return new Date(ts).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  var CSS = "\n.admin-link-card{margin-bottom:12px;}\n.admin-link-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;flex-wrap:wrap;}\n.admin-link-title{font-weight:700;font-size:15px;}\n.admin-link-date{font-size:12px;opacity:.55;flex-shrink:0;}\n.admin-link-url{font-size:13.5px;margin-bottom:6px;word-break:break-all;}\n.admin-link-url a{color:var(--warm-2);}\n.admin-link-note{font-size:13.5px;opacity:.8;margin-bottom:12px;white-space:pre-wrap;}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var supabase = getSupabaseClient();
    var me = null;

    var navAdmin = document.getElementById("nav-admin");
    var navGestionSublist = document.getElementById("nav-gestion-sublist");
    var navGestionRessources = document.getElementById("nav-gestion-ressources");
    var linkForm = document.getElementById("admin-link-form");
    var linkTitle = document.getElementById("admin-link-title");
    var linkUrl = document.getElementById("admin-link-url");
    var linkNote = document.getElementById("admin-link-note");
    var linkError = document.getElementById("admin-link-error");
    var linksList = document.getElementById("admin-links-list");

    if (!navGestionRessources || !linksList) return;

    function switchToView() {
      document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
      if (navAdmin) navAdmin.classList.add("active");
      if (navGestionSublist) {
        navGestionSublist.querySelectorAll(".nav-subitem").forEach(function (si) { si.classList.remove("active"); });
      }
      navGestionRessources.classList.add("active");
      document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
      var v = document.getElementById("view-gestion-ressources");
      if (v) v.classList.add("active");
      if (window.ZenoaNav) {
        window.ZenoaNav.closeSidebar();
        window.ZenoaNav.setLastView("gestion-ressources");
      }
    }

    function buildLinkCard(link) {
      var card = el("div", { class: "glass-card panel-section admin-link-card" });

      var head = el("div", { class: "admin-link-head" });
      head.appendChild(el("div", { class: "admin-link-title" }, escapeHtml(link.title)));
      head.appendChild(el("div", { class: "admin-link-date" }, fmtDateTime(link.created_at)));
      card.appendChild(head);

      if (link.url) {
        card.appendChild(el("div", { class: "admin-link-url" }, '<a href="' + escapeHtml(link.url) + '" target="_blank" rel="noopener">' + escapeHtml(link.url) + "</a>"));
      }
      if (link.note) {
        card.appendChild(el("div", { class: "admin-link-note" }, escapeHtml(link.note)));
      }

      var del = el("button", { class: "btn btn-sm danger" }, "Supprimer");
      del.addEventListener("click", function () {
        if (!confirm("Supprimer ce lien ?")) return;
        supabase.from("admin_links").delete().eq("id", link.id).then(function (res) {
          if (res && res.error) { alert("Erreur : " + res.error.message); return; }
          card.remove();
        });
      });
      card.appendChild(del);

      return card;
    }

    function renderLinks() {
      linksList.innerHTML = "";
      supabase.from("admin_links").select("*").order("created_at", { ascending: false }).then(function (res) {
        if (res && res.error) { linksList.appendChild(el("div", { class: "empty-note" }, "Erreur : " + res.error.message)); return; }
        var rows = (res && res.data) || [];
        if (!rows.length) { linksList.appendChild(el("div", { class: "empty-note" }, "Aucun lien enregistré.")); return; }
        rows.forEach(function (r) { linksList.appendChild(buildLinkCard(r)); });
      });
    }

    navGestionRessources.addEventListener("click", function () {
      switchToView();
      renderLinks();
    });

    if (linkForm) {
      linkForm.addEventListener("submit", function (e) {
        e.preventDefault();
        linkError.textContent = "";
        var title = (linkTitle.value || "").trim();
        var url = (linkUrl.value || "").trim();
        var note = (linkNote.value || "").trim();
        if (!title) { linkError.textContent = "Indique un titre."; return; }
        if (!me) return;

        supabase.from("admin_links").insert({
          title: title,
          url: url || null,
          note: note || null,
          created_by: me.id
        }).then(function (res) {
          if (res && res.error) { linkError.textContent = "Erreur : " + res.error.message; return; }
          linkForm.reset();
          renderLinks();
        });
      });
    }

    var booted = false;
    function boot(userId) {
      if (booted) return;
      booted = true;
      supabase.from("profiles").select("id,role").eq("id", userId).single().then(function (res) {
        if (res && res.data) me = res.data;
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
