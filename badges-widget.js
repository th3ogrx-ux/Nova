(function () {
  "use strict";

  var BADGES = [
    { id: "dm_10", label: "Premier Pas", type: "dm", threshold: 10, icon: "🥉" },
    { id: "dm_50", label: "Chasseur", type: "dm", threshold: 50, icon: "🏹" },
    { id: "dm_150", label: "Machine à DM", type: "dm", threshold: 150, icon: "🚀" },
    { id: "replied_10", label: "Bon Feeling", type: "replied", threshold: 10, icon: "💬" },
    { id: "replied_30", label: "Communicant", type: "replied", threshold: 30, icon: "🗣️" },
    { id: "replied_75", label: "Maître du Discours", type: "replied", threshold: 75, icon: "🎯" },
    { id: "sold_3", label: "Premier Deal", type: "sold", threshold: 3, icon: "💼" },
    { id: "sold_10", label: "Closer", type: "sold", threshold: 10, icon: "💰" },
    { id: "sold_25", label: "Légende", type: "sold", threshold: 25, icon: "👑" },
    { id: "elite", label: "Élite Zenoa", type: "elite", threshold: { dm: 150, replied: 30, sold: 10 }, icon: "💎" }
  ];

  function statValue(stats, type) {
    return (stats && stats[type]) || 0;
  }

  function badgeProgress(badge, stats) {
    if (badge.type === "elite") {
      var t = badge.threshold;
      var pDm = Math.min(1, statValue(stats, "dm") / t.dm);
      var pReplied = Math.min(1, statValue(stats, "replied") / t.replied);
      var pSold = Math.min(1, statValue(stats, "sold") / t.sold);
      return Math.min(pDm, pReplied, pSold);
    }
    return Math.min(1, statValue(stats, badge.type) / badge.threshold);
  }

  function isEarned(badge, stats) {
    return badgeProgress(badge, stats) >= 1;
  }

  function computeEarned(stats) {
    return BADGES.filter(function (b) { return isEarned(b, stats); });
  }

  function getBestBadge(stats) {
    var earned = computeEarned(stats);
    if (!earned.length) return null;
    return earned[earned.length - 1]; // BADGES is ordered by difficulty
  }

  function pickActiveBadge(stats, selectedBadgeId) {
    if (selectedBadgeId) {
      var chosen = BADGES.find(function (b) { return b.id === selectedBadgeId; });
      if (chosen && isEarned(chosen, stats)) return chosen;
    }
    return getBestBadge(stats);
  }

  function badgeGoalText(badge) {
    if (badge.type === "dm") return badge.threshold + " DM envoyés";
    if (badge.type === "replied") return badge.threshold + " réponses reçues";
    if (badge.type === "sold") return badge.threshold + " ventes";
    var t = badge.threshold;
    return t.dm + " DM · " + t.replied + " réponses · " + t.sold + " ventes";
  }

  function fetchAllStats(supabase) {
    return supabase.from("prospects").select("setter_id,status").then(function (res) {
      var rows = (res && res.data) || [];
      var byId = {};
      rows.forEach(function (r) {
        if (!byId[r.setter_id]) byId[r.setter_id] = { dm: 0, replied: 0, sold: 0 };
        byId[r.setter_id].dm++;
        if (r.status === "replied") byId[r.setter_id].replied++;
        else if (r.status === "sold") byId[r.setter_id].sold++;
      });
      return byId;
    });
  }

  window.ZenoaBadges = {
    BADGES: BADGES,
    badgeProgress: badgeProgress,
    isEarned: isEarned,
    computeEarned: computeEarned,
    getBestBadge: getBestBadge,
    pickActiveBadge: pickActiveBadge,
    badgeGoalText: badgeGoalText,
    fetchAllStats: fetchAllStats
  };

  // ---------------------------------------------------------------
  // UI : vue "Récompenses" (quêtes + barres de progression) et la
  // tuile Paramètres > Badges (choix du badge actif).
  // ---------------------------------------------------------------

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

  var CSS = "\n.badge-quest{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(199,194,219,.14);margin-bottom:10px;}\n.badge-quest.locked{opacity:.55;}\n.badge-quest-icon{font-size:28px;width:40px;text-align:center;flex-shrink:0;}\n.badge-quest-body{flex:1;min-width:0;}\n.badge-quest-title{font-weight:700;font-size:14px;margin-bottom:2px;}\n.badge-quest-goal{font-size:12px;opacity:.6;margin-bottom:6px;}\n.badge-quest-track{height:6px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;}\n.badge-quest-fill{height:100%;background:linear-gradient(90deg,var(--cool-1),var(--warm-1));}\n.badge-quest-lock{font-size:18px;flex-shrink:0;opacity:.6;}\n.badges-picker-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:12px;}\n.badge-pick-tile{aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;padding:10px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(199,194,219,.14);cursor:pointer;font-size:11px;position:relative;}\n.badge-pick-tile.locked{opacity:.4;cursor:not-allowed;}\n.badge-pick-tile.selected{border-color:var(--warm-1);background:#bf5af214;}\n.badge-pick-icon{font-size:30px;}\n.nova-badge-tag{font-size:13px;margin-left:6px;vertical-align:middle;}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var existingKey = findExistingStorageKey();
    var clientOpts = existingKey ? { auth: { storageKey: existingKey } } : {};
    var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, clientOpts);

    var me = null;
    var navRewards = document.getElementById("nav-rewards");
    var questsEl = document.getElementById("rewards-quests");
    var settingsBadgesTile = document.getElementById("settings-badges");
    var modalBadges = document.getElementById("modal-badges");
    var badgesPickerGrid = document.getElementById("badges-picker-grid");
    var btnCloseBadges = document.getElementById("btn-close-badges");

    if (!navRewards && !settingsBadgesTile) return;

    function myStats() {
      return window.ZenoaBadges.fetchAllStats(supabase).then(function (byId) {
        return (me && byId[me.id]) || { dm: 0, replied: 0, sold: 0 };
      });
    }

    function recordEarnedBadges(stats) {
      if (!me || me.role === "chef") return;
      var earned = window.ZenoaBadges.computeEarned(stats);
      if (!earned.length) return;
      var rows = earned.map(function (b) { return { user_id: me.id, badge_id: b.id }; });
      supabase.from("badge_events").upsert(rows, { onConflict: "user_id,badge_id", ignoreDuplicates: true }).then(function () {});
    }

    function renderQuests() {
      if (!questsEl) return;
      questsEl.innerHTML = "";
      myStats().then(function (stats) {
        window.ZenoaBadges.BADGES.forEach(function (badge) {
          var pct = Math.round(window.ZenoaBadges.badgeProgress(badge, stats) * 100);
          var earned = pct >= 100;
          var quest = el("div", { class: "badge-quest" + (earned ? "" : " locked") });
          quest.appendChild(el("div", { class: "badge-quest-icon" }, badge.icon));
          var body = el("div", { class: "badge-quest-body" });
          body.appendChild(el("div", { class: "badge-quest-title" }, badge.label));
          body.appendChild(el("div", { class: "badge-quest-goal" }, window.ZenoaBadges.badgeGoalText(badge)));
          var track = el("div", { class: "badge-quest-track" });
          track.appendChild(el("div", { class: "badge-quest-fill", style: "width:" + pct + "%;" }));
          body.appendChild(track);
          quest.appendChild(body);
          quest.appendChild(el("div", { class: "badge-quest-lock" }, earned ? "✓" : "🔒"));
          questsEl.appendChild(quest);
        });
      });
    }

    if (navRewards) {
      navRewards.addEventListener("click", function () {
        document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
        navRewards.classList.add("active");
        document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
        var v = document.getElementById("view-rewards");
        if (v) v.classList.add("active");
        renderQuests();
      });
    }

    function renderBadgesPicker() {
      if (!badgesPickerGrid) return;
      badgesPickerGrid.innerHTML = "";
      myStats().then(function (stats) {
        window.ZenoaBadges.BADGES.forEach(function (badge) {
          var earned = window.ZenoaBadges.isEarned(badge, stats);
          var selected = me.selected_badge_id === badge.id;
          var tile = el("div", { class: "badge-pick-tile" + (earned ? "" : " locked") + (selected ? " selected" : "") });
          tile.appendChild(el("div", { class: "badge-pick-icon" }, earned ? badge.icon : "🔒"));
          tile.appendChild(el("div", {}, badge.label));
          if (earned) {
            tile.addEventListener("click", function () {
              supabase.from("profiles").update({ selected_badge_id: badge.id }).eq("id", me.id).then(function (res) {
                if (res && res.error) { alert("Erreur : " + res.error.message); return; }
                me.selected_badge_id = badge.id;
                renderBadgesPicker();
                applyMyAvatarBadge();
              });
            });
          }
          badgesPickerGrid.appendChild(tile);
        });
      });
    }

    if (settingsBadgesTile && modalBadges) {
      settingsBadgesTile.addEventListener("click", function () {
        renderBadgesPicker();
        modalBadges.classList.add("open");
      });
    }
    if (btnCloseBadges) {
      btnCloseBadges.addEventListener("click", function () {
        modalBadges.classList.remove("open");
      });
    }

    function applyMyAvatarBadge() {
      var avatarEl = document.getElementById("my-avatar");
      if (!avatarEl || !me) return;
      var old = document.getElementById("my-avatar-badge");
      myStats().then(function (stats) {
        recordEarnedBadges(stats);
        var badge = window.ZenoaBadges.pickActiveBadge(stats, me.selected_badge_id);
        if (old) old.remove();
        if (!badge) return;
        var tag = el("span", { id: "my-avatar-badge", title: badge.label }, badge.icon);
        tag.style.cssText = "position:absolute;bottom:-3px;right:-3px;font-size:14px;line-height:1;background:var(--bg-panel);border-radius:50%;padding:1px;";
        avatarEl.appendChild(tag);
      });
    }

    function boot(userId) {
      supabase.from("profiles").select("id,role,selected_badge_id").eq("id", userId).single().then(function (res) {
        if (!res || !res.data) return;
        me = res.data;
        if (navRewards) navRewards.style.display = me.role === "chef" ? "none" : "flex";
        if (settingsBadgesTile) settingsBadgesTile.style.display = me.role === "chef" ? "none" : "flex";
        applyMyAvatarBadge();

        if (me.role !== "chef") {
          supabase.channel("nova-badges-" + me.id)
            .on("postgres_changes", { event: "*", schema: "public", table: "prospects", filter: "setter_id=eq." + me.id }, function () {
              applyMyAvatarBadge();
              renderQuests();
            })
            .subscribe();
        }
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
