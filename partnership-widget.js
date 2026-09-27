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

  function fmtDateTime(ts) {
    if (!ts) return "";
    return new Date(ts).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  var CSS = "\n.nova-lead-card{margin-bottom:14px;}\n.nova-lead-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;flex-wrap:wrap;}\n.nova-lead-activite{font-weight:700;font-size:15px;}\n.nova-lead-date{font-size:12px;opacity:.55;flex-shrink:0;}\n.nova-lead-contact{font-size:13.5px;opacity:.8;margin-bottom:12px;}\n.nova-lead-contact a{color:var(--warm-2);}\n.nova-lead-tags{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;}\n.nova-lead-tag{font-size:12px;padding:5px 10px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(199,194,219,.16);color:var(--text-mid);}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var supabase = getSupabaseClient();
    var me = null;

    var navPartenariat = document.getElementById("nav-partenariat");
    var leadsListEl = document.getElementById("partnership-list");

    if (!navPartenariat || !leadsListEl) return;

    function switchToView() {
      document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
      navPartenariat.classList.add("active");
      document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
      var v = document.getElementById("view-partenariat");
      if (v) v.classList.add("active");
    }

    function buildLeadCard(lead) {
      var card = el("div", { class: "glass-card panel-section nova-lead-card" });

      var head = el("div", { class: "nova-lead-head" });
      head.appendChild(el("div", { class: "nova-lead-activite" }, lead.activite || "Activité non précisée"));
      head.appendChild(el("div", { class: "nova-lead-date" }, fmtDateTime(lead.created_at)));
      card.appendChild(head);

      var contactParts = [];
      if (lead.email) contactParts.push(lead.email);
      if (lead.telephone) contactParts.push(lead.telephone);
      card.appendChild(el("div", { class: "nova-lead-contact" }, contactParts.join("  ·  ") || "Aucun contact renseigné"));

      var tags = el("div", { class: "nova-lead-tags" });
      [["Taille", lead.taille], ["Blocage", lead.blocage], ["Délai", lead.delai], ["Budget", lead.budget]].forEach(function (pair) {
        if (!pair[1]) return;
        tags.appendChild(el("span", { class: "nova-lead-tag" }, pair[0] + " : " + pair[1]));
      });
      card.appendChild(tags);

      var del = el("button", { class: "btn btn-sm danger" }, "Supprimer");
      del.addEventListener("click", function () {
        if (!confirm("Supprimer cette réponse ?")) return;
        supabase.from("partnership_leads").delete().eq("id", lead.id).then(function (res) {
          if (res && res.error) { alert("Erreur : " + res.error.message); return; }
          card.remove();
        });
      });
      card.appendChild(del);

      return card;
    }

    function renderLeads() {
      if (!leadsListEl) return;
      leadsListEl.innerHTML = "";
      supabase.from("partnership_leads").select("*").order("created_at", { ascending: false }).then(function (res) {
        if (res && res.error) { leadsListEl.appendChild(el("div", { class: "empty-note" }, "Erreur : " + res.error.message)); return; }
        var rows = (res && res.data) || [];
        if (!rows.length) { leadsListEl.appendChild(el("div", { class: "empty-note" }, "Aucune réponse pour le moment.")); return; }
        rows.forEach(function (r) { leadsListEl.appendChild(buildLeadCard(r)); });
      });
    }

    navPartenariat.addEventListener("click", function () {
      switchToView();
      renderLeads();
    });

    var booted = false;
    function boot(userId) {
      if (booted) return;
      booted = true;
      supabase.from("profiles").select("id,role").eq("id", userId).single().then(function (res) {
        if (!res || !res.data) return;
        me = res.data;
        if (me.role !== "chef") return;

        supabase.channel("nova-partnership-leads")
          .on("postgres_changes", { event: "*", schema: "public", table: "partnership_leads" }, function () {
            var v = document.getElementById("view-partenariat");
            if (v && v.classList.contains("active")) renderLeads();
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
