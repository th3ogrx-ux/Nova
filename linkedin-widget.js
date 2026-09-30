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

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  var STATUS_LABELS = {
    sent: "Message envoyé",
    replied: "Réponse reçue",
    meeting: "RDV pris",
    interested: "Intéressé",
    sold: "Vendu",
    not_interested: "Pas intéressé"
  };

  var CSS = "\n" +
    ".li-day-group{margin-bottom:18px;}\n" +
    ".li-day-header{font-size:12.5px;opacity:.6;margin-bottom:8px;text-transform:capitalize;}\n" +
    ".li-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.04);margin-bottom:6px;font-size:13.5px;flex-wrap:wrap;}\n" +
    ".li-row-contact{font-weight:600;min-width:120px;flex:1;}\n" +
    ".li-row-secteur{opacity:.65;font-size:12.5px;}\n" +
    ".li-row-status{font-size:11.5px;padding:3px 9px;border-radius:20px;border:1px solid rgba(199,194,219,.2);white-space:nowrap;}\n" +
    ".li-row-status.st-interested{color:#e6ccff;border-color:#e0b3ff59;background:#e0b3ff14;}\n" +
    ".li-row-status.st-sold{color:#f2c572;border-color:#d4af3759;background:#d4af3714;}\n" +
    ".li-row-status.st-replied,.li-row-status.st-meeting{color:#a8e0c4;border-color:#7fd6a759;background:#7fd6a714;}\n" +
    ".li-row-status.st-not_interested{color:#e8a3a3;border-color:#e6807959;background:#e6807914;}\n" +
    ".li-row-actions{display:flex;gap:10px;flex-shrink:0;}\n" +
    ".li-row-action{opacity:.5;cursor:pointer;font-size:14px;}\n" +
    ".li-row-action:hover{opacity:1;}\n" +
    ".li-access-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;border-radius:8px;background:rgba(255,255,255,.04);margin-bottom:6px;font-size:13.5px;}\n" +
    ".li-access-remove{flex-shrink:0;opacity:.5;cursor:pointer;font-size:16px;padding:0 4px;}\n" +
    ".li-access-remove:hover{opacity:1;color:#e88783;}\n" +
    ".li-funnel-bar{display:flex;align-items:stretch;flex:1;min-width:40px;height:7px;border-radius:4px;overflow:hidden;background:rgba(255,255,255,.08);margin-left:8px;}\n" +
    ".li-funnel-seg{height:100%;}\n" +
    ".li-funnel-seg.sent{background:var(--cool-1);}\n" +
    ".li-funnel-seg.replied{background:var(--ok);}\n" +
    ".li-funnel-seg.sold{background:#d4af37;}\n" +
    ".li-funnel-seg.not_interested{background:var(--danger);}\n" +
    ".li-activity-row{display:flex;align-items:center;gap:10px;padding:8px 4px;font-size:13px;}\n" +
    ".li-activity-name{width:120px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}\n" +
    ".li-activity-count{width:56px;flex-shrink:0;font-size:12px;opacity:.8;}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var supabase = getSupabaseClient();
    var me = null;
    var isChef = false;
    var prospects = [];
    var allActiveProfiles = [];
    var editingId = null;
    var filterSetter = "all";
    var filterSecteur = "all";
    var activityPeriod = "day";

    var navLinkedin = document.getElementById("nav-linkedin");
    var journalEl = document.getElementById("linkedin-journal");
    var addBtn = document.getElementById("btn-add-linkedin-prospect");
    var modal = document.getElementById("modal-linkedin-prospect");
    var modalTitle = document.getElementById("linkedin-prospect-modal-title");
    var contactInput = document.getElementById("linkedin-prospect-contact");
    var secteurInput = document.getElementById("linkedin-prospect-secteur");
    var secteurSuggestions = document.getElementById("linkedin-secteur-suggestions");
    var dateInput = document.getElementById("linkedin-prospect-date");
    var statusSelect = document.getElementById("linkedin-prospect-status");
    var errorEl = document.getElementById("linkedin-prospect-error");
    var cancelBtn = document.getElementById("btn-cancel-linkedin-prospect");
    var confirmBtn = document.getElementById("btn-confirm-linkedin-prospect");

    var filterSetterEl = document.getElementById("linkedin-filter-setter");
    var filterSecteurEl = document.getElementById("linkedin-filter-secteur");

    var activityListEl = document.getElementById("linkedin-activity-list");
    var activityPeriodTabs = document.getElementById("linkedin-activity-period-tabs");

    var accessPanel = document.getElementById("linkedin-access-panel");
    var accessListEl = document.getElementById("linkedin-access-list");
    var accessPicker = document.getElementById("linkedin-access-picker");
    var accessAddBtn = document.getElementById("linkedin-access-add-btn");
    var watchedIds = [];

    if (!journalEl) return;

    // -------------------- Modal CRUD --------------------

    function openModal(prospect) {
      editingId = prospect ? prospect.id : null;
      errorEl.textContent = "";
      if (prospect) {
        modalTitle.textContent = "Modifier le prospect";
        contactInput.value = prospect.contact;
        secteurInput.value = prospect.secteur || "";
        dateInput.value = prospect.date;
        statusSelect.value = prospect.status;
      } else {
        modalTitle.textContent = "Ajouter un prospect";
        contactInput.value = "";
        secteurInput.value = "";
        dateInput.value = todayStr();
        statusSelect.value = "sent";
      }
      modal.classList.add("open");
      setTimeout(function () { contactInput.focus(); }, 50);
    }

    function closeModal() { modal.classList.remove("open"); }

    if (addBtn) addBtn.addEventListener("click", function () { openModal(null); });
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
    if (modal) modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });

    if (confirmBtn) {
      confirmBtn.addEventListener("click", function () {
        var contact = contactInput.value.trim();
        var secteur = secteurInput.value.trim();
        var date = dateInput.value;
        var status = statusSelect.value;
        if (!contact) { errorEl.textContent = "Le contact est obligatoire."; return; }
        if (!date) { errorEl.textContent = "Choisis une date."; return; }
        errorEl.textContent = "";

        var save = editingId
          ? supabase.from("linkedin_prospects").update({ contact: contact, secteur: secteur, date: date, status: status }).eq("id", editingId)
          : supabase.from("linkedin_prospects").insert({ setter_id: me.id, contact: contact, secteur: secteur, date: date, status: status });

        save.then(function (res) {
          if (res && res.error) { errorEl.textContent = "Erreur d'enregistrement."; console.error(res.error); return; }
          closeModal();
          loadProspects();
        });
      });
    }

    function deleteProspect(id) {
      if (!confirm("Supprimer ce prospect ?")) return;
      supabase.from("linkedin_prospects").delete().eq("id", id).then(function (res) {
        if (res && res.error) { alert("Erreur lors de la suppression."); return; }
        loadProspects();
      });
    }

    // -------------------- Journal list --------------------

    function formatDayHeader(dateStr) {
      var label = new Date(dateStr + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
      label = label.charAt(0).toUpperCase() + label.slice(1);
      if (dateStr === todayStr()) label += " — Aujourd'hui";
      return label;
    }

    function renderJournal() {
      var filtered = prospects.filter(function (p) {
        if (!isChef && p.setterId !== me.id) return false;
        if (isChef && filterSetter !== "all" && p.setterId !== filterSetter) return false;
        if (isChef && filterSecteur !== "all" && p.secteur !== filterSecteur) return false;
        return true;
      });

      journalEl.innerHTML = "";
      if (!filtered.length) {
        journalEl.appendChild(el("div", { class: "empty-state" }, '<span class="metal-title">Aucun prospect</span>Ajoute ton premier message LinkedIn pour commencer le journal.'));
        return;
      }

      var byDate = {};
      filtered.forEach(function (p) { (byDate[p.date] = byDate[p.date] || []).push(p); });
      var dates = Object.keys(byDate).sort(function (a, b) { return a < b ? 1 : -1; });

      dates.forEach(function (date) {
        var group = el("div", { class: "li-day-group" });
        group.appendChild(el("div", { class: "li-day-header" }, escapeHtml(formatDayHeader(date))));
        byDate[date].forEach(function (p) {
          var row = el("div", { class: "li-row" });
          row.appendChild(el("div", { class: "li-row-contact" }, escapeHtml(p.contact)));
          if (p.secteur) row.appendChild(el("div", { class: "li-row-secteur" }, escapeHtml(p.secteur)));
          row.appendChild(el("div", { class: "li-row-status st-" + p.status }, escapeHtml(STATUS_LABELS[p.status] || p.status)));
          var canEdit = isChef || p.setterId === me.id;
          if (canEdit) {
            var actions = el("div", { class: "li-row-actions" });
            var editBtn = el("span", { class: "li-row-action", title: "Modifier" }, "✎");
            editBtn.addEventListener("click", function () { openModal(p); });
            var delBtn = el("span", { class: "li-row-action", title: "Supprimer" }, "🗑");
            delBtn.addEventListener("click", function () { deleteProspect(p.id); });
            actions.appendChild(editBtn);
            actions.appendChild(delBtn);
            row.appendChild(actions);
          }
          group.appendChild(row);
        });
        journalEl.appendChild(group);
      });
    }

    function refreshFilters() {
      if (!isChef || !filterSetterEl || !filterSecteurEl) return;
      var setterIds = [];
      prospects.forEach(function (p) { if (setterIds.indexOf(p.setterId) === -1) setterIds.push(p.setterId); });
      var setters = setterIds
        .map(function (id) { return allActiveProfiles.filter(function (pr) { return pr.id === id; })[0]; })
        .filter(Boolean);
      filterSetterEl.innerHTML = '<option value="all">Tous les setters</option>' +
        setters.map(function (s) { return '<option value="' + s.id + '">' + escapeHtml(s.pseudo || "?") + "</option>"; }).join("");
      filterSetterEl.value = setters.some(function (s) { return s.id === filterSetter; }) ? filterSetter : "all";
      filterSetter = filterSetterEl.value;

      var secteurs = [];
      prospects.forEach(function (p) { if (p.secteur && secteurs.indexOf(p.secteur) === -1) secteurs.push(p.secteur); });
      secteurs.sort();
      filterSecteurEl.innerHTML = '<option value="all">Tous les secteurs</option>' +
        secteurs.map(function (s) { return '<option value="' + escapeHtml(s) + '">' + escapeHtml(s) + "</option>"; }).join("");
      filterSecteurEl.value = secteurs.indexOf(filterSecteur) !== -1 ? filterSecteur : "all";
      filterSecteur = filterSecteurEl.value;

      secteurSuggestions.innerHTML = secteurs.map(function (s) { return '<option value="' + escapeHtml(s) + '">'; }).join("");
    }

    if (filterSetterEl) filterSetterEl.addEventListener("change", function () { filterSetter = filterSetterEl.value; renderJournal(); });
    if (filterSecteurEl) filterSecteurEl.addEventListener("change", function () { filterSecteur = filterSecteurEl.value; renderJournal(); });

    function loadProspects() {
      return supabase.from("linkedin_prospects").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }).then(function (res) {
        if (res && res.error) { console.error(res.error); prospects = []; return; }
        prospects = (res.data || []).map(function (r) {
          return { id: r.id, setterId: r.setter_id, contact: r.contact, secteur: r.secteur, date: r.date, status: r.status };
        });
        refreshFilters();
        renderJournal();
        if (isChef) renderActivity();
      });
    }

    // -------------------- Activité de l'équipe (chef) --------------------

    function inPeriod(dateStr, period) {
      if (period === "all") return true;
      var target = new Date(dateStr + "T00:00:00");
      var ref = new Date();
      if (period === "day") return dateStr === todayStr();
      if (period === "week") { var w = new Date(ref); w.setDate(w.getDate() - 6); w.setHours(0, 0, 0, 0); return target >= w; }
      if (period === "month") { var m = new Date(ref); m.setDate(m.getDate() - 29); m.setHours(0, 0, 0, 0); return target >= m; }
      return true;
    }

    function renderActivity() {
      if (!activityListEl) return;
      var byPerson = {};
      prospects.forEach(function (p) {
        if (!inPeriod(p.date, activityPeriod)) return;
        if (!byPerson[p.setterId]) byPerson[p.setterId] = { total: 0, replied: 0, sold: 0, not_interested: 0 };
        byPerson[p.setterId].total++;
        if (p.status === "replied" || p.status === "meeting") byPerson[p.setterId].replied++;
        else if (p.status === "sold") byPerson[p.setterId].sold++;
        else if (p.status === "not_interested") byPerson[p.setterId].not_interested++;
      });

      var rows = allActiveProfiles
        .map(function (p) { return { profile: p, c: byPerson[p.id] || { total: 0, replied: 0, sold: 0, not_interested: 0 } }; })
        .filter(function (r) { return r.c.total > 0; })
        .sort(function (a, b) {
          if (b.c.sold !== a.c.sold) return b.c.sold - a.c.sold;
          if (b.c.replied !== a.c.replied) return b.c.replied - a.c.replied;
          return b.c.total - a.c.total;
        });

      activityListEl.innerHTML = "";
      if (!rows.length) {
        activityListEl.appendChild(el("div", { class: "empty-note" }, "Aucune activité sur cette période."));
        return;
      }
      rows.forEach(function (r) {
        var row = el("div", { class: "li-activity-row" });
        row.appendChild(el("div", { class: "li-activity-name" }, escapeHtml(r.profile.pseudo || "?")));
        var bar = el("div", { class: "li-funnel-bar" });
        var remainder = r.c.total - r.c.replied - r.c.sold - r.c.not_interested;
        [["sent", remainder], ["replied", r.c.replied], ["sold", r.c.sold], ["not_interested", r.c.not_interested]].forEach(function (pair) {
          if (pair[1] > 0) {
            var pct = (pair[1] / r.c.total) * 100;
            bar.appendChild(el("div", { class: "li-funnel-seg " + pair[0], style: "width:" + pct + "%;" }));
          }
        });
        row.appendChild(bar);
        row.appendChild(el("div", { class: "li-activity-count" }, r.c.total + "/" + r.c.replied + "/" + r.c.sold));
        activityListEl.appendChild(row);
      });
    }

    if (activityPeriodTabs) {
      activityPeriodTabs.addEventListener("click", function (e) {
        var tab = e.target.closest(".period-tab");
        if (!tab) return;
        activityPeriodTabs.querySelectorAll(".period-tab").forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        activityPeriod = tab.getAttribute("data-period");
        renderActivity();
      });
    }

    // -------------------- Qui peut ajouter (watchlist, chef) --------------------

    function renderAccessPicker() {
      if (!accessPicker) return;
      accessPicker.innerHTML = "";
      var available = allActiveProfiles.filter(function (p) { return watchedIds.indexOf(p.id) === -1; });
      if (!available.length) {
        accessPicker.appendChild(el("div", { class: "empty-note" }, "Tout le monde est déjà ajouté."));
        return;
      }
      available.forEach(function (p) {
        var item = el("div", { class: "rj-picker-item" }, "+ " + escapeHtml(p.pseudo || "Compte incomplet"));
        item.addEventListener("click", function () {
          supabase.from("linkedin_journal_watchlist").insert({ profile_id: p.id }).then(function (res) {
            if (res && res.error) { alert("Erreur : " + res.error.message); return; }
            accessPicker.classList.remove("open");
            loadWatchlist();
          });
        });
        accessPicker.appendChild(item);
      });
    }

    function renderAccessList() {
      if (!accessListEl) return;
      accessListEl.innerHTML = "";
      if (!watchedIds.length) {
        accessListEl.appendChild(el("div", { class: "empty-note" }, "Personne n'est autorisé pour l'instant."));
        return;
      }
      watchedIds.forEach(function (id) {
        var p = allActiveProfiles.filter(function (x) { return x.id === id; })[0];
        if (!p) return;
        var row = el("div", { class: "li-access-row" });
        row.appendChild(el("div", {}, escapeHtml(p.pseudo || "Compte incomplet")));
        var remove = el("div", { class: "li-access-remove", title: "Retirer" }, "×");
        remove.addEventListener("click", function () {
          supabase.from("linkedin_journal_watchlist").delete().eq("profile_id", id).then(function (res) {
            if (res && res.error) { alert("Erreur : " + res.error.message); return; }
            loadWatchlist();
          });
        });
        row.appendChild(remove);
        accessListEl.appendChild(row);
      });
    }

    function loadWatchlist() {
      return supabase.from("linkedin_journal_watchlist").select("profile_id").then(function (res) {
        watchedIds = ((res && res.data) || []).map(function (r) { return r.profile_id; });
        renderAccessList();
        if (accessPicker && accessPicker.classList.contains("open")) renderAccessPicker();
      });
    }

    if (accessAddBtn) {
      accessAddBtn.addEventListener("click", function () {
        var isOpen = accessPicker.classList.toggle("open");
        if (isOpen) renderAccessPicker();
      });
    }

    // -------------------- Boot --------------------

    var booted = false;
    function boot(userId) {
      if (booted) return;
      booted = true;
      supabase.from("profiles").select("id,pseudo,role").eq("id", userId).single().then(function (res) {
        if (!res || !res.data) return;
        me = res.data;
        isChef = me.role === "chef";

        // Le chef atteint le journal LinkedIn via le dossier Équipe
        // (chef-only) ; ce lien autonome n'est destiné qu'aux membres
        // à qui l'accès a été accordé via linkedin_journal_watchlist.
        if (navLinkedin) {
          if (isChef) {
            navLinkedin.style.display = "none";
          } else {
            supabase.from("linkedin_journal_watchlist").select("profile_id").eq("profile_id", me.id).maybeSingle().then(function (wres) {
              navLinkedin.style.display = (wres && wres.data) ? "" : "none";
            });
          }
        }

        supabase.from("profiles").select("id,pseudo").eq("is_active", true).order("pseudo").then(function (res2) {
          allActiveProfiles = (res2 && res2.data) || [];
          loadProspects();
          if (isChef) loadWatchlist();
        });

        supabase.channel("nova-linkedin-prospects")
          .on("postgres_changes", { event: "*", schema: "public", table: "linkedin_prospects" }, function () {
            loadProspects();
          })
          .subscribe();

        supabase.channel("nova-linkedin-watchlist")
          .on("postgres_changes", { event: "*", schema: "public", table: "linkedin_journal_watchlist" }, function () {
            if (navLinkedin && !isChef) {
              supabase.from("linkedin_journal_watchlist").select("profile_id").eq("profile_id", me.id).maybeSingle().then(function (wres) {
                navLinkedin.style.display = (wres && wres.data) ? "" : "none";
              });
            }
            if (isChef) loadWatchlist();
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
