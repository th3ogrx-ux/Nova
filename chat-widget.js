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

  var CSS = "\n.nova-member-row-v2{display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;border-bottom:1px solid rgba(199,194,219,.10)}\n.nova-member-row-v2:hover{background:rgba(255,255,255,.04)}\n.nova-member-avatar{width:40px;height:40px;border-radius:50%;flex-shrink:0;object-fit:cover;background:linear-gradient(135deg,#BF5AF2,#300A66);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;}\n.nova-member-text{min-width:0;flex:1;}\n.nova-member-name{font-family:'Poppins',sans-serif;font-weight:600;font-size:14.5px;margin-bottom:2px;}\n.nova-member-preview{font-size:12.5px;opacity:.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}\n.res-card{aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;text-align:center;padding:14px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(199,194,219,.14);cursor:pointer;font-size:16px;font-weight:700;word-break:break-word}\n.res-card:hover{background:rgba(255,255,255,.09)}\n.res-item{padding:10px 14px;border-radius:8px;background:rgba(255,255,255,.05);font-size:14px;word-break:break-word}\n.res-item a{color:#E0B3FF}\n.res-card{position:relative}\n.res-del{position:absolute;top:6px;right:8px;font-size:14px;opacity:.6;line-height:1}\n.res-del:hover{opacity:1;color:#ef4444}\n.res-item{position:relative;padding-right:34px}\n.res-item .res-del{top:8px;right:10px}\n.res-item.res-item-chef{padding-left:30px;}\n.res-item .res-edit{top:8px;left:10px;}\n.res-card-wide{aspect-ratio:auto!important;width:100%;height:120px;font-size:20px;}\n.res-card-empty{opacity:.55;font-weight:500;font-size:15px;border-style:dashed;}\n.res-card.dragging{opacity:.55;transform:scale(1.05);z-index:5;box-shadow:0 12px 30px #000a;touch-action:none;}\n.res-edit{position:absolute;top:6px;left:8px;font-size:13px;opacity:.6;}\n.res-edit:hover{opacity:1;}\n.nav-item.unread-nav{font-weight:700;}\n.settings-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;}\n.settings-tile{aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:14px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(199,194,219,.14);cursor:pointer;font-size:14px;font-weight:600;}\n.settings-tile:hover{background:rgba(255,255,255,.09);}\n.settings-tile-icon{font-size:28px;}\n.settings-tile-label{word-break:break-word;}\n.settings-tile-danger{border-color:#d9534f4d;color:#e39490;}\n.settings-tile-danger:hover{background:#d9534f14;}\n#screen-login{align-items:center;justify-content:center;padding:24px;}\n.nova-notif-row{display:flex;align-items:flex-start;gap:12px;}\n.nova-notif-icon{width:32px;height:32px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#BF5AF2,#300A66);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff;overflow:hidden;}\n.nova-notif-icon img{width:100%;height:100%;object-fit:cover;}\n.nova-notif-body{flex:1;min-width:0;padding-right:20px;}\n.nova-video-player{border-radius:20px;overflow:hidden;background:radial-gradient(ellipse at 30% 20%,#300a6640,transparent 60%),radial-gradient(ellipse at 80% 80%,#bf5af233,transparent 55%),#0c0518;border:1px solid rgba(199,194,219,.16);box-shadow:0 20px 60px #00000073;}\n.nova-video-progress{display:flex;gap:5px;padding:14px 16px 0;}\n.nova-video-seg{flex:1;height:3px;border-radius:3px;background:rgba(255,255,255,.14);}\n.nova-video-seg.done{background:linear-gradient(90deg,var(--warm-1),var(--warm-2));}\n.nova-video-seg.current{background:linear-gradient(90deg,var(--warm-1),var(--warm-2));animation:nova-video-pulse 1.4s ease-in-out infinite;}\n.nova-video-seg.current.paused{animation:none;opacity:.7;}\n@keyframes nova-video-pulse{0%,100%{opacity:1;}50%{opacity:.42;}}\n.nova-video-stage{min-height:220px;display:flex;align-items:center;justify-content:center;text-align:center;padding:36px 30px;}\n.nova-video-text{font-family:'Playfair Display',Georgia,serif;font-size:22px;line-height:1.6;font-weight:600;letter-spacing:.01em;background:linear-gradient(180deg,var(--metal-2) 0%,var(--warm-2) 55%,var(--warm-1) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;opacity:0;transform:translateY(8px);transition:opacity .45s ease,transform .45s ease;max-width:560px;}\n.nova-video-text.show{opacity:1;transform:translateY(0);}\n.nova-video-controls{display:flex;align-items:center;justify-content:center;gap:14px;padding:16px 16px 20px;}\n.nova-video-btn{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid rgba(199,194,219,.2);color:var(--metal-2);font-size:14px;background:rgba(255,255,255,.04);transition:background .2s ease;}\n.nova-video-btn:hover{background:rgba(255,255,255,.1);}\n.nova-video-btn.play{width:46px;height:46px;font-size:17px;background:linear-gradient(120deg,var(--warm-1),var(--warm-2));color:#04010a;border:none;}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var supabase = getSupabaseClient();

    var me = null;
    var profilesCache = {};
    var avatarCache = {};

    var navAdmin = document.getElementById("nav-admin");
    var navResources = document.getElementById("nav-resources");
    var resGrid = document.getElementById("res-grid");
    var resPinnedWrap = document.getElementById("res-pinned-wrap");
    var resSetterTourWrap = document.getElementById("res-setter-tour-wrap");
    var resDetail = document.getElementById("res-detail");
    var resAddBtn = document.getElementById("res-add-btn");
    var resBack = document.getElementById("res-back");
    var resDetailTitle = document.getElementById("res-detail-title");
    var resItemsEl = document.getElementById("res-items");
    var resItemForm = document.getElementById("res-item-form");
    var resItemInput = document.getElementById("res-item-input");
    var resPinnedVideo = document.getElementById("res-pinned-video");
    var resManageToggle = document.getElementById("res-manage-toggle");
    var settingsBtn = document.getElementById("settings-btn");
    var btnBackSettings = document.getElementById("btn-back-settings");
    var settingsLogout = document.getElementById("settings-logout");
    var settingsEditPseudo = document.getElementById("settings-edit-pseudo");
    var settingsEditPhoto = document.getElementById("settings-edit-photo");
    var myAvatarInput = document.getElementById("my-avatar-input");
    var settingsReportIssue = document.getElementById("settings-report-issue");
    var modalReportIssue = document.getElementById("modal-report-issue");
    var reportIssueText = document.getElementById("report-issue-text");
    var btnCancelReport = document.getElementById("btn-cancel-report");
    var btnSendReport = document.getElementById("btn-send-report");
    var bellBtn = document.getElementById("bell-btn");
    var bellBadge = document.getElementById("bell-badge");
    var modalReportsList = document.getElementById("modal-reports-list");
    var reportsListItems = document.getElementById("reports-list-items");
    var btnCloseReports = document.getElementById("btn-close-reports");
    var settingsManageRoles = document.getElementById("settings-manage-roles");
    var modalRoles = document.getElementById("modal-roles");
    var rolesListItems = document.getElementById("roles-list-items");
    var btnCloseRoles = document.getElementById("btn-close-roles");

    var previousViewBeforeSettings = null;

    function switchToView(viewName) {
      document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
      var navEl = document.querySelector('.nav-item[data-view="' + viewName + '"]');
      if (navEl) navEl.classList.add("active");
      document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
      var v = document.getElementById("view-" + viewName);
      if (v) v.classList.add("active");
    }

    if (settingsBtn) {
      settingsBtn.addEventListener("click", function () {
        var activeNav = document.querySelector(".nav-item.active");
        previousViewBeforeSettings = activeNav ? activeNav.getAttribute("data-view") : "results";
        switchToView("settings");
        var sidebar = document.getElementById("sidebar");
        var sidebarOverlay = document.getElementById("sidebar-overlay");
        if (sidebar) sidebar.classList.remove("open");
        if (sidebarOverlay) sidebarOverlay.classList.remove("open");
      });
    }
    if (btnBackSettings) {
      btnBackSettings.addEventListener("click", function () {
        switchToView(previousViewBeforeSettings || "results");
      });
    }
    if (settingsLogout) {
      settingsLogout.addEventListener("click", function () {
        if (!confirm("Es-tu sûr de vouloir te déconnecter ?")) return;
        supabase.auth.signOut().then(function () { window.location.reload(); });
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
          profilesCache[me.id] = newPseudo;
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

    if (settingsReportIssue && modalReportIssue) {
      settingsReportIssue.addEventListener("click", function () {
        reportIssueText.value = "";
        modalReportIssue.classList.add("open");
      });
    }
    if (btnCancelReport) {
      btnCancelReport.addEventListener("click", function () {
        modalReportIssue.classList.remove("open");
      });
    }
    if (btnSendReport) {
      btnSendReport.addEventListener("click", function () {
        var content = reportIssueText.value.trim();
        if (!content || !me) return;
        supabase.from("issue_reports").insert({ sender_id: me.id, content: content }).then(function (res) {
          if (res && res.error) { alert("Erreur : " + res.error.message); return; }
          modalReportIssue.classList.remove("open");
          alert("Signalement envoyé.");
        });
      });
    }

    // ---------- Notifications (mail BoxMail, prospects DM, signalements) ----------

    function fetchBoxmailNotifs() {
      return supabase.from("boxmails").select("id,sender_id,content,created_at")
        .eq("recipient_id", me.id).order("created_at", { ascending: false }).limit(20)
        .then(function (res) {
          return ((res && res.data) || []).map(function (r) {
            return {
              created_at: r.created_at,
              text: "Nouveau mail de " + (profilesCache[r.sender_id] || "quelqu'un"),
              view: "boxmail",
              icon: { type: "avatar", src: avatarCache[r.sender_id], initials: initials(profilesCache[r.sender_id]) }
            };
          });
        });
    }

    function fetchProspectNotifs() {
      if (!me || me.role !== "chef") return Promise.resolve([]);
      return supabase.from("prospects").select("id,contact,setter_id,created_at")
        .eq("status", "sold").neq("setter_id", me.id).order("created_at", { ascending: false }).limit(20)
        .then(function (res) {
          return ((res && res.data) || []).map(function (r) {
            return {
              created_at: r.created_at,
              text: (profilesCache[r.setter_id] || "Quelqu'un") + " a fait une vente : " + r.contact,
              view: "dms",
              icon: { type: "emoji", value: "💰" }
            };
          });
        });
    }

    function fetchCalendarNotifs() {
      if (!me) return Promise.resolve([]);
      return supabase.from("calendar_events").select("id,title,created_by,created_at")
        .neq("created_by", me.id).order("created_at", { ascending: false }).limit(20)
        .then(function (res) {
          return ((res && res.data) || []).map(function (r) {
            return {
              created_at: r.created_at,
              text: (profilesCache[r.created_by] || "Quelqu'un") + " a ajouté un point au calendrier : " + r.title,
              view: "calendrier",
              icon: { type: "avatar", src: avatarCache[r.created_by], initials: initials(profilesCache[r.created_by]) }
            };
          });
        });
    }

    function fetchReportNotifs() {
      if (!me || me.role !== "chef") return Promise.resolve([]);
      return supabase.from("issue_reports").select("id,content,created_at,sender_id")
        .order("created_at", { ascending: false }).limit(20)
        .then(function (res) {
          return ((res && res.data) || []).map(function (r) {
            return {
              created_at: r.created_at,
              text: "Signalement de " + (profilesCache[r.sender_id] || "quelqu'un") + " : " + r.content,
              view: null,
              icon: { type: "emoji", value: "🚨" }
            };
          });
        });
    }

    function loadNotifications() {
      return Promise.all([fetchBoxmailNotifs(), fetchProspectNotifs(), fetchCalendarNotifs(), fetchReportNotifs()]).then(function (lists) {
        var all = lists[0].concat(lists[1]).concat(lists[2]).concat(lists[3]);
        all.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        return all.slice(0, 30);
      });
    }

    function refreshBellBadge() {
      if (!bellBadge || !me) return;
      loadNotifications().then(function (items) {
        var seenAt = me.notifications_seen_at ? new Date(me.notifications_seen_at).getTime() : 0;
        var unread = items.filter(function (it) { return new Date(it.created_at).getTime() > seenAt; }).length;
        if (unread > 0) {
          bellBadge.textContent = unread > 99 ? "99+" : String(unread);
          bellBadge.style.display = "block";
        } else {
          bellBadge.style.display = "none";
        }
      });
    }

    function buildNotifIcon(icon) {
      var wrap = el("div", { class: "nova-notif-icon" });
      if (icon && icon.type === "avatar") {
        if (icon.src) {
          wrap.appendChild(el("img", { src: icon.src }));
        } else {
          wrap.appendChild(document.createTextNode(icon.initials || "?"));
        }
      } else if (icon) {
        wrap.appendChild(document.createTextNode(icon.value || "🔔"));
      }
      return wrap;
    }

    function renderReportsList() {
      if (!reportsListItems || !me) return;
      loadNotifications().then(function (items) {
        reportsListItems.innerHTML = "";
        if (!items.length) {
          reportsListItems.appendChild(el("div", { class: "empty-note" }, "Aucune notification."));
        }
        items.forEach(function (it) {
          var box = el("div", { class: "res-item nova-notif-row", style: it.view ? "cursor:pointer;" : "" });
          box.appendChild(buildNotifIcon(it.icon));
          var body = el("div", { class: "nova-notif-body" });
          body.appendChild(el("div", { style: "font-size:11px;opacity:.55;margin-bottom:4px;" }, new Date(it.created_at).toLocaleString("fr-FR")));
          body.appendChild(document.createTextNode(it.text));
          box.appendChild(body);
          if (it.view) {
            box.addEventListener("click", function () {
              modalReportsList.classList.remove("open");
              var navEl = document.querySelector('.nav-item[data-view="' + it.view + '"]');
              if (navEl) navEl.click();
            });
          }
          reportsListItems.appendChild(box);
        });

        var nowIso = new Date().toISOString();
        supabase.from("profiles").update({ notifications_seen_at: nowIso }).eq("id", me.id).then(function () {
          me.notifications_seen_at = nowIso;
          refreshBellBadge();
        });
      });
    }

    var myRoleDisplayEl = document.getElementById("my-role-display");
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

    var rolePillCreate = document.getElementById("role-pill-create");
    if (rolePillCreate) {
      new MutationObserver(function () {
        if (rolePillCreate.textContent === "Setter") rolePillCreate.textContent = "Rôle non défini";
      }).observe(rolePillCreate, { childList: true, characterData: true, subtree: true });
    }

    function renderRolesList() {
      if (!rolesListItems || !me) return;
      rolesListItems.innerHTML = "";
      supabase.from("profiles").select("id,pseudo,custom_role,photo_url").eq("is_active", true).order("pseudo").then(function (res) {
        if (res && res.error) { alert("Erreur : " + res.error.message); return; }
        var rows = (res && res.data) || [];
        if (!rows.length) {
          rolesListItems.appendChild(el("div", { class: "empty-note" }, "Aucun membre actif."));
          return;
        }
        rows.forEach(function (p) {
          var row = el("div", { class: "nova-member-row-v2", style: "cursor:pointer;" });
          var avatar = p.photo_url
            ? el("img", { class: "nova-member-avatar", src: p.photo_url })
            : el("div", { class: "nova-member-avatar" }, initials(p.pseudo));
          var textWrap = el("div", { class: "nova-member-text" });
          textWrap.appendChild(el("div", { class: "nova-member-name" }, p.pseudo));
          textWrap.appendChild(el("div", { class: "nova-member-preview" }, p.custom_role || "Aucun rôle défini"));
          row.appendChild(avatar);
          row.appendChild(textWrap);
          row.addEventListener("click", function () {
            var newRole = window.prompt("Rôle de " + p.pseudo + " :", p.custom_role || "");
            if (newRole === null) return;
            newRole = newRole.trim();
            supabase.from("profiles").update({ custom_role: newRole || null }).eq("id", p.id).then(function (res2) {
              if (res2 && res2.error) { alert("Erreur : " + res2.error.message); return; }
              if (p.id === me.id) { me.custom_role = newRole || null; applyMyCustomRole(me.custom_role); }
              renderRolesList();
              decorateTeamList();
            });
          });
          rolesListItems.appendChild(row);
        });
      });
    }

    if (bellBtn) {
      bellBtn.addEventListener("click", function () {
        if (!me) return;
        renderReportsList();
        modalReportsList.classList.add("open");
      });
    }
    if (btnCloseReports) {
      btnCloseReports.addEventListener("click", function () {
        modalReportsList.classList.remove("open");
      });
    }

    if (settingsManageRoles && modalRoles) {
      settingsManageRoles.addEventListener("click", function () {
        renderRolesList();
        modalRoles.classList.add("open");
      });
    }
    if (btnCloseRoles) {
      btnCloseRoles.addEventListener("click", function () {
        modalRoles.classList.remove("open");
      });
    }

    // Empêche l'édition directe du pseudo / de la photo en cliquant dessus :
    // ça passe désormais uniquement par la modale Paramètres.
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

    if (navResources) {
      navResources.addEventListener("click", function () {
        document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
        navResources.classList.add("active");
        document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
        var v = document.getElementById("view-resources");
        if (v) v.classList.add("active");
        backToGrid();
      });
    }
    if (navAdmin) {
      navAdmin.addEventListener("click", function () {
        watchTeamList();
        setTimeout(decorateTeamList, 300);
      });
    }

    document.querySelectorAll(".nav-item").forEach(function (navEl) {
      if (navEl === navResources) return;
      navEl.addEventListener("click", function () { stopPinnedVideo(); });
    });

    function initials(name) {
      return (name || "?").trim().slice(0, 2).toUpperCase();
    }

    function linkify(text) {
      var span = document.createElement("span");
      var urlRe = /(https?:\/\/[^\s]+)/g;
      var last = 0, m;
      while ((m = urlRe.exec(text))) {
        span.appendChild(document.createTextNode(text.slice(last, m.index)));
        var a = el("a", { href: m[0], target: "_blank", rel: "noopener" }, m[0]);
        span.appendChild(a);
        last = m.index + m[0].length;
      }
      span.appendChild(document.createTextNode(text.slice(last)));
      return span;
    }

    function backToGrid() {
      stopPinnedVideo();
      resDetail.style.display = "none";
      resGrid.style.display = "grid";
      renderResourceGrid();
    }

    function makeDeleteBtn(cat, onDone) {
      var del = el("span", { class: "res-del" }, "✕");
      del.addEventListener("click", function (e) {
        e.stopPropagation();
        if (!confirm("Supprimer cette ressource et tout son contenu ?")) return;
        supabase.from("resource_categories").delete().eq("id", cat.id).then(function (res) {
          if (res && res.error) { alert("Erreur : " + res.error.message); return; }
          onDone();
        });
      });
      return del;
    }

    function makeEditBtn(cat, onDone) {
      var edit = el("span", { class: "res-edit" }, "✎");
      edit.addEventListener("click", function (e) {
        e.stopPropagation();
        var newTitle = window.prompt("Nouveau titre :", cat.title);
        if (!newTitle || !newTitle.trim() || newTitle.trim() === cat.title) return;
        supabase.from("resource_categories").update({ title: newTitle.trim() }).eq("id", cat.id).then(function (res) {
          if (res && res.error) { alert("Erreur : " + res.error.message); return; }
          onDone();
        });
      });
      return edit;
    }

    var resSuppressClick = false;

    function persistResourceOrder() {
      var cards = Array.prototype.slice.call(resGrid.querySelectorAll(".res-card"));
      cards.forEach(function (c, i) {
        var id = c.getAttribute("data-cat-id");
        if (id) supabase.from("resource_categories").update({ sort_order: i }).eq("id", id).then(function () {});
      });
    }

    function enableDrag(item, container, itemClass, onReorder) {
      var pressTimer = null, dragging = false, startX = 0, startY = 0;

      item.addEventListener("pointerdown", function (e) {
        if (e.target.closest(".res-del") || e.target.closest(".res-edit")) return;
        startX = e.clientX; startY = e.clientY;
        pressTimer = setTimeout(function () {
          dragging = true;
          item.classList.add("dragging");
          try { item.setPointerCapture(e.pointerId); } catch (err) {}
        }, 450);
      });

      item.addEventListener("pointermove", function (e) {
        if (pressTimer && !dragging) {
          if (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10) {
            clearTimeout(pressTimer); pressTimer = null;
          }
          return;
        }
        if (!dragging) return;
        e.preventDefault();
        item.style.transform = "translate(" + (e.clientX - startX) + "px," + (e.clientY - startY) + "px)";
        var els = document.elementsFromPoint(e.clientX, e.clientY);
        var target = null;
        for (var i = 0; i < els.length; i++) {
          if (els[i].classList && els[i].classList.contains(itemClass) && els[i] !== item && els[i].parentElement === container) {
            target = els[i]; break;
          }
        }
        if (target) {
          var items = Array.prototype.slice.call(container.children);
          if (items.indexOf(item) < items.indexOf(target)) container.insertBefore(item, target.nextSibling);
          else container.insertBefore(item, target);
          item.style.transform = "";
          startX = e.clientX; startY = e.clientY;
        }
      });

      function endDrag() {
        clearTimeout(pressTimer); pressTimer = null;
        if (dragging) {
          dragging = false;
          item.classList.remove("dragging");
          item.style.transform = "";
          resSuppressClick = true;
          setTimeout(function () { resSuppressClick = false; }, 300);
          onReorder();
        }
      }
      item.addEventListener("pointerup", endDrag);
      item.addEventListener("pointercancel", endDrag);
    }

    function persistItemOrder() {
      var boxes = Array.prototype.slice.call(resItemsEl.querySelectorAll(".res-item"));
      boxes.forEach(function (box, i) {
        var id = box.getAttribute("data-item-id");
        if (id) supabase.from("resource_items").update({ sort_order: i }).eq("id", id).then(function () {});
      });
    }

    function buildItemRow(item) {
      var box = el("div", { class: "res-item", "data-item-id": item.id });
      var textSpan = el("span", {});
      textSpan.appendChild(linkify(item.content));
      box.appendChild(textSpan);
      if (me.role === "chef") {
        box.classList.add("res-item-chef");

        var edit = el("span", { class: "res-edit" }, "✎");
        edit.addEventListener("click", function (e) {
          e.stopPropagation();
          var newContent = window.prompt("Modifier :", item.content);
          if (newContent === null || !newContent.trim() || newContent.trim() === item.content) return;
          newContent = newContent.trim();
          supabase.from("resource_items").update({ content: newContent }).eq("id", item.id).then(function (res) {
            if (res && res.error) { alert("Erreur : " + res.error.message); return; }
            item.content = newContent;
            textSpan.innerHTML = "";
            textSpan.appendChild(linkify(newContent));
          });
        });
        box.appendChild(edit);

        var del = el("span", { class: "res-del" }, "✕");
        del.addEventListener("click", function () {
          if (!confirm("Supprimer cette ressource ?")) return;
          supabase.from("resource_items").delete().eq("id", item.id).then(function (res) {
            if (res && res.error) { alert("Erreur : " + res.error.message); return; }
            box.remove();
          });
        });
        box.appendChild(del);

        enableDrag(box, resItemsEl, "res-item", persistItemOrder);
      }
      return box;
    }

    function renderPinned(pinned) {
      if (!resPinnedWrap) return;
      resPinnedWrap.innerHTML = "";
      if (pinned) {
        var card = el("div", { class: "res-card res-card-wide" }, pinned.title);
        card.addEventListener("click", function () { if (!resSuppressClick) openCategory(pinned); });
        if (me.role === "chef") {
          card.appendChild(makeDeleteBtn(pinned, renderResourceGrid));
          card.appendChild(makeEditBtn(pinned, renderResourceGrid));
        }
        resPinnedWrap.appendChild(card);
      } else if (me.role === "chef") {
        var placeholder = el("div", { class: "res-card res-card-wide res-card-empty" }, "+ Créer le bloc principal");
        placeholder.addEventListener("click", function () {
          var title = window.prompt("Titre du bloc principal :");
          if (!title || !title.trim()) return;
          supabase.from("resource_categories").insert({ title: title.trim(), created_by: me.id, is_pinned: true }).then(function (res) {
            if (res && res.error) { alert("Erreur : " + res.error.message); return; }
            renderResourceGrid();
          });
        });
        resPinnedWrap.appendChild(placeholder);
      }
    }

    function renderSetterTour(cat) {
      if (!resSetterTourWrap) return;
      resSetterTourWrap.innerHTML = "";
      if (cat) {
        var card = el("div", { class: "res-card res-card-wide" }, cat.title);
        card.addEventListener("click", function () { if (!resSuppressClick) openCategory(cat); });
        if (me.role === "chef") {
          card.appendChild(makeDeleteBtn(cat, renderResourceGrid));
          card.appendChild(makeEditBtn(cat, renderResourceGrid));
        }
        resSetterTourWrap.appendChild(card);
      } else if (me.role === "chef") {
        var placeholder = el("div", { class: "res-card res-card-wide res-card-empty" }, "+ Créer la présentation Setter");
        placeholder.addEventListener("click", function () {
          var title = window.prompt("Titre de la présentation :", "Présentation — Partie Setter");
          if (!title || !title.trim()) return;
          supabase.from("resource_categories").insert({ title: title.trim(), created_by: me.id, is_setter_tour: true }).then(function (res) {
            if (res && res.error) { alert("Erreur : " + res.error.message); return; }
            renderResourceGrid();
          });
        });
        resSetterTourWrap.appendChild(placeholder);
      }
    }

    function renderResourceGrid() {
      if (!resGrid) return;
      supabase.from("resource_categories").select("id,title,is_pinned,is_setter_tour").order("is_pinned", { ascending: false }).order("sort_order").order("created_at").then(function (res) {
        if (res && res.error) { console.error("[NOVA ressources]", res.error); alert("Erreur ressources : " + res.error.message); return; }
        var rows = (res && res.data) || [];
        var pinned = rows.find(function (c) { return c.is_pinned; });
        var setterTour = rows.find(function (c) { return c.is_setter_tour; });
        var normal = rows.filter(function (c) { return !c.is_pinned && !c.is_setter_tour; });
        renderPinned(pinned);
        renderSetterTour(setterTour);
        resGrid.innerHTML = "";
        normal.forEach(function (c) {
          var card = el("div", { class: "res-card", "data-cat-id": c.id }, c.title);
          card.addEventListener("click", function () { if (!resSuppressClick) openCategory(c); });
          if (me.role === "chef") {
            card.appendChild(makeDeleteBtn(c, renderResourceGrid));
            card.appendChild(makeEditBtn(c, renderResourceGrid));
            enableDrag(card, resGrid, "res-card", persistResourceOrder);
          }
          resGrid.appendChild(card);
        });
      });
    }

    function openCategory(cat) {
      resGrid.style.display = "none";
      resDetail.style.display = "block";
      resDetailTitle.textContent = cat.title;
      resItemForm.dataset.categoryId = cat.id;
      resItemsEl.innerHTML = "";
      stopPinnedVideo();

      var isVideo = !!(cat.is_pinned || cat.is_setter_tour);
      resPinnedVideo.style.display = isVideo ? "block" : "none";
      resManageToggle.style.display = isVideo && me.role === "chef" ? "block" : "none";
      resManageToggle.textContent = "✎ Gérer le contenu";
      resItemsEl.style.display = isVideo ? "none" : "flex";
      resItemForm.style.display = !isVideo && me.role === "chef" ? "flex" : "none";

      supabase.from("resource_items").select("id,content,sort_order").eq("category_id", cat.id)
        .order("sort_order").order("created_at").then(function (res) {
        var rows = (res && res.data) || [];

        if (isVideo) {
          renderPinnedVideoPlayer(rows.map(function (r) { return r.content; }));
        }

        rows.forEach(function (r) {
          resItemsEl.appendChild(buildItemRow(r));
        });
      });
    }

    if (resManageToggle) {
      resManageToggle.addEventListener("click", function () {
        var showing = resItemsEl.style.display !== "none";
        resItemsEl.style.display = showing ? "none" : "flex";
        resItemForm.style.display = showing ? "none" : (me.role === "chef" ? "flex" : "none");
        resManageToggle.textContent = showing ? "✎ Gérer le contenu" : "✕ Fermer l'édition";
      });
    }

    var pinnedVideoState = null;

    function stopPinnedVideo() {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (pinnedVideoState) {
        pinnedVideoState.stopped = true;
        pinnedVideoState = null;
      }
    }

    function stripForSpeech(text) {
      return text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}]/gu, "").trim();
    }

    function renderPinnedVideoPlayer(lines) {
      resPinnedVideo.innerHTML = "";
      if (!lines.length) {
        resPinnedVideo.appendChild(el("div", { class: "empty-note" }, "Aucun contenu pour le moment."));
        return;
      }

      var player = el("div", { class: "nova-video-player" });
      var progress = el("div", { class: "nova-video-progress" });
      var segs = lines.map(function () {
        var seg = el("div", { class: "nova-video-seg" });
        progress.appendChild(seg);
        return seg;
      });
      player.appendChild(progress);

      var stage = el("div", { class: "nova-video-stage" });
      var textEl = el("div", { class: "nova-video-text" });
      stage.appendChild(textEl);
      player.appendChild(stage);

      var controls = el("div", { class: "nova-video-controls" });
      var prevBtn = el("div", { class: "nova-video-btn" }, "◀");
      var playBtn = el("div", { class: "nova-video-btn play" }, "⏸");
      var nextBtn = el("div", { class: "nova-video-btn" }, "▶");
      controls.appendChild(prevBtn);
      controls.appendChild(playBtn);
      controls.appendChild(nextBtn);
      player.appendChild(controls);

      resPinnedVideo.appendChild(player);

      var state = { index: 0, stopped: false, paused: false };
      var utterToken = 0;
      pinnedVideoState = state;

      function updateSegs() {
        segs.forEach(function (seg, i) {
          if (i < state.index) seg.className = "nova-video-seg done";
          else if (i === state.index) seg.className = "nova-video-seg current" + (state.paused ? " paused" : "");
          else seg.className = "nova-video-seg";
        });
      }

      function speakCurrent() {
        utterToken++;
        var myToken = utterToken;
        if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
        window.speechSynthesis.cancel();
        state.paused = false;
        playBtn.textContent = "⏸";
        updateSegs();

        var utter = new SpeechSynthesisUtterance(stripForSpeech(lines[state.index]));
        utter.lang = "fr-FR";
        utter.rate = 0.98;
        utter.onend = function () {
          if (state.stopped || myToken !== utterToken) return;
          state.paused = true;
          playBtn.textContent = "🔁";
          updateSegs();
        };
        utter.onerror = utter.onend;
        window.speechSynthesis.speak(utter);
      }

      function goTo(i) {
        if (state.stopped) return;
        if (i < 0) i = 0;
        if (i >= lines.length) i = lines.length - 1;
        state.index = i;
        updateSegs();

        textEl.classList.remove("show");
        setTimeout(function () {
          if (state.stopped || state.index !== i) return;
          textEl.textContent = lines[i];
          textEl.classList.add("show");
        }, 200);

        speakCurrent();
      }

      prevBtn.addEventListener("click", function () { goTo(state.index - 1); });
      nextBtn.addEventListener("click", function () { goTo(state.index + 1); });
      playBtn.addEventListener("click", function () {
        if (!window.speechSynthesis) return;
        if (playBtn.textContent === "🔁") {
          speakCurrent();
          return;
        }
        if (state.paused) {
          window.speechSynthesis.resume();
          state.paused = false;
          playBtn.textContent = "⏸";
        } else {
          window.speechSynthesis.pause();
          state.paused = true;
          playBtn.textContent = "▶";
        }
        updateSegs();
      });

      goTo(0);
    }

    if (resAddBtn) {
      resAddBtn.addEventListener("click", function () {
        var title = window.prompt("Titre de la ressource :");
        if (!title || !title.trim()) return;
        supabase.from("resource_categories").insert({ title: title.trim(), created_by: me.id }).then(function (res) {
          if (res && res.error) { alert("Erreur : " + res.error.message); return; }
          renderResourceGrid();
        });
      });
    }
    if (resBack) resBack.addEventListener("click", backToGrid);
    if (resItemForm) {
      resItemForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var content = resItemInput.value.trim();
        var categoryId = resItemForm.dataset.categoryId;
        if (!content || !categoryId) return;
        resItemInput.value = "";
        var newSortOrder = resItemsEl.querySelectorAll(".res-item").length;
        supabase.from("resource_items").insert({ category_id: categoryId, content: content, created_by: me.id, sort_order: newSortOrder }).select().then(function (res) {
          if (res && res.error) { alert("Erreur : " + res.error.message); return; }
          var newItem = res && res.data && res.data[0];
          if (newItem) resItemsEl.appendChild(buildItemRow(newItem));
        });
      });
    }

    function activityLabel(ts) {
      if (!ts) return "Jamais connecté";
      var diff = (Date.now() - new Date(ts).getTime()) / 60000; // minutes
      if (diff < 2) return "Connecté actuellement";
      if (diff < 60) return "Connecté il y a " + Math.floor(diff) + " min";
      return "Connecté il y a " + Math.floor(diff / 60) + " h";
    }

    var teamListEl = document.getElementById("team-list");
    var teamObserver = null;

    function decorateTeamList() {
      if (!teamListEl || !me || me.role !== "chef") return;
      var buttons = teamListEl.querySelectorAll("button[data-uid]");
      var ids = Array.prototype.map.call(buttons, function (b) { return b.getAttribute("data-uid"); });
      if (!ids.length) return;
      supabase.from("profiles").select("id,email,last_seen_at,custom_role,account_label").in("id", ids).then(function (res) {
        if (!res || res.error) return;
        var map = {};
        res.data.forEach(function (p) { map[p.id] = p; });
        Array.prototype.forEach.call(buttons, function (btn) {
          var uid = btn.getAttribute("data-uid");
          var row = btn.closest(".team-row");
          if (!row) return;
          var info = row.querySelector(".team-row-info");
          if (!info) return;
          var p = map[uid] || {};
          var online = activityLabel(p.last_seen_at) === "Connecté actuellement";
          var line = info.querySelector(".nova-activity-line");
          if (!line) {
            line = el("div", { class: "nova-activity-line" });
            line.style.cssText = "font-size:12px;opacity:.55;margin-top:2px;display:flex;align-items:center;gap:6px;";
            var dot = el("span", { class: "nova-online-dot" });
            dot.style.cssText = "width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0;";
            line.appendChild(dot);
            line.appendChild(el("span", { class: "nova-activity-text" }));
            info.appendChild(line);
          }
          line.querySelector(".nova-online-dot").style.background = online ? "#4FBF7A" : "#D9534F";
          line.querySelector(".nova-activity-text").textContent = activityLabel(p.last_seen_at);

          var meta = info.querySelector(".team-row-meta");
          if (meta) {
            meta.textContent = (p.email || "") + " · " + (p.custom_role || "Rôle non défini");
          }

          var nameEl = info.querySelector(".team-row-name");
          if (nameEl) {
            var statusTag = nameEl.querySelector(".status-tag");
            if (statusTag && !statusTag.classList.contains("banned")) {
              var label = p.account_label === "test" ? "test" : "actif";
              statusTag.textContent = label === "test" ? "Test" : "Actif";
              statusTag.style.cursor = "pointer";
              statusTag.style.color = label === "test" ? "#f2c572" : "#4FBF7A";
              statusTag.style.borderColor = label === "test" ? "#d4af3759" : "#4FBF7A59";
              statusTag.style.background = label === "test" ? "#d4af3714" : "#4FBF7A12";
              statusTag.onclick = function (e) {
                e.stopPropagation();
                var next = label === "test" ? "actif" : "test";
                supabase.from("profiles").update({ account_label: next }).eq("id", uid).then(function (r) {
                  if (r && r.error) { alert("Erreur : " + r.error.message); return; }
                  decorateTeamList();
                });
              };
            }
          }
        });
      });
    }

    function watchTeamList() {
      if (!teamListEl || teamObserver) return;
      teamObserver = new MutationObserver(function () {
        clearTimeout(watchTeamList._t);
        watchTeamList._t = setTimeout(decorateTeamList, 200);
      });
      teamObserver.observe(teamListEl, { childList: true });
    }

    var booted = false;
    function boot(userId) {
      if (booted) return;
      booted = true;
      supabase.from("profiles").select("id,role,pseudo,custom_role,notifications_seen_at").eq("id", userId).single().then(function (res) {
        if (!res || !res.data) return;
        me = res.data;
        profilesCache[me.id] = me.pseudo;
        applyMyCustomRole(me.custom_role);
        if (settingsManageRoles) settingsManageRoles.style.display = me.role === "chef" ? "" : "none";

        supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", me.id).then(function () {});
        setInterval(function () {
          supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", me.id).then(function () {});
        }, 60000);

        var loadMembers = supabase.from("profiles").select("id,pseudo,photo_url").eq("is_active", true);

        loadMembers.then(function (res2) {
          ((res2 && res2.data) || []).forEach(function (m) {
            profilesCache[m.id] = m.pseudo;
            avatarCache[m.id] = m.photo_url;
          });

          watchTeamList();
          refreshBellBadge();

          supabase.channel("nova-notifs-" + me.id)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "boxmails", filter: "recipient_id=eq." + me.id }, refreshBellBadge)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "calendar_events" }, refreshBellBadge)
            .subscribe();

          if (me.role === "chef") {
            supabase.channel("nova-notifs-chef")
              .on("postgres_changes", { event: "INSERT", schema: "public", table: "issue_reports" }, refreshBellBadge)
              .on("postgres_changes", { event: "UPDATE", schema: "public", table: "prospects" }, refreshBellBadge)
              .subscribe();
          }

          if (resAddBtn) resAddBtn.style.display = me.role === "chef" ? "inline-flex" : "none";
          renderResourceGrid();
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
