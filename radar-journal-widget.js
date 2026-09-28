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

  var CSS = "\n.rj-row{display:flex;align-items:center;gap:14px;}\n.rj-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}\n.rj-stats{display:flex;gap:18px;flex-shrink:0;}\n.rj-stat{text-align:center;min-width:34px;}\n.rj-remove{flex-shrink:0;opacity:.5;cursor:pointer;font-size:16px;padding:0 4px;}\n.rj-remove:hover{opacity:1;color:#e88783;}\n.rj-picker{margin-top:10px;display:none;flex-direction:column;gap:6px;}\n.rj-picker.open{display:flex;}\n.rj-picker-item{padding:10px 14px;border-radius:10px;cursor:pointer;font-size:13.5px;font-weight:600;color:var(--text-mid);background:rgba(255,255,255,.04);border:1px solid rgba(199,194,219,.2);transition:background .2s ease,border-color .2s ease,color .2s ease;}\n.rj-picker-item:hover{background:#bf5af21a;border-color:var(--warm-1);color:var(--metal-2);}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var supabase = getSupabaseClient();

    var navEquipe = document.getElementById("nav-equipe");
    var navEquipeSublist = document.getElementById("nav-equipe-sublist");
    var navRadarJournal = document.getElementById("nav-radar-journal");
    var periodTabs = document.getElementById("radar-journal-period-tabs");
    var activityListEl = document.getElementById("radar-journal-activity-list");
    var addBtn = document.getElementById("radar-journal-add-btn");

    if (!navRadarJournal || !activityListEl) return;

    var currentPeriod = "day";
    var me = null;
    var allProfiles = [];
    var watchedIds = [];
    var picker = null;

    function initials(name) {
      return (name || "?").trim().slice(0, 2).toUpperCase();
    }

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

    function isChef() {
      return me && me.role === "chef";
    }

    function togglePicker() {
      if (!picker) return;
      var isOpen = picker.classList.toggle("open");
      if (isOpen) renderPicker();
    }

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
          supabase.from("radar_journal_watchlist").insert({ profile_id: p.id }).then(function (res) {
            if (res && res.error) { alert("Erreur : " + res.error.message); return; }
            loadWatchlist();
          });
        });
        picker.appendChild(item);
      });
    }

    function loadJournal() {
      if (!watchedIds.length) {
        activityListEl.innerHTML = "";
        activityListEl.appendChild(el("div", { class: "empty-note" }, "Aucune personne suivie — clique sur \"+ Ajouter des personnes\"."));
        return;
      }

      var since = periodSince(currentPeriod);
      var query = supabase.from("radar_leads").select("status,status_set_by").in("status_set_by", watchedIds);
      if (since) query = query.gte("created_at", since);

      query.then(function (res) {
        var rows = (res && res.data) || [];
        var byMember = {};
        watchedIds.forEach(function (id) { byMember[id] = { interested: 0, notInterested: 0, pending: 0 }; });
        rows.forEach(function (r) {
          if (!byMember[r.status_set_by]) return;
          if (r.status === "interested") byMember[r.status_set_by].interested++;
          else if (r.status === "not_interested") byMember[r.status_set_by].notInterested++;
          else if (r.status === "pending") byMember[r.status_set_by].pending++;
        });

        var members = watchedIds.map(function (id) {
          var profile = allProfiles.filter(function (p) { return p.id === id; })[0];
          return { profile: profile, counts: byMember[id] };
        }).filter(function (m) { return m.profile; });

        members.sort(function (a, b) {
          if (b.counts.interested !== a.counts.interested) return b.counts.interested - a.counts.interested;
          var totalA = a.counts.interested + a.counts.notInterested + a.counts.pending;
          var totalB = b.counts.interested + b.counts.notInterested + b.counts.pending;
          if (totalB !== totalA) return totalB - totalA;
          return (a.profile.pseudo || "").localeCompare(b.profile.pseudo || "");
        });

        activityListEl.innerHTML = "";
        members.forEach(function (m) {
          var p = m.profile, counts = m.counts;
          var row = el("div", { class: "team-row glass-card rj-row" });

          var avatar = el("div", { class: "avatar", style: "cursor:default;" });
          if (p.photo_url) avatar.appendChild(el("img", { src: p.photo_url }));
          else avatar.appendChild(el("span", {}, initials(p.pseudo)));
          row.appendChild(avatar);

          var info = el("div", { class: "team-row-info" });
          info.appendChild(el("div", { class: "team-row-name rj-name" }, escapeHtml(p.pseudo || "Compte incomplet")));
          row.appendChild(info);

          var stats = el("div", { class: "rj-stats" });
          [["Intéressé", counts.interested, "#4FBF7A"], ["Non intéressé", counts.notInterested, "#D9534F"], ["En attente", counts.pending, "var(--warm-1)"]].forEach(function (t) {
            var stat = el("div", { class: "rj-stat" });
            stat.appendChild(el("div", { style: "font-weight:700;font-size:16px;color:" + t[2] + ";" }, String(t[1])));
            stat.appendChild(el("small", { style: "font-size:11px;color:var(--text-dim);" }, t[0]));
            stats.appendChild(stat);
          });
          row.appendChild(stats);

          if (isChef()) {
            var remove = el("div", { class: "rj-remove", title: "Retirer" }, "×");
            remove.addEventListener("click", function () {
              supabase.from("radar_journal_watchlist").delete().eq("profile_id", p.id).then(function (res) {
                if (res && res.error) { alert("Erreur : " + res.error.message); return; }
                loadWatchlist();
              });
            });
            row.appendChild(remove);
          }

          activityListEl.appendChild(row);
        });
      });
    }

    function loadWatchlist() {
      supabase.from("radar_journal_watchlist").select("profile_id").then(function (res) {
        watchedIds = ((res && res.data) || []).map(function (r) { return r.profile_id; });
        loadJournal();
      });
    }

    function loadProfiles() {
      return supabase.from("profiles").select("id,pseudo,photo_url,role").eq("is_active", true).order("pseudo").then(function (res) {
        allProfiles = (res && res.data) || [];
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

    if (addBtn) {
      picker = el("div", { class: "rj-picker", id: "radar-journal-picker" });
      addBtn.insertAdjacentElement("afterend", picker);
      addBtn.addEventListener("click", togglePicker);
    }

    navRadarJournal.addEventListener("click", function () {
      switchToView();
      loadProfiles().then(loadWatchlist);
    });

    var subscribed = false;
    function boot(userId) {
      if (subscribed) return;
      subscribed = true;
      supabase.from("profiles").select("id,pseudo,role").eq("id", userId).single().then(function (res) {
        if (!res || !res.data) return;
        me = res.data;
        if (addBtn && isChef()) addBtn.style.display = "inline-flex";
        if (isChef()) { if (navRadarJournal) navRadarJournal.style.display = ""; return; }
        supabase.from("radar_journal_watchlist").select("profile_id").eq("profile_id", me.id).maybeSingle().then(function (wres) {
          var allowed = !!(wres && wres.data);
          if (navRadarJournal) navRadarJournal.style.display = allowed ? "" : "none";
        });
      });
      supabase.channel("nova-radar-journal")
        .on("postgres_changes", { event: "*", schema: "public", table: "radar_leads" }, function () {
          var v = document.getElementById("view-radar-journal");
          if (v && v.classList.contains("active")) loadJournal();
        })
        .subscribe();
      supabase.channel("nova-radar-journal-watchlist")
        .on("postgres_changes", { event: "*", schema: "public", table: "radar_journal_watchlist" }, function () {
          var v = document.getElementById("view-radar-journal");
          if (v && v.classList.contains("active")) loadWatchlist();
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
