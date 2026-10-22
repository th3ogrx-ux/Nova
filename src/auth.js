// Inscription / connexion par email + mot de passe (Supabase Auth).
import { emailHash, isLoginLocked, logLoginFailure, logEvent } from "./security-log.js";
import { supabase } from "./supabase.js";

// Renvoie la session active, ou null si personne n'est connecté.
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Rappelle `onChange(session)` à chaque connexion/déconnexion.
export function onAuthChange(onChange) {
  supabase.auth.onAuthStateChange((_event, session) => onChange(session));
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Affiche l'écran de connexion/inscription dans `container`.
// Appelle `onSignedIn()` une fois la session établie.
export function renderAuthScreen(container, onSignedIn) {
  // Pas d'inscription libre : les comptes sont créés par l'administrateur (espace clients).
  // Remettre à true pour rouvrir l'inscription (et la réactiver aussi dans Supabase).
  const SIGNUP_ENABLED = false;
  let mode = "login"; // "login" | "signup"

  function render() {
    container.innerHTML = `
      <div class="auth-screen">
        <div class="card auth-card">
          <span class="metal-title auth-logo">ZENOA RADAR</span>
          <h1 class="auth-title">${mode === "login" ? "Connexion" : "Créer un compte"}</h1>
          <form id="auth-form">
            <div class="field">
              <label class="field-label">Email</label>
              <input type="email" id="auth-email" required autocomplete="email" placeholder="toi@email.com">
            </div>
            <div class="field">
              <label class="field-label">Mot de passe</label>
              <input type="password" id="auth-password" required
                autocomplete="${mode === "login" ? "current-password" : "new-password"}"
                placeholder="8 caractères minimum">
            </div>
            <div class="error-msg" id="auth-error"></div>
            <button type="submit" class="btn primary" id="auth-submit" style="width:100%;margin-top:4px;">
              ${mode === "login" ? "Se connecter" : "Créer mon compte"}
            </button>
          </form>
          ${SIGNUP_ENABLED ? `<p class="auth-switch">
            ${mode === "login" ? "Pas encore de compte ?" : "Déjà un compte ?"}
            <a href="#" id="auth-switch-link">${mode === "login" ? "Créer un compte" : "Se connecter"}</a>
          </p>` : `<p class="auth-switch" style="color:var(--text-dim);">Pas de compte ? Ton accès t'est envoyé par ton contact Zenoa.</p>`}
          <p class="auth-switch" style="margin-top:10px;font-size:12px;">
            <a href="/legal/mentions-legales.html">Mentions légales</a> · <a href="/legal/confidentialite.html">Confidentialité</a> · <a href="/legal/cgu.html">Conditions</a>
          </p>
        </div>
      </div>
    `;

    const switchLink = container.querySelector("#auth-switch-link");
    if (switchLink) switchLink.addEventListener("click", (e) => {
      e.preventDefault();
      mode = mode === "login" ? "signup" : "login";
      render();
    });

    container.querySelector("#auth-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = container.querySelector("#auth-email").value.trim();
      const password = container.querySelector("#auth-password").value;
      const errorEl = container.querySelector("#auth-error");
      const submitBtn = container.querySelector("#auth-submit");
      errorEl.textContent = "";
      submitBtn.disabled = true;

      const hash = await emailHash(email);
      if (mode === "login" && await isLoginLocked(hash)) {
        submitBtn.disabled = false;
        errorEl.textContent = "Trop de tentatives. Réessaie dans 15 minutes.";
        return;
      }

      const { error } = mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

      submitBtn.disabled = false;
      if (error) {
        if (mode === "login") logLoginFailure(hash);
        errorEl.textContent = translateAuthError(error.message);
        return;
      }
      if (mode === "login") logEvent("login_success", hash);

      const session = await getSession();
      if (session) {
        onSignedIn();
      } else if (mode === "signup") {
        errorEl.style.color = "#4FBF7A";
        errorEl.textContent = "Compte créé — vérifie tes emails pour confirmer ton adresse, puis connecte-toi.";
      }
    });
  }

  render();
}

function translateAuthError(message) {
  if (/already registered/i.test(message)) return "Un compte existe déjà avec cet email.";
  if (/invalid login credentials/i.test(message)) return "Email ou mot de passe incorrect.";
  if (/password should be at least/i.test(message)) return "Le mot de passe doit faire au moins 12 caractères.";
  if (/rate limit|too many/i.test(message)) return "Trop de tentatives. Réessaie dans quelques minutes.";
  // Message volontairement vague : le détail technique ne regarde pas l'utilisateur.
  console.error("[auth]", message);
  return "Connexion impossible pour le moment. Réessaie.";
}
