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

  function fmtEUR(n) {
    return (n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  }

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  var CSS = "\n.home-hero-name{font-family:'Playfair Display',Georgia,serif;font-size:34px;font-weight:700;line-height:41px;margin:0;color:#fff;text-shadow:0 0 6px rgba(255,255,255,.85),0 0 16px rgba(255,255,255,.6),0 0 32px rgba(191,90,242,.45);}\n.home-hero-name .home-hero-workspace{font-weight:400;color:#bf5af2;text-shadow:0 0 8px rgba(191,90,242,.9),0 0 18px rgba(191,90,242,.65),0 0 36px rgba(191,90,242,.4);}\n.home-grid{display:grid;grid-template-columns:1fr;gap:14px;}\n.home-tile{display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:6px;text-align:left;padding:14px 18px;border-radius:18px;background:radial-gradient(ellipse at 100% 0%,#bf5af21a,transparent 60%),rgba(255,255,255,.045);border:1px solid rgba(199,194,219,.14);cursor:default;width:100%;}\n.home-tile-label{font-size:13.5px;opacity:.7;font-weight:600;}\n.home-tile-value{font-size:26px;font-weight:700;color:#3dff8a;text-shadow:0 0 10px rgba(61,255,138,.65),0 0 22px rgba(61,255,138,.35);}\n.home-tile-chart{gap:3px;}\n.home-tile-chart-wrap{margin-top:2px;width:100%;}\n.home-tile-chart-wrap svg{width:100%;height:auto;display:block;}\n.home-chart-x-label{fill:var(--text-dim);font-size:8.5px;}\n.home-compta-title{font-size:13.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text-mid);margin-bottom:0;}\n.home-compta-marge{font-size:12.5px;color:var(--text-dim);margin-top:-4px;}\n.home-compta-flow-row{display:flex;gap:18px;flex-wrap:wrap;font-size:12.5px;color:var(--text-mid);margin-top:0;}\n.home-compta-flow{display:flex;align-items:center;gap:6px;}\n.home-compta-flow b{color:var(--metal-2);font-weight:700;}\n.home-compta-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;background:#3dff8a;box-shadow:0 0 6px #3dff8a;}\n.home-compta-flow.sortie .home-compta-dot{background:var(--danger);box-shadow:0 0 6px var(--danger);}\n.home-compta-add-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;width:100%;margin-top:6px;padding-top:8px;border-top:1px solid rgba(199,194,219,.12);}\n.home-compta-tabs{display:flex;border-radius:9px;overflow:hidden;border:1px solid rgba(199,194,219,.18);flex-shrink:0;}\n.home-compta-tab{border:none;background:transparent;color:var(--text-mid);font-size:12px;font-weight:600;padding:6px 12px;cursor:pointer;}\n.home-compta-tab.active{background:var(--warm-1);color:#fff;}\n.home-compta-amount{width:84px;min-width:0;background:rgba(255,255,255,.05);border:1px solid rgba(199,194,219,.18);border-radius:9px;color:var(--metal-2);font-size:13px;padding:6px 10px;}\n.home-compta-name{flex:1;min-width:100px;background:rgba(255,255,255,.05);border:1px solid rgba(199,194,219,.18);border-radius:9px;color:var(--metal-2);font-size:13px;padding:6px 10px;}\n.home-compta-add-btn{margin-left:auto;padding:6px 16px;font-size:13px;white-space:nowrap;}\n.home-tile-leads{gap:8px;width:50%;min-width:220px;}\n.home-leads-header{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;width:100%;}\n.home-leads-header .home-compta-title{margin-bottom:0;}\n.home-leads-count{justify-self:center;font-size:12.5px;font-weight:700;color:var(--metal-2);background:rgba(191,90,242,.18);border:1px solid rgba(191,90,242,.45);border-radius:999px;padding:2px 11px;}\n.home-leads-list{width:100%;max-height:420px;overflow-y:auto;display:flex;flex-direction:column;gap:7px;}\n.home-lead-row{display:flex;flex-direction:column;gap:3px;font-size:11.5px;padding:8px 9px;border-radius:9px;background:rgba(255,255,255,.04);}\n.home-lead-name{color:var(--metal-2);font-weight:700;font-size:12.5px;}\n.home-lead-badge{display:inline-block;align-self:flex-start;font-size:9.5px;font-weight:700;padding:2px 9px;border-radius:999px;}\n.home-lead-badge.has-site{background:rgba(191,90,242,.18);border:1px solid rgba(191,90,242,.5);color:#e0b3ff;}\n.home-lead-badge.no-site{background:rgba(217,83,79,.18);border:1px solid rgba(217,83,79,.5);color:#e88783;}\n.home-lead-meta{font-size:10.5px;color:var(--text-dim);}\n.home-lead-link{font-size:10.5px;color:#e0b3ff;word-break:break-all;}\n.home-lead-phone{font-size:11.5px;font-weight:700;color:#3dff8a;text-shadow:0 0 6px rgba(61,255,138,.7),0 0 14px rgba(61,255,138,.4);}\n.home-leads-empty{font-size:12.5px;color:var(--text-dim);opacity:.7;padding:4px 2px;}\n.home-lead-status-row{display:flex;gap:5px;margin-top:4px;flex-wrap:wrap;}\n.home-lead-status-btn{flex:1;min-width:0;text-align:center;padding:5px 3px;border-radius:7px;border:1px solid rgba(199,194,219,.2);background:rgba(255,255,255,.03);color:var(--text-mid);font-size:9.5px;font-weight:600;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}\n.home-lead-status-btn.interested{border-color:#4fbf7a;}\n.home-lead-status-btn.interested:active{background:#4fbf7a26;color:#7fe0a4;}\n.home-lead-status-btn.not_interested{border-color:#d9534f;}\n.home-lead-status-btn.not_interested:active{background:#d9534f26;color:#e88783;}\n.home-lead-status-btn.pending{border-color:#bf5af2;}\n.home-lead-status-btn.pending:active{background:#bf5af226;color:#e0b3ff;}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var supabase = getSupabaseClient();

    var me = null;
    var homeGrid = document.getElementById("home-grid");
    var caValueEl = document.getElementById("home-ca-value");
    var caChartEl = document.getElementById("home-ca-chart");
    var margeEl = document.getElementById("home-ca-marge");
    var entreesEl = document.getElementById("home-ca-entrees");
    var sortiesEl = document.getElementById("home-ca-sorties");
    var tabRevenuEl = document.getElementById("home-compta-tab-revenu");
    var tabDepenseEl = document.getElementById("home-compta-tab-depense");
    var amountInputEl = document.getElementById("home-compta-amount");
    var nameInputEl = document.getElementById("home-compta-name");
    var addBtnEl = document.getElementById("home-compta-add-btn");
    var leadsListEl = document.getElementById("home-leads-list");
    var leadsCountEl = document.getElementById("home-leads-count");

    if (!homeGrid) return;

    function el(tag, attrs, html) {
      var e = document.createElement(tag);
      if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
      if (html !== undefined) e.innerHTML = html;
      return e;
    }

    function todayStr() {
      var t = new Date();
      return t.getFullYear() + "-" + pad2(t.getMonth() + 1) + "-" + pad2(t.getDate());
    }

    var LEAD_STATUS_OPTIONS = [
      { value: "interested", label: "Intéressé" },
      { value: "not_interested", label: "Non intéressé" },
      { value: "pending", label: "En attente" }
    ];

    function setLeadStatus(leadId, val) {
      supabase.from("radar_leads").update({
        status: val,
        status_set_by: me && me.id
      }).eq("id", leadId).then(function (res) {
        if (res && res.error) alert("Erreur : " + res.error.message);
      });
    }

    function loadLeads() {
      if (!leadsListEl) return;
      supabase.from("radar_leads").select("id,name,phone,website,category_label,city,status")
        .eq("sent_date", todayStr()).is("status", null).order("created_at", { ascending: false })
        .then(function (res) {
          var rows = (res && res.data) || [];
          if (leadsCountEl) leadsCountEl.textContent = rows.length;
          leadsListEl.innerHTML = "";
          if (!rows.length) {
            leadsListEl.appendChild(el("div", { class: "home-leads-empty" }, "Aucun lead en attente de traitement."));
            return;
          }
          rows.forEach(function (r) {
            var row = el("div", { class: "home-lead-row" });

            var nameEl = el("div", { class: "home-lead-name" });
            nameEl.textContent = r.name || "";
            row.appendChild(nameEl);

            var badge = el("span", { class: "home-lead-badge " + (r.website ? "has-site" : "no-site") });
            badge.textContent = r.website ? "A un site" : "Pas de site";
            row.appendChild(badge);

            var metaParts = [r.city, r.category_label].filter(Boolean);
            if (metaParts.length) {
              var metaEl = el("div", { class: "home-lead-meta" });
              metaEl.textContent = metaParts.join(" · ");
              row.appendChild(metaEl);
            }

            if (r.website) {
              var link = document.createElement("a");
              link.className = "home-lead-link";
              link.href = r.website;
              link.target = "_blank";
              link.rel = "noopener";
              link.textContent = r.website;
              row.appendChild(link);
            }

            if (r.phone) {
              var phoneEl = el("div", { class: "home-lead-phone" });
              phoneEl.textContent = r.phone;
              row.appendChild(phoneEl);
            }

            var statusRow = el("div", { class: "home-lead-status-row" });
            LEAD_STATUS_OPTIONS.forEach(function (opt) {
              var btn = el("button", { type: "button", class: "home-lead-status-btn " + opt.value });
              btn.textContent = opt.label;
              btn.addEventListener("click", function () {
                setLeadStatus(r.id, opt.value);
                row.remove();
                if (leadsCountEl) leadsCountEl.textContent = leadsListEl.children.length;
                if (!leadsListEl.children.length) {
                  leadsListEl.appendChild(el("div", { class: "home-leads-empty" }, "Aucun lead en attente de traitement."));
                }
              });
              statusRow.appendChild(btn);
            });
            row.appendChild(statusRow);

            leadsListEl.appendChild(row);
          });
        });
    }

    function svgEl(tag, attrs) {
      var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
      if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    }

    // Spline cubique monotone (Fritsch-Carlson), appliquée SEGMENT PAR
    // SEGMENT : chaque segment a ses deux tangentes bornées indépendamment
    // (au lieu de forcer la même tangente partagée des deux côtés d'un
    // point). Ça garantit toujours qu'aucun segment ne dépasse ses deux
    // points (pas de faux creux), tout en laissant un point qui sort d'un
    // palier plat repartir avec une tangente différente de celle qui
    // termine ce palier — un petit angle contrôlé à cet endroit précis,
    // adouci au rendu par stroke-linejoin:round, plutôt que la courbe
    // tendue "en angle droit" obtenue en forçant une tangente commune.
    function monotonePath(pts) {
      var n = pts.length;
      if (n < 2) return "";
      if (n === 2) {
        return "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1) +
          "L" + pts[1][0].toFixed(1) + "," + pts[1][1].toFixed(1);
      }
      var dx = [], slope = [];
      for (var i = 0; i < n - 1; i++) {
        dx[i] = pts[i + 1][0] - pts[i][0];
        slope[i] = dx[i] ? (pts[i + 1][1] - pts[i][1]) / dx[i] : 0;
      }
      var avg = [slope[0]];
      for (i = 1; i < n - 1; i++) avg[i] = (slope[i - 1] + slope[i]) / 2;
      avg[n - 1] = slope[n - 2];

      var d = "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1);
      for (i = 0; i < n - 1; i++) {
        var mStart = avg[i], mEnd = avg[i + 1];
        if (slope[i] === 0) {
          mStart = 0; mEnd = 0;
        } else {
          var a = mStart / slope[i], b = mEnd / slope[i];
          if (a < 0) a = 0;
          if (b < 0) b = 0;
          var h = a * a + b * b;
          if (h > 9) {
            var t = 3 / Math.sqrt(h);
            a *= t; b *= t;
          }
          mStart = a * slope[i];
          mEnd = b * slope[i];
        }
        var c1x = pts[i][0] + dx[i] / 3;
        var c1y = pts[i][1] + mStart * dx[i] / 3;
        var c2x = pts[i + 1][0] - dx[i] / 3;
        var c2y = pts[i + 1][1] - mEnd * dx[i] / 3;
        d += "C" + c1x.toFixed(1) + "," + c1y.toFixed(1) + " " + c2x.toFixed(1) + "," + c2y.toFixed(1) + " " + pts[i + 1][0].toFixed(1) + "," + pts[i + 1][1].toFixed(1);
      }
      return d;
    }

    function shortLabel(dateStr) {
      var parts = dateStr.split("-");
      return parts[2] + "/" + parts[1];
    }

    function renderCaChart(dayTotals) {
      if (!caChartEl) return;
      var days = Object.keys(dayTotals).sort();
      var W = 560, H = 100, padL = 4, padR = 4, padT = 8, padB = 18;
      var plotW = W - padL - padR, plotH = H - padT - padB;
      var values = days.map(function (d) { return dayTotals[d]; });
      var minVal = Math.min(0, Math.min.apply(null, values));
      var maxVal = Math.max(1, Math.max.apply(null, values));
      var range = (maxVal - minVal) || 1;
      var stepX = days.length > 1 ? plotW / (days.length - 1) : 0;
      function xAt(i) { return padL + i * stepX; }
      function yAt(v) { return padT + plotH * (1 - (v - minVal) / range); }

      caChartEl.innerHTML = "";
      var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "xMinYMid meet" });

      days.forEach(function (dd, i) {
        if (i % 2 !== 0 && i !== days.length - 1) return;
        var label = svgEl("text", { class: "home-chart-x-label", x: xAt(i), y: H - 4, "text-anchor": i === days.length - 1 ? "end" : "middle" });
        label.textContent = shortLabel(dd);
        svg.appendChild(label);
      });

      var pts = days.map(function (d, i) { return [xAt(i), yAt(dayTotals[d])]; });
      var d = monotonePath(pts);

      // tube "laser" : halo large et flou derrière, trait fin et lumineux devant.
      svg.appendChild(svgEl("path", {
        d: d, fill: "none", stroke: "#bf5af2", "stroke-width": "7",
        "stroke-linecap": "round", "stroke-linejoin": "round",
        opacity: "0.45", style: "filter:blur(4px);"
      }));
      svg.appendChild(svgEl("path", {
        d: d, fill: "none", stroke: "#bf5af2", "stroke-width": "1.8",
        "stroke-linecap": "round", "stroke-linejoin": "round",
        style: "filter:drop-shadow(0 0 3px #e0b3ff) drop-shadow(0 0 8px #bf5af2);"
      }));
      if (pts.length) {
        var last = pts[pts.length - 1];
        svg.appendChild(svgEl("circle", { cx: last[0], cy: last[1], r: 3, fill: "#f1eefb", style: "filter:drop-shadow(0 0 4px #fff);" }));
      }
      caChartEl.appendChild(svg);
    }


    function loadCaTotal() {
      if (!caValueEl) return;
      Promise.all([
        supabase.from("clients").select("entries"),
        supabase.from("one_shot_sales").select("amount,sale_date"),
        supabase.from("home_expenses").select("amount,entry_date")
      ]).then(function (results) {
        var clientRows = (results[0] && results[0].data) || [];
        var saleRows = (results[1] && results[1].data) || [];
        var expenseRows = (results[2] && results[2].data) || [];
        var entreesTotal = 0, sortiesTotal = 0;
        var inDay = {}, outDay = {};
        clientRows.forEach(function (c) {
          (c.entries || []).forEach(function (e) {
            var amt = Number(e.amount) || 0;
            entreesTotal += amt;
            if (e.date) inDay[e.date] = (inDay[e.date] || 0) + amt;
          });
        });
        saleRows.forEach(function (s) {
          var amt = Number(s.amount) || 0;
          entreesTotal += amt;
          if (s.sale_date) inDay[s.sale_date] = (inDay[s.sale_date] || 0) + amt;
        });
        expenseRows.forEach(function (x) {
          var amt = Number(x.amount) || 0;
          sortiesTotal += amt;
          if (x.entry_date) outDay[x.entry_date] = (outDay[x.entry_date] || 0) + amt;
        });

        var net = entreesTotal - sortiesTotal;
        caValueEl.textContent = fmtEUR(net);
        if (margeEl) margeEl.textContent = "Marge " + (entreesTotal > 0 ? Math.round((net / entreesTotal) * 100) : 100) + " %";
        if (entreesEl) entreesEl.textContent = "+" + fmtEUR(entreesTotal);
        if (sortiesEl) sortiesEl.textContent = "-" + fmtEUR(sortiesTotal);

        // courbe = 14 derniers jours, bénéfice net cumulé jour par jour.
        var range = [];
        for (var i = 13; i >= 0; i--) {
          var d = new Date();
          d.setDate(d.getDate() - i);
          range.push(d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()));
        }
        var since = range[0];
        var before = 0;
        Object.keys(inDay).forEach(function (d) { if (d < since) before += inDay[d]; });
        Object.keys(outDay).forEach(function (d) { if (d < since) before -= outDay[d]; });
        var running = before;
        var cumul = {};
        range.forEach(function (d) {
          running += (inDay[d] || 0) - (outDay[d] || 0);
          cumul[d] = running;
        });
        renderCaChart(cumul);
      });
    }

    var addType = "revenu";
    if (tabRevenuEl && tabDepenseEl) {
      tabRevenuEl.addEventListener("click", function () {
        addType = "revenu";
        tabRevenuEl.classList.add("active");
        tabDepenseEl.classList.remove("active");
      });
      tabDepenseEl.addEventListener("click", function () {
        addType = "depense";
        tabDepenseEl.classList.add("active");
        tabRevenuEl.classList.remove("active");
      });
    }

    if (addBtnEl) {
      addBtnEl.addEventListener("click", function () {
        if (!me) return;
        var amount = Number(amountInputEl && amountInputEl.value);
        var name = ((nameInputEl && nameInputEl.value) || "").trim();
        if (!amount || amount <= 0) { if (amountInputEl) amountInputEl.focus(); return; }
        if (!name) { if (nameInputEl) nameInputEl.focus(); return; }

        addBtnEl.disabled = true;
        var insert = addType === "depense"
          ? supabase.from("home_expenses").insert({ name: name, amount: amount, created_by: me.id })
          : supabase.from("one_shot_sales").insert({ client_name: name, amount: amount, created_by: me.id });

        insert.then(function (res) {
          addBtnEl.disabled = false;
          if (res && res.error) { alert("Erreur : " + res.error.message); return; }
          if (amountInputEl) amountInputEl.value = "";
          if (nameInputEl) nameInputEl.value = "";
          loadCaTotal();
        });
      });
    }

    function scheduleMidnightReset() {
      var now = new Date();
      var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5, 0);
      setTimeout(function () {
        loadCaTotal();
        loadLeads();
        scheduleMidnightReset();
      }, next.getTime() - now.getTime());
    }

    function switchToAccueil() {
      document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
      var navEl = document.getElementById("nav-accueil");
      if (navEl) navEl.classList.add("active");
      document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
      var v = document.getElementById("view-accueil");
      if (v) v.classList.add("active");
    }

    var booted = false;
    function boot(userId) {
      if (booted) return;
      booted = true;
      supabase.from("profiles").select("id,role").eq("id", userId).single().then(function (res) {
        if (!res || !res.data) return;
        me = res.data;

        if (me.role === "chef") {
          switchToAccueil();
        }

        loadCaTotal();
        loadLeads();
        scheduleMidnightReset();

        supabase.channel("nova-home-compta")
          .on("postgres_changes", { event: "*", schema: "public", table: "one_shot_sales" }, loadCaTotal)
          .on("postgres_changes", { event: "*", schema: "public", table: "home_expenses" }, loadCaTotal)
          .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, loadCaTotal)
          .subscribe();

        supabase.channel("nova-home-leads")
          .on("postgres_changes", { event: "*", schema: "public", table: "radar_leads" }, loadLeads)
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
