// Polices hébergées avec le site (aucune requête vers Google : pas de transfert d'adresse IP à un tiers).
import "@fontsource/orbitron/latin-700.css";
import "@fontsource/orbitron/latin-900.css";
import "@fontsource/playfair-display/latin-600.css";
import "@fontsource/playfair-display/latin-700.css";
import "./style.css";
import { confirmDialog } from "./confirm-dialog.js";
import { getSession, onAuthChange, renderAuthScreen, signOut } from "./auth.js";
import { supabase, supabaseConfigured } from "./supabase.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderRecherche } from "./views/recherche.js";
import { renderRessources } from "./views/ressources.js";
import { renderEspace } from "./views/espace.js";
import { renderMessages } from "./views/messages.js";
import { renderClients } from "./views/clients.js";
import { needsPasswordChange, renderForcePassword } from "./force-password.js";
import { startUnreadWatch, stopUnreadWatch, onUnread } from "./espace-unread.js";
import { mfaState, renderMfaChallenge } from "./mfa.js";
import { logEvent, loadSecurityAlerts } from "./security-log.js";
import { renderDemoPage } from "./views/demo.js";
import { renderSettings, setOnProfileUpdated, applyAvatarPreview } from "./views/settings.js";
import { applyTheme } from "./theme.js";
import { setCurrentUser, getCurrentRole, loadRole } from "./session.js";
import { initA11y, markActiveNav } from "./a11y.js";
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

// "roles" : qui peut ouvrir la page. Un client n'a accès qu'à son espace et à
// ses paramètres ; le Radar et les Ressources lui sont fermés (la base
// de données le lui interdit aussi : ceci évite seulement de lui montrer des
// pages vides ou de lancer des recherches à sa place).
const VIEWS = {
  dashboard: { render: renderDashboard, title: "Tableau de bord", roles: ["admin", "radar"] },
  recherche: { render: renderRecherche, title: "Zenoa Radar", roles: ["admin", "radar"] },
  ressources: { render: renderRessources, title: "Ressources", roles: ["admin", "radar"] },
  clients: { render: renderClients, title: "Clients", roles: ["admin"] },
  espace: { render: renderEspace, title: "Mon espace", roles: ["client", "admin"] },
  messages: { render: renderMessages, title: "Messages", roles: ["client", "admin"] },
  settings: { render: renderSettings, title: "Paramètres", roles: ["admin", "radar", "client"] },
};

const canOpen = (name) => !!VIEWS[name] && VIEWS[name].roles.includes(getCurrentRole());
const homeView = () => (getCurrentRole() === "client" ? "espace" : "dashboard");

// Affiche dans le menu uniquement les pages permises au rôle courant.
function applyRoleToNav() {
  const role = getCurrentRole();
  document.querySelectorAll(".nav-item[data-roles]").forEach((el) => {
    el.hidden = !el.dataset.roles.split(" ").includes(role);
  });
  // Pour toi (admin), cette page est un aperçu de ce que voient tes clients.
  document.getElementById("espace-nav-label").textContent = role === "admin" ? "Aperçu client" : "Mon espace";
}

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
  if (!canOpen(name)) {
    if (VIEWS[name]) logEvent("access_denied", "page " + name); // page existante mais interdite à ce rôle
    name = homeView();
  }
  const view = VIEWS[name];
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === name);
  });
  markActiveNav(name);
  document.title = (name === "espace" && getCurrentRole() === "admin" ? "Aperçu client" : view.title) + " — Zenoa Radar";

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
  const queue = Object.keys(VIEWS).filter((n) => canOpen(n) && !viewCache.has(n));
  const next = () => {
    const name = queue.shift();
    if (!name || !shownUserId) return;
    const entry = viewCache.get(name) || mountView(name);
    Promise.race([entry.ready, new Promise((r) => setTimeout(r, 1500))]).then(() => idle(next));
  };
  idle(next);
}

