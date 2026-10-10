(function () {
  "use strict";

  var SUPABASE_URL = "https://mfdqxzccmzumxiichdqw.supabase.co";
  var SUPABASE_KEY = "sb_publishable_Qes5VQ0OcaAEVh_kMjej6A_HJ6yxY3T";

  // ===== Page Accueil : contenu éditable =====
  // Nouveautés affichées sur l'accueil (3 maximum). "view" est optionnel :
  // si renseigné (ex: "resources"), cliquer sur l'item ouvre cette page.
  var ACCUEIL_NEWS = [
    { date: "Oct.", titre: "Nouveau design de l'espace membre", view: null },
    { date: "Oct.", titre: "Page Ressources mise à jour", view: "resources" },
    { date: "Oct.", titre: "Calendrier disponible", view: "calendrier" }
  ];
  // Texte de la mission du moment, affiché à côté de la case à cocher.
  var ACCUEIL_MISSION_TEXT = "Termine ta première leçon du module en cours.";
  // DONNÉES DE TEST : la progression et la prochaine leçon ne sont pas
  // encore stockées en base (pas de table leçons/modules pour l'instant).
  // À brancher plus tard sur de vraies données (ex: tables "lessons" et
  // "user_lesson_progress") — en attendant, ces valeurs sont statiques.
  var ACCUEIL_TEST_PROGRESS = { done: 4, total: 12, module: "Module 2 — Les fondamentaux" };
  var ACCUEIL_TEST_NEXT_LESSON = { titre: "Structurer ton premier message", module: "Module 2 — Les fondamentaux", duree: "12 min" };

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

    // Pré-remplit le champ code si on arrive via le lien "Copier le lien"
    // généré depuis Accès et codes (admin) : .../?code=XXX-XXXXXX.
    try {
      var prefillCode = new URLSearchParams(window.location.search).get("code");
      var codeInputEl = document.getElementById("code-input");
      if (prefillCode && codeInputEl) {
        codeInputEl.value = prefillCode.toUpperCase();
        codeInputEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } catch (e) {}

    var settingsLogout = document.getElementById("settings-logout");
    var myAvatarInput = document.getElementById("my-avatar-input");
    var myRoleDisplayEl = document.getElementById("my-role-display");
    var settingsBtn = document.getElementById("settings-btn");
    var btnBackSettings = document.getElementById("btn-back-settings");

    // Pages admin : en plus d'être masquées du menu pour un élève
    // (déjà géré par .chef-only), on refuse ici le switch si quelqu'un
    // essayait de les forcer (ex: depuis la console du navigateur).
    // Ce n'est qu'une protection côté interface : la vraie sécurité est
    // dans les policies RLS (admin-panel.sql), qui bloquent aussi les
    // lectures/écritures même si l'affichage était contourné.
    var ADMIN_ONLY_VIEWS = ["tableau-de-bord", "eleves", "eleve-detail", "contenu", "module-detail", "acces-codes"];
    function switchToView(viewName) {
      if (ADMIN_ONLY_VIEWS.indexOf(viewName) !== -1 && !(me && me.role === "chef")) return;
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
    // Calendrier) et navigation chef (Tableau de bord, Élèves, Contenu,
    // Calendrier, Accès et codes) : chacune visible uniquement pour le
    // rôle correspondant, affichée/masquée dans boot() une fois le
    // rôle connu.
    document.querySelectorAll(".eleve-only[data-view], .chef-only[data-view]").forEach(function (navEl) {
      navEl.addEventListener("click", function () {
        document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
        navEl.classList.add("active");
        switchToView(navEl.getAttribute("data-view"));
      });
    });

    // Navigue vers une page via son item de menu (réutilise le clic déjà
    // câblé juste au-dessus, pour garder le surlignage du menu cohérent).
    function goToView(viewName) {
      var navEl = document.querySelector('.nav-item[data-view="' + viewName + '"]');
      if (navEl) navEl.click();
      else switchToView(viewName);
    }

    function showToast(message) {
      var toast = document.getElementById("toast");
      if (!toast) return;
      toast.textContent = message;
      toast.classList.add("show");
      clearTimeout(showToast._t);
      showToast._t = setTimeout(function () { toast.classList.remove("show"); }, 2600);
    }

    // ---------- Page Accueil ----------

    function renderAccueil() {
      if (!me) return;
      var nameEl = document.getElementById("accueil-welcome-name");
      if (nameEl) nameEl.textContent = me.pseudo || "";

      var p = ACCUEIL_TEST_PROGRESS;
      var pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
      var fill = document.getElementById("accueil-progress-fill");
      if (fill) fill.style.width = pct + "%";
      var progressText = document.getElementById("accueil-progress-text");
      if (progressText) progressText.textContent = p.done + (p.done > 1 ? " leçons terminées sur " : " leçon terminée sur ") + p.total;
      var progressPct = document.getElementById("accueil-progress-pct");
      if (progressPct) progressPct.textContent = pct + "%";
      var progressModule = document.getElementById("accueil-progress-module");
      if (progressModule) progressModule.textContent = p.module;

      var lessonTitle = document.getElementById("accueil-next-lesson-title");
      if (lessonTitle) lessonTitle.textContent = ACCUEIL_TEST_NEXT_LESSON.titre;
      var lessonMeta = document.getElementById("accueil-next-lesson-meta");
      if (lessonMeta) lessonMeta.textContent = ACCUEIL_TEST_NEXT_LESSON.module + " · " + ACCUEIL_TEST_NEXT_LESSON.duree;

      var missionText = document.getElementById("accueil-mission-text");
      if (missionText) missionText.textContent = ACCUEIL_MISSION_TEXT;
      var missionCheck = document.getElementById("accueil-mission-check");
      var missionRow = document.getElementById("accueil-mission-row");
      if (missionCheck) {
        missionCheck.checked = !!me.mission_done;
        if (missionRow) missionRow.classList.toggle("done", missionCheck.checked);
      }

      renderAccueilNews();
    }

    // Nouveautés affichées sur l'accueil : viennent de la table
    // home_news, gérée par l'admin depuis Contenu > Nouveautés. En
    // attendant le premier chargement (ou si la migration admin-panel.sql
    // n'a pas encore été exécutée), on affiche les 3 nouveautés d'origine
    // codées en dur, pour ne jamais laisser la page vide.
    var homeNewsList = ACCUEIL_NEWS.map(function (item) {
      return { date_label: item.date, title: item.titre, link_view: item.view };
    });
    var homeNewsLoaded = false;

    function loadHomeNews() {
      supabase.from("home_news").select("id,position,date_label,title,link_view").order("position").then(function (res) {
        if (res && res.data && res.data.length) homeNewsList = res.data;
        homeNewsLoaded = true;
        renderAccueilNews();
      });
    }

    function renderAccueilNews() {
      var newsList = document.getElementById("accueil-news-list");
      if (!newsList) return;
      newsList.innerHTML = "";
      homeNewsList.slice(0, 3).forEach(function (item) {
        var row = document.createElement("div");
        row.className = "accueil-news-item" + (item.link_view ? " clickable" : "");
        var dateEl = document.createElement("span");
        dateEl.className = "accueil-news-date";
        dateEl.textContent = item.date_label;
        var titleEl = document.createElement("span");
        titleEl.className = "accueil-news-title";
        titleEl.textContent = item.title;
        row.appendChild(dateEl);
        row.appendChild(titleEl);
        if (item.link_view) row.addEventListener("click", function () { goToView(item.link_view); });
        newsList.appendChild(row);
      });
    }

    var accueilMissionCheck = document.getElementById("accueil-mission-check");
    if (accueilMissionCheck) {
      accueilMissionCheck.addEventListener("change", function () {
        if (!me) return;
        me.mission_done = accueilMissionCheck.checked;
        var missionRow = document.getElementById("accueil-mission-row");
        if (missionRow) missionRow.classList.toggle("done", accueilMissionCheck.checked);
        supabase.from("profiles").update({ mission_done: accueilMissionCheck.checked }).eq("id", me.id).then(function (res) {
          if (res && res.error) alert("Erreur : " + res.error.message);
        });
      });
    }

    var accueilContinueBtn = document.getElementById("accueil-continue-btn");
    if (accueilContinueBtn) {
      accueilContinueBtn.addEventListener("click", function () { goToView("cours"); });
    }

    document.querySelectorAll(".accueil-quick-access [data-view]").forEach(function (btn) {
      btn.addEventListener("click", function () { goToView(btn.getAttribute("data-view")); });
    });

    // Pas encore de vraie messagerie élève -> chef côté UI : affiche un
    // message d'attente plutôt que de deviner un contact. À brancher sur
    // une vraie fonctionnalité (ex: BoxMail, ou un mailto: vers une
    // adresse de support confirmée) quand elle existera.
    var accueilAskBtn = document.getElementById("accueil-ask-question");
    if (accueilAskBtn) {
      accueilAskBtn.addEventListener("click", function () {
        showToast("La messagerie arrive bientôt.");
      });
    }

    // ---------- Page Cours ----------
    // Modules/leçons/progression viennent de Supabase (tables
    // course_modules, course_lessons, user_lesson_progress — voir
    // cours-content.sql), pas de données écrites en dur ici.

    var courseModules = [];   // [{id, position, title, description}]
    var courseLessons = [];   // [{id, module_id, position, title, duration_minutes, content_type, content_text, video_url}]
    var courseProgress = {};  // { lessonId: true } pour les leçons terminées par l'utilisateur connecté
    var courseDataLoaded = false;
    var currentLessonId = null;
    var previousViewBeforeLecon = "cours";

    // Toutes les leçons triées dans l'ordre (module puis position dans
    // le module) : sert à déterminer la "leçon en cours" (la première
    // leçon non terminée dans cet ordre) et le bouton "Leçon suivante".
    function getOrderedLessons() {
      var moduleOrder = {};
      courseModules.forEach(function (m) { moduleOrder[m.id] = m.position; });
      return courseLessons.slice().sort(function (a, b) {
        var ma = moduleOrder[a.module_id] || 0, mb = moduleOrder[b.module_id] || 0;
        if (ma !== mb) return ma - mb;
        return a.position - b.position;
      });
    }

    function loadCourseData(userId) {
      if (courseDataLoaded) return;
      courseDataLoaded = true;
      Promise.all([
        supabase.from("course_modules").select("id,position,title,description").order("position"),
        supabase.from("course_lessons").select("id,module_id,position,title,duration_minutes,content_type,content_text,video_url,status").order("position"),
        supabase.from("user_lesson_progress").select("lesson_id,completed").eq("user_id", userId)
      ]).then(function (results) {
        var modulesRes = results[0], lessonsRes = results[1], progressRes = results[2];
        if (modulesRes && modulesRes.data) courseModules = modulesRes.data;
        if (lessonsRes && lessonsRes.data) courseLessons = lessonsRes.data;
        if (progressRes && progressRes.data) {
          progressRes.data.forEach(function (row) {
            if (row.completed) courseProgress[row.lesson_id] = true;
          });
        }
        renderCoursModules();
      });
    }

    function renderCoursModules() {
      var list = document.getElementById("cours-modules-list");
      if (!list) return;
      list.innerHTML = "";
      if (!courseModules.length) {
        list.innerHTML = '<div class="cours-empty">Aucun module pour le moment.</div>';
        return;
      }

      var ordered = getOrderedLessons();
      var currentLessonIdGlobal = null;
      for (var i = 0; i < ordered.length; i++) {
        if (!courseProgress[ordered[i].id]) { currentLessonIdGlobal = ordered[i].id; break; }
      }

      courseModules.slice().sort(function (a, b) { return a.position - b.position; }).forEach(function (mod) {
        var lessons = courseLessons.filter(function (l) { return l.module_id === mod.id; })
          .sort(function (a, b) { return a.position - b.position; });
        var doneCount = lessons.filter(function (l) { return courseProgress[l.id]; }).length;
        var pct = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0;
        var containsCurrent = lessons.some(function (l) { return l.id === currentLessonIdGlobal; });

        var block = document.createElement("div");
        block.className = "glass-card panel-section cours-module" + (containsCurrent ? " open" : "");

        var head = document.createElement("button");
        head.type = "button";
        head.className = "cours-module-head";
        var headText = document.createElement("div");
        var titleEl = document.createElement("div");
        titleEl.className = "cours-module-title";
        titleEl.textContent = mod.title;
        var descEl = document.createElement("div");
        descEl.className = "cours-module-desc";
        descEl.textContent = mod.description || "";
        headText.appendChild(titleEl);
        headText.appendChild(descEl);
        var caretEl = document.createElement("span");
        caretEl.className = "cours-module-caret";
        caretEl.textContent = "▾";
        head.appendChild(headText);
        head.appendChild(caretEl);
        head.addEventListener("click", function () { block.classList.toggle("open"); });
        block.appendChild(head);

        var progressWrap = document.createElement("div");
        progressWrap.className = "cours-module-progress";
        var track = document.createElement("div");
        track.className = "progress-track";
        var fill = document.createElement("div");
        fill.className = "progress-fill prog-green";
        fill.style.width = pct + "%";
        track.appendChild(fill);
        var label = document.createElement("div");
        label.className = "progress-label";
        label.innerHTML = "<span></span><span></span>";
        label.children[0].textContent = doneCount + " leçon" + (doneCount > 1 ? "s" : "") + " terminée" + (doneCount > 1 ? "s" : "") + " sur " + lessons.length;
        label.children[1].textContent = pct + "%";
        progressWrap.appendChild(track);
        progressWrap.appendChild(label);
        block.appendChild(progressWrap);

        var lessonsWrap = document.createElement("div");
        lessonsWrap.className = "cours-module-lessons";
        lessons.forEach(function (lesson, idx) {
          var isDone = !!courseProgress[lesson.id];
          var isCurrent = lesson.id === currentLessonIdGlobal;

          var row = document.createElement("div");
          row.className = "cours-lesson" + (isDone ? " done" : "");

          var numEl = document.createElement("span");
          numEl.className = "cours-lesson-num";
          numEl.textContent = isDone ? "✓" : String(idx + 1);

          var infoEl = document.createElement("div");
          infoEl.className = "cours-lesson-info";
          var lTitleEl = document.createElement("div");
          lTitleEl.className = "cours-lesson-title";
          lTitleEl.textContent = lesson.title;
          var metaEl = document.createElement("div");
          metaEl.className = "cours-lesson-meta";
          metaEl.textContent = lesson.duration_minutes ? lesson.duration_minutes + " min" : "";
          infoEl.appendChild(lTitleEl);
          infoEl.appendChild(metaEl);

          row.appendChild(numEl);
          row.appendChild(infoEl);

          if (isCurrent) {
            var contBtn = document.createElement("button");
            contBtn.type = "button";
            contBtn.className = "btn orange btn-sm";
            contBtn.textContent = "Continuer";
            contBtn.addEventListener("click", function (e) {
              e.stopPropagation();
              openLesson(lesson.id);
            });
            row.appendChild(contBtn);
          } else {
            var statusEl = document.createElement("span");
            statusEl.className = "cours-lesson-status " + (isDone ? "status-done" : "status-todo");
            statusEl.textContent = isDone ? "Terminée ✅" : "À faire";
            row.appendChild(statusEl);
          }

          row.addEventListener("click", function () { openLesson(lesson.id); });
          lessonsWrap.appendChild(row);
        });
        block.appendChild(lessonsWrap);

        list.appendChild(block);
      });
    }

    function updateLessonCompleteButton() {
      var btn = document.getElementById("lecon-complete-btn");
      if (!btn || !currentLessonId) return;
      var done = !!courseProgress[currentLessonId];
      btn.textContent = done ? "Terminée ✅" : "Marquer comme terminée";
      btn.classList.toggle("ghost", done);
    }

    function openLesson(lessonId) {
      var lesson = courseLessons.find(function (l) { return l.id === lessonId; });
      if (!lesson) return;
      currentLessonId = lessonId;
      var mod = courseModules.find(function (m) { return m.id === lesson.module_id; });

      var metaEl = document.getElementById("lecon-meta");
      if (metaEl) metaEl.textContent = (mod ? mod.title : "") + (lesson.duration_minutes ? " · " + lesson.duration_minutes + " min" : "");
      var titleEl = document.getElementById("lecon-title");
      if (titleEl) titleEl.textContent = lesson.title;
      var bodyEl = document.getElementById("lecon-body");
      if (bodyEl) {
        bodyEl.innerHTML = "";
        if (lesson.content_type === "video" && lesson.video_url) {
          var video = document.createElement("video");
          video.src = lesson.video_url;
          video.controls = true;
          bodyEl.appendChild(video);
        }
        if (lesson.content_text) {
          var textEl = document.createElement("div");
          textEl.textContent = lesson.content_text;
          bodyEl.appendChild(textEl);
        }
      }
      updateLessonCompleteButton();

      var activeNav = document.querySelector(".nav-item.active[data-view]");
      previousViewBeforeLecon = activeNav ? activeNav.getAttribute("data-view") : "cours";
      switchToView("lecon");
    }

    var btnBackLecon = document.getElementById("btn-back-lecon");
    if (btnBackLecon) {
      btnBackLecon.addEventListener("click", function () { switchToView(previousViewBeforeLecon); });
    }

    var leconCompleteBtn = document.getElementById("lecon-complete-btn");
    if (leconCompleteBtn) {
      leconCompleteBtn.addEventListener("click", function () {
        if (!currentLessonId || !me) return;
        var newDone = !courseProgress[currentLessonId];
        courseProgress[currentLessonId] = newDone;
        updateLessonCompleteButton();
        renderCoursModules();
        supabase.from("user_lesson_progress")
          .upsert({ user_id: me.id, lesson_id: currentLessonId, completed: newDone, completed_at: newDone ? new Date().toISOString() : null }, { onConflict: "user_id,lesson_id" })
          .then(function (res) {
            if (res && res.error) alert("Erreur : " + res.error.message);
          });
      });
    }

    var leconNextBtn = document.getElementById("lecon-next-btn");
    if (leconNextBtn) {
      leconNextBtn.addEventListener("click", function () {
        var ordered = getOrderedLessons();
        var idx = ordered.findIndex(function (l) { return l.id === currentLessonId; });
        if (idx !== -1 && idx < ordered.length - 1) openLesson(ordered[idx + 1].id);
      });
    }

    // ---------- Page Mon projet ----------
    // Étapes partagées (project_steps), titre + avancement + dépôts
    // propres à chaque élève (user_project, user_project_steps,
    // project_submissions). Voir mon-projet.sql.

    var PROJECT_STEPS_TEMPLATE = [];
    var myProjectSteps = {};
    var myProjectSubmissions = [];
    var projectDataLoaded = false;

    function loadProjectData(userId) {
      if (projectDataLoaded) return;
      projectDataLoaded = true;
      Promise.all([
        supabase.from("project_steps").select("id,position,label").order("position"),
        supabase.from("user_project").select("title").eq("user_id", userId).single(),
        supabase.from("user_project_steps").select("step_id,done").eq("user_id", userId),
        supabase.from("project_submissions").select("id,note,link_url,file_name,file_path,created_at,admin_feedback,corrected").eq("user_id", userId).order("created_at", { ascending: false })
      ]).then(function (results) {
        var stepsRes = results[0], projectRes = results[1], userStepsRes = results[2], subsRes = results[3];
        if (stepsRes && stepsRes.data) PROJECT_STEPS_TEMPLATE = stepsRes.data;
        var titleInput = document.getElementById("projet-title-input");
        if (titleInput) titleInput.value = (projectRes && projectRes.data && projectRes.data.title) || "Mon produit digital";
        myProjectSteps = {};
        if (userStepsRes && userStepsRes.data) {
          userStepsRes.data.forEach(function (row) { if (row.done) myProjectSteps[row.step_id] = true; });
        }
        if (subsRes && subsRes.data) myProjectSubmissions = subsRes.data;
        renderProjectSteps();
        renderProjectSubmissions();
      });
    }

    function updateProjectStepsProgress() {
      var total = PROJECT_STEPS_TEMPLATE.length;
      var done = PROJECT_STEPS_TEMPLATE.filter(function (s) { return myProjectSteps[s.id]; }).length;
      var pct = total ? Math.round((done / total) * 100) : 0;
      var fill = document.getElementById("projet-steps-fill");
      if (fill) fill.style.width = pct + "%";
      var text = document.getElementById("projet-steps-text");
      if (text) text.textContent = done + "/" + total + " étape" + (total > 1 ? "s" : "");
      var pctEl = document.getElementById("projet-steps-pct");
      if (pctEl) pctEl.textContent = pct + "%";
    }

    function renderProjectSteps() {
      var list = document.getElementById("projet-steps-list");
      if (!list) return;
      list.innerHTML = "";
      PROJECT_STEPS_TEMPLATE.slice().sort(function (a, b) { return a.position - b.position; }).forEach(function (step) {
        var isDone = !!myProjectSteps[step.id];
        var row = document.createElement("label");
        row.className = "projet-step-row" + (isDone ? " done" : "");
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = isDone;
        cb.addEventListener("change", function () {
          if (!me) return;
          myProjectSteps[step.id] = cb.checked;
          row.classList.toggle("done", cb.checked);
          updateProjectStepsProgress();
          supabase.from("user_project_steps")
            .upsert({ user_id: me.id, step_id: step.id, done: cb.checked }, { onConflict: "user_id,step_id" })
            .then(function (res) { if (res && res.error) alert("Erreur : " + res.error.message); });
        });
        var span = document.createElement("span");
        span.textContent = step.label;
        row.appendChild(cb);
        row.appendChild(span);
        list.appendChild(row);
      });
      updateProjectStepsProgress();
    }

    function renderProjectSubmissions() {
      var list = document.getElementById("projet-submissions-list");
      if (!list) return;
      list.innerHTML = "";
      if (!myProjectSubmissions.length) {
        list.innerHTML = '<div class="cours-empty">Aucun dépôt pour le moment.</div>';
        return;
      }
      myProjectSubmissions.forEach(function (sub) {
        var item = document.createElement("div");
        item.className = "projet-submission-item";
        var dateEl = document.createElement("div");
        dateEl.className = "projet-submission-date";
        dateEl.textContent = new Date(sub.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
        item.appendChild(dateEl);
        if (sub.note) {
          var noteEl = document.createElement("div");
          noteEl.className = "projet-submission-note";
          noteEl.textContent = sub.note;
          item.appendChild(noteEl);
        }
        if (sub.link_url) {
          var linkEl = document.createElement("a");
          linkEl.className = "projet-submission-link";
          linkEl.href = sub.link_url;
          linkEl.target = "_blank";
          linkEl.rel = "noopener";
          linkEl.textContent = "🔗 " + sub.link_url;
          item.appendChild(linkEl);
        }
        if (sub.file_path) {
          var fileEl = document.createElement("a");
          fileEl.className = "projet-submission-file";
          fileEl.textContent = "📎 " + (sub.file_name || "Fichier joint");
          fileEl.href = "#";
          fileEl.addEventListener("click", function (e) {
            e.preventDefault();
            // Bucket privé : on génère un lien signé temporaire à la demande
            // plutôt que de stocker une URL publique.
            supabase.storage.from("project-uploads").createSignedUrl(sub.file_path, 3600).then(function (res) {
              if (res && res.data && res.data.signedUrl) window.open(res.data.signedUrl, "_blank");
              else alert("Impossible d'ouvrir ce fichier pour le moment.");
            });
          });
          item.appendChild(fileEl);
        }
        // Retour de l'admin sur ce dépôt (renseigné directement en base
        // pour l'instant, la page Retours ayant été retirée) : visible
        // ici dès qu'il a écrit quelque chose, avec le statut.
        if (sub.admin_feedback || sub.corrected) {
          var feedbackBox = document.createElement("div");
          feedbackBox.className = "projet-submission-feedback";
          var statusPill = document.createElement("span");
          statusPill.className = "status-pill " + (sub.corrected ? "status-actif" : "status-churn");
          statusPill.textContent = sub.corrected ? "Corrigé" : "En attente de correction";
          feedbackBox.appendChild(statusPill);
          if (sub.admin_feedback) {
            var feedbackText = document.createElement("div");
            feedbackText.className = "projet-submission-feedback-text";
            feedbackText.textContent = sub.admin_feedback;
            feedbackBox.appendChild(feedbackText);
          }
          item.appendChild(feedbackBox);
        }
        list.appendChild(item);
      });
    }

    var projetTitleSaveBtn = document.getElementById("projet-title-save-btn");
    if (projetTitleSaveBtn) {
      projetTitleSaveBtn.addEventListener("click", function () {
        if (!me) return;
        var input = document.getElementById("projet-title-input");
        var title = input ? input.value.trim() : "";
        if (!title) return;
        supabase.from("user_project").upsert({ user_id: me.id, title: title }, { onConflict: "user_id" }).then(function (res) {
          if (res && res.error) alert("Erreur : " + res.error.message);
        });
      });
    }

    var PROJECT_FILE_MAX_BYTES = 10 * 1024 * 1024; // 10 Mo
    var PROJECT_FILE_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

    var projetSubmitBtn = document.getElementById("projet-submit-btn");
    if (projetSubmitBtn) {
      projetSubmitBtn.addEventListener("click", function () {
        if (!me) return;
        var errorEl = document.getElementById("projet-submit-error");
        var successEl = document.getElementById("projet-submit-success");
        if (errorEl) errorEl.textContent = "";
        if (successEl) successEl.textContent = "";
        var noteInput = document.getElementById("projet-submit-note");
        var linkInput = document.getElementById("projet-submit-link");
        var fileInput = document.getElementById("projet-submit-file");
        var note = noteInput ? noteInput.value.trim() : "";
        var link = linkInput ? linkInput.value.trim() : "";
        var file = fileInput && fileInput.files && fileInput.files[0];

        if (!note && !link && !file) {
          if (errorEl) errorEl.textContent = "Ajoute au moins une note, un lien ou un fichier.";
          return;
        }
        if (file && file.size > PROJECT_FILE_MAX_BYTES) {
          if (errorEl) errorEl.textContent = "Le fichier dépasse 10 Mo.";
          return;
        }
        if (file && PROJECT_FILE_ALLOWED_TYPES.indexOf(file.type) === -1) {
          if (errorEl) errorEl.textContent = "Type de fichier non autorisé (image ou PDF uniquement).";
          return;
        }

        projetSubmitBtn.disabled = true;
        var uploadPromise = file
          ? supabase.storage.from("project-uploads").upload(me.id + "/" + Date.now() + "-" + file.name, file).then(function (res) {
              if (res && res.error) throw res.error;
              return { path: res.data.path, name: file.name };
            })
          : Promise.resolve(null);

        uploadPromise
          .then(function (uploaded) {
            return supabase.from("project_submissions").insert({
              user_id: me.id,
              note: note || null,
              link_url: link || null,
              file_path: uploaded ? uploaded.path : null,
              file_name: uploaded ? uploaded.name : null
            }).select().single();
          })
          .then(function (res) {
            projetSubmitBtn.disabled = false;
            if (res && res.error) { if (errorEl) errorEl.textContent = "Erreur : " + res.error.message; return; }
            if (successEl) successEl.textContent = "Envoyé !";
            if (noteInput) noteInput.value = "";
            if (linkInput) linkInput.value = "";
            if (fileInput) fileInput.value = "";
            if (res && res.data) myProjectSubmissions.unshift(res.data);
            renderProjectSubmissions();
          })
          .catch(function (err) {
            projetSubmitBtn.disabled = false;
            if (errorEl) errorEl.textContent = "Erreur : " + (err && err.message ? err.message : "envoi impossible.");
          });
      });
    }

    var projetQuestionSendBtn = document.getElementById("projet-question-send-btn");
    if (projetQuestionSendBtn) {
      projetQuestionSendBtn.addEventListener("click", function () {
        if (!me) return;
        var input = document.getElementById("projet-question-input");
        var successEl = document.getElementById("projet-question-success");
        var q = input ? input.value.trim() : "";
        if (!q) return;
        supabase.from("coach_questions").insert({ user_id: me.id, question: q }).then(function (res) {
          if (res && res.error) { alert("Erreur : " + res.error.message); return; }
          if (successEl) successEl.textContent = "Question envoyée au coach.";
          if (input) input.value = "";
        });
      });
    }

    // ---------- Page Ressources ----------
    // Contenu dans la table "resources" (voir ressources.sql) : rien
    // d'écrit en dur ici, juste l'affichage/filtrage.

    var RESOURCE_CATEGORY_ORDER = ["Templates", "Prompts", "Guides PDF", "Outils"];
    var resourcesList = [];
    var resourcesDataLoaded = false;
    var resourcesActiveCategory = null; // null = toutes les catégories

    function loadResourcesData() {
      if (resourcesDataLoaded) return;
      resourcesDataLoaded = true;
      supabase.from("resources").select("id,category,title,description,resource_type,file_url,prompt_text").order("category").then(function (res) {
        if (res && res.data) resourcesList = res.data;
        renderResourceCategoryPills();
        renderResourcesList();
      });
    }

    function sortByCategoryOrder(cats) {
      return cats.slice().sort(function (a, b) {
        var ia = RESOURCE_CATEGORY_ORDER.indexOf(a); if (ia === -1) ia = 999;
        var ib = RESOURCE_CATEGORY_ORDER.indexOf(b); if (ib === -1) ib = 999;
        return ia - ib;
      });
    }

    function renderResourceCategoryPills() {
      var wrap = document.getElementById("ressources-categories");
      if (!wrap) return;
      wrap.innerHTML = "";
      var cats = [];
      resourcesList.forEach(function (r) { if (cats.indexOf(r.category) === -1) cats.push(r.category); });
      cats = sortByCategoryOrder(cats);

      var allPill = document.createElement("button");
      allPill.type = "button";
      allPill.className = "ressources-cat-pill" + (resourcesActiveCategory === null ? " active" : "");
      allPill.textContent = "Tout";
      allPill.addEventListener("click", function () { resourcesActiveCategory = null; renderResourceCategoryPills(); renderResourcesList(); });
      wrap.appendChild(allPill);

      cats.forEach(function (cat) {
        var pill = document.createElement("button");
        pill.type = "button";
        pill.className = "ressources-cat-pill" + (resourcesActiveCategory === cat ? " active" : "");
        pill.textContent = cat;
        pill.addEventListener("click", function () { resourcesActiveCategory = cat; renderResourceCategoryPills(); renderResourcesList(); });
        wrap.appendChild(pill);
      });
    }

    function renderResourcesList() {
      var container = document.getElementById("ressources-list");
      if (!container) return;
      container.innerHTML = "";
      var searchInput = document.getElementById("ressources-search-input");
      var q = (searchInput ? searchInput.value : "").trim().toLowerCase();

      var filtered = resourcesList.filter(function (r) {
        if (resourcesActiveCategory && r.category !== resourcesActiveCategory) return false;
        if (q && r.title.toLowerCase().indexOf(q) === -1 && (r.description || "").toLowerCase().indexOf(q) === -1) return false;
        return true;
      });

      if (!filtered.length) {
        container.innerHTML = '<div class="ressources-empty">Aucune ressource trouvée.</div>';
        return;
      }

      var byCategory = {};
      var order = [];
      filtered.forEach(function (r) {
        if (!byCategory[r.category]) { byCategory[r.category] = []; order.push(r.category); }
        byCategory[r.category].push(r);
      });
      order = sortByCategoryOrder(order);

      order.forEach(function (cat) {
        var section = document.createElement("div");
        section.className = "ressources-category";
        var head = document.createElement("div");
        head.className = "ressources-category-head";
        head.textContent = cat;
        section.appendChild(head);

        byCategory[cat].forEach(function (r) {
          var item = document.createElement("div");
          item.className = "glass-card ressource-item";

          var info = document.createElement("div");
          info.className = "ressource-item-info";
          var titleEl = document.createElement("div");
          titleEl.className = "ressource-item-title";
          titleEl.textContent = r.title;
          var descEl = document.createElement("div");
          descEl.className = "ressource-item-desc";
          descEl.textContent = r.description || "";
          info.appendChild(titleEl);
          info.appendChild(descEl);
          item.appendChild(info);

          var typeEl = document.createElement("span");
          typeEl.className = "ressource-item-type";
          typeEl.textContent = r.resource_type === "prompt" ? "Prompt" : ((r.file_url || "").toLowerCase().indexOf(".pdf") !== -1 ? "PDF" : "Fichier");
          item.appendChild(typeEl);

          if (r.resource_type === "prompt") {
            var copyBtn = document.createElement("button");
            copyBtn.type = "button";
            copyBtn.className = "btn blue btn-sm";
            copyBtn.textContent = "Copier";
            copyBtn.addEventListener("click", function () {
              var text = r.prompt_text || "";
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () { showToast("Copié !"); });
              } else {
                showToast("Copie non disponible sur ce navigateur.");
              }
            });
            item.appendChild(copyBtn);
          } else if (r.file_url) {
            var dlBtn = document.createElement("a");
            dlBtn.className = "btn orange btn-sm";
            dlBtn.textContent = "Télécharger";
            dlBtn.href = r.file_url;
            dlBtn.target = "_blank";
            dlBtn.rel = "noopener";
            item.appendChild(dlBtn);
          }

          section.appendChild(item);
        });

        container.appendChild(section);
      });
    }

    var ressourcesSearchInput = document.getElementById("ressources-search-input");
    if (ressourcesSearchInput) {
      ressourcesSearchInput.addEventListener("input", function () { renderResourcesList(); });
    }

    // ---------- Page Calendrier ----------
    // Table "calendar_events" (voir calendrier.sql) : table déjà
    // existante (ancienne fonctionnalité calendrier), réutilisée telle
    // quelle plutôt que dupliquée. Colonnes event_date/event_time sont
    // déjà en heure de Paris (murale, sans fuseau stocké) : aucune
    // conversion pour l'affichage, seule la génération du .ics a besoin
    // d'un vrai instant UTC.

    var calendarEvents = [];
    var calendarDataLoaded = false;

    function loadCalendarData() {
      if (calendarDataLoaded) return;
      calendarDataLoaded = true;
      supabase.from("calendar_events").select("id,title,description,event_date,event_time,join_url,replay_url").order("event_date").order("event_time").then(function (res) {
        if (res && res.data) calendarEvents = res.data;
        renderCalendar();
      });
    }

    // Place date/heure "telles quelles" dans un Date en UTC — jamais
    // interprété comme un vrai instant UTC, juste un support pour les
    // utilitaires de formatage de Date (toLocaleString...).
    function parseEventDateTime(dateStr, timeStr) {
      return new Date((dateStr || "1970-01-01") + "T" + (timeStr || "00:00:00") + "Z");
    }

    function formatEventDate(dateStr, timeStr) {
      var d = parseEventDateTime(dateStr, timeStr);
      return {
        day: d.toLocaleDateString("fr-FR", { day: "2-digit", timeZone: "UTC" }),
        month: d.toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" }),
        full: d.toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
      };
    }

    // Convertit une heure murale Europe/Paris en vrai instant UTC (pour
    // comparer à "maintenant" et pour le fichier .ics), été comme hiver,
    // sans dépendance externe.
    function parisWallTimeToUtcDate(dateStr, timeStr) {
      var guess = parseEventDateTime(dateStr, timeStr);
      var parisStr = new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
      }).format(guess);
      var m = parisStr.match(/(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+):(\d+)/);
      if (!m) return guess;
      var hour = +m[4] === 24 ? 0 : +m[4];
      var parisAsIfUtc = Date.UTC(+m[3], +m[1] - 1, +m[2], hour, +m[5], +m[6]);
      var offsetMs = guess.getTime() - parisAsIfUtc;
      return new Date(guess.getTime() + offsetMs);
    }

    // Génère un fichier .ics minimal pour un événement et le télécharge.
    function downloadIcs(evt) {
      function toIcsDate(d) {
        return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      }
      var lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ZENOA//Calendrier//FR", "BEGIN:VEVENT",
        "UID:" + evt.id + "@zenoa",
        "DTSTAMP:" + toIcsDate(new Date()),
        "DTSTART:" + toIcsDate(parisWallTimeToUtcDate(evt.event_date, evt.event_time))
      ];
      lines.push("SUMMARY:" + (evt.title || "").replace(/\n/g, " "));
      if (evt.description) lines.push("DESCRIPTION:" + evt.description.replace(/\n/g, "\\n"));
      if (evt.join_url) lines.push("LOCATION:" + evt.join_url);
      lines.push("END:VEVENT", "END:VCALENDAR");
      var blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = (evt.title || "evenement").replace(/[^a-z0-9]+/gi, "-") + ".ics";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    function renderCalendarList(containerId, events, isPast) {
      var container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = "";
      if (!events.length) {
        container.innerHTML = '<div class="calendrier-empty">' + (isPast ? "Aucun événement passé." : "Aucun événement prévu pour le moment.") + "</div>";
        return;
      }
      events.forEach(function (evt) {
        var d = formatEventDate(evt.event_date, evt.event_time);
        var card = document.createElement("div");
        card.className = "glass-card calendrier-event" + (isPast ? " past" : "");

        var dateCol = document.createElement("div");
        dateCol.className = "calendrier-event-date";
        var dayEl = document.createElement("div");
        dayEl.className = "calendrier-event-date-day";
        dayEl.textContent = d.day;
        var monthEl = document.createElement("div");
        monthEl.className = "calendrier-event-date-month";
        monthEl.textContent = d.month;
        dateCol.appendChild(dayEl);
        dateCol.appendChild(monthEl);
        card.appendChild(dateCol);

        var body = document.createElement("div");
        body.className = "calendrier-event-body";
        var titleEl = document.createElement("div");
        titleEl.className = "calendrier-event-title";
        titleEl.textContent = evt.title;
        var timeEl = document.createElement("div");
        timeEl.className = "calendrier-event-time";
        timeEl.textContent = d.full + " (Europe/Paris)";
        body.appendChild(titleEl);
        body.appendChild(timeEl);
        if (evt.description) {
          var descEl = document.createElement("div");
          descEl.className = "calendrier-event-desc";
          descEl.textContent = evt.description;
          body.appendChild(descEl);
        }
        var actions = document.createElement("div");
        actions.className = "calendrier-event-actions";
        if (!isPast && evt.join_url) {
          var joinBtn = document.createElement("a");
          joinBtn.className = "btn blue btn-sm";
          joinBtn.textContent = "Rejoindre";
          joinBtn.href = evt.join_url;
          joinBtn.target = "_blank";
          joinBtn.rel = "noopener";
          actions.appendChild(joinBtn);
        }
        if (isPast && evt.replay_url) {
          var replayBtn = document.createElement("a");
          replayBtn.className = "btn orange btn-sm";
          replayBtn.textContent = "Voir le replay";
          replayBtn.href = evt.replay_url;
          replayBtn.target = "_blank";
          replayBtn.rel = "noopener";
          actions.appendChild(replayBtn);
        }
        if (!isPast) {
          var icsBtn = document.createElement("button");
          icsBtn.type = "button";
          icsBtn.className = "btn btn-sm";
          icsBtn.textContent = "Ajouter à mon calendrier";
          icsBtn.addEventListener("click", function () { downloadIcs(evt); });
          actions.appendChild(icsBtn);
        }
        if (me && me.role === "chef") {
          var deleteEventBtn = document.createElement("button");
          deleteEventBtn.type = "button";
          deleteEventBtn.className = "btn danger btn-sm admin-icon-x-btn";
          deleteEventBtn.textContent = "✕";
          deleteEventBtn.title = "Supprimer cet événement";
          deleteEventBtn.addEventListener("click", function () {
            zenoaConfirm('Supprimer l\'événement "' + evt.title + '" ?', { danger: true, confirmLabel: "Supprimer" }).then(function (ok) {
              if (!ok) return;
              supabase.from("calendar_events").delete().eq("id", evt.id).then(function (res) {
                if (res && res.error) { alert("Erreur : " + res.error.message); return; }
                calendarDataLoaded = false;
                loadCalendarData();
              });
            });
          });
          actions.appendChild(deleteEventBtn);
        }
        body.appendChild(actions);
        card.appendChild(body);
        container.appendChild(card);
      });
    }

    function renderCalendar() {
      var now = new Date();
      var upcoming = calendarEvents.filter(function (e) { return parisWallTimeToUtcDate(e.event_date, e.event_time) >= now; });
      var past = calendarEvents.filter(function (e) { return parisWallTimeToUtcDate(e.event_date, e.event_time) < now; }).slice().reverse();
      renderCalendarList("calendrier-upcoming-list", upcoming, false);
      renderCalendarList("calendrier-past-list", past, true);
    }

    // Ajout d'un événement par le chef : apparaît aussitôt dans le
    // calendrier de tous les élèves (même table calendar_events,
    // policy "admin can write events" dans admin-panel.sql).
    function openEventModal() {
      openAdminModal("Ajouter un événement",
        '<div class="field"><label class="field-label">Titre</label><input type="text" id="cf-title"></div>' +
        '<div class="field"><label class="field-label">Date</label><input type="date" id="cf-date"></div>' +
        '<div class="field"><label class="field-label">Heure (Europe/Paris)</label><input type="time" id="cf-time"></div>' +
        '<div class="field"><label class="field-label">Lien de connexion (optionnel)</label><input type="text" id="cf-join-url" placeholder="https://..."></div>' +
        '<div class="field"><label class="field-label">Description (optionnel)</label><textarea id="cf-desc" rows="3"></textarea></div>',
        function (done) {
          var title = document.getElementById("cf-title").value.trim();
          var date = document.getElementById("cf-date").value;
          if (!title) { done("Le titre est obligatoire."); return; }
          if (!date) { done("La date est obligatoire."); return; }
          var payload = {
            title: title,
            event_date: date,
            event_time: document.getElementById("cf-time").value || null,
            join_url: document.getElementById("cf-join-url").value.trim() || null,
            description: document.getElementById("cf-desc").value.trim() || null,
            created_by: me.id
          };
          supabase.from("calendar_events").insert(payload).then(function (res) {
            if (res && res.error) { done("Erreur : " + res.error.message); return; }
            done();
            calendarDataLoaded = false;
            loadCalendarData();
          });
        });
      document.getElementById("cf-title").value = "";
      document.getElementById("cf-date").value = "";
      document.getElementById("cf-time").value = "";
      document.getElementById("cf-join-url").value = "";
      document.getElementById("cf-desc").value = "";
    }
    var calendrierAddEventBtn = document.getElementById("calendrier-add-event-btn");
    if (calendrierAddEventBtn) calendrierAddEventBtn.addEventListener("click", function () { openEventModal(); });

    // ============================================================
    // ---------- PARTIE ADMIN (visible seulement par le "chef") ----------
    // Sécurité : en plus du blocage d'affichage (ADMIN_ONLY_VIEWS plus
    // haut) et du masquage menu (.chef-only, géré dans boot()), TOUTES
    // les lectures/écritures ci-dessous passent par les policies RLS de
    // admin-panel.sql, qui vérifient public.is_admin() côté serveur.
    // Même si quelqu'un contournait l'interface (ex: console du
    // navigateur), Supabase refuserait la requête.
    // ============================================================

    function formatShortDate(value) {
      if (!value) return "—";
      return new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
    }
    function formatShortDateTime(value) {
      if (!value) return "—";
      return new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }

    // ----- Modal générique (admin-modal-*), réutilisé par toutes les
    // actions d'ajout/édition de contenu, pour éviter un modal par type. -----
    var adminModalOverlay = document.getElementById("admin-modal-overlay");
    var adminModalTitle = document.getElementById("admin-modal-title");
    var adminModalBody = document.getElementById("admin-modal-body");
    var adminModalError = document.getElementById("admin-modal-error");
    var adminModalCancel = document.getElementById("admin-modal-cancel");
    var adminModalSave = document.getElementById("admin-modal-save");
    var adminModalOnSave = null;

    function openAdminModal(title, fieldsHtml, onSave) {
      if (!adminModalOverlay) return;
      adminModalTitle.textContent = title;
      adminModalBody.innerHTML = fieldsHtml;
      adminModalError.textContent = "";
      adminModalOnSave = onSave;
      adminModalOverlay.classList.add("open");
    }
    function closeAdminModal() {
      if (!adminModalOverlay) return;
      adminModalOverlay.classList.remove("open");
      adminModalOnSave = null;
    }
    if (adminModalCancel) adminModalCancel.addEventListener("click", closeAdminModal);
    if (adminModalOverlay) {
      adminModalOverlay.addEventListener("click", function (e) { if (e.target === adminModalOverlay) closeAdminModal(); });
    }
    if (adminModalSave) {
      adminModalSave.addEventListener("click", function () {
        if (!adminModalOnSave) return;
        adminModalError.textContent = "";
        adminModalOnSave(function (errMsg) {
          if (errMsg) { adminModalError.textContent = errMsg; return; }
          closeAdminModal();
        });
      });
    }

    // ---------- Tableau de bord ----------
    var dashboardStudents = [];
    var dashboardDoneByUser = {};

    function loadDashboardData() {
      var statsEl = document.getElementById("admin-stats-grid");
      if (!statsEl) return;
      Promise.all([
        supabase.from("profiles").select("id,pseudo,email,created_at,last_seen_at,is_active").eq("role", "membre"),
        supabase.from("user_lesson_progress").select("user_id").eq("completed", true)
      ]).then(function (results) {
        dashboardStudents = (results[0] && results[0].data) || [];
        var progressRows = (results[1] && results[1].data) || [];

        dashboardDoneByUser = {};
        progressRows.forEach(function (row) {
          dashboardDoneByUser[row.user_id] = (dashboardDoneByUser[row.user_id] || 0) + 1;
        });

        var totalLessons = courseLessons.filter(function (l) { return l.status !== "draft"; }).length;
        var weekAgo = Date.now() - 7 * 86400000;
        var newThisWeek = dashboardStudents.filter(function (s) { return s.created_at && new Date(s.created_at).getTime() >= weekAgo; }).length;
        var activeLast7 = dashboardStudents.filter(function (s) { return s.last_seen_at && new Date(s.last_seen_at).getTime() >= weekAgo; }).length;

        var avgPct = 0;
        if (dashboardStudents.length && totalLessons > 0) {
          var sumPct = dashboardStudents.reduce(function (acc, s) { return acc + ((dashboardDoneByUser[s.id] || 0) / totalLessons) * 100; }, 0);
          avgPct = Math.round(sumPct / dashboardStudents.length);
        }

        statsEl.innerHTML = "";
        [
          { label: "Élèves au total", value: String(dashboardStudents.length) },
          { label: "Nouveaux cette semaine", value: String(newThisWeek) },
          { label: "Actifs ces 7 derniers jours", value: String(activeLast7) },
          { label: "Progression moyenne", value: avgPct + "%" }
        ].forEach(function (stat) {
          var card = document.createElement("div");
          card.className = "glass-card indicator-card";
          var val = document.createElement("div");
          val.className = "indicator-value";
          val.textContent = stat.value;
          var lab = document.createElement("div");
          lab.className = "indicator-label";
          lab.textContent = stat.label;
          card.appendChild(val);
          card.appendChild(lab);
          statsEl.appendChild(card);
        });

        // "Qui avance" : les 5 élèves les plus récemment actifs.
        var topActiveList = document.getElementById("admin-top-active-list");
        if (topActiveList) {
          var mostActive = dashboardStudents.filter(function (s) { return s.last_seen_at; })
            .sort(function (a, b) { return new Date(b.last_seen_at) - new Date(a.last_seen_at); })
            .slice(0, 5);
          topActiveList.innerHTML = "";
          if (!mostActive.length) {
            topActiveList.innerHTML = '<div class="cours-empty">Pas encore de connexion enregistrée.</div>';
          } else {
            mostActive.forEach(function (s) {
              var pct = totalLessons > 0 ? Math.round(((dashboardDoneByUser[s.id] || 0) / totalLessons) * 100) : 0;
              topActiveList.appendChild(buildAdminActivityRow(s, pct, formatShortDateTime(s.last_seen_at)));
            });
          }
        }
      });
    }

    function buildAdminActivityRow(student, pct, subText) {
      var row = document.createElement("div");
      row.className = "activity-row";
      row.style.cursor = "pointer";
      var name = document.createElement("div");
      name.className = "activity-row-name";
      name.textContent = student.pseudo || student.email;
      var track = document.createElement("div");
      track.className = "activity-row-track";
      var fill = document.createElement("div");
      fill.className = "activity-row-fill";
      fill.style.width = pct + "%";
      track.appendChild(fill);
      var count = document.createElement("div");
      count.className = "activity-row-count";
      count.textContent = subText;
      row.appendChild(name);
      row.appendChild(track);
      row.appendChild(count);
      row.addEventListener("click", function () { openEleveDetail(student.id); });
      return row;
    }

    // ---------- Page Élèves ----------
    var elevesList = [];
    var elevesDoneByUser = {};
    var elevesFilter = "all";

    function loadElevesData() {
      Promise.all([
        supabase.from("profiles").select("id,pseudo,email,created_at,last_seen_at,is_active,access_expires_at,admin_notes").eq("role", "membre"),
        supabase.from("user_lesson_progress").select("user_id").eq("completed", true)
      ]).then(function (results) {
        elevesList = (results[0] && results[0].data) || [];
        elevesDoneByUser = {};
        ((results[1] && results[1].data) || []).forEach(function (row) {
          elevesDoneByUser[row.user_id] = (elevesDoneByUser[row.user_id] || 0) + 1;
        });
        renderElevesFilterPills();
        renderElevesList();
      });
    }

    function eleveAccessStatus(s) {
      if (!s.is_active) return "suspended";
      if (s.access_expires_at && new Date(s.access_expires_at).getTime() < Date.now()) return "expired";
      return "actif";
    }
    function eleveAccessStatusLabel(status) {
      if (status === "suspended") return "Suspendu";
      if (status === "expired") return "Expiré";
      return "Actif";
    }

    function renderElevesFilterPills() {
      var wrap = document.getElementById("eleves-filter-pills");
      if (!wrap) return;
      wrap.innerHTML = "";
      [
        { key: "all", label: "Tous" },
        { key: "active", label: "Actifs" },
        { key: "blocked", label: "Bloqués" },
        { key: "new", label: "Nouveaux" }
      ].forEach(function (f) {
        var pill = document.createElement("button");
        pill.type = "button";
        pill.className = "ressources-cat-pill" + (elevesFilter === f.key ? " active" : "");
        pill.textContent = f.label;
        pill.addEventListener("click", function () { elevesFilter = f.key; renderElevesFilterPills(); renderElevesList(); });
        wrap.appendChild(pill);
      });
    }

    function renderElevesList() {
      var container = document.getElementById("eleves-list");
      if (!container) return;
      var searchInput = document.getElementById("eleves-search-input");
      var q = (searchInput ? searchInput.value : "").trim().toLowerCase();
      var weekAgo = Date.now() - 7 * 86400000;

      var filtered = elevesList.filter(function (s) {
        if (q && (s.pseudo || "").toLowerCase().indexOf(q) === -1 && (s.email || "").toLowerCase().indexOf(q) === -1) return false;
        if (elevesFilter === "active") return s.last_seen_at && new Date(s.last_seen_at).getTime() >= weekAgo;
        if (elevesFilter === "blocked") return !s.last_seen_at || new Date(s.last_seen_at).getTime() < weekAgo;
        if (elevesFilter === "new") return s.created_at && new Date(s.created_at).getTime() >= weekAgo;
        return true;
      });

      container.innerHTML = "";
      if (!filtered.length) {
        container.innerHTML = '<div class="cours-empty">Aucun élève trouvé.</div>';
        return;
      }

      var totalLessons = courseLessons.filter(function (l) { return l.status !== "draft"; }).length;
      filtered.forEach(function (s) {
        var pct = totalLessons > 0 ? Math.round(((elevesDoneByUser[s.id] || 0) / totalLessons) * 100) : 0;
        var status = eleveAccessStatus(s);
        var row = document.createElement("div");
        row.className = "glass-card eleve-row";
        row.innerHTML =
          '<div class="eleve-row-info">' +
            '<div class="eleve-row-name"><span class="eleve-row-name-text"></span><span class="status-pill"></span></div>' +
            '<div class="eleve-row-meta"></div>' +
          '</div>' +
          '<div class="eleve-row-progress"><div class="progress-track"><div class="progress-fill prog-green"></div></div><span></span></div>';
        row.querySelector(".eleve-row-name-text").textContent = s.pseudo || "(sans nom)";
        var pill = row.querySelector(".status-pill");
        pill.classList.add("status-" + status);
        pill.textContent = eleveAccessStatusLabel(status);
        row.querySelector(".eleve-row-meta").textContent = (s.email || "") + " · Inscrit le " + formatShortDate(s.created_at);
        row.querySelector(".progress-fill").style.width = pct + "%";
        row.querySelector(".eleve-row-progress span").textContent = pct + "%";
        row.addEventListener("click", function () { openEleveDetail(s.id); });
        container.appendChild(row);
      });
    }

    var elevesSearchInput = document.getElementById("eleves-search-input");
    if (elevesSearchInput) elevesSearchInput.addEventListener("input", renderElevesList);

    // ----- Fiche élève -----
    var btnBackEleveDetail = document.getElementById("btn-back-eleve-detail");
    if (btnBackEleveDetail) btnBackEleveDetail.addEventListener("click", function () { switchToView("eleves"); });

    function openEleveDetail(studentId) {
      switchToView("eleve-detail");
      var content = document.getElementById("eleve-detail-content");
      if (content) content.innerHTML = '<div class="cours-empty">Chargement…</div>';
      Promise.all([
        supabase.from("profiles").select("id,pseudo,email,created_at,last_seen_at,is_active,access_expires_at,admin_notes").eq("id", studentId).single(),
        supabase.from("user_lesson_progress").select("completed").eq("user_id", studentId).eq("completed", true)
      ]).then(function (results) {
        var student = results[0] && results[0].data;
        if (!student) {
          if (content) content.innerHTML = '<div class="cours-empty">Élève introuvable.</div>';
          return;
        }
        var doneCount = ((results[1] && results[1].data) || []).length;
        renderEleveDetail(student, doneCount);
      });
    }

    function renderEleveDetail(student, doneCount) {
      var content = document.getElementById("eleve-detail-content");
      if (!content) return;
      var totalLessons = courseLessons.filter(function (l) { return l.status !== "draft"; }).length;
      var pct = totalLessons > 0 ? Math.round((doneCount / totalLessons) * 100) : 0;
      var status = eleveAccessStatus(student);

      content.innerHTML = "";

      var head = document.createElement("div");
      head.className = "glass-card panel-section";
      head.innerHTML =
        '<div class="admin-panel-head">' +
          '<div>' +
            '<div class="panel-title" style="margin-bottom:2px;" data-f="name"></div>' +
            '<div class="admin-student-row-meta" data-f="email"></div>' +
          '</div>' +
          '<span class="status-pill"></span>' +
        '</div>' +
        '<div class="admin-student-row-meta">Inscrit le <span data-f="inscr"></span> · Dernière connexion : <span data-f="lastseen"></span> · Progression : <span data-f="pct"></span></div>';
      head.querySelector('[data-f="name"]').textContent = student.pseudo || "(sans nom)";
      head.querySelector('[data-f="email"]').textContent = student.email || "";
      var pill = head.querySelector(".status-pill");
      pill.classList.add("status-" + status);
      pill.textContent = eleveAccessStatusLabel(status);
      head.querySelector('[data-f="inscr"]').textContent = formatShortDate(student.created_at);
      head.querySelector('[data-f="lastseen"]').textContent = student.last_seen_at ? formatShortDateTime(student.last_seen_at) : "jamais connecté";
      head.querySelector('[data-f="pct"]').textContent = pct + "% (" + doneCount + "/" + totalLessons + " leçons)";
      content.appendChild(head);

      // ----- Actions -----
      var actions = document.createElement("div");
      actions.className = "glass-card panel-section eleve-detail-actions";

      var suspendBtn = document.createElement("button");
      suspendBtn.type = "button";
      suspendBtn.className = "btn btn-sm " + (student.is_active ? "danger" : "blue");
      suspendBtn.textContent = student.is_active ? "Suspendre l'accès" : "Réactiver l'accès";
      suspendBtn.addEventListener("click", function () {
        zenoaConfirm(
          student.is_active ? "Suspendre l'accès de cet élève ? Il ne pourra plus se connecter." : "Réactiver l'accès de cet élève ?",
          student.is_active ? { danger: true, confirmLabel: "Suspendre" } : {}
        ).then(function (ok) {
          if (!ok) return;
          supabase.from("profiles").update({ is_active: !student.is_active }).eq("id", student.id).then(function (res) {
            if (res && res.error) { alert("Erreur : " + res.error.message); return; }
            openEleveDetail(student.id);
          });
        });
      });
      actions.appendChild(suspendBtn);

      var deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn danger btn-sm";
      deleteBtn.textContent = "Supprimer le compte";
      deleteBtn.addEventListener("click", function () {
        zenoaConfirm(
          "Supprimer définitivement le compte et toutes les données de " + (student.pseudo || student.email) + " ? Cette action est irréversible.",
          { danger: true, confirmLabel: "Supprimer définitivement" }
        ).then(function (ok) {
          if (!ok) return;
          supabase.rpc("admin_delete_student", { student_id: student.id }).then(function (res) {
            if (res && res.error) { alert("Erreur : " + res.error.message); return; }
            showToast("Compte supprimé.");
            switchToView("eleves");
            loadElevesData();
            loadDashboardData();
          });
        });
      });
      actions.appendChild(deleteBtn);
      content.appendChild(actions);

      // ----- Notes privées -----
      var notesSection = document.createElement("div");
      notesSection.className = "glass-card panel-section";
      notesSection.innerHTML =
        '<div class="panel-title">Notes privées (visibles seulement par toi)</div>' +
        '<textarea class="eleve-notes-textarea" rows="3" placeholder="Ex : a besoin d\'un suivi rapproché..."></textarea>' +
        '<button type="button" class="btn btn-sm eleve-notes-save-btn" style="margin-top:8px;">Enregistrer</button>';
      var notesTextarea = notesSection.querySelector(".eleve-notes-textarea");
      notesTextarea.value = student.admin_notes || "";
      notesSection.querySelector(".eleve-notes-save-btn").addEventListener("click", function () {
        supabase.from("profiles").update({ admin_notes: notesTextarea.value }).eq("id", student.id).then(function (res) {
          if (res && res.error) { alert("Erreur : " + res.error.message); return; }
          showToast("Notes enregistrées.");
        });
      });
      content.appendChild(notesSection);
    }

    // ---------- Page Contenu ----------
    // Simplifié à la demande : ajout de modules (titre + image de
    // couverture) et de ressources (titre + catégorie + fichier ou
    // prompt). Les leçons/nouveautés/événements restent dans Supabase
    // (tables course_lessons/home_news/calendar_events, toujours lues
    // côté élève) mais n'ont plus d'interface d'ajout/édition dédiée
    // ici : à gérer depuis le Table Editor de Supabase si besoin.
    var adminModules = [];
    var adminResources = [];

    function loadContenuData() {
      Promise.all([
        supabase.from("course_modules").select("id,position,title,cover_url").order("position"),
        supabase.from("resources").select("id,category,title,description,resource_type,file_url,prompt_text,position").order("position")
      ]).then(function (results) {
        adminModules = (results[0] && results[0].data) || [];
        adminResources = (results[1] && results[1].data) || [];
        renderContenuModules();
        renderContenuResources();
      });
    }

    function renderContenuModules() {
      var list = document.getElementById("contenu-modules-list");
      if (!list) return;
      list.innerHTML = "";
      if (!adminModules.length) {
        list.innerHTML = '<div class="cours-empty">Aucun module pour le moment.</div>';
        return;
      }
      var grid = document.createElement("div");
      grid.className = "contenu-modules-grid";
      adminModules.slice().sort(function (a, b) { return a.position - b.position; }).forEach(function (mod) {
        var card = document.createElement("div");
        card.className = "glass-card contenu-module-card";
        if (mod.cover_url) {
          var img = document.createElement("img");
          img.className = "contenu-module-cover";
          img.src = mod.cover_url;
          img.alt = mod.title;
          card.appendChild(img);
        } else {
          var placeholder = document.createElement("div");
          placeholder.className = "contenu-module-cover-placeholder";
          placeholder.textContent = "Pas d'image";
          card.appendChild(placeholder);
        }
        var titleRow = document.createElement("div");
        titleRow.className = "contenu-module-title-row";
        var titleEl = document.createElement("div");
        titleEl.className = "contenu-module-title";
        titleEl.textContent = mod.title;
        titleRow.appendChild(titleEl);
        var deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "btn danger btn-sm admin-icon-x-btn";
        deleteBtn.textContent = "✕";
        deleteBtn.title = "Supprimer ce module";
        deleteBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          zenoaConfirm('Supprimer le module "' + mod.title + '" et toutes ses leçons ? Cette action est irréversible.', { danger: true, confirmLabel: "Supprimer" }).then(function (ok) {
            if (!ok) return;
            supabase.from("course_modules").delete().eq("id", mod.id).then(function (res) {
              if (res && res.error) { alert("Erreur : " + res.error.message); return; }
              loadContenuData();
            });
          });
        });
        titleRow.appendChild(deleteBtn);
        card.appendChild(titleRow);
        card.addEventListener("click", function () { openModuleDetail(mod); });
        grid.appendChild(card);
      });
      list.appendChild(grid);
    }

    var MODULE_COVER_MAX_BYTES = 5 * 1024 * 1024; // 5 Mo
    var MODULE_COVER_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

    function openModuleModal(mod) {
      openAdminModal(mod ? "Modifier le module" : "Ajouter un module",
        '<div class="field"><label class="field-label">Titre</label><input type="text" id="cf-title"></div>' +
        '<div class="field"><label class="field-label">Image de couverture (format rectangulaire' + (mod ? ', laisse vide pour garder l\'actuelle' : ', optionnelle') + ')</label><input type="file" id="cf-cover" accept="image/png,image/jpeg,image/webp"></div>',
        function (done) {
          var title = document.getElementById("cf-title").value.trim();
          if (!title) { done("Le titre est obligatoire."); return; }
          var fileInput = document.getElementById("cf-cover");
          var file = fileInput && fileInput.files && fileInput.files[0];
          if (file && file.size > MODULE_COVER_MAX_BYTES) { done("L'image dépasse 5 Mo."); return; }
          if (file && MODULE_COVER_ALLOWED_TYPES.indexOf(file.type) === -1) { done("Type d'image non autorisé (PNG, JPEG ou WebP uniquement)."); return; }

          var uploadPromise = file
            ? supabase.storage.from("module-covers").upload(Date.now() + "-" + file.name, file).then(function (res) {
                if (res && res.error) throw res.error;
                var pub = supabase.storage.from("module-covers").getPublicUrl(res.data.path);
                return (pub && pub.data && pub.data.publicUrl) || null;
              })
            : Promise.resolve(mod ? undefined : null);

          uploadPromise
            .then(function (coverUrl) {
              var payload = { title: title };
              if (coverUrl !== undefined) payload.cover_url = coverUrl;
              return mod
                ? supabase.from("course_modules").update(payload).eq("id", mod.id)
                : supabase.from("course_modules").insert(Object.assign({ position: adminModules.length }, payload));
            })
            .then(function (res) {
              if (res && res.error) { done("Erreur : " + res.error.message); return; }
              done();
              loadContenuData();
              if (mod) { mod.title = title; openModuleDetail(mod); }
            })
            .catch(function (err) {
              done("Erreur : " + (err && err.message ? err.message : "envoi de l'image impossible."));
            });
        });
      document.getElementById("cf-title").value = mod ? mod.title : "";
    }
    var contenuAddModuleBtn = document.getElementById("contenu-add-module-btn");
    if (contenuAddModuleBtn) contenuAddModuleBtn.addEventListener("click", function () { openModuleModal(); });

    // ---------- Détail d'un module : voir/ajouter/modifier/supprimer
    // ses leçons ----------
    var currentModuleDetail = null;
    var moduleDetailLessons = [];

    function openModuleDetail(mod) {
      currentModuleDetail = mod;
      switchToView("module-detail");
      var titleEl = document.getElementById("module-detail-title");
      if (titleEl) titleEl.textContent = mod.title;
      var content = document.getElementById("module-detail-content");
      if (content) content.innerHTML = '<div class="cours-empty">Chargement…</div>';
      supabase.from("course_lessons").select("id,module_id,position,title,duration_minutes,content_type,content_text,video_url,status").eq("module_id", mod.id).order("position").then(function (res) {
        moduleDetailLessons = (res && res.data) || [];
        renderModuleDetail();
      });
    }

    var btnBackModuleDetail = document.getElementById("btn-back-module-detail");
    if (btnBackModuleDetail) btnBackModuleDetail.addEventListener("click", function () { switchToView("contenu"); });

    function renderModuleDetail() {
      var content = document.getElementById("module-detail-content");
      if (!content || !currentModuleDetail) return;
      content.innerHTML = "";

      var infoCard = document.createElement("div");
      infoCard.className = "glass-card panel-section";
      infoCard.innerHTML =
        '<div class="admin-panel-head">' +
          '<div class="panel-title" style="margin-bottom:0;"></div>' +
        '</div>';
      infoCard.querySelector(".panel-title").textContent = currentModuleDetail.title;
      var editModBtn = document.createElement("button");
      editModBtn.type = "button";
      editModBtn.className = "btn blue btn-sm";
      editModBtn.textContent = "Modifier le titre / l'image";
      editModBtn.addEventListener("click", function () { openModuleModal(currentModuleDetail); });
      infoCard.querySelector(".admin-panel-head").appendChild(editModBtn);
      content.appendChild(infoCard);

      var addLessonBtn = document.createElement("button");
      addLessonBtn.type = "button";
      addLessonBtn.id = "module-detail-add-lesson-btn";
      addLessonBtn.className = "btn blue btn-sm";
      addLessonBtn.style.marginTop = "4px";
      addLessonBtn.textContent = "+ Ajouter une leçon";
      addLessonBtn.addEventListener("click", function () { openLessonModal(currentModuleDetail, null); });
      content.appendChild(addLessonBtn);

      var list = document.createElement("div");
      list.id = "module-detail-lessons-list";
      list.style.marginTop = "14px";
      content.appendChild(list);
      renderModuleDetailLessons();
    }

    function renderModuleDetailLessons() {
      var list = document.getElementById("module-detail-lessons-list");
      if (!list) return;
      list.innerHTML = "";
      if (!moduleDetailLessons.length) {
        list.innerHTML = '<div class="cours-empty">Aucune leçon pour le moment.</div>';
        return;
      }
      moduleDetailLessons.slice().sort(function (a, b) { return a.position - b.position; }).forEach(function (lesson) {
        var item = document.createElement("div");
        item.className = "glass-card contenu-resource-item";
        item.innerHTML =
          '<div class="contenu-resource-item-info">' +
            '<div class="contenu-resource-item-title"></div>' +
            '<div class="contenu-resource-item-meta"></div>' +
          '</div>' +
          '<div class="contenu-resource-item-actions"></div>';
        item.querySelector(".contenu-resource-item-title").textContent = lesson.title;
        item.querySelector(".contenu-resource-item-meta").textContent =
          (lesson.content_type === "video" ? "Vidéo" : "Texte") +
          (lesson.duration_minutes ? " · " + lesson.duration_minutes + " min" : "") +
          " · " + (lesson.status === "draft" ? "Brouillon" : "Publiée");

        var actions = item.querySelector(".contenu-resource-item-actions");
        var editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "btn blue btn-sm";
        editBtn.textContent = "Modifier";
        editBtn.addEventListener("click", function () { openLessonModal(currentModuleDetail, lesson); });
        actions.appendChild(editBtn);

        var deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "btn danger btn-sm admin-icon-x-btn";
        deleteBtn.textContent = "✕";
        deleteBtn.title = "Supprimer cette leçon";
        deleteBtn.addEventListener("click", function () {
          zenoaConfirm('Supprimer la leçon "' + lesson.title + '" ?', { danger: true, confirmLabel: "Supprimer" }).then(function (ok) {
            if (!ok) return;
            supabase.from("course_lessons").delete().eq("id", lesson.id).then(function (res) {
              if (res && res.error) { alert("Erreur : " + res.error.message); return; }
              openModuleDetail(currentModuleDetail);
            });
          });
        });
        actions.appendChild(deleteBtn);

        list.appendChild(item);
      });
    }

    function openLessonModal(mod, lesson) {
      // Pas de choix de type de contenu : toutes les leçons sont des
      // vidéos (content_type fixé à "video" automatiquement).
      openAdminModal(lesson ? "Modifier la leçon" : "Ajouter une leçon",
        '<div class="field"><label class="field-label">Titre</label><input type="text" id="cf-title"></div>' +
        '<div class="field"><label class="field-label">Lien vidéo</label><input type="text" id="cf-video" placeholder="https://..."></div>' +
        '<div class="field"><label class="field-label">Texte / description (optionnel)</label><textarea id="cf-text" rows="3"></textarea></div>' +
        '<div class="field"><label class="field-label">Durée (minutes)</label><input type="number" id="cf-duration" min="1"></div>' +
        '<div class="field"><label class="field-label">Statut</label><select id="cf-status"><option value="published">Publiée</option><option value="draft">Brouillon</option></select></div>',
        function (done) {
          var title = document.getElementById("cf-title").value.trim();
          if (!title) { done("Le titre est obligatoire."); return; }
          var durationVal = document.getElementById("cf-duration").value;
          var payload = {
            title: title,
            content_type: "video",
            video_url: document.getElementById("cf-video").value.trim() || null,
            content_text: document.getElementById("cf-text").value.trim() || null,
            duration_minutes: durationVal ? parseInt(durationVal, 10) : null,
            status: document.getElementById("cf-status").value
          };
          var query = lesson
            ? supabase.from("course_lessons").update(payload).eq("id", lesson.id)
            : supabase.from("course_lessons").insert(Object.assign({
                module_id: mod.id,
                position: moduleDetailLessons.length
              }, payload));
          query.then(function (res) {
            if (res && res.error) { done("Erreur : " + res.error.message); return; }
            done();
            openModuleDetail(mod);
          });
        });
      document.getElementById("cf-title").value = lesson ? lesson.title : "";
      document.getElementById("cf-video").value = (lesson && lesson.video_url) || "";
      document.getElementById("cf-text").value = (lesson && lesson.content_text) || "";
      document.getElementById("cf-duration").value = (lesson && lesson.duration_minutes) || "";
      document.getElementById("cf-status").value = (lesson && lesson.status) || "published";
    }

    function renderContenuResources() {
      var list = document.getElementById("contenu-resources-list");
      if (!list) return;
      list.innerHTML = "";
      if (!adminResources.length) {
        list.innerHTML = '<div class="cours-empty">Aucune ressource pour le moment.</div>';
        return;
      }
      adminResources.slice().sort(function (a, b) { return a.position - b.position; }).forEach(function (r) {
        var item = document.createElement("div");
        item.className = "glass-card contenu-resource-item";
        item.innerHTML =
          '<div class="contenu-resource-item-info">' +
            '<div class="contenu-resource-item-title"></div>' +
            '<div class="contenu-resource-item-meta"></div>' +
          '</div>';
        item.querySelector(".contenu-resource-item-title").textContent = r.title;
        item.querySelector(".contenu-resource-item-meta").textContent = r.resource_type === "prompt" ? "Texte" : "Lien";

        var deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "btn danger btn-sm admin-icon-x-btn";
        deleteBtn.textContent = "✕";
        deleteBtn.title = "Supprimer cette ressource";
        deleteBtn.addEventListener("click", function () {
          zenoaConfirm('Supprimer la ressource "' + r.title + '" ?', { danger: true, confirmLabel: "Supprimer" }).then(function (ok) {
            if (!ok) return;
            supabase.from("resources").delete().eq("id", r.id).then(function (res) {
              if (res && res.error) { alert("Erreur : " + res.error.message); return; }
              loadContenuData();
              resourcesDataLoaded = false;
              loadResourcesData();
            });
          });
        });
        item.appendChild(deleteBtn);

        list.appendChild(item);
      });
    }

    // Catégorie fixe (le choix de catégorie a été retiré du formulaire
    // pour rester simple) : les ressources ajoutées ici tombent toutes
    // dans un même groupe "Ressources" sur la page élève.
    var DEFAULT_RESOURCE_CATEGORY = "Ressources";

    function openResourceModal() {
      openAdminModal("Ajouter une ressource",
        '<div class="field"><label class="field-label">Titre</label><input type="text" id="cf-title"></div>' +
        '<div class="field"><label class="field-label">Lien (si c\'est un fichier/une page à ouvrir)</label><input type="text" id="cf-file-url" placeholder="https://..."></div>' +
        '<div class="field"><label class="field-label">Ou directement du texte (si pas de lien)</label><textarea id="cf-prompt" rows="4"></textarea></div>',
        function (done) {
          var title = document.getElementById("cf-title").value.trim();
          var fileUrl = document.getElementById("cf-file-url").value.trim();
          var text = document.getElementById("cf-prompt").value.trim();
          if (!title) { done("Le titre est obligatoire."); return; }
          if (!fileUrl && !text) { done("Ajoute un lien ou du texte."); return; }
          var payload = {
            category: DEFAULT_RESOURCE_CATEGORY,
            title: title,
            resource_type: fileUrl ? "file" : "prompt",
            file_url: fileUrl || null,
            prompt_text: fileUrl ? null : text,
            position: adminResources.length
          };
          supabase.from("resources").insert(payload).then(function (res) {
            if (res && res.error) { done("Erreur : " + res.error.message); return; }
            done();
            loadContenuData();
            resourcesDataLoaded = false;
            loadResourcesData();
          });
        });
      document.getElementById("cf-title").value = "";
      document.getElementById("cf-file-url").value = "";
      document.getElementById("cf-prompt").value = "";
    }
    var contenuAddResourceBtn = document.getElementById("contenu-add-resource-btn");
    if (contenuAddResourceBtn) contenuAddResourceBtn.addEventListener("click", function () { openResourceModal(); });

    // ---------- Page Accès et codes ----------
    var adminCodes = [];
    var codesFilter = "all";
    // Alphabet sans caractères ambigus (0/O, 1/I/L) pour que les codes
    // tapés à la main se trompent le moins possible.
    var CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    function generateRandomCode() {
      function randomChars(n) {
        var bytes = new Uint8Array(n);
        crypto.getRandomValues(bytes);
        var out = "";
        for (var i = 0; i < n; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
        return out;
      }
      return randomChars(3) + "-" + randomChars(6);
    }

    function loadCodesData() {
      Promise.all([
        supabase.from("access_codes").select("code,type,used_by,created_at,note,disabled,expires_access_days,intended_pseudo,intended_email").eq("type", "membre").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,pseudo,email,created_at")
      ]).then(function (results) {
        var codes = (results[0] && results[0].data) || [];
        var profilesById = {};
        ((results[1] && results[1].data) || []).forEach(function (p) { profilesById[p.id] = p; });
        adminCodes = codes.map(function (c) {
          c._usedByProfile = c.used_by ? profilesById[c.used_by] : null;
          return c;
        });
        renderCodesFilterPills();
        renderCodesList();
      });
    }

    function codeStatus(c) {
      if (c.used_by) return "used";
      return "available";
    }
    function codeStatusLabel(status) {
      if (status === "used") return "Utilisé";
      return "Disponible";
    }
    function codeStatusPillClass(status) {
      if (status === "used") return "status-churn";
      return "status-actif";
    }

    function renderCodesFilterPills() {
      var wrap = document.getElementById("codes-filter-pills");
      if (!wrap) return;
      wrap.innerHTML = "";
      [{ key: "all", label: "Tous" }, { key: "available", label: "Disponibles" }, { key: "used", label: "Utilisés" }].forEach(function (f) {
        var pill = document.createElement("button");
        pill.type = "button";
        pill.className = "ressources-cat-pill" + (codesFilter === f.key ? " active" : "");
        pill.textContent = f.label;
        pill.addEventListener("click", function () { codesFilter = f.key; renderCodesFilterPills(); renderCodesList(); });
        wrap.appendChild(pill);
      });
    }

    function renderCodesList() {
      var list = document.getElementById("codes-list");
      if (!list) return;
      var searchInput = document.getElementById("codes-search-input");
      var q = (searchInput ? searchInput.value : "").trim().toLowerCase();
      var filtered = adminCodes.filter(function (c) {
        if (codesFilter !== "all" && codeStatus(c) !== codesFilter) return false;
        if (q) {
          var hay = (c.code + " " + (c.intended_pseudo || "") + " " + (c.intended_email || "") +
            " " + (c._usedByProfile ? (c._usedByProfile.pseudo || "") + " " + (c._usedByProfile.email || "") : "")).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });
      list.innerHTML = "";
      if (!filtered.length) {
        list.innerHTML = '<div class="cours-empty">Aucun code trouvé.</div>';
        return;
      }

      filtered.forEach(function (c) {
        var status = codeStatus(c);
        var item = document.createElement("div");
        item.className = "glass-card admin-code-item";
        item.innerHTML =
          '<div class="admin-code-head"><span class="admin-code-value"></span><span class="status-pill"></span></div>' +
          '<div class="admin-code-meta"></div>' +
          '<div class="admin-code-actions"></div>';
        item.querySelector(".admin-code-value").textContent = c.code;
        var pill = item.querySelector(".status-pill");
        pill.classList.add(codeStatusPillClass(status));
        pill.textContent = codeStatusLabel(status);

        var metaParts = [];
        if (c.intended_pseudo || c.intended_email) metaParts.push("Pour : " + (c.intended_pseudo || c.intended_email));
        if (c.expires_access_days) metaParts.push(c.expires_access_days + " jours d'accès prévus");
        if (c.note) metaParts.push("Note : " + c.note);
        if (c._usedByProfile) metaParts.push("Utilisé par " + (c._usedByProfile.pseudo || c._usedByProfile.email) + " le " + formatShortDate(c._usedByProfile.created_at));
        item.querySelector(".admin-code-meta").textContent = metaParts.length ? metaParts.join(" · ") : "Aucune information supplémentaire.";

        var actions = item.querySelector(".admin-code-actions");
        var copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "btn btn-sm";
        copyBtn.textContent = "Copier le lien";
        copyBtn.addEventListener("click", function () {
          var link = window.location.origin + window.location.pathname + "?code=" + encodeURIComponent(c.code);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(function () { showToast("Lien copié !"); });
          } else {
            showToast("Copie non disponible sur ce navigateur.");
          }
        });
        actions.appendChild(copyBtn);

        var deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "btn danger btn-sm admin-icon-x-btn";
        deleteBtn.textContent = "✕";
        deleteBtn.title = "Supprimer ce code";
        deleteBtn.addEventListener("click", function () {
          // Si quelqu'un s'est déjà inscrit avec ce code, le supprimer
          // coupe aussi son accès immédiatement (sinon ça n'empêcherait
          // que de FUTURES inscriptions, pas la personne déjà connectée
          // avec ce compte).
          var msg = c._usedByProfile
            ? "Supprimer ce code ? " + (c._usedByProfile.pseudo || c._usedByProfile.email) + " ne pourra plus se connecter."
            : "Supprimer ce code ? Il ne pourra plus être utilisé pour s'inscrire.";
          zenoaConfirm(msg, { danger: true, confirmLabel: "Supprimer" }).then(function (ok) {
            if (!ok) return;
            var tasks = [supabase.from("access_codes").delete().eq("code", c.code)];
            if (c.used_by) tasks.push(supabase.from("profiles").update({ is_active: false }).eq("id", c.used_by));
            Promise.all(tasks).then(function (results) {
              var errRes = results.find(function (r) { return r && r.error; });
              if (errRes) { alert("Erreur : " + errRes.error.message); return; }
              loadCodesData();
            });
          });
        });
        actions.appendChild(deleteBtn);

        list.appendChild(item);
      });
    }

    var codesSearchInput = document.getElementById("codes-search-input");
    if (codesSearchInput) codesSearchInput.addEventListener("input", renderCodesList);

    var codesGenerateBtn = document.getElementById("codes-generate-btn");
    var codesGeneratedBox = document.getElementById("codes-generated-box");
    var codesGeneratedValue = document.getElementById("codes-generated-value");
    var codesGeneratedCopyBtn = document.getElementById("codes-generated-copy-btn");
    if (codesGenerateBtn) {
      codesGenerateBtn.addEventListener("click", function () {
        var code = generateRandomCode();
        codesGenerateBtn.disabled = true;
        supabase.from("access_codes").insert({ code: code, type: "membre" }).then(function (res) {
          codesGenerateBtn.disabled = false;
          if (res && res.error) { alert("Erreur : " + res.error.message); return; }
          if (codesGeneratedValue) codesGeneratedValue.textContent = code;
          if (codesGeneratedBox) codesGeneratedBox.hidden = false;
          loadCodesData();
        });
      });
    }
    if (codesGeneratedCopyBtn) {
      codesGeneratedCopyBtn.addEventListener("click", function () {
        var code = codesGeneratedValue ? codesGeneratedValue.textContent : "";
        if (!code) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(function () { showToast("Code copié !"); });
        } else {
          showToast("Copie non disponible sur ce navigateur.");
        }
      });
    }

    // ----- Rechargement des données admin à chaque visite d'une page
    // (contrairement aux pages élève, les données admin changent souvent :
    // nouvel élève, nouveau dépôt... donc pas de cache "chargé une fois"). -----
    var navChefDashboard = document.getElementById("nav-chef-dashboard");
    if (navChefDashboard) navChefDashboard.addEventListener("click", loadDashboardData);
    var navChefEleves = document.getElementById("nav-chef-eleves");
    if (navChefEleves) navChefEleves.addEventListener("click", loadElevesData);
    var navChefContenu = document.getElementById("nav-chef-contenu");
    if (navChefContenu) navChefContenu.addEventListener("click", loadContenuData);
    var navChefCodes = document.getElementById("nav-chef-codes");
    if (navChefCodes) navChefCodes.addEventListener("click", loadCodesData);

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
      currentDesiredRoleText = customRole || "Élève";
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
    // "Membre" par défaut : il n'y a que deux rôles possibles (chef, qui
    // crée son compte autrement, et tous les autres qui sont des élèves),
    // donc on l'affiche clairement comme tel.
    var rolePillCreate = document.getElementById("role-pill-create");
    if (rolePillCreate) {
      new MutationObserver(function () {
        if (rolePillCreate.textContent === "Membre") rolePillCreate.textContent = "Élève";
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
        renderAccueil();
        // Horodatage de la dernière connexion, utilisé par le Tableau de
        // bord admin ("Qui avance" / "Qui est bloqué"). Non bloquant :
        // si la colonne n'existe pas encore (migration admin-panel.sql
        // pas encore passée), l'erreur est ignorée, rien d'autre ne casse.
        supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", userId).then(function () {});
        // Chaque rôle a sa propre navigation à gauche : élèves (Accueil...)
        // ou chef (Tableau de bord...), jamais les deux en même temps.
        var isChef = me.role === "chef";
        document.querySelectorAll(".eleve-only").forEach(function (el) {
          el.style.display = isChef ? "none" : "flex";
        });
        document.querySelectorAll(".chef-only").forEach(function (el) {
          el.style.display = isChef ? "flex" : "none";
        });
        var landingView = isChef ? "tableau-de-bord" : "accueil";
        switchToView(landingView);
        document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
        var landingNav = document.querySelector('.nav-item[data-view="' + landingView + '"]');
        if (landingNav) landingNav.classList.add("active");
        if (isChef) loadDashboardData();

        // Champ ajouté par une migration plus récente (mission_done) :
        // récupéré à part, pour ne jamais bloquer le reste de l'appli
        // (nav, page Accueil) si la migration n'a pas encore été
        // exécutée et que la colonne n'existe pas encore.
        supabase.from("profiles").select("mission_done").eq("id", userId).single().then(function (res2) {
          if (!res2 || !res2.data) return;
          me.mission_done = res2.data.mission_done;
          var missionCheck = document.getElementById("accueil-mission-check");
          var missionRow = document.getElementById("accueil-mission-row");
          if (missionCheck) {
            missionCheck.checked = !!me.mission_done;
            if (missionRow) missionRow.classList.toggle("done", missionCheck.checked);
          }
        });
      });
    }

    supabase.auth.getSession().then(function (res) {
      var session = res && res.data && res.data.session;
      if (session && session.user) {
        boot(session.user.id);
        loadCourseData(session.user.id);
        loadProjectData(session.user.id);
        loadResourcesData();
        loadCalendarData();
        loadHomeNews();
      }
    });
    supabase.auth.onAuthStateChange(function (event, session) {
      if (session && session.user) {
        boot(session.user.id);
        loadCourseData(session.user.id);
        loadProjectData(session.user.id);
        loadResourcesData();
        loadCalendarData();
        loadHomeNews();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { loadSupabase(init); });
  } else {
    loadSupabase(init);
  }
})();
