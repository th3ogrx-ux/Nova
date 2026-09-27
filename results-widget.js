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

  function fmtEUR(n) {
    return (n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  var CSS = "\n.oneshot-row{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-radius:10px;background:rgba(255,255,255,.05);margin-bottom:8px;}\n.oneshot-row-name{font-weight:600;font-size:14px;}\n.oneshot-row-desc{font-size:12.5px;opacity:.6;margin-top:2px;}\n.oneshot-row-meta{font-size:11px;opacity:.5;margin-top:2px;}\n.oneshot-row-amount{font-weight:700;font-size:15px;color:var(--warm-1);}\n.results-clients-row{display:flex;justify-content:space-between;padding:9px 4px;font-size:13.5px;border-bottom:1px solid rgba(199,194,219,.08);}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var existingKey = findExistingStorageKey();
    var clientOpts = existingKey ? { auth: { storageKey: existingKey } } : {};
    var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, clientOpts);

    var me = null;
    var modeTabs = document.getElementById("results-mode-tabs");
    var totalPanel = document.getElementById("results-total-panel");
    var oneshotPanel = document.getElementById("results-oneshot-panel");
    var recurringPanel = document.getElementById("results-recurring-panel");
    var totalValueEl = document.getElementById("results-total-value");
    var totalChartEl = document.getElementById("results-total-chart");
    var totalClientsEl = document.getElementById("results-total-clients");
    var oneshotTotalEl = document.getElementById("oneshot-total-value");
    var oneshotListEl = document.getElementById("oneshot-list");
    var oneshotPeriodTabs = document.getElementById("oneshot-period-tabs");
    var btnAddOneshot = document.getElementById("btn-add-oneshot");
    var modalOneshot = document.getElementById("modal-add-oneshot");
    var oneshotName = document.getElementById("oneshot-name");
    var oneshotDescription = document.getElementById("oneshot-description");
    var oneshotAmount = document.getElementById("oneshot-amount");
    var oneshotDate = document.getElementById("oneshot-date");
    var oneshotError = document.getElementById("oneshot-error");
    var btnCancelOneshot = document.getElementById("btn-cancel-oneshot");
    var btnConfirmOneshot = document.getElementById("btn-confirm-oneshot");

    if (!modeTabs) return;

    var currentOneshotPeriod = 365;

    function showMode(mode) {
      modeTabs.querySelectorAll(".period-tab").forEach(function (t) {
        t.classList.toggle("active", t.getAttribute("data-mode") === mode);
      });
      totalPanel.style.display = mode === "total" ? "block" : "none";
      oneshotPanel.style.display = mode === "oneshot" ? "block" : "none";
      recurringPanel.style.display = mode === "recurring" ? "block" : "none";
      if (mode === "total") renderTotal();
      if (mode === "oneshot") renderOneshot();
    }

    modeTabs.addEventListener("click", function (e) {
      var tab = e.target.closest(".period-tab");
      if (!tab) return;
      showMode(tab.getAttribute("data-mode"));
    });

    function fetchRecurringEntries() {
      return supabase.from("clients").select("name,entries").then(function (res) {
        return (res && res.data) || [];
      });
    }

    function fetchOneshotSales() {
      return supabase.from("one_shot_sales").select("id,client_name,description,amount,sale_date,created_at").order("sale_date", { ascending: false }).then(function (res) {
        return (res && res.data) || [];
      });
    }

    function renderChart(container, dayTotals) {
      var days = Object.keys(dayTotals).sort();
      var r = Math.max(340, days.length * 34);
      var s = 180, n = 26;
      var maxVal = Math.max(1, Math.max.apply(null, days.map(function (d) { return dayTotals[d]; })));
      var barW = Math.min(24, r / Math.max(1, days.length) - 8);
      var bars = "";
      days.forEach(function (d, i) {
        var x = i * (r / days.length) + (r / days.length - barW) / 2;
        var h = (dayTotals[d] / maxVal) * (s - n - 16);
        var y = s - n - h;
        var label = d.slice(8, 10) + "/" + d.slice(5, 7);
        bars += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + Math.max(h, 1.5) + '" rx="4" fill="url(#zenoaGrad)" opacity="0.92"/>' +
          '<text x="' + (x + barW / 2) + '" y="' + (s - n + 16) + '" text-anchor="middle" font-size="9.5" fill="#8A84A0">' + label + '</text>';
      });
      container.innerHTML = '<svg viewBox="0 0 ' + r + ' ' + s + '" width="100%" height="' + s + '" xmlns="http://www.w3.org/2000/svg">' +
        '<defs><linearGradient id="zenoaGrad" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#300A66"/><stop offset="100%" stop-color="#BF5AF2"/></linearGradient></defs>' +
        '<line x1="0" y1="' + (s - n) + '" x2="' + r + '" y2="' + (s - n) + '" stroke="rgba(199,194,219,0.15)"/>' + bars + '</svg>';
    }

    function renderTotal() {
      if (!totalValueEl) return;
      Promise.all([fetchRecurringEntries(), fetchOneshotSales()]).then(function (results) {
        var clients = results[0], sales = results[1];
        var dayTotals = {};
        var clientNames = {};
        var grandTotal = 0;

        clients.forEach(function (c) {
          var hasEntries = false;
          (c.entries || []).forEach(function (entry) {
            var amt = Number(entry.amount) || 0;
            grandTotal += amt;
            hasEntries = true;
            if (entry.date) dayTotals[entry.date] = (dayTotals[entry.date] || 0) + amt;
          });
          if (hasEntries && c.name) clientNames[c.name] = true;
        });

        sales.forEach(function (sRow) {
          var amt = Number(sRow.amount) || 0;
          grandTotal += amt;
          if (sRow.sale_date) dayTotals[sRow.sale_date] = (dayTotals[sRow.sale_date] || 0) + amt;
          if (sRow.client_name) clientNames[sRow.client_name] = true;
        });

        totalValueEl.textContent = fmtEUR(grandTotal);

        // ne garde que les 30 derniers jours pour le graphique
        var since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
        var recentDayTotals = {};
        Object.keys(dayTotals).forEach(function (d) { if (d >= since) recentDayTotals[d] = dayTotals[d]; });
        if (!Object.keys(recentDayTotals).length) recentDayTotals[todayISO()] = 0;
        if (totalChartEl) renderChart(totalChartEl, recentDayTotals);

        if (totalClientsEl) {
          totalClientsEl.innerHTML = "";
          var names = Object.keys(clientNames).sort();
          if (!names.length) {
            totalClientsEl.appendChild(el("div", { class: "empty-note" }, "Aucun client pour le moment."));
          } else {
            names.forEach(function (name) {
              totalClientsEl.appendChild(el("div", { class: "results-clients-row" }, "<span>" + name + "</span>"));
            });
          }
        }
      });
    }

    function renderOneshot() {
      if (!oneshotTotalEl) return;
      fetchOneshotSales().then(function (sales) {
        var since = new Date(Date.now() - currentOneshotPeriod * 24 * 3600 * 1000).toISOString().slice(0, 10);
        var filtered = sales.filter(function (r) { return r.sale_date >= since; });
        var total = filtered.reduce(function (sum, r) { return sum + (Number(r.amount) || 0); }, 0);
        oneshotTotalEl.textContent = fmtEUR(total);

        oneshotListEl.innerHTML = "";
        if (!filtered.length) {
          oneshotListEl.appendChild(el("div", { class: "empty-note" }, "Aucune vente one-shot sur cette période."));
          return;
        }
        filtered.forEach(function (r) {
          var row = el("div", { class: "oneshot-row" });
          var left = el("div", {});
          left.appendChild(el("div", { class: "oneshot-row-name" }, r.client_name));
          if (r.description) left.appendChild(el("div", { class: "oneshot-row-desc" }, r.description));
          left.appendChild(el("div", { class: "oneshot-row-meta" }, new Date(r.sale_date + "T00:00:00").toLocaleDateString("fr-FR")));
          row.appendChild(left);
          var right = el("div", { style: "display:flex;align-items:center;gap:12px;" });
          right.appendChild(el("div", { class: "oneshot-row-amount" }, fmtEUR(r.amount)));
          var del = el("span", { class: "res-del", style: "position:static;cursor:pointer;opacity:.6;" }, "✕");
          del.addEventListener("click", function () {
            if (!confirm("Supprimer cette vente one-shot ?")) return;
            supabase.from("one_shot_sales").delete().eq("id", r.id).then(function (res) {
              if (res && res.error) { alert("Erreur : " + res.error.message); return; }
              renderOneshot();
            });
          });
          right.appendChild(del);
          row.appendChild(right);
          oneshotListEl.appendChild(row);
        });
      });
    }

    if (oneshotPeriodTabs) {
      oneshotPeriodTabs.addEventListener("click", function (e) {
        var tab = e.target.closest(".period-tab");
        if (!tab) return;
        oneshotPeriodTabs.querySelectorAll(".period-tab").forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        currentOneshotPeriod = Number(tab.getAttribute("data-period"));
        renderOneshot();
      });
    }

    if (btnAddOneshot && modalOneshot) {
      btnAddOneshot.addEventListener("click", function () {
        oneshotName.value = "";
        oneshotDescription.value = "";
        oneshotAmount.value = "";
        oneshotDate.value = todayISO();
        oneshotError.textContent = "";
        modalOneshot.classList.add("open");
      });
    }
    if (btnCancelOneshot) {
      btnCancelOneshot.addEventListener("click", function () {
        modalOneshot.classList.remove("open");
      });
    }
    if (btnConfirmOneshot) {
      btnConfirmOneshot.addEventListener("click", function () {
        var name = (oneshotName.value || "").trim();
        var description = (oneshotDescription.value || "").trim();
        var amount = Number(oneshotAmount.value);
        var date = oneshotDate.value || todayISO();
        if (!name) { oneshotError.textContent = "Entre le nom du client."; return; }
        if (!amount || amount <= 0) { oneshotError.textContent = "Entre un montant valide."; return; }
        if (!me) return;
        btnConfirmOneshot.disabled = true;
        supabase.from("one_shot_sales").insert({
          client_name: name, description: description, amount: amount, sale_date: date, created_by: me.id
        }).then(function (res) {
          btnConfirmOneshot.disabled = false;
          if (res && res.error) { oneshotError.textContent = "Erreur : " + res.error.message; return; }
          modalOneshot.classList.remove("open");
          renderOneshot();
        });
      });
    }

    function boot(userId) {
      supabase.from("profiles").select("id,role").eq("id", userId).single().then(function (res) {
        if (!res || !res.data) return;
        me = res.data;
        if (me.role !== "chef") return;
        renderTotal();

        supabase.channel("nova-oneshot-sales")
          .on("postgres_changes", { event: "*", schema: "public", table: "one_shot_sales" }, function () {
            var activeTab = modeTabs.querySelector(".period-tab.active");
            var mode = activeTab ? activeTab.getAttribute("data-mode") : "total";
            if (mode === "total") renderTotal();
            if (mode === "oneshot") renderOneshot();
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
