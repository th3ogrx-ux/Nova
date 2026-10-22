// Double authentification (TOTP : appli Google Authenticator, Authy, 1Password…).
// Obligatoire pour l'administrateur ; proposée aux clients dans Paramètres.
// Le vrai verrou est dans la base (securite.sql) : sans code validé, l'admin n'a accès à rien.
import { supabase } from "./supabase.js";
import { signOut } from "./auth.js";
import { logEvent } from "./security-log.js";

const esc = (s) => { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; };

export async function verifiedFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return (data && data.totp) || []; // ne contient que les facteurs validés
}

// { enrolled, needsCode } : needsCode = la session n'a pas encore validé son code.
export async function mfaState() {
  const [factors, aal] = await Promise.all([verifiedFactors(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
  const level = aal.data || {};
  return { factors, enrolled: factors.length > 0, needsCode: factors.length > 0 && level.currentLevel !== "aal2" };
}

function screen(container, title, intro, bodyHtml) {
  container.style.display = "";
  container.innerHTML = `
    <div class="auth-screen">
      <div class="card auth-card">
        <span class="metal-title auth-logo">ZENOA</span>
        <h1 class="auth-title">${esc(title)}</h1>
        <p style="font-size:13.5px;color:var(--text-dim);text-align:center;line-height:1.6;margin-bottom:18px;">${intro}</p>
        ${bodyHtml}
        <p class="auth-switch"><a href="#" id="mfa-logout">Se déconnecter</a></p>
      </div>
    </div>`;
  container.querySelector("#mfa-logout").addEventListener("click", (e) => { e.preventDefault(); signOut(); });
}

const codeField = `
  <div class="field">
    <label class="field-label" for="mfa-code">Code à 6 chiffres</label>
    <input type="text" id="mfa-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required>
  </div>
  <div class="error-msg" id="mfa-error"></div>`;

// Connexion : demande le code d'un facteur déjà activé.
export function renderMfaChallenge(container, factorId, onDone) {
  screen(container, "Vérification en deux étapes", "Ouvre ton application d'authentification et saisis le code à 6 chiffres.",
    `<form id="mfa-form">${codeField}<button type="submit" class="btn primary" id="mfa-submit" style="width:100%;margin-top:4px;">Valider</button></form>`);
  const errorEl = container.querySelector("#mfa-error");
  const input = container.querySelector("#mfa-code");
  input.focus();
  container.querySelector("#mfa-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = container.querySelector("#mfa-submit");
    btn.disabled = true;
    errorEl.textContent = "";
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: input.value.trim() });
    if (error) {
      btn.disabled = false;
      input.value = "";
      errorEl.textContent = "Code incorrect ou expiré. Réessaie.";
      return;
    }
    container.innerHTML = "";
    onDone();
  });
}

// Activation : affiche le QR code, puis valide un premier code. `mandatory` = écran bloquant (admin).
export async function renderMfaEnroll(container, { mandatory = true, onDone, onCancel } = {}) {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Zenoa " + Date.now() });
  if (error || !data) {
    screen(container, "Double authentification", "Impossible de démarrer l'activation pour le moment. Recharge la page et réessaie.", "");
    return;
  }
  const factorId = data.id;
  screen(container, mandatory ? "Active la double authentification" : "Double authentification",
    "1. Installe une application d'authentification (Google Authenticator, Authy, 1Password…).<br>2. Scanne ce QR code.<br>3. Saisis le code à 6 chiffres qu'elle affiche.",
    `<div style="text-align:center;margin-bottom:14px;"><img id="mfa-qr" alt="QR code à scanner avec l'application d'authentification" width="180" height="180" style="background:#fff;padding:8px;border-radius:10px;"></div>
     <p style="font-size:12px;color:var(--text-dim);text-align:center;margin-bottom:14px;word-break:break-all;">Pas de caméra ? Saisis cette clé : <strong>${esc(data.totp.secret)}</strong></p>
     <form id="mfa-form">${codeField}<button type="submit" class="btn primary" id="mfa-submit" style="width:100%;margin-top:4px;">Activer</button></form>
     ${mandatory ? "" : `<p class="auth-switch"><a href="#" id="mfa-cancel">Annuler</a></p>`}`);
  // Le QR code est un SVG brut (avec des guillemets) : on l'encode, au lieu de le coller dans l'attribut HTML.
  const qr = String(data.totp.qr_code || "");
  const svg = qr.replace(/^data:image\/svg\+xml;(charset=)?utf-8,/i, "");
  container.querySelector("#mfa-qr").src = svg.trimStart().startsWith("<svg")
    ? "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)
    : (/^data:image\/(png|svg\+xml)/.test(qr) ? qr : "");
  const errorEl = container.querySelector("#mfa-error");
  const input = container.querySelector("#mfa-code");
  const cancel = container.querySelector("#mfa-cancel");
  if (cancel) cancel.addEventListener("click", async (e) => {
    e.preventDefault();
    await supabase.auth.mfa.unenroll({ factorId }); // facteur non validé : on le retire
    onCancel && onCancel();
  });
  container.querySelector("#mfa-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = container.querySelector("#mfa-submit");
    btn.disabled = true;
    errorEl.textContent = "";
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: input.value.trim() });
    if (verifyError) {
      btn.disabled = false;
      input.value = "";
      errorEl.textContent = "Code incorrect. Vérifie l'heure de ton téléphone et réessaie.";
      return;
    }
    logEvent("mfa_enrolled");
    container.innerHTML = "";
    onDone && onDone();
  });
}
