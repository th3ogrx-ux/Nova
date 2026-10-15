import "./style.css";
import { confirmDialog } from "./confirm-dialog.js";
import { getSession, onAuthChange, renderAuthScreen } from "./auth.js";
import { supabase, supabaseConfigured } from "./supabase.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderRecherche } from "./views/recherche.js";
import { renderProspects } from "./views/prospects.js";
import { renderMaquettes } from "./views/maquettes.js";
import { renderDemoPage } from "./views/demo.js";
import { renderSettings, setOnProfileUpdated, applyAvatarPreview } from "./views/settings.js";
import { applyTheme } from "./theme.js";

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
  prospects: { render: renderProspects, title: "Prospects" },
  maquettes: { render: renderMaquettes, title: "Maquettes" },
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

function switchView(name) {
  const view = VIEWS[name] || VIEWS.dashboard;
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === name);
  });
  document.title = view.title + " — Zenoa Radar";
  view.render(viewRoot);
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

async function refreshSidebarProfile(session) {
  const email = session.user.email || "";
  const { data: profile } = await supabase.from("user_profiles").select("pseudo, avatar_url").eq("user_id", session.user.id).maybeSingle();
  const pseudo = profile && profile.pseudo;
  document.getElementById("my-name-display").textContent = pseudo || email;
  applyAvatarPreview(document, "#my-avatar", (profile && profile.avatar_url) || null, email);
}

async function showApp(session) {
  screenAuth.style.display = "none";
  app.style.display = "";

  setOnProfileUpdated(() => refreshSidebarProfile(session));
  await refreshSidebarProfile(session);

  switchView("dashboard");
}

function showAuth() {
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
