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

  var CSS = "\n" +
    ".suivi-chart-wrap{margin-top:6px;}\n" +
    ".suivi-chart-wrap svg{width:100%;height:auto;display:block;}\n" +
    ".suivi-axis-line{stroke:rgba(199,194,219,.16);stroke-width:1;}\n" +
    ".suivi-grid-line{stroke:rgba(199,194,219,.08);stroke-width:1;}\n" +
    ".suivi-y-label{fill:var(--text-dim);font-size:9px;}\n" +
    ".suivi-x-label{fill:var(--text-dim);font-size:9px;}\n";

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

    function loadDailyCounts(table, dateColumn, days, cb) {
      var range = buildDateRange(days);
      var start = range[0];
      supabase.from(table).select(dateColumn).gte(dateColumn, start).then(function (res) {
        var counts = {};
        range.forEach(function (d) { counts[d] = 0; });
        ((res && res.data) || []).forEach(function (r) {
          var d = r[dateColumn];
          if (Object.prototype.hasOwnProperty.call(counts, d)) counts[d]++;
        });
        cb(range.map(function (d) { return { date: d, count: counts[d] }; }));
      });
    }

    function svgEl(tag, attrs) {
      var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
      if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    }

    function renderLineChart(container, series, color) {
      if (!container) return;
      container.innerHTML = "";

      var W = 600, H = 180;
      var padL = 30, padR = 10, padT = 12, padB = 24;
      var plotW = W - padL - padR;
      var plotH = H - padT - padB;

      var maxVal = 0;
      series.forEach(function (d) { if (d.count > maxVal) maxVal = d.count; });
      if (maxVal === 0) maxVal = 1;

      var stepX = series.length > 1 ? plotW / (series.length - 1) : 0;

      function xAt(i) { return padL + i * stepX; }
      function yAt(v) { return padT + plotH * (1 - v / maxVal); }

      var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "xMinYMid meet" });

      // Grille + axe Y (0 et le maximum)
      [0, maxVal].forEach(function (v) {
        var y = yAt(v);
        svg.appendChild(svgEl("line", { class: v === 0 ? "suivi-axis-line" : "suivi-grid-line", x1: padL, x2: W - padR, y1: y, y2: y }));
        var label = svgEl("text", { class: "suivi-y-label", x: padL - 6, y: y + 3, "text-anchor": "end" });
        label.textContent = String(v);
        svg.appendChild(label);
      });

      // Axe X
      svg.appendChild(svgEl("line", { class: "suivi-axis-line", x1: padL, x2: padL, y1: padT, y2: H - padB }));

      // Dates en bas (un label sur deux pour ne pas surcharger)
      series.forEach(function (d, i) {
        if (i % 2 !== 0 && i !== series.length - 1) return;
        var label = svgEl("text", { class: "suivi-x-label", x: xAt(i), y: H - padB + 14, "text-anchor": "middle" });
        label.textContent = shortLabel(d.date);
        svg.appendChild(label);
      });

      // Ligne
      var points = series.map(function (d, i) { return xAt(i).toFixed(1) + "," + yAt(d.count).toFixed(1); }).join(" ");
      svg.appendChild(svgEl("polyline", {
        points: points,
        fill: "none",
        stroke: color,
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round"
      }));

      // Points
      series.forEach(function (d, i) {
        svg.appendChild(svgEl("circle", { cx: xAt(i), cy: yAt(d.count), r: 2.5, fill: color }));
      });

      var wrap = document.createElement("div");
      wrap.className = "suivi-chart-wrap";
      wrap.appendChild(svg);
      container.appendChild(wrap);
    }

    var booted = false;
    function boot(userId) {
      if (booted) return;
      booted = true;
      supabase.from("profiles").select("id,role").eq("id", userId).single().then(function (res) {
        if (!res || !res.data || res.data.role !== "chef") return;

        loadDailyCounts("prospects", "date", DAYS, function (series) {
          renderLineChart(containers.dms, series, "var(--cool-1)");
        });
        loadDailyCounts("linkedin_prospects", "date", DAYS, function (series) {
          renderLineChart(containers.linkedin, series, "#5ac8fa");
        });
        loadDailyCounts("radar_leads", "sent_date", DAYS, function (series) {
          renderLineChart(containers.radar, series, "var(--warm-1)");
        });
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