// L'admin a modifié des données de l'espace clients : les pages déjà préparées
// (Aperçu client, Messages) se remettent à jour discrètement.
let espaceRefreshTimer = null;
window.addEventListener("zenoa:espace-changed", () => {
  clearTimeout(espaceRefreshTimer);
  espaceRefreshTimer = setTimeout(() => { refreshInBackground("espace"); refreshInBackground("messages"); }, 600);
});

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
  document.getElementById("settings-btn-mobile").addEventListener("click", () => switchView("settings"));
  initA11y();
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

  // Le rôle est connu AVANT d'afficher quoi que ce soit : un client ne doit
  // jamais voir (ni déclencher) les pages Radar, même un instant.
  const role = await loadRole(session.user.id);
  if (shownUserId !== session.user.id) return; // déconnecté pendant l'attente
  if (!role.ok) {
    shownUserId = null;
    showFatalError(role.message + ' <a href="#" id="retry-role" style="color:var(--warm-2);">Réessayer</a>');
    document.getElementById("retry-role").addEventListener("click", (e) => { e.preventDefault(); location.reload(); });
    return;
  }

  // Compte sans profil (ex. client supprimé dont la session était encore ouverte) : aucun accès.
  if (getCurrentRole() === "none") {
    logEvent("access_denied", "compte sans profil");
    showNoAccess();
    return;
  }

  // Double authentification facultative : si elle a été activée dans Paramètres, le code est demandé.
  let mfa;
  try { mfa = await mfaState(); } catch (err) {
    console.error("[mfa]", err);
    shownUserId = null;
    showFatalError("Impossible de vérifier la double authentification. Réessaie dans un instant.");
    return;
  }
  if (mfa.needsCode) {
    app.style.display = "none";
    await new Promise((resolve) => renderMfaChallenge(screenAuth, mfa.factors[0].id, resolve));
    if (shownUserId !== session.user.id) return;
  }

  // Premier accès d'un client : mot de passe temporaire à remplacer avant tout.
  if (getCurrentRole() === "client" && needsPasswordChange(session.user)) {
    app.style.display = "none";
    await new Promise((resolve) => renderForcePassword(screenAuth, resolve));
    if (shownUserId !== session.user.id) return;
  }

  screenAuth.style.display = "none";
  app.style.display = "";
  applyRoleToNav();
  // Badge de messages non lus (client et admin uniquement).
  if (role_isMessaging()) startUnreadWatch(getCurrentRole());

  setOnProfileUpdated(() => refreshSidebarProfile(session));
  refreshSidebarProfile(session); // sans attendre : n'empêche pas la page de s'afficher

  if (getCurrentRole() === "admin") showSecurityAlerts();

  const home = homeView();
  switchView(home);
  viewCache.get(home).ready.then(prepareOtherViews);
}

const role_isMessaging = () => getCurrentRole() === "client" || getCurrentRole() === "admin";

// Pastille du menu "Messages" : nombre de messages non lus.
onUnread((count) => {
  const badge = document.getElementById("messages-badge");
  if (!badge) return;
  badge.hidden = !count;
  badge.textContent = count > 99 ? "99+" : String(count);
  badge.setAttribute("aria-label", count + " message" + (count > 1 ? "s" : "") + " non lu" + (count > 1 ? "s" : ""));
});

// Pastille du menu "Clients" : clients dont la saisie des chiffres est à faire sous 3 jours (ou en retard).
window.addEventListener("zenoa:due-count", (e) => {
  const badge = document.getElementById("clients-badge");
  if (!badge) return;
  const count = e.detail.count;
  badge.hidden = !count;
  badge.textContent = String(count);
  badge.setAttribute("aria-label", count + " client" + (count > 1 ? "s" : "") + " à mettre à jour bientôt");
});

// Alerte visible de l'admin quand l'activité est anormale (nombreux échecs de connexion, accès refusés).
async function showSecurityAlerts() {
  const alerts = await loadSecurityAlerts();
  document.getElementById("security-banner")?.remove();
  if (!alerts.length) return;
  const banner = document.createElement("div");
  banner.id = "security-banner";
  banner.setAttribute("role", "alert");
  banner.style.cssText = "background:var(--danger);color:#fff;padding:10px 16px;font-size:13px;line-height:1.5;";
  banner.textContent = "⚠️ " + alerts.join(" ") + " Détails : Paramètres > Journal de sécurité.";
  mainEl.parentNode.insertBefore(banner, mainEl);
}

function showNoAccess() {
  app.style.display = "none";
  screenAuth.style.display = "";
  screenAuth.innerHTML = `
    <div class="auth-screen">
      <div class="card auth-card">
        <span class="metal-title auth-logo">ZENOA</span>
        <h1 class="auth-title">Accès non autorisé</h1>
        <p style="font-size:13.5px;color:var(--text-dim);text-align:center;line-height:1.6;margin-bottom:18px;">
          Ce compte n'est rattaché à aucun espace (il a peut-être été supprimé). Si tu penses que c'est une erreur, contacte Zenoa.
        </p>
        <button type="button" class="btn primary" id="noaccess-logout" style="width:100%;">Se déconnecter</button>
      </div>
    </div>`;
  screenAuth.querySelector("#noaccess-logout").addEventListener("click", () => signOut());
}

function showAuth() {
  stopUnreadWatch();
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
