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

  function fmtDateStr(s) {
    if (!s) return "";
    var parts = String(s).slice(0, 10).split("-");
    if (parts.length !== 3) return s;
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  function initials(name) {
    return (name || "?").trim().slice(0, 2).toUpperCase();
  }

  window.ZenoaContracts = window.ZenoaContracts || {};
  var STATUS_LABELS = { draft: "Brouillon", sent: "Envoyé", signed: "Signé", returned: "Retourné" };
  var STATUS_COLORS = { draft: "#8a84a0", sent: "#bf5af2", signed: "#d4af37", returned: "#4FBF7A" };
  window.ZenoaContracts.STATUS_LABELS = STATUS_LABELS;
  window.ZenoaContracts.STATUS_COLORS = STATUS_COLORS;
  window.ZenoaContracts.fmtDateTime = fmtDateTime;

  function buildContractContent(data) {
    var lines = [];
    lines.push("CONTRAT DE COLLABORATION COMMERCIALE");
    lines.push("");
    lines.push("Entre ZENOA (ci-après \"l'Agence\") et " + data.pseudo + " (ci-après \"le Setter\").");
    lines.push("");
    lines.push("Il a été convenu ce qui suit :");
    lines.push("");
    lines.push("Article 1 — Poste");
    lines.push("Le Setter occupera le poste de : " + (data.position || "Setter"));
    lines.push("");
    lines.push("Article 2 — Rémunération");
    lines.push("Le Setter percevra une commission de " + data.percentage + "% sur chaque vente réalisée grâce à son activité de prospection.");
    lines.push("");
    lines.push("Article 3 — Durée");
    lines.push("Le présent contrat est conclu pour une durée de " + data.duration + ", à compter du " + fmtDateStr(data.start_date) + ".");
    lines.push("");
    lines.push("Article 4 — Période d'essai");
    lines.push(data.trial_period ? "Une période d'essai de " + data.trial_period + " est prévue." : "Aucune période d'essai n'est prévue.");
    lines.push("");
    lines.push("Article 5 — Préavis");
    lines.push(data.notice_period ? "En cas de résiliation, un préavis de " + data.notice_period + " devra être respecté." : "Aucun préavis spécifique n'est requis.");
    lines.push("");
    lines.push("Article 6 — Confidentialité");
    lines.push(data.confidentiality ? "Le Setter s'engage à respecter la confidentialité des informations de l'Agence et de ses clients, pendant toute la durée du contrat et après sa résiliation." : "Aucune clause de confidentialité spécifique n'est applicable.");
    lines.push("");
    lines.push("Article 7 — Notes complémentaires");
    lines.push(data.notes || "Aucune.");
    lines.push("");
    lines.push("Fait le " + fmtDateStr(new Date().toISOString()) + ", en deux exemplaires.");
    return lines.join("\n");
  }
  window.ZenoaContracts.buildContractContent = buildContractContent;

  var CSS = "\n.nova-contract-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 16px;cursor:pointer;border-bottom:1px solid rgba(199,194,219,.10);}\n.nova-contract-row:hover{background:rgba(255,255,255,.04);}\n.nova-contract-body{min-width:0;}\n.nova-contract-name{font-family:'Poppins',sans-serif;font-weight:600;font-size:14.5px;margin-bottom:2px;}\n.nova-contract-date{font-size:12px;opacity:.55;}\n.nova-contract-status{font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;border:1px solid;flex-shrink:0;}\n";

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var supabase = getSupabaseClient();
    var me = null;

    var navAdministratif = document.getElementById("nav-administratif");
    var adminFoldersPanel = document.getElementById("admin-folders-panel");
    var adminFoldersPanelGrid = document.getElementById("admin-folders-panel-grid");
    var adminFolderContracts = document.getElementById("admin-folder-contracts");
    var adminContractsPanel = document.getElementById("admin-contracts-panel");
    var btnBackAdminFolders = document.getElementById("btn-back-admin-folders");
    var btnGenerateContract = document.getElementById("btn-generate-contract");
    var contractsListEl = document.getElementById("contracts-list");
    var contractDetailEl = document.getElementById("contract-detail");
    var btnBackContractsList = document.getElementById("btn-back-contracts-list");
    var contractDetailMeta = document.getElementById("contract-detail-meta");
    var contractDetailContent = document.getElementById("contract-detail-content");
    var btnSendContract = document.getElementById("btn-send-contract");
    var btnDeleteContract = document.getElementById("btn-delete-contract");

    var adminFolderCodes = document.getElementById("admin-folder-codes");
    var adminCodesPanel = document.getElementById("admin-codes-panel");
    var btnBackAdminFoldersCodes = document.getElementById("btn-back-admin-folders-codes");
    var codesListEl = document.getElementById("codes-list");

    var modalGenerateContract = document.getElementById("modal-generate-contract");
    var contractPseudo = document.getElementById("contract-pseudo");
    var contractPseudoSuggestions = document.getElementById("contract-pseudo-suggestions");
    var contractPosition = document.getElementById("contract-position");
    var contractPercentage = document.getElementById("contract-percentage");
    var contractDuration = document.getElementById("contract-duration");
    var contractStartDate = document.getElementById("contract-start-date");
    var contractTrial = document.getElementById("contract-trial");
    var contractNotice = document.getElementById("contract-notice");
    var contractConfidentiality = document.getElementById("contract-confidentiality");
    var contractNotes = document.getElementById("contract-notes");
    var contractError = document.getElementById("contract-error");
    var btnCancelContract = document.getElementById("btn-cancel-contract");
    var btnConfirmContract = document.getElementById("btn-confirm-contract");

    if (!navAdministratif || !adminContractsPanel) return;

    var setterIndex = {}; // pseudo lower -> profile
    var currentContractId = null;

    function switchToView(viewName) {
      document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
      var navEl = document.querySelector('.nav-item[data-view="' + viewName + '"]');
      if (navEl) navEl.classList.add("active");
      document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
      var v = document.getElementById("view-" + viewName);
      if (v) v.classList.add("active");
    }

    function showFolders() {
      adminContractsPanel.style.display = "none";
      if (adminCodesPanel) adminCodesPanel.style.display = "none";
      if (adminFoldersPanel) adminFoldersPanel.style.display = "flex";
      if (adminFoldersPanelGrid) adminFoldersPanelGrid.style.display = "grid";
    }
    function showContractsPanel() {
      if (adminFoldersPanel) adminFoldersPanel.style.display = "none";
      if (adminFoldersPanelGrid) adminFoldersPanelGrid.style.display = "none";
      if (adminCodesPanel) adminCodesPanel.style.display = "none";
      adminContractsPanel.style.display = "block";
      showContractsList();
      renderContractsList();
    }
    function showContractsList() {
      contractDetailEl.style.display = "none";
      contractsListEl.style.display = "block";
    }
    function showContractDetail() {
      contractsListEl.style.display = "none";
      contractDetailEl.style.display = "block";
    }
    function showCodesPanel() {
      if (adminFoldersPanel) adminFoldersPanel.style.display = "none";
      if (adminFoldersPanelGrid) adminFoldersPanelGrid.style.display = "none";
      adminContractsPanel.style.display = "none";
      if (adminCodesPanel) adminCodesPanel.style.display = "block";
      renderCodesList();
    }

    navAdministratif.addEventListener("click", function () {
      switchToView("administratif");
      showFolders();
    });
    if (adminFolderContracts) adminFolderContracts.addEventListener("click", showContractsPanel);
    if (btnBackAdminFolders) btnBackAdminFolders.addEventListener("click", showFolders);
    if (btnBackContractsList) {
      btnBackContractsList.addEventListener("click", function () {
        currentContractId = null;
        showContractsList();
        renderContractsList();
      });
    }
    if (adminFolderCodes) adminFolderCodes.addEventListener("click", showCodesPanel);
    if (btnBackAdminFoldersCodes) btnBackAdminFoldersCodes.addEventListener("click", showFolders);

    function renderCodesList() {
      if (!codesListEl) return;
      codesListEl.innerHTML = "";
      supabase.from("profiles").select("id,pseudo,photo_url,code").eq("is_active", true).order("pseudo")
        .then(function (res) {
          if (res && res.error) { codesListEl.appendChild(el("div", { class: "empty-note" }, "Erreur : " + res.error.message)); return; }
          var rows = (res && res.data) || [];
          if (!rows.length) { codesListEl.appendChild(el("div", { class: "empty-note" }, "Aucun membre actif.")); return; }
          rows.forEach(function (p) {
            var row = el("div", { class: "team-row glass-card" });
            var avatar = el("div", { class: "avatar", style: "cursor:default;" });
            if (p.photo_url) avatar.appendChild(el("img", { src: p.photo_url }));
            else avatar.appendChild(el("span", {}, initials(p.pseudo)));
            row.appendChild(avatar);
            var info = el("div", { class: "team-row-info" });
            info.appendChild(el("div", { class: "team-row-name" }, p.pseudo || "Compte incomplet"));
            info.appendChild(el("div", { class: "team-row-meta" }, p.code ? ("Code : " + p.code) : "Aucun code enregistré"));
            row.appendChild(info);
            codesListEl.appendChild(row);
          });
        });
    }

    function loadSetters() {
      return supabase.from("profiles").select("id,pseudo,custom_role").eq("is_active", true).neq("role", "chef").then(function (res) {
        setterIndex = {};
        contractPseudoSuggestions.innerHTML = "";
        ((res && res.data) || []).forEach(function (p) {
          setterIndex[(p.pseudo || "").trim().toLowerCase()] = p;
          contractPseudoSuggestions.appendChild(el("option", { value: p.pseudo }));
        });
      });
    }

    if (btnGenerateContract) {
      btnGenerateContract.addEventListener("click", function () {
        contractError.textContent = "";
        contractPseudo.value = "";
        contractPosition.value = "";
        contractPercentage.value = "";
        contractDuration.value = "";
        contractStartDate.value = new Date().toISOString().slice(0, 10);
        contractTrial.value = "";
        contractNotice.value = "";
        contractConfidentiality.checked = false;
        contractNotes.value = "";
        loadSetters().then(function () {
          modalGenerateContract.classList.add("open");
        });
      });
    }
    if (btnCancelContract) {
      btnCancelContract.addEventListener("click", function () {
        modalGenerateContract.classList.remove("open");
      });
    }

    if (btnConfirmContract) {
      btnConfirmContract.addEventListener("click", function () {
        contractError.textContent = "";
        var pseudo = (contractPseudo.value || "").trim();
        var target = setterIndex[pseudo.toLowerCase()];
        if (!target) { contractError.textContent = "Choisis un membre existant dans la liste."; return; }
        var percentage = parseFloat(contractPercentage.value);
        if (isNaN(percentage) || percentage < 0) { contractError.textContent = "Indique un pourcentage valide."; return; }
        var duration = (contractDuration.value || "").trim();
        if (!duration) { contractError.textContent = "Indique une durée de contrat."; return; }
        var startDate = contractStartDate.value;
        if (!startDate) { contractError.textContent = "Indique une date de début."; return; }

        var data = {
          pseudo: target.pseudo,
          position: (contractPosition.value || "").trim() || target.custom_role || "Setter",
          percentage: percentage,
          duration: duration,
          start_date: startDate,
          trial_period: (contractTrial.value || "").trim(),
          notice_period: (contractNotice.value || "").trim(),
          confidentiality: !!contractConfidentiality.checked,
          notes: (contractNotes.value || "").trim()
        };
        var content = buildContractContent(data);

        btnConfirmContract.disabled = true;
        supabase.from("team_contracts").insert({
          created_by: me.id,
          setter_id: target.id,
          pseudo: data.pseudo,
          position: data.position,
          percentage: data.percentage,
          duration: data.duration,
          start_date: data.start_date,
          trial_period: data.trial_period || null,
          notice_period: data.notice_period || null,
          confidentiality: data.confidentiality,
          notes: data.notes || null,
          content: content,
          status: "draft"
        }).then(function (res) {
          btnConfirmContract.disabled = false;
          if (res && res.error) { contractError.textContent = "Erreur : " + res.error.message; return; }
          modalGenerateContract.classList.remove("open");
          renderContractsList();
        });
      });
    }

    function renderContractsList() {
      if (!contractsListEl) return;
      contractsListEl.innerHTML = "";
      supabase.from("team_contracts").select("id,pseudo,status,created_at").eq("created_by", me.id)
        .order("created_at", { ascending: false }).then(function (res) {
          if (res && res.error) { contractsListEl.appendChild(el("div", { class: "empty-note" }, "Erreur : " + res.error.message)); return; }
          var rows = (res && res.data) || [];
          if (!rows.length) { contractsListEl.appendChild(el("div", { class: "empty-note" }, "Aucun contrat généré pour le moment.")); return; }
          rows.forEach(function (r) {
            var row = el("div", { class: "nova-contract-row" });
            var body = el("div", { class: "nova-contract-body" });
            body.appendChild(el("div", { class: "nova-contract-name" }, r.pseudo || "?"));
            body.appendChild(el("div", { class: "nova-contract-date" }, fmtDateTime(r.created_at)));
            row.appendChild(body);
            var color = STATUS_COLORS[r.status] || "#8a84a0";
            var tag = el("span", { class: "nova-contract-status" }, STATUS_LABELS[r.status] || r.status);
            tag.style.color = color;
            tag.style.borderColor = color + "59";
            tag.style.background = color + "14";
            row.appendChild(tag);
            row.addEventListener("click", function () { openContractDetail(r.id); });
            contractsListEl.appendChild(row);
          });
        });
    }

    function openContractDetail(id) {
      currentContractId = id;
      showContractDetail();
      contractDetailContent.textContent = "Chargement...";
      contractDetailMeta.textContent = "";
      btnSendContract.style.display = "none";
      supabase.from("team_contracts").select("*").eq("id", id).single().then(function (res) {
        if (!res || !res.data) { contractDetailContent.textContent = "Contrat introuvable."; return; }
        var c = res.data;
        var metaParts = ["Pour " + (c.pseudo || "?"), "Généré le " + fmtDateTime(c.created_at), "Statut : " + (STATUS_LABELS[c.status] || c.status)];
        if (c.status === "signed" || c.status === "returned") {
          metaParts.push("Signé par " + (c.signature_name || "?") + " le " + fmtDateTime(c.signed_at));
        }
        if (c.status === "returned") {
          metaParts.push("Retourné le " + fmtDateTime(c.returned_at));
        }
        contractDetailMeta.textContent = metaParts.join(" · ");
        contractDetailContent.textContent = c.content;
        btnSendContract.style.display = c.status === "draft" ? "inline-flex" : "none";
      });
    }

    if (btnSendContract) {
      btnSendContract.addEventListener("click", function () {
        if (!currentContractId) return;
        btnSendContract.disabled = true;
        supabase.from("team_contracts").select("setter_id").eq("id", currentContractId).single().then(function (res) {
          if (!res || !res.data) { btnSendContract.disabled = false; return; }
          var setterId = res.data.setter_id;
          supabase.from("team_contracts").update({ status: "sent" }).eq("id", currentContractId).then(function (res2) {
            if (res2 && res2.error) { btnSendContract.disabled = false; alert("Erreur : " + res2.error.message); return; }
            supabase.from("boxmails").insert({
              sender_id: me.id,
              recipient_id: setterId,
              content: "📄 Nouveau contrat à consulter et signer.",
              contract_id: currentContractId
            }).then(function (res3) {
              btnSendContract.disabled = false;
              if (res3 && res3.error) { alert("Erreur : " + res3.error.message); return; }
              openContractDetail(currentContractId);
            });
          });
        });
      });
    }

    if (btnDeleteContract) {
      btnDeleteContract.addEventListener("click", function () {
        if (!currentContractId) return;
        zenoaConfirm("Supprimer définitivement ce contrat ?").then(function (ok) {
          if (!ok) return;
          supabase.from("team_contracts").delete().eq("id", currentContractId).then(function (res) {
            if (res && res.error) { alert("Erreur : " + res.error.message); return; }
            currentContractId = null;
            showContractsList();
            renderContractsList();
          });
        });
      });
    }

    var booted = false;
    function boot(userId) {
      if (booted) return;
      booted = true;
      supabase.from("profiles").select("id,role,pseudo").eq("id", userId).single().then(function (res) {
        if (!res || !res.data) return;
        me = res.data;
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
