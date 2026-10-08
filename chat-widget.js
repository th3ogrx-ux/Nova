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

  var CSS = "\n.settings-grid{display:flex;flex-direction:column;gap:3px;}\n.settings-tile{aspect-ratio:auto;display:flex;flex-direction:row;align-items:center;justify-content:flex-start;text-align:left;gap:14px;padding:13px 14px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(199,194,219,.14);cursor:pointer;font-size:14px;font-weight:600;}\n.settings-tile:hover{background:rgba(255,255,255,.09);}\n.settings-tile-icon{font-size:17px;width:30px;height:30px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(255,255,255,.06);}\n.settings-tile-label{flex:1;word-break:break-word;}\n.settings-tile::after{content:\"\\203a\";opacity:.35;font-size:19px;font-weight:400;margin-left:6px;}\n.settings-tile-danger{border-color:#d9534f4d;color:#e39490;}\n.settings-tile-danger:hover{background:#d9534f14;}\n#screen-login{align-items:center;justify-content:center;padding:24px;}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var supabase = getSupabaseClient();
    var me = null;

    var settingsLogout = document.getElementById("settings-logout");
    var settingsEditPseudo = document.getElementById("settings-edit-pseudo");
    var settingsEditPhoto = document.getElementById("settings-edit-photo");
    var myAvatarInput = document.getElementById("my-avatar-input");
    var myRoleDisplayEl = document.getElementById("my-role-display");

    function switchToView(viewName) {
      document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
      var v = document.getElementById("view-" + viewName);
      if (v) v.classList.add("active");
    }

    if (settingsLogout) {
      settingsLogout.addEventListener("click", function () {
        zenoaConfirm("Es-tu sûr de vouloir te déconnecter ?").then(function (ok) {
          if (!ok) return;
          supabase.auth.signOut().then(function () { window.location.reload(); });
        });
      });
    }
    if (settingsEditPseudo) {
      settingsEditPseudo.addEventListener("click", function () {
        if (!me) return;
        var newPseudo = window.prompt("Nouveau pseudo :", me.pseudo || "");
        if (!newPseudo || !newPseudo.trim() || newPseudo.trim() === me.pseudo) return;
        newPseudo = newPseudo.trim();
        supabase.from("profiles").update({ pseudo: newPseudo }).eq("id", me.id).then(function (res) {
          if (res && res.error) { alert("Erreur : " + res.error.message); return; }
          me.pseudo = newPseudo;
          var nameEl = document.getElementById("my-name-display");
          if (nameEl) nameEl.textContent = newPseudo;
        });
      });
    }
    if (settingsEditPhoto && myAvatarInput) {
      settingsEditPhoto.addEventListener("click", function () {
        myAvatarInput.click(); // réutilise l'upload déjà géré par l'app
      });
    }

    // Empêche l'édition directe du pseudo / de la photo en cliquant dessus :
    // ça passe uniquement par la modale Paramètres.
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (t.id === "my-avatar-input" || (t.closest && t.closest("#my-avatar-input"))) return;
      var hitsAvatar = t.closest && t.closest("#my-avatar");
      var hitsName = t.closest && t.closest("#my-name-display");
      if (hitsAvatar || hitsName) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    var currentDesiredRoleText = null;
    var roleObserverStarted = false;

    function applyMyCustomRole(customRole) {
      var oldLine = document.getElementById("my-custom-role-display");
      if (oldLine) oldLine.remove();
      if (!myRoleDisplayEl || !me || me.role === "chef") { currentDesiredRoleText = null; return; }
      currentDesiredRoleText = customRole || "Rôle non défini";
      myRoleDisplayEl.textContent = currentDesiredRoleText;
      if (!roleObserverStarted) {
        roleObserverStarted = true;
        new MutationObserver(function () {
          if (currentDesiredRoleText && myRoleDisplayEl.textContent !== currentDesiredRoleText) {
            myRoleDisplayEl.textContent = currentDesiredRoleText;
          }
        }).observe(myRoleDisplayEl, { childList: true, characterData: true, subtree: true });
      }
    }

    // Sur l'écran de création de compte, le pill de rôle du bundle affiche
    // "Membre" par défaut : on le remplace par un libellé neutre.
    var rolePillCreate = document.getElementById("role-pill-create");
    if (rolePillCreate) {
      new MutationObserver(function () {
        if (rolePillCreate.textContent === "Membre") rolePillCreate.textContent = "Rôle non défini";
      }).observe(rolePillCreate, { childList: true, characterData: true, subtree: true });
    }

    var booted = false;
    function boot(userId) {
      if (booted) return;
      booted = true;
      supabase.from("profiles").select("id,role,pseudo,custom_role").eq("id", userId).single().then(function (res) {
        if (!res || !res.data) return;
        me = res.data;
        applyMyCustomRole(me.custom_role);
        // Le site ne garde plus que Paramètres : on y atterrit directement
        // après connexion, quel que soit le rôle.
        switchToView("settings");
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
