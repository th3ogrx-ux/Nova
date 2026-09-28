(function () {
  "use strict";

  var SUPABASE_URL = "https://mfdqxzccmzumxiichdqw.supabase.co";
  var SUPABASE_KEY = "sb_publishable_Qes5VQ0OcaAEVh_kMjej6A_HJ6yxY3T";

  // Clé publique VAPID (générée pour ZENOA). La clé privée correspondante
  // vit uniquement dans les secrets de l'Edge Function côté Supabase.
  var VAPID_PUBLIC_KEY = "BIwsGwB_LUY3jVd409Oobd9VGgtasWsgMuE-_9QZxHjuKkMfiECC2are9XfYoBUggj3f-NZWR4BG6Cv46KHguaw";

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

  function urlBase64ToUint8Array(base64String) {
    var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  function isSupported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }

  function init() {
    var supabase = getSupabaseClient();
    var me = null;
    var swRegistration = null;

    var settingsPushTile = document.getElementById("settings-push");
    var settingsPushStatus = document.getElementById("settings-push-status");
    var settingsPushSwitch = document.getElementById("settings-push-switch");

    if (!isSupported()) {
      if (settingsPushTile) settingsPushTile.style.display = "none";
      return;
    }

    function refreshSettingsUI() {
      var perm = Notification.permission;

      if (perm === "denied") {
        if (settingsPushStatus) settingsPushStatus.textContent = "Bloquées par le navigateur";
        if (settingsPushSwitch) { settingsPushSwitch.checked = false; settingsPushSwitch.disabled = true; }
        return;
      }
      if (settingsPushSwitch) settingsPushSwitch.disabled = false;

      if (perm !== "granted") {
        if (settingsPushStatus) settingsPushStatus.textContent = "Désactivées";
        if (settingsPushSwitch) settingsPushSwitch.checked = false;
        return;
      }

      if (!swRegistration) {
        if (settingsPushStatus) settingsPushStatus.textContent = "Désactivées";
        if (settingsPushSwitch) settingsPushSwitch.checked = false;
        return;
      }

      swRegistration.pushManager.getSubscription().then(function (sub) {
        var active = !!sub;
        if (settingsPushStatus) settingsPushStatus.textContent = active ? "Activées ✓" : "Désactivées";
        if (settingsPushSwitch) settingsPushSwitch.checked = active;
      });
    }

    function registerSW() {
      return navigator.serviceWorker.register("/sw.js").then(function (reg) {
        swRegistration = reg;
        return reg;
      }).catch(function (err) {
        console.error("[ZENOA push] échec d'enregistrement du service worker :", err);
      });
    }

    function saveSubscription(sub) {
      if (!me || !sub) return;
      var json = sub.toJSON();
      if (!json.keys) return;
      return supabase.from("push_subscriptions").upsert({
        user_id: me.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth
      }, { onConflict: "endpoint" }).then(function (res) {
        if (res && res.error) console.error("[ZENOA push] échec de sauvegarde de l'abonnement :", res.error);
      });
    }

    function subscribe() {
      if (!swRegistration) return Promise.resolve();
      return swRegistration.pushManager.getSubscription().then(function (existing) {
        if (existing) return existing;
        return swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }).then(function (sub) {
        return saveSubscription(sub);
      }).catch(function (err) {
        console.error("[ZENOA push] échec d'abonnement :", err);
      }).then(function () {
        refreshSettingsUI();
      });
    }

    function unsubscribe() {
      if (!swRegistration) return Promise.resolve();
      return swRegistration.pushManager.getSubscription().then(function (sub) {
        if (!sub) return;
        var endpoint = sub.endpoint;
        return sub.unsubscribe().then(function () {
          return supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
        });
      }).catch(function (err) {
        console.error("[ZENOA push] échec de désabonnement :", err);
      }).then(function () {
        refreshSettingsUI();
      });
    }

    function requestAndSubscribe() {
      return Notification.requestPermission().then(function (perm) {
        refreshSettingsUI();
        if (perm === "granted") return subscribe();
      });
    }

    if (settingsPushSwitch) {
      settingsPushSwitch.addEventListener("change", function () {
        if (Notification.permission === "denied") {
          settingsPushSwitch.checked = false;
          zenoaConfirm("", {
            html: "Les notifications sont bloquées pour ZENOA. Autorise-les depuis les réglages de ton navigateur (icône à côté de l'adresse du site) puis reviens ici.",
            confirmLabel: "Compris",
            hideCancel: true,
            danger: false
          });
          return;
        }
        if (settingsPushSwitch.checked) requestAndSubscribe();
        else unsubscribe();
      });
    }

    var booted = false;
    function boot(userId) {
      if (booted) return;
      booted = true;
      supabase.from("profiles").select("id").eq("id", userId).single().then(function (res) {
        if (!res || !res.data) return;
        me = res.data;

        registerSW().then(function () {
          refreshSettingsUI();

          if (Notification.permission === "granted") {
            subscribe();
            return;
          }
          if (Notification.permission === "denied") return;

          var alreadyPrompted = false;
          try { alreadyPrompted = localStorage.getItem("zenoa-push-prompted") === "1"; } catch (e) {}
          if (alreadyPrompted) return;

          setTimeout(function () {
            try { localStorage.setItem("zenoa-push-prompted", "1"); } catch (e) {}
            requestAndSubscribe();
          }, 1500);
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
