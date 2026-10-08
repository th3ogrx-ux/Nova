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
    var myAvatarInput = document.getElementById("my-avatar-input");
    var myRoleDisplayEl = document.getElementById("my-role-display");
    var settingsBtn = document.getElementById("settings-btn");
    var btnBackSettings = document.getElementById("btn-back-settings");

    function switchToView(viewName) {
      document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
      var v = document.getElementById("view-" + viewName);
      if (v) v.classList.add("active");
    }

    // Réduction du menu à gauche (icônes seules, toujours cliquables) :
    // l'état se garde d'une visite à l'autre.
    var sidebarToggle = document.getElementById("sidebar-toggle");
    var screenApp = document.getElementById("screen-app");
    if (sidebarToggle && screenApp) {
      var COLLAPSE_KEY = "zenoaSidebarCollapsed";
      function applyCollapsed(collapsed) {
        screenApp.classList.toggle("sidebar-collapsed", collapsed);
        sidebarToggle.title = collapsed ? "Agrandir le menu" : "Réduire le menu";
      }
      try { applyCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch (e) {}
      sidebarToggle.addEventListener("click", function () {
        var collapsed = !screenApp.classList.contains("sidebar-collapsed");
        applyCollapsed(collapsed);
        try { localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0"); } catch (e) {}
      });
    }

    // Navigation élève (Accueil, Mon projet, Ressources, Cours,
    // Progression, Calendrier) et navigation chef (Tableau de bord,
    // Élèves, Contenu, Retours, Accès et codes) : chacune visible
    // uniquement pour le rôle correspondant, affichée/masquée dans
    // boot() une fois le rôle connu.
    document.querySelectorAll(".eleve-only[data-view], .chef-only[data-view]").forEach(function (navEl) {
      navEl.addEventListener("click", function () {
        document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
        navEl.classList.add("active");
        switchToView(navEl.getAttribute("data-view"));
      });
    });

    var previousViewBeforeSettings = "accueil";
    if (settingsBtn) {
      settingsBtn.addEventListener("click", function () {
        var activeNav = document.querySelector(".nav-item.active[data-view]");
        previousViewBeforeSettings = activeNav ? activeNav.getAttribute("data-view") : (me && me.role === "chef" ? "tableau-de-bord" : "accueil");
        switchToView("settings");
      });
    }
    if (btnBackSettings) {
      btnBackSettings.addEventListener("click", function () {
        switchToView(previousViewBeforeSettings);
      });
    }

    // ---------- Sous-pages de Paramètres ----------

    function wireSettingsTile(tileId, viewName, backBtnId, onOpen) {
      var tile = document.getElementById(tileId);
      if (tile) {
        tile.addEventListener("click", function () {
          if (onOpen) onOpen();
          switchToView(viewName);
        });
      }
      var backBtn = document.getElementById(backBtnId);
      if (backBtn) {
        backBtn.addEventListener("click", function () { switchToView("settings"); });
      }
    }

    // ----- Profil -----
    var profilNameInput = document.getElementById("profil-name-input");
    var profilEmailInput = document.getElementById("profil-email-input");
    var profilError = document.getElementById("profil-error");
    var profilSuccess = document.getElementById("profil-success");
    var profilSaveBtn = document.getElementById("profil-save-btn");
    var profilChangePhotoBtn = document.getElementById("profil-change-photo-btn");
    var profilAvatarImg = document.getElementById("profil-avatar-img");
    var profilAvatarInitial = document.getElementById("profil-avatar-initial");
    var myAvatarImg = document.getElementById("my-avatar-img");
    var myAvatarInitial = document.getElementById("my-avatar-initial");

    function syncProfilAvatar() {
      if (!profilAvatarImg || !myAvatarImg) return;
      if (myAvatarImg.style.display !== "none" && myAvatarImg.src) {
        profilAvatarImg.src = myAvatarImg.src;
        profilAvatarImg.style.display = "block";
        if (profilAvatarInitial) profilAvatarInitial.style.display = "none";
      } else {
        profilAvatarImg.style.display = "none";
        if (profilAvatarInitial && myAvatarInitial) {
          profilAvatarInitial.textContent = myAvatarInitial.textContent;
          profilAvatarInitial.style.display = "";
        }
      }
    }
    if (myAvatarImg) {
      new MutationObserver(syncProfilAvatar).observe(myAvatarImg, { attributes: true, attributeFilter: ["src", "style"] });
    }
    if (myAvatarInitial) {
      new MutationObserver(syncProfilAvatar).observe(myAvatarInitial, { childList: true, characterData: true, subtree: true });
    }

    wireSettingsTile("settings-profil", "settings-profil", "btn-back-settings-profil", function () {
      if (!me) return;
      if (profilNameInput) profilNameInput.value = me.pseudo || "";
      if (profilEmailInput) profilEmailInput.value = me.email || "";
      if (profilError) profilError.textContent = "";
      if (profilSuccess) profilSuccess.textContent = "";
      syncProfilAvatar();
    });
    if (profilChangePhotoBtn && myAvatarInput) {
      profilChangePhotoBtn.addEventListener("click", function () { myAvatarInput.click(); });
    }
    if (profilSaveBtn) {
      profilSaveBtn.addEventListener("click", function () {
        if (!me) return;
        if (profilError) profilError.textContent = "";
        if (profilSuccess) profilSuccess.textContent = "";
        var newPseudo = (profilNameInput && profilNameInput.value.trim()) || "";
        var newEmail = (profilEmailInput && profilEmailInput.value.trim()) || "";
        if (!newPseudo) { if (profilError) profilError.textContent = "Le nom ne peut pas être vide."; return; }
        if (!newEmail || !newEmail.includes("@")) { if (profilError) profilError.textContent = "Entre une adresse e-mail valide."; return; }

        var emailChanged = newEmail !== me.email;
        var tasks = [];
        if (newPseudo !== me.pseudo) {
          tasks.push(supabase.from("profiles").update({ pseudo: newPseudo }).eq("id", me.id));
        }
        if (emailChanged) {
          tasks.push(supabase.auth.updateUser({ email: newEmail }));
          tasks.push(supabase.from("profiles").update({ email: newEmail }).eq("id", me.id));
        }
        if (!tasks.length) { if (profilSuccess) profilSuccess.textContent = "Rien à enregistrer."; return; }

        Promise.all(tasks).then(function (results) {
          var err = results.find(function (r) { return r && r.error; });
          if (err) { if (profilError) profilError.textContent = "Erreur : " + err.error.message; return; }
          me.pseudo = newPseudo;
          me.email = newEmail;
          var nameEl = document.getElementById("my-name-display");
          if (nameEl) nameEl.textContent = newPseudo;
          if (profilSuccess) profilSuccess.textContent = emailChanged ? "Profil mis à jour. Vérifie ta boîte mail pour confirmer la nouvelle adresse." : "Profil mis à jour.";
        });
      });
    }

    // ----- Mot de passe et sécurité -----
    var passwordNewInput = document.getElementById("password-new-input");
    var passwordConfirmInput = document.getElementById("password-confirm-input");
    var passwordError = document.getElementById("password-error");
    var passwordSuccess = document.getElementById("password-success");
    var passwordSaveBtn = document.getElementById("password-save-btn");

    wireSettingsTile("settings-password", "settings-password", "btn-back-settings-password", function () {
      if (passwordNewInput) passwordNewInput.value = "";
      if (passwordConfirmInput) passwordConfirmInput.value = "";
      if (passwordError) passwordError.textContent = "";
      if (passwordSuccess) passwordSuccess.textContent = "";
    });
    if (passwordSaveBtn) {
      passwordSaveBtn.addEventListener("click", function () {
        if (passwordError) passwordError.textContent = "";
        if (passwordSuccess) passwordSuccess.textContent = "";
        var pw1 = passwordNewInput ? passwordNewInput.value : "";
        var pw2 = passwordConfirmInput ? passwordConfirmInput.value : "";
        if (!pw1 || pw1.length < 8) { if (passwordError) passwordError.textContent = "8 caractères minimum."; return; }
        if (pw1 !== pw2) { if (passwordError) passwordError.textContent = "Les deux mots de passe ne correspondent pas."; return; }
        supabase.auth.updateUser({ password: pw1 }).then(function (res) {
          if (res && res.error) { if (passwordError) passwordError.textContent = "Erreur : " + res.error.message; return; }
          if (passwordNewInput) passwordNewInput.value = "";
          if (passwordConfirmInput) passwordConfirmInput.value = "";
          if (passwordSuccess) passwordSuccess.textContent = "Mot de passe mis à jour.";
        });
      });
    }

    // ----- Notifications -----
    var notifEmailSwitch = document.getElementById("notif-email-switch");
    var notifRemindersSwitch = document.getElementById("notif-reminders-switch");

    wireSettingsTile("settings-notifications", "settings-notifications", "btn-back-settings-notifications", function () {
      if (!me) return;
      if (notifEmailSwitch) notifEmailSwitch.checked = me.notif_email !== false;
      if (notifRemindersSwitch) notifRemindersSwitch.checked = me.notif_reminders !== false;
    });
    if (notifEmailSwitch) {
      notifEmailSwitch.addEventListener("change", function () {
        if (!me) return;
        me.notif_email = notifEmailSwitch.checked;
        supabase.from("profiles").update({ notif_email: notifEmailSwitch.checked }).eq("id", me.id).then(function (res) {
          if (res && res.error) alert("Erreur : " + res.error.message);
        });
      });
    }
    if (notifRemindersSwitch) {
      notifRemindersSwitch.addEventListener("change", function () {
        if (!me) return;
        me.notif_reminders = notifRemindersSwitch.checked;
        supabase.from("profiles").update({ notif_reminders: notifRemindersSwitch.checked }).eq("id", me.id).then(function (res) {
          if (res && res.error) alert("Erreur : " + res.error.message);
        });
      });
    }

    // ----- Supprimer mon compte (RGPD) -----
    var deleteAccountConfirmInput = document.getElementById("delete-account-confirm-input");
    var deleteAccountError = document.getElementById("delete-account-error");
    var deleteAccountBtn = document.getElementById("delete-account-btn");

    wireSettingsTile("settings-delete-account", "settings-delete-account", "btn-back-settings-delete-account", function () {
      if (deleteAccountConfirmInput) deleteAccountConfirmInput.value = "";
      if (deleteAccountError) deleteAccountError.textContent = "";
      if (deleteAccountBtn) deleteAccountBtn.disabled = true;
    });
    if (deleteAccountConfirmInput && deleteAccountBtn) {
      deleteAccountConfirmInput.addEventListener("input", function () {
        deleteAccountBtn.disabled = deleteAccountConfirmInput.value.trim() !== "SUPPRIMER";
      });
    }
    if (deleteAccountBtn) {
      deleteAccountBtn.addEventListener("click", function () {
        if (deleteAccountError) deleteAccountError.textContent = "";
        zenoaConfirm("C'est définitif : ton compte et toutes tes données seront supprimés. Continuer ?", { danger: true, confirmLabel: "Supprimer définitivement" }).then(function (ok) {
          if (!ok) return;
          deleteAccountBtn.disabled = true;
          supabase.rpc("delete_my_account").then(function (res) {
            if (res && res.error) {
              if (deleteAccountError) deleteAccountError.textContent = "Erreur : " + res.error.message;
              deleteAccountBtn.disabled = false;
              return;
            }
            supabase.auth.signOut().then(function () { window.location.reload(); });
          });
        });
      });
    }

    // ---------- Reste de Paramètres ----------

    if (settingsLogout) {
      settingsLogout.addEventListener("click", function () {
        zenoaConfirm("Es-tu sûr de vouloir te déconnecter ?").then(function (ok) {
          if (!ok) return;
          supabase.auth.signOut().then(function () { window.location.reload(); });
        });
      });
    }

    // Empêche l'édition directe du pseudo / de la photo en cliquant dessus :
    // ça passe uniquement par la page Paramètres > Profil.
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
      supabase.from("profiles").select("id,role,pseudo,custom_role,email,notif_email,notif_reminders").eq("id", userId).single().then(function (res) {
        if (!res || !res.data) return;
        me = res.data;
        applyMyCustomRole(me.custom_role);
        // Chaque rôle a sa propre navigation à gauche : élèves (Accueil...)
        // ou chef (Tableau de bord...), jamais les deux en même temps.
        var isChef = me.role === "chef";
        document.querySelectorAll(".eleve-only").forEach(function (el) {
          el.style.display = isChef ? "none" : "flex";
        });
        document.querySelectorAll(".chef-only").forEach(function (el) {
          el.style.display = isChef ? "flex" : "none";
        });
        switchToView(isChef ? "tableau-de-bord" : "accueil");
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
