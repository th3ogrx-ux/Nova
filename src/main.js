import "./style.css";
import { confirmDialog } from "./confirm-dialog.js";
import { getSession, onAuthChange, renderAuthScreen, signOut } from "./auth.js";
import { supabase } from "./supabase.js";
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

async function boot() {
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
}

boot();
