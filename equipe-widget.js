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

  function initials(name) {
    return (name || "?").trim().slice(0, 2).toUpperCase();
  }

  function init() {
    var existingKey = findExistingStorageKey();
    var clientOpts = existingKey ? { auth: { storageKey: existingKey } } : {};
    var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, clientOpts);

    var me = null;
    var navEquipe = document.getElementById("nav-equipe");
    var equipeList = document.getElementById("equipe-list");

    if (!navEquipe || !equipeList) return;

    navEquipe.addEventListener("click", function () {
      document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
      navEquipe.classList.add("active");
      document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
      var v = document.getElementById("view-equipe");
      if (v) v.classList.add("active");
      renderEquipe();
    });

    function renderEquipe() {
      equipeList.innerHTML = "";
      supabase.from("profiles").select("id,pseudo,photo_url,custom_role,role,selected_badge_id,is_active")
        .eq("is_active", true).order("pseudo").then(function (res) {
          if (res && res.error) { equipeList.appendChild(el("div", { class: "empty-note" }, "Erreur : " + res.error.message)); return; }
          var rows = (res && res.data) || [];
          if (!rows.length) { equipeList.appendChild(el("div", { class: "empty-note" }, "Aucun membre.")); return; }
          window.ZenoaBadges.fetchAllStats(supabase).then(function (statsById) {
            rows.forEach(function (p) {
              var row = el("div", { class: "team-row glass-card" });
              var avatar = el("div", { class: "avatar", style: "cursor:default;" });
              if (p.photo_url) avatar.appendChild(el("img", { src: p.photo_url }));
              else avatar.appendChild(el("span", {}, initials(p.pseudo)));
              row.appendChild(avatar);

              var info = el("div", { class: "team-row-info" });
              var nameLine = el("div", { class: "team-row-name" }, (p.pseudo || "Compte incomplet") + " ");
              var stats = statsById[p.id] || { dm: 0, replied: 0, sold: 0 };
              var badge = window.ZenoaBadges.pickActiveBadge(stats, p.selected_badge_id);
              if (badge) {
                var tag = el("span", { class: "nova-badge-tag", title: badge.label }, badge.icon);
                nameLine.appendChild(tag);
              }
              info.appendChild(nameLine);
              info.appendChild(el("div", { class: "team-row-meta" }, (p.role === "chef" ? "Chef" : (p.custom_role || "Rôle non défini"))));
              row.appendChild(info);

              equipeList.appendChild(row);
            });
          });
        });
    }

    function boot(userId) {
      supabase.from("profiles").select("id,role").eq("id", userId).single().then(function (res) {
        if (!res || !res.data) return;
        me = res.data;
        navEquipe.style.display = me.role === "chef" ? "none" : "flex";
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
