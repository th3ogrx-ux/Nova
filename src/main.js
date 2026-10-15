import "./style.css";
import { confirmDialog } from "./confirm-dialog.js";
import { getSession, onAuthChange, renderAuthScreen, signOut } from "./auth.js";
import { supabase, supabaseConfigured } from "./supabase.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderRecherche } from "./views/recherche.js";
import { renderProspects } from "./views/prospects.js";
import { renderMaquettes } from "./views/maquettes.js";
import { renderDemoPage } from "./views/demo.js";

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
  recherche: { render: renderRecherche, title: "Recherche" },
  prospects: { render: renderProspects, title: "Prospects" },
  maquettes: { render: renderMaquettes, title: "Maquettes" },
};

const screenAuth = document.getElementById("screen-auth");
const app = document.getElementById("app");
const viewRoot = document.getElementById("view-root");
const topbarTitle = document.getElementById("topbar-title");

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
  topbarTitle.textContent = view.title;
  view.render(viewRoot);
}

function wireNav() {
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.addEventListener("click", () => switchView(el.dataset.view));
  });
  document.getElementById("sidebar-toggle").addEventListener("click", () => {
    app.classList.toggle("sidebar-collapsed");
  });
  document.getElementById("logout-btn").addEventListener("click", async () => {
    const ok = await confirmDialog("Te déconnecter ?", { confirmLabel: "Se déconnecter" });
    if (ok) await signOut();
  });
}

async function showApp(session) {
  screenAuth.style.display = "none";
  app.style.display = "";

  const email = session.user.email || "";
  document.getElementById("my-email-display").textContent = email;
  document.getElementById("my-avatar-initial").textContent = email.charAt(0).toUpperCase();

  const { data: userPlan } = await supabase
    .from("user_plans")
    .select("plan_id, plans(label)")
    .eq("user_id", session.user.id)
    .single();
  document.getElementById("my-plan-display").textContent = (userPlan && userPlan.plans && userPlan.plans.label) || "Gratuit";

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
