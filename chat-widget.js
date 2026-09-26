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

  function timeAgo(ts) {
    if (!ts) return "jamais";
    var diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 60) return "à l'instant";
    if (diff < 3600) return "il y a " + Math.floor(diff / 60) + " min";
    if (diff < 86400) return "il y a " + Math.floor(diff / 3600) + " h";
    return "il y a " + Math.floor(diff / 86400) + " j";
  }

  var CSS = "\n.nova-msg{max-width:78%;padding:7px 11px;border-radius:10px;font-size:13px;line-height:1.35;word-break:break-word}\n.nova-msg.me{align-self:flex-end;background:#6d28d9;color:#fff}\n.nova-msg.other{align-self:flex-start;background:rgba(255,255,255,.08);color:inherit}\n.nova-msg-sender{font-size:10px;opacity:.6;margin-bottom:2px}\n.nova-msg-vu{align-self:flex-end;font-size:10px;opacity:.55;cursor:pointer;margin-top:-2px}\n.nova-member-row{padding:12px 16px;font-size:13px;cursor:pointer;border-bottom:1px solid rgba(184,188,194,.10)}\n.nova-member-row.unread{font-weight:700}\n.nova-member-row:hover{background:rgba(255,255,255,.04)}\n.nova-member-row-v2{display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;border-bottom:1px solid rgba(184,188,194,.10)}\n.nova-member-row-v2:hover{background:rgba(255,255,255,.04)}\n.nova-member-avatar{width:40px;height:40px;border-radius:50%;flex-shrink:0;object-fit:cover;background:linear-gradient(135deg,#6d28d9,#3A9FD9);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;}\n.nova-member-text{min-width:0;flex:1;}\n.nova-member-name{font-family:'Poppins',sans-serif;font-weight:600;font-size:14.5px;margin-bottom:2px;}\n.nova-member-preview{font-size:12.5px;opacity:.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}\n.nova-member-preview.unread{font-weight:800;opacity:1;font-size:13.5px;color:#fff;}\n#chat-tab-group.unread,#chat-tab-indiv.unread{font-weight:700}\n.nova-activity-row{display:flex;justify-content:space-between;padding:8px 4px;font-size:13px;border-bottom:1px solid rgba(184,188,194,.08)}\n.nova-activity-row span:last-child{opacity:.6}\n.res-card{aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;text-align:center;padding:14px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(184,188,194,.14);cursor:pointer;font-size:16px;font-weight:700;word-break:break-word}\n.res-card:hover{background:rgba(255,255,255,.09)}\n.res-item{padding:10px 14px;border-radius:8px;background:rgba(255,255,255,.05);font-size:14px;word-break:break-word}\n.res-item a{color:#a78bfa}\n.res-card{position:relative}\n.res-del{position:absolute;top:6px;right:8px;font-size:14px;opacity:.6;line-height:1}\n.res-del:hover{opacity:1;color:#ef4444}\n.res-item{position:relative;padding-right:34px}\n.res-item .res-del{top:8px;right:10px}\n.res-card-wide{aspect-ratio:auto!important;width:100%;height:120px;font-size:20px;}\n.res-card-empty{opacity:.55;font-weight:500;font-size:15px;border-style:dashed;}\n.res-card.dragging{opacity:.55;transform:scale(1.05);z-index:5;box-shadow:0 12px 30px #000a;touch-action:none;}\n.res-edit{position:absolute;top:6px;left:8px;font-size:13px;opacity:.6;}\n.res-edit:hover{opacity:1;}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var existingKey = findExistingStorageKey();
    var clientOpts = existingKey ? { auth: { storageKey: existingKey } } : {};
    var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, clientOpts);

    var me = null;
    var members = [];
    var profilesCache = {};
    var avatarCache = {};
    var chefId = null;
    var currentConv = "group";
    var msgChannel = null;
    var readChannel = null;
    var lastRenderedMsgId = null;

    var navChat = document.getElementById("nav-chat");
    var navAdmin = document.getElementById("nav-admin");
    var tabGroup = document.getElementById("chat-tab-group");
    var tabIndiv = document.getElementById("chat-tab-indiv");
    var backRow = document.getElementById("chat-back-row");
    var memberListEl = document.getElementById("chat-member-list");
    var threadEl = document.getElementById("chat-thread");
    var headerEl = document.getElementById("chat-header");
    var msgsEl = document.getElementById("chat-messages");
    var formEl = document.getElementById("chat-form");
    var inputEl = document.getElementById("chat-input");
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

    function refreshBellBadge() {
      if (!bellBadge || me.role !== "chef") return;
      supabase.from("issue_reports").select("id", { count: "exact", head: true }).is("read_at", null).then(function (res) {
        bellBadge.style.display = (res && res.count > 0) ? "block" : "none";
      });
    }

    function renderReportsList() {
      if (!reportsListItems) return;
      supabase.from("issue_reports").select("id,content,created_at,read_at,sender_id").order("created_at", { ascending: false }).then(function (res) {
        if (res && res.error) { alert("Erreur : " + res.error.message); return; }
        var rows = (res && res.data) || [];
        reportsListItems.innerHTML = "";
        if (!rows.length) {
          reportsListItems.appendChild(el("div", { class: "empty-note" }, "Aucun signalement."));
        }
        rows.forEach(function (r) {
          var box = el("div", { class: "res-item" });
          var name = profilesCache[r.sender_id] || "Membre";
          box.appendChild(el("div", { style: "font-size:11px;opacity:.55;margin-bottom:4px;" }, name + " · " + new Date(r.created_at).toLocaleString("fr-FR")));
          box.appendChild(document.createTextNode(r.content));
          reportsListItems.appendChild(box);
        });
        var unreadIds = rows.filter(function (r) { return !r.read_at; }).map(function (r) { return r.id; });
        if (unreadIds.length) {
          supabase.from("issue_reports").update({ read_at: new Date().toISOString() }).in("id", unreadIds).then(function () {
            refreshBellBadge();
          });
        }
      });
    }

    if (bellBtn) {
      bellBtn.addEventListener("click", function () {
        if (!me || me.role !== "chef") return;
        renderReportsList();
        modalReportsList.classList.add("open");
      });
    }
    if (btnCloseReports) {
      btnCloseReports.addEventListener("click", function () {
        modalReportsList.classList.remove("open");
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

    if (!navChat || !msgsEl) return;

    function switchView(viewName, navEl) {
      document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
      navEl.classList.add("active");
      document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
      var v = document.getElementById("view-" + viewName);
      if (v) v.classList.add("active");
    }

    navChat.addEventListener("click", function () {
      switchView("chat", navChat);
      navChat.classList.remove("unread-nav");
    });
    if (navResources) {
      navResources.addEventListener("click", function () {
        switchView("resources", navResources);
        backToGrid();
      });
    }
    if (navAdmin) {
      navAdmin.addEventListener("click", function () {
        watchTeamList();
        setTimeout(decorateTeamList, 300);
      });
    }

    function showThread() {
      backRow.style.display = "none";
      memberListEl.style.display = "none";
      threadEl.style.display = "flex";
    }
    function showMemberList() {
      backRow.style.display = "none";
      memberListEl.style.display = "block";
      threadEl.style.display = "none";
    }

    tabGroup.addEventListener("click", function () {
      tabGroup.classList.add("active"); tabIndiv.classList.remove("active");
      showThread();
      openConv("group", "Groupe");
    });
    tabIndiv.addEventListener("click", function () {
      tabIndiv.classList.add("active"); tabGroup.classList.remove("active");
      if (me.role !== "chef") {
        backRow.style.display = "none";
        showThread();
        openConv(me.id, members[0] ? members[0].pseudo : "Chef");
      } else {
        renderMemberList();
      }
    });
    backRow.addEventListener("click", function () {
      renderMemberList();
    });

    function initials(name) {
      return (name || "?").trim().slice(0, 2).toUpperCase();
    }

    function fmtTime(ts) {
      return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    }

    function getConvSummary(convId, otherId) {
      return supabase.from("messages").select("content,sender_id,read_at,created_at").eq("conversation_id", convId)
        .order("created_at", { ascending: false }).limit(1).then(function (res) {
          var row = res && res.data && res.data[0];
          if (!row) return { preview: "Aucun message", unread: false, lastAt: null };
          var preview = row.content.length > 38 ? row.content.slice(0, 38) + "…" : row.content;
          var unread = row.sender_id === otherId && !row.read_at;
          return { preview: preview, unread: unread, lastAt: row.created_at };
        });
    }

    function renderMemberList() {
      showMemberList();
      memberListEl.innerHTML = "";
      Promise.all(members.map(function (m) {
        var convId = me.role === "chef" ? m.id : me.id;
        var otherId = me.role === "chef" ? m.id : chefId;
        return getConvSummary(convId, otherId).then(function (summary) {
          return { member: m, summary: summary };
        });
      })).then(function (entries) {
        entries.sort(function (a, b) {
          var ta = a.summary.lastAt ? new Date(a.summary.lastAt).getTime() : 0;
          var tb = b.summary.lastAt ? new Date(b.summary.lastAt).getTime() : 0;
          return tb - ta;
        });
        entries.forEach(function (entry) {
          var m = entry.member, summary = entry.summary;
          var row = el("div", { class: "nova-member-row-v2" });
          var avatar = m.photo_url
            ? el("img", { class: "nova-member-avatar", src: m.photo_url })
            : el("div", { class: "nova-member-avatar" }, initials(m.pseudo));
          var textWrap = el("div", { class: "nova-member-text" });
          textWrap.appendChild(el("div", { class: "nova-member-name" }, m.pseudo));
          textWrap.appendChild(el("div", { class: "nova-member-preview" + (summary.unread ? " unread" : "") }, summary.preview));
          row.appendChild(avatar);
          row.appendChild(textWrap);
          row.addEventListener("click", function () {
            backRow.style.display = "block";
            threadEl.style.display = "flex";
            memberListEl.style.display = "none";
            openConv(m.id, m.pseudo);
          });
          memberListEl.appendChild(row);
        });
      });
    }

    function avatarFor(userId) {
      var url = userId === me.id ? me.photo_url : (avatarCache[userId] || null);
      return url
        ? el("img", { class: "nova-msg-avatar", src: url })
        : el("div", { class: "nova-msg-avatar" }, initials(profilesCache[userId] || "?"));
    }

    function renderMsg(m) {
      var mine = m.sender_id === me.id;
      var row = el("div", { class: "nova-msg-row" + (mine ? " me" : "") });
      row.appendChild(avatarFor(m.sender_id));
      var col = el("div", { class: "nova-msg-col" });
      var wrap = el("div", { class: "nova-msg " + (mine ? "me" : "other") });
      if (!mine && currentConv === "group") {
        wrap.appendChild(el("div", { class: "nova-msg-sender" }, profilesCache[m.sender_id] || "..."));
      }
      wrap.appendChild(document.createTextNode(m.content));
      col.appendChild(wrap);
      col.appendChild(el("div", { class: "nova-msg-time" }, fmtTime(m.created_at)));
      row.appendChild(col);
      msgsEl.appendChild(row);
      lastRenderedMsgId = m.id;
      return row;
    }

    function renderVuFor(message) {
      var old = document.getElementById("nova-vu-line");
      if (old) old.remove();
      if (!message || message.sender_id !== me.id) return;
      var lastRow = msgsEl.lastElementChild;
      var col = lastRow && lastRow.querySelector(".nova-msg-col");
      if (!col) return;

      if (currentConv === "group") {
        supabase.from("message_reads").select("user_id,read_at").eq("message_id", message.id).then(function (res) {
          var rows = ((res && res.data) || []).filter(function (r) { return r.user_id !== me.id; });
          if (!rows.length) return;
          var line = el("div", { id: "nova-vu-line", class: "nova-msg-vu" }, "Lu");
          line.addEventListener("click", function () {
            var names = rows.map(function (r) { return (profilesCache[r.user_id] || "?") + " à " + fmtTime(r.read_at); }).join(", ");
            line.textContent = "Lu par : " + names;
          });
          col.appendChild(line);
        });
      } else {
        if (message.read_at) {
          col.appendChild(el("div", { id: "nova-vu-line", class: "nova-msg-vu" }, "Lu à " + fmtTime(message.read_at)));
        }
      }
    }

    function markReadForConv(convId, rows) {
      var others = rows.filter(function (r) { return r.sender_id !== me.id; });
      if (!others.length) return;
      if (convId === "group") {
        var payload = others.map(function (r) { return { message_id: r.id, user_id: me.id }; });
        supabase.from("message_reads").upsert(payload, { onConflict: "message_id,user_id" }).then(function () {});
      } else {
        var ids = others.filter(function (r) { return !r.read_at; }).map(function (r) { return r.id; });
        if (ids.length) supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", ids).then(function () {});
      }
    }

    function openConv(convId, label) {
      currentConv = convId;
      headerEl.textContent = label;
      msgsEl.innerHTML = "";
      if (msgChannel) supabase.removeChannel(msgChannel);
      if (readChannel) supabase.removeChannel(readChannel);

      supabase.from("messages").select("*").eq("conversation_id", convId).order("created_at", { ascending: true }).limit(200)
        .then(function (res) {
          var rows = (res && res.data) || [];
          rows.forEach(renderMsg);
          msgsEl.scrollTop = msgsEl.scrollHeight;
          if (rows.length) renderVuFor(rows[rows.length - 1]);
          markReadForConv(convId, rows);
        });

      msgChannel = supabase.channel("nova-msgs-" + convId)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "conversation_id=eq." + convId }, function (payload) {
          renderMsg(payload.new);
          msgsEl.scrollTop = msgsEl.scrollHeight;
          renderVuFor(payload.new);
          markReadForConv(convId, [payload.new]);
        })
        .subscribe();

      readChannel = supabase.channel("nova-reads-" + convId)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reads" }, function () {
          if (lastRenderedMsgId) {
            supabase.from("messages").select("*").eq("id", lastRenderedMsgId).single().then(function (r) {
              if (r && r.data) renderVuFor(r.data);
            });
          }
        })
        .subscribe();
    }

    formEl.addEventListener("submit", function (e) {
      e.preventDefault();
      var content = inputEl.value.trim();
      if (!content || !me) return;
      inputEl.value = "";
      supabase.from("messages").insert({ conversation_id: currentConv, sender_id: me.id, content: content }).then(function () {});
    });

    function checkUnreadDM(memberId) {
      var convId = me.role === "chef" ? memberId : me.id;
      var otherId = me.role === "chef" ? memberId : chefId;
      return supabase.from("messages").select("id", { count: "exact", head: true })
        .eq("conversation_id", convId).eq("sender_id", otherId).is("read_at", null)
        .then(function (res) { return (res && res.count) > 0; });
    }

    function checkUnreadGroup() {
      return supabase.from("messages").select("id").eq("conversation_id", "group").neq("sender_id", me.id).then(function (allRes) {
        var allIds = ((allRes && allRes.data) || []).map(function (r) { return r.id; });
        if (!allIds.length) return false;
        return supabase.from("message_reads").select("message_id").eq("user_id", me.id).in("message_id", allIds).then(function (readRes) {
          var readIds = ((readRes && readRes.data) || []).map(function (r) { return r.message_id; });
          return allIds.length > readIds.length;
        });
      });
    }

    function refreshUnreadBadge() {
      checkUnreadGroup().then(function (unread) {
        if (unread && currentConv !== "group") {
          tabGroup.classList.add("unread");
          navChat.classList.add("unread-nav");
        } else {
          tabGroup.classList.remove("unread");
        }
      });
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
      if (!resGrid) { console.log("[NOVA ressources] resGrid introuvable dans le DOM"); return; }
      console.log("[NOVA ressources] chargement, role =", me && me.role, "user =", me && me.id);
      supabase.from("resource_categories").select("id,title,is_pinned").order("is_pinned", { ascending: false }).order("sort_order").order("created_at").then(function (res) {
        console.log("[NOVA ressources] résultat requête :", res);
        if (res && res.error) { console.error("[NOVA ressources]", res.error); alert("Erreur ressources : " + res.error.message); return; }
        var rows = (res && res.data) || [];
        console.log("[NOVA ressources] nombre de cartes reçues :", rows.length);
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
      if (!teamListEl || me.role !== "chef") { console.log("[NOVA activité] arrêt : role =", me && me.role); return; }
      var buttons = teamListEl.querySelectorAll("button[data-uid]");
      var ids = Array.prototype.map.call(buttons, function (b) { return b.getAttribute("data-uid"); });
      console.log("[NOVA activité] boutons trouvés :", buttons.length, ids);
      if (!ids.length) return;
      supabase.from("profiles").select("id,last_seen_at").in("id", ids).then(function (res) {
        console.log("[NOVA activité] résultat requête :", res);
        if (!res || res.error) return;
        var map = {};
        res.data.forEach(function (p) { map[p.id] = p.last_seen_at; });
        Array.prototype.forEach.call(buttons, function (btn) {
          var uid = btn.getAttribute("data-uid");
          var row = btn.closest(".team-row");
          if (!row) return;
          var info = row.querySelector(".team-row-info");
          if (!info) return;
          var line = info.querySelector(".nova-activity-line");
          if (!line) {
            line = el("div", { class: "nova-activity-line" });
            line.style.cssText = "font-size:12px;opacity:.55;margin-top:2px;";
            info.appendChild(line);
          }
          line.textContent = activityLabel(map[uid]);
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
      supabase.from("profiles").select("id,role,pseudo").eq("id", userId).single().then(function (res) {
        if (!res || !res.data) return;
        me = res.data;
        profilesCache[me.id] = me.pseudo;

        supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", me.id).then(function () {});
        setInterval(function () {
          supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", me.id).then(function () {});
        }, 60000);

        var loadMembers = me.role === "chef"
          ? supabase.from("profiles").select("id,pseudo,role,photo_url").eq("role", "setter").eq("is_active", true).order("pseudo")
          : supabase.from("profiles").select("id,pseudo,role,photo_url").eq("role", "chef").limit(1);

        loadMembers.then(function (res2) {
          members = (res2 && res2.data) || [];
          members.forEach(function (m) { profilesCache[m.id] = m.pseudo; });
          if (me.role !== "chef" && members[0]) chefId = members[0].id;
          if (me.role === "chef") chefId = me.id;
          if (me.role !== "chef" && members[0]) tabIndiv.textContent = members[0].pseudo;

          openConv("group", "Groupe");
          refreshUnreadBadge();
          watchTeamList();
          refreshBellBadge();
          if (me.role === "chef") {
            supabase.channel("nova-issue-reports")
              .on("postgres_changes", { event: "INSERT", schema: "public", table: "issue_reports" }, function () {
                refreshBellBadge();
              })
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
