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

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  function dateStrDaysAgo(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function shortLabel(dateStr) {
    var parts = dateStr.split("-");
    return parts[2] + "/" + parts[1];
  }

  var DAYS = 14;

  // Mêmes catégories/couleurs que dans "Activité de l'équipe" de chaque journal.
  var DM_CATEGORIES = [
    { key: "sent", label: "DM envoyé", color: "var(--cool-1)" },
    { key: "replied", label: "Réponse reçue", color: "var(--ok)" },
    { key: "sold", label: "Vendu", color: "#d4af37" },
    { key: "not_interested", label: "Pas intéressé", color: "var(--danger)" }
  ];
  var LINKEDIN_CATEGORIES = [
    { key: "sent", label: "Message envoyé", color: "var(--cool-1)" },
    { key: "replied", label: "Réponse reçue", color: "var(--ok)" },
    { key: "audit", label: "Demande audit", color: "#e0b3ff" },
    { key: "meeting", label: "Call pris", color: "#5ac8fa" },
    { key: "sold", label: "Vendu", color: "#d4af37" },
    { key: "not_interested", label: "Pas intéressé", color: "var(--danger)" }
  ];
  var RADAR_CATEGORIES = [
    { key: "pending", label: "En attente", color: "var(--warm-1)" },
    { key: "interested", label: "Intéressé", color: "#4FBF7A" },
    { key: "not_interested", label: "Non intéressé", color: "#D9534F" }
  ];

  var CSS = "\n" +
    ".suivi-chart-wrap{margin-top:6px;}\n" +
    ".suivi-chart-wrap svg{width:100%;height:auto;display:block;}\n" +
    ".suivi-axis-line{stroke:rgba(199,194,219,.16);stroke-width:1;}\n" +
    ".suivi-grid-line{stroke:rgba(199,194,219,.08);stroke-width:1;}\n" +
    ".suivi-y-label{fill:var(--text-dim);font-size:9px;}\n" +
    ".suivi-x-label{fill:var(--text-dim);font-size:9px;}\n" +
    ".suivi-legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;font-size:11.5px;opacity:.8;}\n" +
    ".suivi-legend-item{display:flex;align-items:center;gap:6px;}\n" +
    ".suivi-legend-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0;}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var supabase = getSupabaseClient();

    var containers = {
      dms: document.getElementById("suivi-chart-dms"),
      linkedin: document.getElementById("suivi-chart-linkedin"),
      radar: document.getElementById("suivi-chart-radar")
    };

    if (!containers.dms && !containers.linkedin && !containers.radar) return;

    function buildDateRange(days) {
      var arr = [];
      for (var i = days - 1; i >= 0; i--) arr.push(dateStrDaysAgo(i));
      return arr;
    }

    // Récupère date+status sur la fenêtre, puis compte par jour selon une
    // fonction de classement propre à chaque journal (même logique que son
    // "Activité de l'équipe").
    function loadDailySeries(table, dateColumn, categories, classify, cb) {
      var range = buildDateRange(DAYS);
      var start = range[0];
      supabase.from(table).select(dateColumn + ",status").gte(dateColumn, start).then(function (res) {
        var byDate = {};
        range.forEach(function (d) {
          var counts = {};
          categories.forEach(function (c) { counts[c.key] = 0; });
          byDate[d] = counts;
        });
        ((res && res.data) || []).forEach(function (r) {
          var d = r[dateColumn];
          if (!Object.prototype.hasOwnProperty.call(byDate, d)) return;
          var key = classify(r.status);
          if (key && Object.prototype.hasOwnProperty.call(byDate[d], key)) byDate[d][key]++;
        });
        cb(range.map(function (d) { return { date: d, counts: byDate[d] }; }));
      });
    }

    function svgEl(tag, attrs) {
      var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
      if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    }

    function renderMultiLineChart(container, series, categories) {
      if (!container) return;
      container.innerHTML = "";

      var W = 600, H = 180;
      var padL = 30, padR = 10, padT = 12, padB = 24;
      var plotW = W - padL - padR;
      var plotH = H - padT - padB;

      var maxVal = 0;
      series.forEach(function (d) {
        categories.forEach(function (c) { if (d.counts[c.key] > maxVal) maxVal = d.counts[c.key]; });
      });
      if (maxVal === 0) maxVal = 1;

      var stepX = series.length > 1 ? plotW / (series.length - 1) : 0;
      function xAt(i) { return padL + i * stepX; }
      function yAt(v) { return padT + plotH * (1 - v / maxVal); }

      var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "xMinYMid meet" });

      [0, maxVal].forEach(function (v) {
        var y = yAt(v);
        svg.appendChild(svgEl("line", { class: v === 0 ? "suivi-axis-line" : "suivi-grid-line", x1: padL, x2: W - padR, y1: y, y2: y }));
        var label = svgEl("text", { class: "suivi-y-label", x: padL - 6, y: y + 3, "text-anchor": "end" });
        label.textContent = String(v);
        svg.appendChild(label);
      });

      svg.appendChild(svgEl("line", { class: "suivi-axis-line", x1: padL, x2: padL, y1: padT, y2: H - padB }));

      // Ligne pointillée au niveau du maximum, pour le repérer d'un coup d'œil.
      svg.appendChild(svgEl("line", {
        x1: padL, x2: W - padR, y1: yAt(maxVal), y2: yAt(maxVal),
        stroke: "rgba(199,194,219,.35)", "stroke-width": "1", "stroke-dasharray": "4,3"
      }));

      series.forEach(function (d, i) {
        if (i % 2 !== 0 && i !== series.length - 1) return;
        var label = svgEl("text", { class: "suivi-x-label", x: xAt(i), y: H - padB + 14, "text-anchor": "middle" });
        label.textContent = shortLabel(d.date);
        svg.appendChild(label);
      });

      var baseline = H - padB;

      categories.forEach(function (cat) {
        // Petite ligne verticale sous chaque point, pour voir sa hauteur
        // d'un coup d'œil sans avoir à viser l'axe de gauche.
        series.forEach(function (d, i) {
          if (d.counts[cat.key] <= 0) return;
          var x = xAt(i), y = yAt(d.counts[cat.key]);
          svg.appendChild(svgEl("line", { x1: x, x2: x, y1: y, y2: baseline, stroke: cat.color, "stroke-width": "1", opacity: "0.25" }));
        });

        var points = series.map(function (d, i) { return xAt(i).toFixed(1) + "," + yAt(d.counts[cat.key]).toFixed(1); }).join(" ");
        svg.appendChild(svgEl("polyline", {
          points: points,
          fill: "none",
          stroke: cat.color,
          "stroke-width": "2",
          "stroke-linecap": "round",
          "stroke-linejoin": "round"
        }));
        series.forEach(function (d, i) {
          if (d.counts[cat.key] > 0) svg.appendChild(svgEl("circle", { cx: xAt(i), cy: yAt(d.counts[cat.key]), r: 2.5, fill: cat.color }));
        });
      });

      var wrap = document.createElement("div");
      wrap.className = "suivi-chart-wrap";
      wrap.appendChild(svg);
      container.appendChild(wrap);

      var legend = document.createElement("div");
      legend.className = "suivi-legend";
      categories.forEach(function (cat) {
        var item = document.createElement("div");
        item.className = "suivi-legend-item";
        var dot = document.createElement("span");
        dot.className = "suivi-legend-dot";
        dot.style.background = cat.color;
        item.appendChild(dot);
        item.appendChild(document.createTextNode(cat.label));
        legend.appendChild(item);
      });
      container.appendChild(legend);
    }

    function classifyDm(status) {
      if (status === "sold") return "sold";
      if (status === "not_interested") return "not_interested";
      if (status === "replied") return "replied";
      return "sent"; // sent, meeting, interested (ou pas de statut) comptent comme "envoyé"
    }

    function classifyLinkedin(status) {
      if (status === "sold") return "sold";
      if (status === "not_interested") return "not_interested";
      if (status === "replied") return "replied";
      if (status === "audit_requested") return "audit";
      if (status === "meeting") return "meeting";
      return "sent";
    }

    function classifyRadar(status) {
      if (status === "interested") return "interested";
      if (status === "not_interested") return "not_interested";
      if (status === "pending") return "pending";
      return null; // pas encore traité : ne compte dans aucune courbe
    }

    var booted = false;
    function boot(userId) {
      if (booted) return;
      booted = true;
      supabase.from("profiles").select("id,role").eq("id", userId).single().then(function (res) {
        if (!res || !res.data || res.data.role !== "chef") return;

        function refreshDms() {
          loadDailySeries("prospects", "date", DM_CATEGORIES, classifyDm, function (series) {
            renderMultiLineChart(containers.dms, series, DM_CATEGORIES);
          });
        }
        function refreshLinkedin() {
          loadDailySeries("linkedin_prospects", "date", LINKEDIN_CATEGORIES, classifyLinkedin, function (series) {
            renderMultiLineChart(containers.linkedin, series, LINKEDIN_CATEGORIES);
          });
        }
        function refreshRadar() {
          loadDailySeries("radar_leads", "sent_date", RADAR_CATEGORIES, classifyRadar, function (series) {
            renderMultiLineChart(containers.radar, series, RADAR_CATEGORIES);
          });
        }

        refreshDms();
        refreshLinkedin();
        refreshRadar();

        // Se remet à jour tout seul dès qu'un prospect/lead est ajouté,
        // modifié (changement de statut) ou supprimé, sans recharger la page.
        supabase.channel("nova-suivi-prospects")
          .on("postgres_changes", { event: "*", schema: "public", table: "prospects" }, refreshDms)
          .subscribe();
        supabase.channel("nova-suivi-linkedin")
          .on("postgres_changes", { event: "*", schema: "public", table: "linkedin_prospects" }, refreshLinkedin)
          .subscribe();
        supabase.channel("nova-suivi-radar")
          .on("postgres_changes", { event: "*", schema: "public", table: "radar_leads" }, refreshRadar)
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
