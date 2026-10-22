// Premier accès d'un client : il a reçu un mot de passe TEMPORAIRE de la part de
// l'admin et doit en choisir un à lui avant de continuer. (Indication d'affichage :
// la vraie protection des données est dans la base, pas dans cet écran.)
import { passwordError } from "./password-policy.js";
import { supabase } from "./supabase.js";
import { signOut } from "./auth.js";
import { logEvent } from "./security-log.js";

export function needsPasswordChange(user) {
  return !!(user && user.user_metadata && user.user_metadata.must_change_password);
}

export function renderForcePassword(container, onDone) {
  container.style.display = "";
  container.innerHTML = `
    <div class="auth-screen">
      <div class="card auth-card">
        <span class="metal-title auth-logo">ZENOA</span>
        <h1 class="auth-title">Choisis ton mot de passe</h1>
        <p style="font-size:13.5px;color:var(--text-dim);text-align:center;line-height:1.6;margin-bottom:18px;">
          Pour ta sécurité, remplace le mot de passe temporaire que tu as reçu par un mot de passe à toi.
        </p>
        <form id="force-form">
          <div class="field">
            <label class="field-label" for="force-pw">Nouveau mot de passe (12 caractères minimum)</label>
            <input type="password" id="force-pw" autocomplete="new-password" minlength="12" required>
          </div>
          <div class="field">
            <label class="field-label" for="force-pw2">Confirme le mot de passe</label>
            <input type="password" id="force-pw2" autocomplete="new-password" minlength="12" required>
          </div>
          <div class="error-msg" id="force-error"></div>
          <button type="submit" class="btn primary" id="force-submit" style="width:100%;margin-top:4px;">Enregistrer et continuer</button>
        </form>
        <p class="auth-switch"><a href="#" id="force-logout">Se déconnecter</a></p>
      </div>
    </div>`;

  container.querySelector("#force-logout").addEventListener("click", (e) => { e.preventDefault(); signOut(); });
  container.querySelector("#force-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = container.querySelector("#force-pw").value;
    const pw2 = container.querySelector("#force-pw2").value;
    const errorEl = container.querySelector("#force-error");
    const btn = container.querySelector("#force-submit");
    errorEl.textContent = "";
    if (pw !== pw2) { errorEl.textContent = "Les deux mots de passe ne sont pas identiques."; return; }
    btn.disabled = true;
    const problem = await passwordError(pw);
    if (problem) { btn.disabled = false; errorEl.textContent = problem; return; }
    const { error } = await supabase.auth.updateUser({ password: pw, data: { must_change_password: false } });
    if (error) {
      btn.disabled = false;
      errorEl.textContent = /different|same/i.test(error.message || "")
        ? "Choisis un mot de passe différent du mot de passe temporaire."
        : "Impossible de changer le mot de passe : " + error.message;
      return;
    }
    logEvent("password_changed");
    container.innerHTML = "";
    onDone();
  });
}
