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

  var CSS = "\n.nova-member-row-v2{display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;border-bottom:1px solid rgba(184,188,194,.10)}\n.nova-member-row-v2:hover{background:rgba(255,255,255,.04)}\n.nova-member-avatar{width:40px;height:40px;border-radius:50%;flex-shrink:0;object-fit:cover;background:linear-gradient(135deg,#6d28d9,#3A9FD9);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;}\n.nova-member-text{min-width:0;flex:1;}\n.nova-member-name{font-family:'Poppins',sans-serif;font-weight:600;font-size:14.5px;margin-bottom:2px;}\n.nova-member-preview{font-size:12.5px;opacity:.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}\n.res-card{aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;text-align:center;padding:14px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(184,188,194,.14);cursor:pointer;font-size:16px;font-weight:700;word-break:break-word}\n.res-card:hover{background:rgba(255,255,255,.09)}\n.res-item{padding:10px 14px;border-radius:8px;background:rgba(255,255,255,.05);font-size:14px;word-break:break-word}\n.res-item a{color:#a78bfa}\n.res-card{position:relative}\n.res-del{position:absolute;top:6px;right:8px;font-size:14px;opacity:.6;line-height:1}\n.res-del:hover{opacity:1;color:#ef4444}\n.res-item{position:relative;padding-right:34px}\n.res-item .res-del{top:8px;right:10px}\n.res-card-wide{aspect-ratio:auto!important;width:100%;height:120px;font-size:20px;}\n.res-card-empty{opacity:.55;font-weight:500;font-size:15px;border-style:dashed;}\n.res-card.dragging{opacity:.55;transform:scale(1.05);z-index:5;box-shadow:0 12px 30px #000a;touch-action:none;}\n.res-edit{position:absolute;top:6px;left:8px;font-size:13px;opacity:.6;}\n.res-edit:hover{opacity:1;}\n.nav-item.unread-nav{font-weight:700;}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var existingKey = findExistingStorageKey();
    var clientOpts = existingKey ? { auth: { storageKey: existingKey } } : {};
    var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, clientOpts);

    var me = null;
    var profilesCache = {};

    var navAdmin = document.getElementById("nav-admin");
    var navResources = document.getElementById("nav-resources");
    var resGrid = document.getElementById("res-grid");
    var resPinnedWrap = document.getElementById("res-pinned-wrap");
    var resDetail = document.getElementById("res-detail");
    var resAddBtn = document.getElementById("res-add-btn");
    var resBack = document.getElementById("res-back");
    var resDetailTitle = document.getElementById("res-detail-title");
    var resItemsEl = document.getElementById("res-items");
    var resItemForm = document.getElementById("res-item-form");
    var resItemInput = document.getElementById("res-item-input");
    var settingsBtn = document.getElementById("settings-btn");
    var modalSettings = document.getElementById("modal-settings");
    var btnCloseSettings = document.getElementById("btn-close-settings");
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

    if (settingsBtn && modalSettings) {
      settingsBtn.addEventListener("click", function () {
        modalSettings.classList.add("open");
      });
    }
    if (btnCloseSettings) {
      btnCloseSettings.addEventListener("click", function () {
        modalSettings.classList.remove("open");
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
        modalSettings.classList.remove("open");
        myAvatarInput.click(); // réutilise l'upload déjà géré par l'app
      });
    }

    if (settingsReportIssue && modalReportIssue) {
      settingsReportIssue.addEventListener("click", function () {
        modalSettings.classList.remove("open");
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
            return { created_at: r.created_at, text: "Nouveau mail de " + (profilesCache[r.sender_id] || "quelqu'un"), view: "boxmail" };
          });
        });
    }

    function fetchProspectNotifs() {
      if (!me || me.role !== "chef") return Promise.resolve([]);
      return supabase.from("prospects").select("id,contact,setter_id,created_at")
        .neq("setter_id", me.id).order("created_at", { ascending: false }).limit(20)
        .then(function (res) {
          return ((res && res.data) || []).map(function (r) {
            return { created_at: r.created_at, text: (profilesCache[r.setter_id] || "Quelqu'un") + " a ajouté un prospect : " + r.contact, view: "dms" };
          });
        });
    }

    function fetchReportNotifs() {
      if (!me || me.role !== "chef") return Promise.resolve([]);
      return supabase.from("issue_reports").select("id,content,created_at,sender_id")
        .order("created_at", { ascending: false }).limit(20)
        .then(function (res) {
          return ((res && res.data) || []).map(function (r) {
            return { created_at: r.created_at, text: "Signalement de " + (profilesCache[r.sender_id] || "quelqu'un") + " : " + r.content, view: null };
          });
        });
    }

    function loadNotifications() {
      return Promise.all([fetchBoxmailNotifs(), fetchProspectNotifs(), fetchReportNotifs()]).then(function (lists) {
        var all = lists[0].concat(lists[1]).concat(lists[2]);
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

    function renderReportsList() {
      if (!reportsListItems || !me) return;
      loadNotifications().then(function (items) {
        reportsListItems.innerHTML = "";
        if (!items.length) {
          reportsListItems.appendChild(el("div", { class: "empty-note" }, "Aucune notification."));
        }
        items.forEach(function (it) {
          var box = el("div", { class: "res-item", style: it.view ? "cursor:pointer;" : "" });
          box.appendChild(el("div", { style: "font-size:11px;opacity:.55;margin-bottom:4px;" }, new Date(it.created_at).toLocaleString("fr-FR")));
          box.appendChild(document.createTextNode(it.text));
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

    function applyMyCustomRole(customRole) {
      var infoWrap = document.querySelector(".sidebar-profile-info");
      if (!infoWrap) return;
      var line = document.getElementById("my-custom-role-display");
      if (!customRole) { if (line) line.remove(); return; }
      if (!line) {
        line = el("div", { id: "my-custom-role-display" });
        line.style.cssText = "font-size:11px;opacity:.65;margin-top:2px;font-style:italic;";
        infoWrap.appendChild(line);
      }
      line.textContent = customRole;
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
        modalSettings.classList.remove("open");
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

    function enableCardDrag(card) {
      var pressTimer = null, dragging = false, startX = 0, startY = 0;

      card.addEventListener("pointerdown", function (e) {
        if (e.target.closest(".res-del") || e.target.closest(".res-edit")) return;
        startX = e.clientX; startY = e.clientY;
        pressTimer = setTimeout(function () {
          dragging = true;
          card.classList.add("dragging");
          try { card.setPointerCapture(e.pointerId); } catch (err) {}
        }, 450);
      });

      card.addEventListener("pointermove", function (e) {
        if (pressTimer && !dragging) {
          if (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10) {
            clearTimeout(pressTimer); pressTimer = null;
          }
          return;
        }
        if (!dragging) return;
        e.preventDefault();
        card.style.transform = "translate(" + (e.clientX - startX) + "px," + (e.clientY - startY) + "px)";
        var els = document.elementsFromPoint(e.clientX, e.clientY);
        var target = null;
        for (var i = 0; i < els.length; i++) {
          if (els[i].classList && els[i].classList.contains("res-card") && els[i] !== card && els[i].parentElement === resGrid) {
            target = els[i]; break;
          }
        }
        if (target) {
          var cards = Array.prototype.slice.call(resGrid.children);
          if (cards.indexOf(card) < cards.indexOf(target)) resGrid.insertBefore(card, target.nextSibling);
          else resGrid.insertBefore(card, target);
          card.style.transform = "";
          startX = e.clientX; startY = e.clientY;
        }
      });

      function endDrag() {
        clearTimeout(pressTimer); pressTimer = null;
        if (dragging) {
          dragging = false;
          card.classList.remove("dragging");
          card.style.transform = "";
          resSuppressClick = true;
          setTimeout(function () { resSuppressClick = false; }, 300);
          persistResourceOrder();
        }
      }
      card.addEventListener("pointerup", endDrag);
      card.addEventListener("pointercancel", endDrag);
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

    function renderResourceGrid() {
      if (!resGrid) return;
      supabase.from("resource_categories").select("id,title,is_pinned").order("is_pinned", { ascending: false }).order("sort_order").order("created_at").then(function (res) {
        if (res && res.error) { console.error("[NOVA ressources]", res.error); alert("Erreur ressources : " + res.error.message); return; }
        var rows = (res && res.data) || [];
        var pinned = rows.find(function (c) { return c.is_pinned; });
        var normal = rows.filter(function (c) { return !c.is_pinned; });
        renderPinned(pinned);
        resGrid.innerHTML = "";
        normal.forEach(function (c) {
          var card = el("div", { class: "res-card", "data-cat-id": c.id }, c.title);
          card.addEventListener("click", function () { if (!resSuppressClick) openCategory(c); });
          if (me.role === "chef") {
            card.appendChild(makeDeleteBtn(c, renderResourceGrid));
            card.appendChild(makeEditBtn(c, renderResourceGrid));
            enableCardDrag(card);
          }
          resGrid.appendChild(card);
        });
      });
    }

    function openCategory(cat) {
      resGrid.style.display = "none";
      resDetail.style.display = "block";
      resDetailTitle.textContent = cat.title;
      resItemForm.style.display = me.role === "chef" ? "flex" : "none";
      resItemForm.dataset.categoryId = cat.id;
      resItemsEl.innerHTML = "";
      supabase.from("resource_items").select("id,content").eq("category_id", cat.id).order("created_at").then(function (res) {
        var rows = (res && res.data) || [];
        rows.forEach(function (r) {
          var box = el("div", { class: "res-item" });
          box.appendChild(linkify(r.content));
          if (me.role === "chef") {
            var del = el("span", { class: "res-del" }, "✕");
            del.addEventListener("click", function () {
              if (!confirm("Supprimer cette ressource ?")) return;
              supabase.from("resource_items").delete().eq("id", r.id).then(function (res) {
                if (res && res.error) { alert("Erreur : " + res.error.message); return; }
                box.remove();
              });
            });
            box.appendChild(del);
          }
          resItemsEl.appendChild(box);
        });
      });
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
        supabase.from("resource_items").insert({ category_id: categoryId, content: content, created_by: me.id }).select().then(function (res) {
          if (res && res.error) { alert("Erreur : " + res.error.message); return; }
          var newId = res && res.data && res.data[0] && res.data[0].id;
          var box = el("div", { class: "res-item" });
          box.appendChild(linkify(content));
          if (me.role === "chef" && newId) {
            var del = el("span", { class: "res-del" }, "✕");
            del.addEventListener("click", function () {
              if (!confirm("Supprimer cette ressource ?")) return;
              supabase.from("resource_items").delete().eq("id", newId).then(function (r2) {
                if (r2 && r2.error) { alert("Erreur : " + r2.error.message); return; }
                box.remove();
              });
            });
            box.appendChild(del);
          }
          resItemsEl.appendChild(box);
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
      supabase.from("profiles").select("id,email,last_seen_at,custom_role").in("id", ids).then(function (res) {
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
          var line = info.querySelector(".nova-activity-line");
          if (!line) {
            line = el("div", { class: "nova-activity-line" });
            line.style.cssText = "font-size:12px;opacity:.55;margin-top:2px;";
            info.appendChild(line);
          }
          line.textContent = activityLabel(p.last_seen_at);

          var meta = info.querySelector(".team-row-meta");
          if (meta) {
            meta.textContent = (p.email || "") + " · " + (p.custom_role || "Rôle non défini");
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

    function boot(userId) {
      supabase.from("profiles").select("id,role,pseudo,custom_role,notifications_seen_at").eq("id", userId).single().then(function (res) {
        if (!res || !res.data) return;
        me = res.data;
        profilesCache[me.id] = me.pseudo;
        applyMyCustomRole(me.custom_role);
        if (settingsManageRoles) settingsManageRoles.style.display = me.role === "chef" ? "block" : "none";

        supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", me.id).then(function () {});
        setInterval(function () {
          supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", me.id).then(function () {});
        }, 60000);

        var loadMembers = me.role === "chef"
          ? supabase.from("profiles").select("id,pseudo").eq("role", "setter").eq("is_active", true).order("pseudo")
          : supabase.from("profiles").select("id,pseudo").eq("role", "chef").limit(1);

        loadMembers.then(function (res2) {
          ((res2 && res2.data) || []).forEach(function (m) { profilesCache[m.id] = m.pseudo; });

          watchTeamList();
          refreshBellBadge();

          supabase.channel("nova-notifs-" + me.id)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "boxmails", filter: "recipient_id=eq." + me.id }, refreshBellBadge)
            .subscribe();

          if (me.role === "chef") {
            supabase.channel("nova-notifs-chef")
              .on("postgres_changes", { event: "INSERT", schema: "public", table: "issue_reports" }, refreshBellBadge)
              .on("postgres_changes", { event: "INSERT", schema: "public", table: "prospects" }, refreshBellBadge)
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
      if (session && session.user && !me) boot(session.user.id);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { loadSupabase(init); });
  } else {
    loadSupabase(init);
  }
})();
