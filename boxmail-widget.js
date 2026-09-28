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
    return new Date(ts).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function initials(name) {
    return (name || "?").trim().slice(0, 2).toUpperCase();
  }

  var CSS = "\n.nova-boxmail-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;margin-left:8px;vertical-align:middle;line-height:18px;}\n.nav-item.unread-nav{font-weight:700;}\n#boxmail-tab-inbox.unread,#boxmail-tab-send.unread{font-weight:700;}\n.nova-boxmail-row{display:flex;align-items:center;gap:12px;padding:13px 4px;cursor:pointer;border-bottom:1px solid rgba(199,194,219,.10);}\n.nova-boxmail-row:hover{background:rgba(255,255,255,.04);}\n.nova-boxmail-avatar{width:38px;height:38px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#BF5AF2,#300A66);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;}\n.nova-boxmail-text{min-width:0;flex:1;}\n.nova-boxmail-sender{font-family:'Poppins',sans-serif;font-weight:500;font-size:14px;margin-bottom:2px;}\n.nova-boxmail-sender.unread{font-weight:800;}\n.nova-boxmail-preview{font-size:12.5px;opacity:.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}\n.nova-boxmail-preview.unread{font-weight:700;opacity:1;}\n.nova-boxmail-time{font-size:11px;opacity:.5;flex-shrink:0;}\n.nova-boxmail-empty{opacity:.55;font-size:14px;padding:18px 4px;}\n#boxmail-to-dropdown{position:absolute;top:100%;left:0;right:0;margin-top:4px;max-height:260px;overflow-y:auto;background:var(--bg-panel);border:1px solid rgba(199,194,219,.18);border-radius:10px;box-shadow:0 12px 30px #00000080;z-index:20;}\n#boxmail-to-dropdown .nova-member-row-v2{border-bottom:1px solid rgba(199,194,219,.08);}\n#boxmail-to-dropdown .nova-member-row-v2:last-child{border-bottom:none;}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var supabase = getSupabaseClient();

    var me = null;
    var pseudoIndex = {}; // pseudo (lowercase) -> {id, pseudo}
    var profilesCache = {}; // id -> pseudo
    var currentDetailId = null;
    var boxmailChannel = null;

    var navBoxmail = document.getElementById("nav-boxmail");
    var navBadge = document.getElementById("boxmail-nav-badge");
    var tabBadge = document.getElementById("boxmail-tab-badge");
    var tabSend = document.getElementById("boxmail-tab-send");
    var tabInbox = document.getElementById("boxmail-tab-inbox");
    var sendPanel = document.getElementById("boxmail-send-panel");
    var inboxPanel = document.getElementById("boxmail-inbox-panel");
    var inboxList = document.getElementById("boxmail-inbox-list");
    var detailPanel = document.getElementById("boxmail-detail");
    var detailBack = document.getElementById("boxmail-detail-back");
    var detailMeta = document.getElementById("boxmail-detail-meta");
    var detailContent = document.getElementById("boxmail-detail-content");
    var validateBtn = document.getElementById("boxmail-validate-btn");
    var toInput = document.getElementById("boxmail-to");
    var toDropdown = document.getElementById("boxmail-to-dropdown");
    var contentInput = document.getElementById("boxmail-content");
    var sendBtn = document.getElementById("boxmail-send-btn");
    var sendError = document.getElementById("boxmail-send-error");
    var sendSuccess = document.getElementById("boxmail-send-success");
    var broadcastField = document.getElementById("boxmail-broadcast-field");
    var broadcastCheck = document.getElementById("boxmail-broadcast");
    var toField = document.getElementById("boxmail-to-field");

    if (!navBoxmail || !inboxList) return;

    function switchToBoxmailView() {
      document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
      navBoxmail.classList.add("active");
      navBoxmail.classList.remove("unread-nav");
      document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
      var v = document.getElementById("view-boxmail");
      if (v) v.classList.add("active");
    }

    function showSendPanel() {
      tabSend.classList.add("active"); tabInbox.classList.remove("active");
      sendPanel.style.display = "block";
      inboxPanel.style.display = "none";
    }
    function showInboxPanel() {
      tabInbox.classList.add("active"); tabSend.classList.remove("active");
      sendPanel.style.display = "none";
      inboxPanel.style.display = "block";
      showList();
      renderInbox();
    }
    function showList() {
      detailPanel.style.display = "none";
      inboxList.style.display = "block";
    }
    function showDetail() {
      inboxList.style.display = "none";
      detailPanel.style.display = "block";
    }

    navBoxmail.addEventListener("click", function () {
      switchToBoxmailView();
      showInboxPanel();
    });
    tabSend.addEventListener("click", showSendPanel);
    tabInbox.addEventListener("click", showInboxPanel);
    detailBack.addEventListener("click", function () {
      currentDetailId = null;
      showList();
      renderInbox();
    });

    if (broadcastCheck && toField) {
      broadcastCheck.addEventListener("change", function () {
        toField.style.display = broadcastCheck.checked ? "none" : "block";
        if (broadcastField) broadcastField.classList.toggle("checked", broadcastCheck.checked);
      });
    }

    function refreshBadge() {
      if (!me) return;
      supabase.from("boxmails").select("id", { count: "exact", head: true })
        .eq("recipient_id", me.id).is("read_at", null).is("validated_at", null)
        .then(function (res) {
          var count = (res && res.count) || 0;
          if (count > 0) {
            navBadge.textContent = String(count);
            navBadge.style.display = "inline-flex";
            tabBadge.textContent = String(count);
            tabBadge.style.display = "inline-flex";
            var boxmailView = document.getElementById("view-boxmail");
            if (!boxmailView || !boxmailView.classList.contains("active")) {
              navBoxmail.classList.add("unread-nav");
            }
          } else {
            navBadge.style.display = "none";
            tabBadge.style.display = "none";
            navBoxmail.classList.remove("unread-nav");
          }
        });
    }

    function renderInbox() {
      inboxList.innerHTML = "";
      supabase.from("boxmails").select("id,sender_id,content,created_at,read_at,contract_id")
        .eq("recipient_id", me.id).is("validated_at", null)
        .order("created_at", { ascending: false })
        .then(function (res) {
          if (res && res.error) { inboxList.appendChild(el("div", { class: "nova-boxmail-empty" }, "Erreur : " + res.error.message)); return; }
          var rows = (res && res.data) || [];
          if (!rows.length) {
            inboxList.appendChild(el("div", { class: "nova-boxmail-empty" }, "Aucun mail dans ta boîte de réception."));
            return;
          }
          rows.forEach(function (r) {
            var unread = !r.read_at;
            var senderName = profilesCache[r.sender_id] || "Membre";
            var row = el("div", { class: "nova-boxmail-row" });
            if (r.contract_id) row.appendChild(el("div", { class: "nova-boxmail-avatar" }, "📄"));
            else row.appendChild(el("div", { class: "nova-boxmail-avatar" }, initials(senderName)));
            var textWrap = el("div", { class: "nova-boxmail-text" });
            textWrap.appendChild(el("div", { class: "nova-boxmail-sender" + (unread ? " unread" : "") }, senderName));
            var preview = r.contract_id ? "Contrat équipe" : (r.content.length > 60 ? r.content.slice(0, 60) + "…" : r.content);
            textWrap.appendChild(el("div", { class: "nova-boxmail-preview" + (unread ? " unread" : "") }, preview));
            row.appendChild(textWrap);
            row.appendChild(el("div", { class: "nova-boxmail-time" }, fmtDateTime(r.created_at)));
            row.addEventListener("click", function () { openDetail(r); });
            inboxList.appendChild(row);
          });
        });
    }

    var contractActionsEl = null;
    function clearContractActions() {
      if (contractActionsEl) { contractActionsEl.remove(); contractActionsEl = null; }
    }

    function renderContractInDetail(contract, mailRow) {
      detailContent.textContent = contract.content;
      clearContractActions();
      contractActionsEl = el("div", { style: "margin-top:18px;display:flex;flex-direction:column;gap:12px;" });

      if (contract.status === "sent" && contract.setter_id === me.id) {
        var nameInput = el("input", { type: "text", placeholder: "Ton nom complet", value: me.pseudo || "" });
        nameInput.style.cssText = "width:100%;padding:10px 12px;border-radius:8px;border:1px solid rgba(199,194,219,.2);background:transparent;color:var(--metal-2);font-family:inherit;font-size:14px;box-sizing:border-box;";
        var checkLabel = el("label", { style: "display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;" });
        var check = el("input", { type: "checkbox" });
        checkLabel.appendChild(check);
        checkLabel.appendChild(document.createTextNode("Je certifie avoir lu et j'accepte les termes de ce contrat."));
        var errEl = el("div", { class: "error-msg" });
        var signBtn = el("button", { class: "btn primary btn-sm" }, "Signer le contrat");
        signBtn.addEventListener("click", function () {
          errEl.textContent = "";
          var name = nameInput.value.trim();
          if (!name) { errEl.textContent = "Indique ton nom pour signer."; return; }
          if (!check.checked) { errEl.textContent = "Coche la case pour accepter les termes."; return; }
          signBtn.disabled = true;
          supabase.from("team_contracts").update({ status: "signed", signature_name: name, signed_at: new Date().toISOString() }).eq("id", contract.id).then(function (res2) {
            signBtn.disabled = false;
            if (res2 && res2.error) { errEl.textContent = "Erreur : " + res2.error.message; return; }
            contract.status = "signed";
            contract.signature_name = name;
            contract.signed_at = new Date().toISOString();
            renderContractInDetail(contract, mailRow);
          });
        });
        contractActionsEl.appendChild(nameInput);
        contractActionsEl.appendChild(checkLabel);
        contractActionsEl.appendChild(errEl);
        contractActionsEl.appendChild(signBtn);
      } else if (contract.status === "signed" && contract.setter_id === me.id) {
        contractActionsEl.appendChild(el("div", { class: "info-msg" }, "✓ Signé par " + contract.signature_name + " le " + fmtDateTime(contract.signed_at) + "."));
        var returnBtn = el("button", { class: "btn primary btn-sm" }, "Renvoyer à Théo");
        returnBtn.addEventListener("click", function () {
          returnBtn.disabled = true;
          supabase.from("team_contracts").update({ status: "returned", returned_at: new Date().toISOString() }).eq("id", contract.id).then(function (res2) {
            if (res2 && res2.error) { alert("Erreur : " + res2.error.message); returnBtn.disabled = false; return; }
            supabase.from("boxmails").insert({
              sender_id: me.id,
              recipient_id: contract.created_by,
              content: "Contrat signé et retourné par " + (me.pseudo || "un setter") + ".",
              contract_id: contract.id
            }).then(function () {
              supabase.from("boxmails").update({ validated_at: new Date().toISOString() }).eq("id", mailRow.id).then(function () {
                currentDetailId = null;
                showList();
                renderInbox();
                refreshBadge();
              });
            });
          });
        });
        contractActionsEl.appendChild(returnBtn);
      } else if (contract.status === "returned") {
        contractActionsEl.appendChild(el("div", { class: "info-msg" }, "✓ Contrat signé par " + (contract.signature_name || "") + " et retourné le " + fmtDateTime(contract.returned_at) + "."));
      }

      detailContent.parentElement.appendChild(contractActionsEl);
    }

    function openDetail(r) {
      currentDetailId = r.id;
      showDetail();
      clearContractActions();
      var senderName = profilesCache[r.sender_id] || "Membre";
      detailMeta.textContent = "De " + senderName + " · " + fmtDateTime(r.created_at);

      if (r.contract_id) {
        validateBtn.style.display = "none";
        detailContent.textContent = "Chargement du contrat...";
        supabase.from("team_contracts").select("*").eq("id", r.contract_id).single().then(function (res) {
          if (!res || !res.data) { detailContent.textContent = "Ce contrat a été supprimé."; return; }
          renderContractInDetail(res.data, r);
        });
      } else {
        validateBtn.style.display = "";
        detailContent.textContent = r.content;
      }

      if (!r.read_at) {
        supabase.from("boxmails").update({ read_at: new Date().toISOString() }).eq("id", r.id).then(function () {
          refreshBadge();
        });
      }
    }

    validateBtn.addEventListener("click", function () {
      if (!currentDetailId) return;
      var id = currentDetailId;
      validateBtn.disabled = true;
      supabase.from("boxmails").update({ validated_at: new Date().toISOString() }).eq("id", id).then(function (res) {
        validateBtn.disabled = false;
        if (res && res.error) { alert("Erreur : " + res.error.message); return; }
        currentDetailId = null;
        showList();
        renderInbox();
        refreshBadge();
      });
    });

    sendBtn.addEventListener("click", function () {
      sendError.textContent = "";
      sendSuccess.textContent = "";
      var content = (contentInput.value || "").trim();
      if (!content) { sendError.textContent = "Écris un message."; return; }

      if (broadcastCheck && broadcastCheck.checked) {
        var recipients = Object.keys(pseudoIndex).map(function (k) { return pseudoIndex[k]; });
        if (!recipients.length) { sendError.textContent = "Aucun membre à qui envoyer."; return; }
        var rows = recipients.map(function (p) { return { sender_id: me.id, recipient_id: p.id, content: content }; });
        sendBtn.disabled = true;
        supabase.from("boxmails").insert(rows).then(function (res) {
          sendBtn.disabled = false;
          if (res && res.error) { sendError.textContent = "Erreur : " + res.error.message; return; }
          contentInput.value = "";
          sendSuccess.textContent = "Mail envoyé à toute l'équipe (" + recipients.length + " membres).";
        });
        return;
      }

      var pseudo = (toInput.value || "").trim();
      if (!pseudo) { sendError.textContent = "Indique le pseudo du destinataire."; return; }
      var target = pseudoIndex[pseudo.toLowerCase()];
      if (!target) { sendError.textContent = "Aucun membre avec ce pseudo."; return; }
      if (target.id === me.id) { sendError.textContent = "Tu ne peux pas t'envoyer un mail à toi-même."; return; }
      sendBtn.disabled = true;
      supabase.from("boxmails").insert({ sender_id: me.id, recipient_id: target.id, content: content }).then(function (res) {
        sendBtn.disabled = false;
        if (res && res.error) { sendError.textContent = "Erreur : " + res.error.message; return; }
        toInput.value = "";
        contentInput.value = "";
        sendSuccess.textContent = "Mail envoyé à " + target.pseudo + ".";
      });
    });

    function loadDirectory() {
      return supabase.from("profiles").select("id,pseudo,photo_url,custom_role,role").eq("is_active", true).then(function (res) {
        var rows = (res && res.data) || [];
        rows.forEach(function (p) {
          profilesCache[p.id] = p.pseudo;
          if (p.id === me.id) return;
          pseudoIndex[(p.pseudo || "").toLowerCase()] = p;
        });
      });
    }

    function hideToDropdown() {
      if (toDropdown) toDropdown.style.display = "none";
    }

    function renderToDropdown() {
      if (!toDropdown) return;
      var q = (toInput.value || "").trim().toLowerCase();
      var matches = Object.keys(pseudoIndex).map(function (k) { return pseudoIndex[k]; })
        .filter(function (p) { return !q || (p.pseudo || "").toLowerCase().indexOf(q) !== -1; })
        .sort(function (a, b) { return (a.pseudo || "").localeCompare(b.pseudo || ""); });

      toDropdown.innerHTML = "";
      if (!matches.length) { hideToDropdown(); return; }

      matches.forEach(function (p) {
        var row = el("div", { class: "nova-member-row-v2" });
        var avatar = p.photo_url
          ? el("img", { class: "nova-member-avatar", src: p.photo_url })
          : el("div", { class: "nova-member-avatar" }, initials(p.pseudo));
        row.appendChild(avatar);
        var textWrap = el("div", { class: "nova-member-text" });
        textWrap.appendChild(el("div", { class: "nova-member-name" }, p.pseudo));
        textWrap.appendChild(el("div", { class: "nova-member-preview" }, p.role === "chef" ? "Chef" : (p.custom_role || "Rôle non défini")));
        row.appendChild(textWrap);
        row.addEventListener("mousedown", function (e) {
          e.preventDefault();
          toInput.value = p.pseudo;
          hideToDropdown();
        });
        toDropdown.appendChild(row);
      });
      toDropdown.style.display = "block";
    }

    if (toInput) {
      toInput.addEventListener("focus", renderToDropdown);
      toInput.addEventListener("input", renderToDropdown);
      toInput.addEventListener("blur", function () { setTimeout(hideToDropdown, 150); });
    }

    var booted = false;
    function boot(userId) {
      if (booted) return;
      booted = true;
      supabase.from("profiles").select("id,pseudo,role").eq("id", userId).single().then(function (res) {
        if (!res || !res.data) return;
        me = res.data;
        profilesCache[me.id] = me.pseudo;
        if (broadcastField) broadcastField.style.display = me.role === "chef" ? "block" : "none";

        loadDirectory().then(function () {
          refreshBadge();

          boxmailChannel = supabase.channel("nova-boxmail-" + me.id)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "boxmails", filter: "recipient_id=eq." + me.id }, function () {
              refreshBadge();
              var boxmailView = document.getElementById("view-boxmail");
              if (boxmailView && boxmailView.classList.contains("active") && inboxPanel.style.display !== "none" && detailPanel.style.display === "none") {
                renderInbox();
              }
            })
            .subscribe();
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
