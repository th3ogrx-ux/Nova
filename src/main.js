import "./style.css";
import { confirmDialog } from "./confirm-dialog.js";
import { getSession, onAuthChange, renderAuthScreen } from "./auth.js";
import { supabase, supabaseConfigured } from "./supabase.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderRecherche } from "./views/recherche.js";
import { renderRessources } from "./views/ressources.js";
import { renderCrm } from "./views/crm.js";
import { renderDemoPage } from "./views/demo.js";
import { renderSettings, setOnProfileUpdated, applyAvatarPreview } from "./views/settings.js";
import { applyTheme } from "./theme.js";
import { setCurrentUser } from "./session.js";
import { readCache, writeCache, clearCache } from "./data-cache.js";

// Applique le mode sombre/clair enregistré avant le premier rendu de
// l'appli (#app reste de toute façon caché jusqu'à la connexion).
applyTheme();

// Rend confirmDialog disponible globalement, pratique à réutiliser
// depuis n'importe quelle vue sans import répété.
window.confirmDialog = confirmDialog;

// Enregistre le service worker (nécessaire pour que l'app soit
// installable comme une PWA sur la plupart des navigateurs).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => console.error("[Zenoa Radar] service worker :", err));
  });
}

const VIEWS = {
  dashboard: { render: renderDashboard, title: "Tableau de bord" },
  recherche: { render: renderRecherche, title: "Zenoa Radar" },
  crm: { render: renderCrm, title: "CRM" },
  ressources: { render: renderRessources, title: "Ressources" },
  settings: { render: renderSettings, title: "Paramètres" },
};

const screenAuth = document.getElementById("screen-auth");
const app = document.getElementById("app");
const viewRoot = document.getElementById("view-root");

// Filet de sécurité : si une erreur empêche boot() de s'exécuter
// jusqu'au bout (donc rien n'a encore été affiché — écran "vierge" =
// noir, le fond par défaut), on affiche un message au lieu de rien.
// Ne se déclenche plus une fois l'appli démarrée normalement.
window.addEventListener("error", () => {
  const stillBlank =
    screenAuth.innerHTML.trim() === "" &&
    app.style.display === "none" &&
    document.getElementById("screen-demo").style.display === "none";
  if (stillBlank) showFatalError("Une erreur inattendue s'est produite au chargement. Essaie de rafraîchir la page.");
});

// Chaque page n'est construite qu'une fois, puis gardée en mémoire et
// simplement masquée quand on en change : revenir dessus est instantané,
// sans écran "Chargement". Les autres pages sont préparées en arrière-plan
// juste après l'ouverture de l'appli. Le Tableau de bord, qui résume les
// autres pages, se remet à jour discrètement à chaque retour ; une page
// préparée un autre jour aussi (ex. nouveaux prospects du Radar).
const mainEl = document.querySelector(".main");
const viewCache = new Map(); // nom -> { el, day, scrollTop }
let currentView = null;
let shownUserId = null;

const todayStamp = () => new Date().toDateString();

function mountView(name) {
  const el = document.createElement("div");
  el.hidden = name !== currentView;
  viewRoot.appendChild(el);
  const entry = { el, day: todayStamp(), scrollTop: 0, ready: null };
  viewCache.set(name, entry);
  entry.ready = Promise.resolve(VIEWS[name].render(el)).catch((err) => console.error("[Zenoa Radar] page " + name + " :", err));
  return entry;
}

// Reconstruit la page dans un calque caché, puis remplace l'ancienne d'un
// coup une fois prête — sauf si on est en train d'y écrire ou qu'une
// fenêtre est ouverte, pour ne rien faire perdre.
function refreshInBackground(name) {
  const entry = viewCache.get(name);
  if (!entry || entry.refreshing) return;
  entry.refreshing = true;
  const fresh = document.createElement("div");
  fresh.hidden = true;
  viewRoot.appendChild(fresh);
  Promise.resolve(VIEWS[name].render(fresh))
    .then(() => {
      const busy = entry.el.contains(document.activeElement) || document.querySelector(".modal-overlay.open");
      if (busy || viewCache.get(name) !== entry) { fresh.remove(); return; }
      fresh.hidden = entry.el.hidden;
      entry.el.replaceWith(fresh);
      entry.el = fresh;
      entry.day = todayStamp();
    })
    .catch((err) => { console.error("[Zenoa Radar] mise à jour de " + name + " :", err); fresh.remove(); })
    .finally(() => { entry.refreshing = false; });
}

function switchView(name) {
  if (!VIEWS[name]) name = "dashboard";
  const view = VIEWS[name];
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === name);
  });
  document.title = view.title + " — Zenoa Radar";

  const previous = currentView && viewCache.get(currentView);
  if (previous) previous.scrollTop = mainEl.scrollTop;
  currentView = name;

  let entry = viewCache.get(name);
  if (!entry) entry = mountView(name);
  else if (name === "dashboard" || entry.day !== todayStamp()) refreshInBackground(name);
  viewCache.forEach((e, n) => { e.el.hidden = n !== name; });
  mainEl.scrollTop = entry.scrollTop;
}

