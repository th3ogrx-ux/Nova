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

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  var STATUS_LABELS = {
    sent: "DM envoyé",
    replied: "Réponse reçue",
    meeting: "RDV pris",
    interested: "Intéressé",
    sold: "Vendu",
    not_interested: "Pas intéressé"
  };

  var CSS = "\n.status-tag-dm.st-interested{color:#c4b5fd;border-color:#a78bfa59;background:#a78bfa14;}\n.status-tag-dm.st-sold{color:#f0b866;border-color:#d4841a59;background:#d4841a14;}\n.nova-funnel-bar{display:flex;align-items:stretch;width:56px;height:7px;border-radius:4px;overflow:hidden;background:rgba(255,255,255,.08);flex-shrink:0;margin-left:8px;}\n.nova-funnel-seg{height:100%;}\n.nova-funnel-seg.interested{background:#a78bfa;}\n.nova-funnel-seg.sold{background:var(--warm-1);}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var existingKey = findExistingStorageKey();
    var clientOpts = existingKey ? { auth: { storageKey: existingKey } } : {};
    var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, clientOpts);

    var me = null;
    var dmJournalEl = document.getElementById("dm-journal");
    var activityListEl = document.getElementById("activity-list");
    var dmObserver = null;
    var activityObserver = null;
    var funnelCounts = {}; // pseudo (lowercase) -> {meeting, interested, sold}
    var funnelMax = 1;

    if (!dmJournalEl && !activityListEl) return;

    var statusSelect = document.getElementById("prospect-status");
    var statusChecks = document.querySelectorAll(".prospect-status-check");
    var modalProspect = document.getElementById("modal-prospect");

    function syncChecksFromSelect() {
      if (!statusSelect) return;
      var val = statusSelect.value;
      statusChecks.forEach(function (cb) {
        cb.checked = cb.getAttribute("data-status-value") === val;
      });
    }

    statusChecks.forEach(function (cb) {
      cb.addEventListener("change", function () {
        if (!statusSelect) return;
        if (cb.checked) {
          statusChecks.forEach(function (other) { if (other !== cb) other.checked = false; });
          statusSelect.value = cb.getAttribute("data-status-value");
        } else {
          statusSelect.value = "sent";
        }
      });
    });

    if (modalProspect) {
      new MutationObserver(function () {
        if (modalProspect.classList.contains("open")) syncChecksFromSelect();
      }).observe(modalProspect, { attributes: true, attributeFilter: ["class"] });
    }

    function decorateDmJournal() {
      if (!dmJournalEl) return;
      var tags = dmJournalEl.querySelectorAll(".status-tag-dm");
      tags.forEach(function (tag) {
        var m = tag.className.match(/st-([a-z_]+)/);
        if (!m) return;
        var label = STATUS_LABELS[m[1]];
        if (label) tag.textContent = label;
      });
    }

    function watchDmJournal() {
      if (!dmJournalEl || dmObserver) return;
      dmObserver = new MutationObserver(function () {
        clearTimeout(watchDmJournal._t);
        watchDmJournal._t = setTimeout(decorateDmJournal, 150);
      });
      dmObserver.observe(dmJournalEl, { childList: true, subtree: true });
    }

    function loadFunnelCounts() {
      return supabase.from("prospects").select("setter_id,status").then(function (res) {
        var rows = (res && res.data) || [];
        return supabase.from("profiles").select("id,pseudo").then(function (res2) {
          var idToPseudo = {};
          ((res2 && res2.data) || []).forEach(function (p) { idToPseudo[p.id] = p.pseudo; });
          buildCounts(rows, idToPseudo);
        });
      });
    }

    function buildCounts(rows, idToPseudo) {
      var counts = {};
      var max = 1;
      rows.forEach(function (r) {
        var pseudo = idToPseudo[r.setter_id];
        if (!pseudo) return;
        if (r.status !== "interested" && r.status !== "sold") return;
        var key = pseudo.trim().toLowerCase();
        if (!counts[key]) counts[key] = { interested: 0, sold: 0 };
        counts[key][r.status]++;
        var total = counts[key].interested + counts[key].sold;
        if (total > max) max = total;
      });
      funnelCounts = counts;
      funnelMax = max;
    }

    function buildFunnelBar(pseudo) {
      var c = funnelCounts[(pseudo || "").trim().toLowerCase()] || { interested: 0, sold: 0 };
      var wrap = el("div", {
        class: "nova-funnel-bar",
        title: "Intéressé : " + c.interested + " · Vendu : " + c.sold
      });
      var scale = 56 / funnelMax;
      ["interested", "sold"].forEach(function (key) {
        var w = Math.round(c[key] * scale);
        if (w > 0) wrap.appendChild(el("div", { class: "nova-funnel-seg " + key, style: "width:" + w + "px;" }));
      });
      return wrap;
    }

    function decorateActivityList() {
      if (!activityListEl) return;
      loadFunnelCounts().then(function () {
        var rows = activityListEl.querySelectorAll(".activity-row");
        rows.forEach(function (row) {
          var nameEl = row.querySelector(".activity-row-name");
          if (!nameEl) return;
          var old = row.querySelector(".nova-funnel-bar");
          if (old) old.remove();
          nameEl.insertAdjacentElement("afterend", buildFunnelBar(nameEl.textContent));
        });
      });
    }

    function watchActivityList() {
      if (!activityListEl || activityObserver) return;
      activityObserver = new MutationObserver(function () {
        clearTimeout(watchActivityList._t);
        watchActivityList._t = setTimeout(decorateActivityList, 150);
      });
      activityObserver.observe(activityListEl, { childList: true });
    }

    function boot(userId) {
      supabase.from("profiles").select("id,pseudo").eq("id", userId).single().then(function (res) {
        if (!res || !res.data) return;
        me = res.data;

        watchDmJournal();
        watchActivityList();
        decorateDmJournal();
        decorateActivityList();

        supabase.channel("nova-prospects-funnel")
          .on("postgres_changes", { event: "*", schema: "public", table: "prospects" }, function () {
            decorateDmJournal();
            decorateActivityList();
          })
          .subscribe();
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
