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

  var STATUS_LABELS = {
    sent: "DM envoyé",
    replied: "Réponse reçue",
    mini_analysis_requested: "Demande mini analyse",
    meeting: "Call pris",
    sold: "Vendu",
    not_interested: "Pas intéressé"
  };

  var CSS = "\n.status-tag-dm.st-mini_analysis_requested{color:#e6ccff;border-color:#e0b3ff59;background:#e0b3ff14;}\n.status-tag-dm.st-sold{color:#f2c572;border-color:#d4af3759;background:#d4af3714;}\n.status-tag-dm.st-meeting{color:#a8d8f2;border-color:#5ac8fa59;background:#5ac8fa14;}\n.nova-funnel-bar{display:flex;align-items:stretch;flex:1;min-width:40px;height:7px;border-radius:4px;overflow:hidden;background:rgba(255,255,255,.08);margin-left:8px;}\n.nova-funnel-seg{height:100%;}\n.nova-funnel-seg.sent{background:var(--cool-1);}\n.nova-funnel-seg.replied{background:var(--ok);}\n.nova-funnel-seg.mini_analysis{background:#e0b3ff;}\n.nova-funnel-seg.meeting{background:#5ac8fa;}\n.nova-funnel-seg.sold{background:#d4af37;}\n.nova-funnel-seg.not_interested{background:var(--danger);}\n.nova-funnel-legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:14px;padding-top:12px;border-top:1px solid rgba(199,194,219,.12);font-size:12px;opacity:.75;}\n.nova-funnel-legend-item{display:flex;align-items:center;gap:6px;}\n.nova-funnel-legend-dot{width:9px;height:9px;border-radius:50%;display:inline-block;flex-shrink:0;}\n.nova-funnel-legend-dot.sent{background:var(--cool-1);}\n.nova-funnel-legend-dot.replied{background:var(--ok);}\n.nova-funnel-legend-dot.mini_analysis{background:#e0b3ff;}\n.nova-funnel-legend-dot.meeting{background:#5ac8fa;}\n.nova-funnel-legend-dot.sold{background:#d4af37;}\n.nova-funnel-legend-dot.not_interested{background:var(--danger);}\n.activity-row-count{width:auto;min-width:56px;white-space:nowrap;font-size:12px;}\n.nova-activity-namewrap{width:100px;flex-shrink:0;min-width:0;display:flex;flex-direction:column;justify-content:center;}\n.nova-activity-namewrap .activity-row-name{width:auto;}\n.nova-activity-role{font-size:10.5px;opacity:.6;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var supabase = getSupabaseClient();

    var me = null;
    var dmJournalEl = document.getElementById("dm-journal");
    var activityListEl = document.getElementById("activity-list");
    var dmObserver = null;
    var activityObserver = null;
    var funnelCounts = {}; // pseudo (lowercase) -> {sent, replied, sold, not_interested, total}
    var rolesByPseudo = {}; // pseudo (lowercase) -> custom_role
    var profileByPseudo = {}; // pseudo (lowercase) -> {id, pseudo, photo_url, role}
    var dmWatchlistIds = [];

    function loadDmWatchlist() {
      return supabase.from("dm_journal_watchlist").select("profile_id").then(function (res) {
        dmWatchlistIds = ((res && res.data) || []).map(function (r) { return r.profile_id; });
      });
    }

    if (!dmJournalEl && !activityListEl) return;

    var modalProspect = document.getElementById("modal-prospect");
    var statusField = document.getElementById("prospect-status-field");
    var prospectModalTitle = document.getElementById("prospect-modal-title");

    function syncModalMode() {
      var isEdit = !!(prospectModalTitle && prospectModalTitle.textContent.indexOf("Modifier") !== -1);
      if (statusField) statusField.style.display = isEdit ? "block" : "none";
    }

    if (modalProspect) {
      new MutationObserver(function () {
        if (modalProspect.classList.contains("open")) syncModalMode();
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
        return supabase.from("profiles").select("id,pseudo,custom_role,role").eq("is_active", true).then(function (res2) {
          var idToPseudo = {};
          rolesByPseudo = {};
          profileByPseudo = {};
          ((res2 && res2.data) || []).forEach(function (p) {
            idToPseudo[p.id] = p.pseudo;
            var key = (p.pseudo || "").trim().toLowerCase();
            rolesByPseudo[key] = p.custom_role || "";
            profileByPseudo[key] = p;
          });
          buildCounts(rows, idToPseudo);
        });
      });
    }

    function buildCounts(rows, idToPseudo) {
      var counts = {};
      rows.forEach(function (r) {
        var pseudo = idToPseudo[r.setter_id];
        if (!pseudo) return;
        var key = pseudo.trim().toLowerCase();
        if (!counts[key]) counts[key] = { total: 0, replied: 0, mini_analysis: 0, meeting: 0, sold: 0, not_interested: 0 };
        counts[key].total++; // chaque prospect compte toujours comme un DM envoyé
        if (r.status === "replied") counts[key].replied++;
        else if (r.status === "mini_analysis_requested") counts[key].mini_analysis++;
        else if (r.status === "meeting") counts[key].meeting++;
        else if (r.status === "sold") counts[key].sold++;
        else if (r.status === "not_interested") counts[key].not_interested++;
      });
      funnelCounts = counts;
    }

    function buildFunnelBar(pseudo) {
      var c = funnelCounts[(pseudo || "").trim().toLowerCase()];
      var wrap = el("div", { class: "nova-funnel-bar" });
      if (!c || !c.total) return wrap;
      var remainder = c.total - c.replied - c.mini_analysis - c.meeting - c.sold - c.not_interested;
      wrap.setAttribute("title", "DM envoyé : " + c.total + " · Réponse reçue : " + c.replied + " · Demande mini analyse : " + c.mini_analysis + " · Call pris : " + c.meeting + " · Vendu : " + c.sold + " · Pas intéressé : " + c.not_interested);
      [["sent", remainder], ["replied", c.replied], ["mini_analysis", c.mini_analysis], ["meeting", c.meeting], ["sold", c.sold], ["not_interested", c.not_interested]].forEach(function (pair) {
        if (pair[1] > 0) {
          var pct = (pair[1] / c.total) * 100;
          wrap.appendChild(el("div", { class: "nova-funnel-seg " + pair[0], style: "width:" + pct + "%;" }));
        }
      });
      return wrap;
    }

    function ensureLegend() {
      if (!activityListEl || !activityListEl.parentElement) return;
      if (document.getElementById("nova-funnel-legend")) return;
      var legend = el("div", { id: "nova-funnel-legend", class: "nova-funnel-legend" });
      var formatNote = el("div", { style: "width:100%;opacity:.6;" }, "Chiffres : DM envoyé / Réponse reçue / Demande mini analyse / Call pris / Vendu / Pas intéressé");
      legend.appendChild(formatNote);
      [
        { key: "sent", label: "DM envoyé" },
        { key: "replied", label: "Réponse reçue" },
        { key: "mini_analysis", label: "Demande mini analyse" },
        { key: "meeting", label: "Call pris" },
        { key: "sold", label: "Vendu" },
        { key: "not_interested", label: "Pas intéressé" }
      ].forEach(function (it) {
        var item = el("div", { class: "nova-funnel-legend-item" });
        item.appendChild(el("span", { class: "nova-funnel-legend-dot " + it.key }));
        item.appendChild(document.createTextNode(it.label));
        legend.appendChild(item);
      });
      activityListEl.parentElement.appendChild(legend);
    }

    function decorateActivityList() {
      if (!activityListEl) return;
      ensureLegend();
      loadFunnelCounts().then(function () {
        var rows = activityListEl.querySelectorAll(".activity-row");
        rows.forEach(function (row) {
          var nameEl = row.querySelector(".activity-row-name");
          if (!nameEl) return;

          var rowProfile = profileByPseudo[nameEl.textContent.trim().toLowerCase()];
          if (rowProfile && rowProfile.role === "chef") {
            row.style.display = "none";
            return;
          }
          if (rowProfile && dmWatchlistIds.indexOf(rowProfile.id) === -1) {
            row.style.display = "none";
            return;
          }
          row.style.display = "";

          var wrap = nameEl.parentElement.classList.contains("nova-activity-namewrap")
            ? nameEl.parentElement
            : null;
          if (!wrap) {
            wrap = el("div", { class: "nova-activity-namewrap" });
            nameEl.parentNode.insertBefore(wrap, nameEl);
            wrap.appendChild(nameEl);
          }
          var roleLine = wrap.querySelector(".nova-activity-role");
          if (!roleLine) {
            roleLine = el("div", { class: "nova-activity-role" });
            wrap.appendChild(roleLine);
          }
          roleLine.textContent = rolesByPseudo[nameEl.textContent.trim().toLowerCase()] || "";

          var old = row.querySelector(".nova-funnel-bar");
          if (old) old.remove();
          wrap.insertAdjacentElement("afterend", buildFunnelBar(nameEl.textContent));

          var track = row.querySelector(".activity-row-track");
          if (track) track.style.display = "none";

          var countEl = row.querySelector(".activity-row-count");
          if (countEl) {
            var c = funnelCounts[nameEl.textContent.trim().toLowerCase()] || { total: 0, replied: 0, mini_analysis: 0, meeting: 0, sold: 0, not_interested: 0 };
            countEl.textContent = c.total + "/" + c.replied + "/" + c.mini_analysis + "/" + c.meeting + "/" + c.sold + "/" + c.not_interested;
          }
        });

        function statsFor(row) {
          var nameEl = row.querySelector(".activity-row-name");
          var key = (nameEl ? nameEl.textContent : "").trim().toLowerCase();
          return funnelCounts[key] || { total: 0, replied: 0, sold: 0 };
        }

        var currentOrder = Array.prototype.slice.call(rows);
        var sorted = currentOrder.slice().sort(function (a, b) {
          var ac = statsFor(a), bc = statsFor(b);
          if (bc.sold !== ac.sold) return bc.sold - ac.sold;
          if (bc.replied !== ac.replied) return bc.replied - ac.replied;
          return bc.total - ac.total;
        });

        var orderChanged = sorted.some(function (row, i) { return row !== currentOrder[i]; });
        if (orderChanged) {
          sorted.forEach(function (row) { activityListEl.appendChild(row); });
        }
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

    var booted = false;
    function boot(userId) {
      if (booted) return;
      booted = true;
      supabase.from("profiles").select("id,pseudo,role").eq("id", userId).single().then(function (res) {
        if (!res || !res.data) return;
        me = res.data;

        // Le chef atteint le journal de DMs via le dossier Équipe
        // (chef-only) ; ce lien autonome n'est destiné qu'aux membres
        // à qui l'accès a été accordé via dm_journal_watchlist.
        var navDms = document.getElementById("nav-dms");
        if (navDms) {
          if (me.role === "chef") {
            navDms.style.display = "none";
          } else {
            supabase.from("dm_journal_watchlist").select("profile_id").eq("profile_id", me.id).maybeSingle().then(function (wres) {
              navDms.style.display = (wres && wres.data) ? "" : "none";
            });
          }
        }

        watchDmJournal();
        watchActivityList();

        var dayTab = document.querySelector('#activity-period-tabs .period-tab[data-period="day"]');
        if (dayTab) dayTab.click();

        decorateDmJournal();
        loadDmWatchlist().then(decorateActivityList);

        supabase.channel("nova-prospects-funnel")
          .on("postgres_changes", { event: "*", schema: "public", table: "prospects" }, function () {
            decorateDmJournal();
            decorateActivityList();
          })
          .subscribe();

        supabase.channel("nova-dm-watchlist-filter")
          .on("postgres_changes", { event: "*", schema: "public", table: "dm_journal_watchlist" }, function () {
            loadDmWatchlist().then(decorateActivityList);
          })
          .subscribe();
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
