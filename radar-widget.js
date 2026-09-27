(function () {
  "use strict";

  var SUPABASE_URL = "https://mfdqxzccmzumxiichdqw.supabase.co";
  var SUPABASE_KEY = "sb_publishable_Qes5VQ0OcaAEVh_kMjej6A_HJ6yxY3T";
  var RADAR_FN_URL = SUPABASE_URL + "/functions/v1/radar-search-";

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

  function csvEscape(v) {
    var s = v === null || v === undefined ? "" : String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  var CSS = "\n.radar-card{display:flex;flex-direction:column;gap:6px;padding:16px 18px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(199,194,219,.14);margin-bottom:10px;}\n.radar-card-name{font-weight:700;font-size:15.5px;}\n.radar-card-row{font-size:13px;color:var(--text-mid);display:flex;align-items:center;gap:7px;}\n.radar-card-row a{color:#E0B3FF;word-break:break-all;}\n.radar-empty{opacity:.55;font-size:14px;padding:20px 4px;}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var supabase = getSupabaseClient();
    var me = null;
    var currentResults = [];

    var navAgentIa = document.getElementById("nav-agent-ia");
    var navAgentIaSublist = document.getElementById("nav-agent-ia-sublist");
    var navRadar = document.getElementById("nav-radar");
    var radarForm = document.getElementById("radar-search-form");
    var radarCity = document.getElementById("radar-city");
    var radarCategory = document.getElementById("radar-category");
    var radarSearchBtn = document.getElementById("radar-search-btn");
    var radarError = document.getElementById("radar-error");
    var radarResultsToolbar = document.getElementById("radar-results-toolbar");
    var radarResultsCount = document.getElementById("radar-results-count");
    var radarResults = document.getElementById("radar-results");
    var radarExportBtn = document.getElementById("radar-export-csv");

    if (navRadar) {
      navRadar.addEventListener("click", function () {
        document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
        if (navAgentIa) navAgentIa.classList.add("active");
        if (navAgentIaSublist) {
          navAgentIaSublist.querySelectorAll(".nav-subitem").forEach(function (si) { si.classList.remove("active"); });
        }
        navRadar.classList.add("active");
        document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
        var v = document.getElementById("view-radar");
        if (v) v.classList.add("active");
        if (window.ZenoaNav) {
          window.ZenoaNav.closeSidebar();
          window.ZenoaNav.setLastView("radar");
        }
      });
    }

    function renderResults(results) {
      radarResults.innerHTML = "";
      if (!results.length) {
        radarResults.appendChild(el("div", { class: "radar-empty" }, "Aucun résultat pour cette recherche."));
        radarResultsToolbar.style.display = "none";
        return;
      }
      radarResultsToolbar.style.display = "flex";
      radarResultsCount.textContent = results.length + " résultat" + (results.length > 1 ? "s" : "");
      results.forEach(function (r) {
        var card = el("div", { class: "radar-card" });
        card.appendChild(el("div", { class: "radar-card-name" }, escapeHtml(r.name)));
        if (r.address) card.appendChild(el("div", { class: "radar-card-row" }, "📍 " + escapeHtml(r.address)));
        if (r.phone) card.appendChild(el("div", { class: "radar-card-row" }, "📞 " + escapeHtml(r.phone)));
        if (r.website) {
          card.appendChild(el("div", { class: "radar-card-row" }, '🌐 <a href="' + escapeHtml(r.website) + '" target="_blank" rel="noopener">' + escapeHtml(r.website) + "</a>"));
        }
        card.appendChild(el("div", { class: "radar-card-row" }, "✉️ " + (r.email ? escapeHtml(r.email) : "Non trouvé")));
        radarResults.appendChild(card);
      });
    }

    if (radarForm) {
      radarForm.addEventListener("submit", function (e) {
        e.preventDefault();
        radarError.textContent = "";
        var city = (radarCity.value || "").trim();
        var category = (radarCategory.value || "").trim();
        if (!city || !category) { radarError.textContent = "Indique une ville et une catégorie."; return; }

        radarSearchBtn.disabled = true;
        radarSearchBtn.textContent = "Recherche...";
        radarResultsToolbar.style.display = "none";
        radarResults.innerHTML = "";

        supabase.auth.getSession().then(function (res) {
          var session = res && res.data && res.data.session;
          var token = session && session.access_token;
          if (!token) {
            radarError.textContent = "Session expirée, reconnecte-toi.";
            radarSearchBtn.disabled = false;
            radarSearchBtn.textContent = "Rechercher";
            return;
          }
          fetch(RADAR_FN_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + token,
              "apikey": SUPABASE_KEY
            },
            body: JSON.stringify({ city: city, category: category })
          }).then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
            .then(function (out) {
              radarSearchBtn.disabled = false;
              radarSearchBtn.textContent = "Rechercher";
              if (!out.ok || out.data.error) {
                radarError.textContent = "Erreur : " + (out.data && out.data.error ? out.data.error : "recherche impossible");
                return;
              }
              currentResults = out.data.results || [];
              renderResults(currentResults);
            }).catch(function () {
              radarSearchBtn.disabled = false;
              radarSearchBtn.textContent = "Rechercher";
              radarError.textContent = "Erreur réseau, réessaie.";
            });
        });
      });
    }

    if (radarExportBtn) {
      radarExportBtn.addEventListener("click", function () {
        if (!currentResults.length) return;
        var rows = [["Nom", "Adresse", "Téléphone", "Site web", "Email"]];
        currentResults.forEach(function (r) {
          rows.push([r.name || "", r.address || "", r.phone || "", r.website || "", r.email || ""]);
        });
        var csv = rows.map(function (row) { return row.map(csvEscape).join(","); }).join("\n");
        var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
        var url = URL.createObjectURL(blob);
        var a = el("a", { href: url, download: "zenoa-radar-export.csv" });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

    var booted = false;
    function boot(userId) {
      if (booted) return;
      booted = true;
      supabase.from("profiles").select("id,pseudo").eq("id", userId).single().then(function (res) {
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
