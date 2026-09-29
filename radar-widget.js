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

  function csvEscape(v) {
    var s = v === null || v === undefined ? "" : String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function exportCsv(rows, filename) {
    var header = [["Nom", "Adresse", "Téléphone", "Site web", "Email", "Métier", "Ville"]];
    var body = rows.map(function (r) {
      return [r.name || "", r.address || "", r.phone || "", r.website || "", r.email || "", r.category_label || "", r.city || ""];
    });
    var csv = header.concat(body).map(function (row) { return row.map(csvEscape).join(","); }).join("\n");
    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = el("a", { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function todayStr() {
    var t = new Date();
    return t.getFullYear() + "-" + pad2(t.getMonth() + 1) + "-" + pad2(t.getDate());
  }

  var CSS = "\n.radar-card{display:flex;flex-direction:column;gap:6px;padding:16px 18px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(199,194,219,.14);margin-bottom:10px;transition:opacity .2s ease,border-color .2s ease;}\n.radar-card.done{opacity:.5;border-color:rgba(79,191,122,.5);}\n.radar-card-name{font-weight:700;font-size:15.5px;}\n.radar-card-row{font-size:13px;color:var(--text-mid);display:flex;align-items:center;gap:7px;}\n.radar-card-row a{color:#E0B3FF;word-break:break-all;}\n.radar-card-status{display:flex;gap:8px;margin-top:4px;padding-top:10px;border-top:1px solid rgba(199,194,219,.12);flex-wrap:wrap;}\n.radar-status-btn{flex:1;text-align:center;padding:8px 6px;border-radius:8px;border:1px solid rgba(199,194,219,.2);background:rgba(255,255,255,.03);color:var(--text-mid);font-size:12.5px;font-weight:600;cursor:pointer;transition:background .2s ease,border-color .2s ease,color .2s ease;white-space:nowrap;}\n.radar-status-btn:hover{background:rgba(255,255,255,.08);}\n.radar-status-btn.active.interested{background:#4fbf7a26;border-color:#4fbf7a;color:#7fe0a4;}\n.radar-status-btn.active.not_interested{background:#d9534f26;border-color:#d9534f;color:#e88783;}\n.radar-status-btn.active.pending{background:#bf5af226;border-color:#bf5af2;color:#e0b3ff;}\n.radar-empty{opacity:.55;font-size:14px;padding:20px 4px;}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var supabase = getSupabaseClient();
    var me = null;

    var navRadar = document.getElementById("nav-radar");
    var radarDailyResults = document.getElementById("radar-daily-results");
    var radarDailyCount = document.getElementById("radar-daily-count");
    var radarDailyExportBtn = document.getElementById("radar-daily-export-csv");
    var currentDailyResults = [];

    if (navRadar) {
      navRadar.addEventListener("click", function () {
        document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
        document.querySelectorAll(".nav-subitem").forEach(function (si) { si.classList.remove("active"); });
        navRadar.classList.add("active");
        document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
        var v = document.getElementById("view-radar");
        if (v) v.classList.add("active");
        if (window.ZenoaNav) {
          window.ZenoaNav.closeSidebar();
          window.ZenoaNav.setLastView("radar");
        }
        loadDailyLeads();
      });
    }

    var STATUS_OPTIONS = [
      { value: "interested", label: "Intéressé" },
      { value: "not_interested", label: "Non intéressé" },
      { value: "pending", label: "En attente" }
    ];

    function setStatus(id, val) {
      supabase.from("radar_leads").update({
        status: val,
        status_set_by: val ? (me && me.id) : null
      }).eq("id", id).then(function () {});
    }

    function renderCards(container, results, emptyText) {
      container.innerHTML = "";
      if (!results.length) {
        container.appendChild(el("div", { class: "radar-empty" }, emptyText));
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
            setStatus(r.id, next);
          });
          statusRow.appendChild(btn);
        });
        card.appendChild(statusRow);

        container.appendChild(card);
      });
    }

    function loadDailyLeads() {
      if (!radarDailyResults) return;
      supabase.from("radar_leads").select("*").eq("sent_date", todayStr())
        .order("created_at", { ascending: false }).then(function (res) {
          currentDailyResults = (res && res.data) || [];
          radarDailyCount.textContent = currentDailyResults.length ? "(" + currentDailyResults.length + ")" : "";
          if (radarDailyExportBtn) radarDailyExportBtn.style.display = currentDailyResults.length ? "inline-flex" : "none";
          renderCards(radarDailyResults, currentDailyResults, "Aucun prospect généré aujourd'hui pour l'instant — repasse après midi.");
        });
    }

    if (radarDailyExportBtn) {
      radarDailyExportBtn.addEventListener("click", function () {
        if (!currentDailyResults.length) return;
        exportCsv(currentDailyResults, "zenoa-radar-du-jour-" + todayStr() + ".csv");
      });
    }

    function applyAccess(allowed) {
      if (navRadar) navRadar.style.display = allowed ? "" : "none";
      var homeTileRadar = document.getElementById("home-tile-radar");
      if (homeTileRadar) homeTileRadar.style.display = allowed ? "" : "none";
    }

    var booted = false;
    function boot(userId) {
      if (booted) return;
      booted = true;
      supabase.from("profiles").select("id,pseudo,role").eq("id", userId).single().then(function (res) {
        if (!res || !res.data) return;
        me = res.data;
        if (me.role === "chef") { applyAccess(true); return; }
        supabase.from("radar_journal_watchlist").select("profile_id").eq("profile_id", me.id).maybeSingle().then(function (wres) {
          applyAccess(!!(wres && wres.data));
        });
      });
      loadDailyLeads();
      supabase.channel("nova-radar-leads")
        .on("postgres_changes", { event: "*", schema: "public", table: "radar_leads" }, function () {
          var radarView = document.getElementById("view-radar");
          if (radarView && radarView.classList.contains("active")) loadDailyLeads();
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