// Prépare les autres pages une par une, quand le navigateur est libre.
// On n'attend pas plus de 1,5 s chacune : la génération quotidienne du
// Radar peut durer, elle ne doit pas retarder les pages suivantes.
function prepareOtherViews() {
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 300));
  const queue = Object.keys(VIEWS).filter((n) => !viewCache.has(n));
  const next = () => {
    const name = queue.shift();
    if (!name || !shownUserId) return;
    const entry = viewCache.get(name) || mountView(name);
    Promise.race([entry.ready, new Promise((r) => setTimeout(r, 1500))]).then(() => idle(next));
  };
  idle(next);
}

function clearViews() {
  viewCache.forEach((e) => e.el.remove());
  viewCache.clear();
  currentView = null;
}

function wireNav() {
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.addEventListener("click", () => switchView(el.dataset.view));
  });
  document.getElementById("sidebar-toggle").addEventListener("click", () => {
    app.classList.toggle("sidebar-collapsed");
  });
  document.getElementById("settings-btn").addEventListener("click", () => switchView("settings"));
}

// Nom et photo de la barre latérale : les derniers connus s'affichent tout
// de suite, puis ceux à jour.
async function refreshSidebarProfile(session) {
  const email = session.user.email || "";
  const cacheKey = "profile:" + session.user.id;
  const show = (profile) => {
    document.getElementById("my-name-display").textContent = (profile && profile.pseudo) || email;
    applyAvatarPreview(document, "#my-avatar", (profile && profile.avatar_url) || null, email);
  };
  const cached = readCache(cacheKey);
  show(cached);
  const { data: profile, error } = await supabase.from("user_profiles").select("pseudo, avatar_url").eq("user_id", session.user.id).maybeSingle();
  if (error) return;
  writeCache(cacheKey, profile || {});
  show(profile);
}

async function showApp(session) {
  // Supabase prévient aussi à chaque renouvellement de la connexion (environ
  // toutes les heures) : on ne recharge l'appli que si l'utilisateur change.
  if (shownUserId === session.user.id) return;
  clearViews();
  shownUserId = session.user.id;
  setCurrentUser(session.user);
  screenAuth.style.display = "none";
  app.style.display = "";

  setOnProfileUpdated(() => refreshSidebarProfile(session));
  refreshSidebarProfile(session); // sans attendre : n'empêche pas la page de s'afficher

  switchView("dashboard");
  viewCache.get("dashboard").ready.then(prepareOtherViews);
}

function showAuth() {
  // Déconnexion : on oublie l'utilisateur et ses données gardées en mémoire.
  if (shownUserId) clearCache();
  shownUserId = null;
  setCurrentUser(null);
  clearViews();
  app.style.display = "none";
  screenAuth.style.display = "";
  renderAuthScreen(screenAuth, async () => {
    const session = await getSession();
    if (session) showApp(session);
  });
}

// Affiche un message d'erreur clair à la place de l'écran noir qu'on
// aurait sinon (fond noir par défaut, rien dessus si le script
// plante). Utilisé pour toute erreur qui empêcherait l'appli de
// démarrer normalement.
function showFatalError(message) {
  document.getElementById("app").style.display = "none";
  document.getElementById("screen-demo").style.display = "none";
  screenAuth.style.display = "";
  screenAuth.innerHTML = `
    <div class="auth-screen">
      <div class="card auth-card">
        <span class="metal-title auth-logo">ZENOA RADAR</span>
        <h1 class="auth-title" style="color:var(--danger);">Oups, un problème</h1>
        <p style="font-size:13.5px;color:var(--text-dim);text-align:center;line-height:1.6;">${message}</p>
      </div>
    </div>
  `;
}

async function boot() {
  if (!supabaseConfigured) {
    showFatalError("Le site n'est pas correctement configuré (connexion à la base de données impossible). Si tu es l'administrateur : vérifie VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans Vercel (Project Settings → Environment Variables), puis relance un déploiement — ces variables ne sont prises en compte qu'au moment du build.");
    return;
  }

  try {
    // Page publique de maquette : aucune authentification, ignore tout
    // le reste de l'appli (sidebar/topbar/auth).
    const demoMatch = window.location.pathname.match(/^\/demo\/([^/]+)/);
    if (demoMatch) {
      document.getElementById("screen-auth").style.display = "none";
      document.getElementById("app").style.display = "none";
      const demoScreen = document.getElementById("screen-demo");
      demoScreen.style.display = "";
      await renderDemoPage(demoScreen, decodeURIComponent(demoMatch[1]));
      return;
    }

    wireNav();
    const session = await getSession();
    if (session) {
      showApp(session);
    } else {
      showAuth();
    }

    onAuthChange((session) => {
      if (session) showApp(session);
      else showAuth();
    });
  } catch (err) {
    console.error("[Zenoa Radar] Erreur au démarrage :", err);
    showFatalError("Une erreur inattendue a empêché le chargement de la page. Essaie de rafraîchir ; si ça persiste, contacte l'administrateur.");
  }
}

boot();
