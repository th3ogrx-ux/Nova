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

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  function dateStr(y, m, d) {
    return y + "-" + pad2(m + 1) + "-" + pad2(d);
  }

  function todayStr() {
    var t = new Date();
    return dateStr(t.getFullYear(), t.getMonth(), t.getDate());
  }

  var WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  var CSS = "\n.calendar-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}\n.calendar-month-label{font-size:15px;font-weight:600;text-transform:capitalize;}\n.calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;}\n.calendar-weekday{font-size:11px;text-align:center;opacity:.5;padding:4px 0;text-transform:uppercase;letter-spacing:.06em;}\n.calendar-day{aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:10px;cursor:pointer;font-size:13px;position:relative;background:rgba(255,255,255,.03);transition:background .2s ease;}\n.calendar-day:hover{background:rgba(255,255,255,.08);}\n.calendar-day.today{border:1px solid var(--cool-2);}\n.calendar-day.selected{background:linear-gradient(120deg,var(--warm-1),var(--warm-2));color:#04010a;font-weight:700;}\n.calendar-day.empty{visibility:hidden;cursor:default;}\n.calendar-day-dot{width:5px;height:5px;border-radius:50%;background:var(--warm-2);position:absolute;bottom:5px;left:50%;transform:translateX(-50%);}\n.calendar-day.selected .calendar-day-dot{background:#04010a;}\n.calendar-event-row{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(199,194,219,.12);margin-bottom:8px;}\n.calendar-event-time{font-size:12.5px;color:var(--text-dim);width:44px;flex-shrink:0;}\n.calendar-event-body{flex:1;min-width:0;}\n.calendar-event-title{font-weight:600;font-size:14px;}\n.calendar-event-desc{font-size:12.5px;opacity:.65;margin-top:2px;}\n.calendar-event-meta{font-size:11px;opacity:.5;margin-top:4px;}\n.calendar-event-del{cursor:pointer;opacity:.55;flex-shrink:0;font-size:14px;}\n.calendar-event-del:hover{opacity:1;color:#e88783;}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var supabase = getSupabaseClient();
    var me = null;

    var navCalendrier = document.getElementById("nav-calendrier");
    var calGrid = document.getElementById("calendar-grid");
    var calMonthLabel = document.getElementById("cal-month-label");
    var calPrevMonth = document.getElementById("cal-prev-month");
    var calNextMonth = document.getElementById("cal-next-month");
    var calSelectedDayLabel = document.getElementById("cal-selected-day-label");
    var calDayEvents = document.getElementById("calendar-day-events");
    var btnAddEvent = document.getElementById("btn-add-event");

    var modalAddEvent = document.getElementById("modal-add-event");
    var eventTitle = document.getElementById("event-title");
    var eventDate = document.getElementById("event-date");
    var eventTime = document.getElementById("event-time");
    var eventDescription = document.getElementById("event-description");
    var eventError = document.getElementById("event-error");
    var btnCancelEvent = document.getElementById("btn-cancel-event");
    var btnConfirmEvent = document.getElementById("btn-confirm-event");

    if (!navCalendrier || !calGrid) return;

    var profilesCache = {}; // id -> pseudo
    var eventsByDate = {}; // "YYYY-MM-DD" -> [event, ...]
    var viewYear, viewMonth; // month is 0-indexed
    var selectedDate = todayStr();

    (function () {
      var t = new Date();
      viewYear = t.getFullYear();
      viewMonth = t.getMonth();
    })();

    function switchToView() {
      document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
      navCalendrier.classList.add("active");
      document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
      var v = document.getElementById("view-calendrier");
      if (v) v.classList.add("active");
    }

    function loadProfiles() {
      if (Object.keys(profilesCache).length) return Promise.resolve();
      return supabase.from("profiles").select("id,pseudo").then(function (res) {
        ((res && res.data) || []).forEach(function (p) { profilesCache[p.id] = p.pseudo; });
      });
    }

    function loadMonthEvents() {
      var from = dateStr(viewYear, viewMonth, 1);
      var lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
      var to = dateStr(viewYear, viewMonth, lastDay);
      return supabase.from("calendar_events").select("id,created_by,title,description,event_date,event_time")
        .gte("event_date", from).lte("event_date", to)
        .then(function (res) {
          eventsByDate = {};
          ((res && res.data) || []).forEach(function (ev) {
            if (!eventsByDate[ev.event_date]) eventsByDate[ev.event_date] = [];
            eventsByDate[ev.event_date].push(ev);
          });
          Object.keys(eventsByDate).forEach(function (d) {
            eventsByDate[d].sort(function (a, b) {
              return (a.event_time || "").localeCompare(b.event_time || "");
            });
          });
          renderGrid();
          renderDayEvents();
        });
    }

    function renderGrid() {
      calGrid.innerHTML = "";
      var refDate = new Date(viewYear, viewMonth, 1);
      calMonthLabel.textContent = refDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

      WEEKDAYS.forEach(function (wd) {
        calGrid.appendChild(el("div", { class: "calendar-weekday" }, wd));
      });

      var firstWeekday = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Monday = 0
      var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      var today = todayStr();

      for (var i = 0; i < firstWeekday; i++) {
        calGrid.appendChild(el("div", { class: "calendar-day empty" }));
      }

      for (var d = 1; d <= daysInMonth; d++) {
        var ds = dateStr(viewYear, viewMonth, d);
        var classes = "calendar-day";
        if (ds === today) classes += " today";
        if (ds === selectedDate) classes += " selected";
        var cell = el("div", { class: classes }, String(d));
        if (eventsByDate[ds] && eventsByDate[ds].length) {
          cell.appendChild(el("span", { class: "calendar-day-dot" }));
        }
        (function (ds) {
          cell.addEventListener("click", function () {
            selectedDate = ds;
            renderGrid();
            renderDayEvents();
          });
        })(ds);
        calGrid.appendChild(cell);
      }
    }

    function renderDayEvents() {
      var parts = selectedDate.split("-");
      var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      var label = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      calSelectedDayLabel.textContent = label.charAt(0).toUpperCase() + label.slice(1);

      calDayEvents.innerHTML = "";
      var events = eventsByDate[selectedDate] || [];
      if (!events.length) {
        calDayEvents.appendChild(el("div", { class: "empty-note" }, "Aucun point prévu ce jour-là."));
        return;
      }
      events.forEach(function (ev) {
        var row = el("div", { class: "calendar-event-row" });
        row.appendChild(el("div", { class: "calendar-event-time" }, ev.event_time ? ev.event_time.slice(0, 5) : "—"));
        var body = el("div", { class: "calendar-event-body" });
        body.appendChild(el("div", { class: "calendar-event-title" }, ev.title));
        if (ev.description) body.appendChild(el("div", { class: "calendar-event-desc" }, ev.description));
        body.appendChild(el("div", { class: "calendar-event-meta" }, "Ajouté par " + (profilesCache[ev.created_by] || "quelqu'un")));
        row.appendChild(body);
        if (me && ev.created_by === me.id) {
          var del = el("span", { class: "calendar-event-del" }, "✕");
          del.addEventListener("click", function () {
            zenoaConfirm("Supprimer ce point ?").then(function (ok) {
              if (!ok) return;
              supabase.from("calendar_events").delete().eq("id", ev.id).then(function (res) {
                if (res && res.error) { alert("Erreur : " + res.error.message); return; }
                loadMonthEvents();
              });
            });
          });
          row.appendChild(del);
        }
        calDayEvents.appendChild(row);
      });
    }

    navCalendrier.addEventListener("click", function () {
      switchToView();
      loadProfiles().then(loadMonthEvents);
    });

    if (calPrevMonth) {
      calPrevMonth.addEventListener("click", function () {
        viewMonth--;
        if (viewMonth < 0) { viewMonth = 11; viewYear--; }
        selectedDate = dateStr(viewYear, viewMonth, 1);
        loadMonthEvents();
      });
    }
    if (calNextMonth) {
      calNextMonth.addEventListener("click", function () {
        viewMonth++;
        if (viewMonth > 11) { viewMonth = 0; viewYear++; }
        selectedDate = dateStr(viewYear, viewMonth, 1);
        loadMonthEvents();
      });
    }

    if (btnAddEvent) {
      btnAddEvent.addEventListener("click", function () {
        eventError.textContent = "";
        eventTitle.value = "";
        eventDate.value = selectedDate;
        eventTime.value = "";
        eventDescription.value = "";
        modalAddEvent.classList.add("open");
      });
    }
    if (btnCancelEvent) {
      btnCancelEvent.addEventListener("click", function () {
        modalAddEvent.classList.remove("open");
      });
    }
    if (btnConfirmEvent) {
      btnConfirmEvent.addEventListener("click", function () {
        eventError.textContent = "";
        var title = (eventTitle.value || "").trim();
        var date = eventDate.value;
        if (!title) { eventError.textContent = "Indique un titre."; return; }
        if (!date) { eventError.textContent = "Indique une date."; return; }

        btnConfirmEvent.disabled = true;
        supabase.from("calendar_events").insert({
          created_by: me.id,
          title: title,
          description: (eventDescription.value || "").trim() || null,
          event_date: date,
          event_time: eventTime.value || null
        }).then(function (res) {
          btnConfirmEvent.disabled = false;
          if (res && res.error) { eventError.textContent = "Erreur : " + res.error.message; return; }
          modalAddEvent.classList.remove("open");
          var parts = date.split("-");
          var y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1;
          if (y !== viewYear || m !== viewMonth) {
            viewYear = y; viewMonth = m;
          }
          selectedDate = date;
          loadMonthEvents();
        });
      });
    }

    var booted = false;
    function boot(userId) {
      if (booted) return;
      booted = true;
      supabase.from("profiles").select("id,pseudo").eq("id", userId).single().then(function (res) {
        if (!res || !res.data) return;
        me = res.data;

        supabase.channel("nova-calendar-events")
          .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, function () {
            var calView = document.getElementById("view-calendrier");
            if (calView && calView.classList.contains("active")) loadMonthEvents();
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
