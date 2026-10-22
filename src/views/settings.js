// Paramètres — pseudo, photo de profil, apparence, déconnexion, suppression de compte.
import { passwordError } from "../password-policy.js";
import { supabase } from "../supabase.js";
import { getCurrentUser, isClient } from "../session.js";
import { signOut } from "../auth.js";
import { getTheme, setTheme } from "../theme.js";
import { verifiedFactors, renderMfaEnroll } from "../mfa.js";
import { logEvent, loadRecentEvents, loadSecurityAlerts, EVENT_LABELS } from "../security-log.js";
import { getCurrentRole } from "../session.js";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 3 * 1024 * 1024; // 3 Mo

// Rappelé après un enregistrement réussi, pour que main.js mette à
// jour l'affichage dans la sidebar sans recharger la page.
let onProfileUpdated = null;
export function setOnProfileUpdated(cb) {
  onProfileUpdated = cb;
}

export async function renderSettings(root) {
  root.innerHTML = `
    <h1 class="page-title">Paramètres</h1>

    <div class="card settings-section">
      <div class="panel-title">Profil</div>

      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;flex-wrap:wrap;">
        <div class="avatar clickable" id="settings-avatar" style="width:64px;height:64px;font-size:22px;">
          <span id="settings-avatar-initial"></span>
          <img id="settings-avatar-img" style="display:none;" alt="">
        </div>
        <div>
          <button type="button" class="btn ghost btn-sm" id="settings-avatar-btn">Changer la photo</button>
          <input type="file" id="settings-avatar-input" accept="image/*" style="display:none;">
          <div class="error-msg" id="settings-avatar-error"></div>
        </div>
      </div>

      <div class="field settings-field">
        <label class="field-label">Pseudo</label>
        <input type="text" id="settings-pseudo" placeholder="Ton pseudo" maxlength="40">
      </div>
      <div class="error-msg" id="settings-error"></div>
      <button type="button" class="btn primary btn-sm" id="settings-save">Enregistrer</button>
      <span id="settings-feedback" style="font-size:12px;color:var(--ok);margin-left:10px;"></span>
    </div>

    <div class="card settings-section">
      <div class="panel-title">Apparence</div>
      <div style="display:flex;align-items:center;gap:14px;">
        <label class="switch">
          <input type="checkbox" id="settings-dark-mode" ${getTheme() === "dark" ? "checked" : ""}>
          <span class="switch-track"></span>
        </label>
        <span style="font-size:13.5px;">Mode sombre</span>
      </div>
    </div>

    <div class="card settings-section">
      <div class="panel-title">Mot de passe</div>
      <div class="field settings-field">
        <label class="field-label">Nouveau mot de passe (12 caractères minimum)</label>
        <input type="password" id="settings-new-password" autocomplete="new-password" minlength="12">
      </div>
      <div class="error-msg" id="settings-password-msg"></div>
      <button type="button" class="btn primary btn-sm" id="settings-password-save">Changer le mot de passe</button>
    </div>

    <div class="card settings-section">
      <div class="panel-title">Double authentification</div>
      <p style="font-size:13px;color:var(--light-text-dim);margin-bottom:12px;max-width:460px;" id="settings-mfa-text">Chargement…</p>
      <div class="error-msg" id="settings-mfa-msg"></div>
      <button type="button" class="btn primary btn-sm" id="settings-mfa-btn" hidden></button>
    </div>

    <div class="card settings-section" id="settings-security" hidden>
      <div class="panel-title">Journal de sécurité</div>
      <div id="settings-security-alerts"></div>
      <ul id="settings-security-list" style="list-style:none;padding:0;margin:0;font-size:13px;"></ul>
    </div>

    <div class="card settings-section">
      <div class="panel-title">Informations légales</div>
      <p style="font-size:13px;"><a href="/legal/mentions-legales.html" target="_blank" rel="noopener">Mentions légales</a> · <a href="/legal/confidentialite.html" target="_blank" rel="noopener">Politique de confidentialité</a> · <a href="/legal/cgu.html" target="_blank" rel="noopener">Conditions d'utilisation</a></p>
    </div>

    <div class="card settings-section">
      <div class="panel-title">Session</div>
      <button type="button" class="btn ghost btn-sm" id="settings-logout">Se déconnecter</button>
    </div>

    <div class="card settings-section" id="settings-danger" style="border-color:#d9534f4d;">
      <div class="panel-title" style="color:var(--danger);">Zone dangereuse</div>
      <p style="font-size:13px;color:var(--light-text-dim);margin-bottom:14px;max-width:460px;">
        Supprime définitivement ton compte et toutes tes données (prospects, maquettes, modèles de message). Cette action est irréversible.
      </p>
      <div class="field settings-field">
        <label class="field-label">Tape SUPPRIMER pour confirmer</label>
        <input type="text" id="settings-delete-confirm" placeholder="SUPPRIMER">
      </div>
      <div class="error-msg" id="settings-delete-error"></div>
      <button type="button" class="btn danger btn-sm" id="settings-delete" disabled>Supprimer mon compte</button>
    </div>
  `;

  const user = await getCurrentUser();
  const { data: profile } = await supabase.from("user_profiles").select("pseudo, avatar_url").eq("user_id", user.id).maybeSingle();

  const pseudoInput = root.querySelector("#settings-pseudo");
  pseudoInput.value = (profile && profile.pseudo) || "";
  applyAvatarPreview(root, "#settings-avatar", (profile && profile.avatar_url) || null, user.email);

  root.querySelector("#settings-avatar-btn").addEventListener("click", () => {
    root.querySelector("#settings-avatar-input").click();
  });

  root.querySelector("#settings-avatar-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const errorEl = root.querySelector("#settings-avatar-error");
    errorEl.textContent = "";

    if (!file.type.startsWith("image/")) {
      errorEl.textContent = "Choisis un fichier image.";
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      errorEl.textContent = "Image trop lourde (3 Mo maximum).";
      return;
    }

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, { upsert: true });
    if (uploadError) {
      errorEl.textContent = "Échec de l'envoi : " + uploadError.message;
      return;
    }

    const { data: publicUrlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    // Cache-bust : même chemin de fichier à chaque changement de
    // photo, donc sans ce paramètre le navigateur réafficherait
    // l'ancienne image depuis son cache.
    const avatarUrl = publicUrlData.publicUrl + "?t=" + Date.now();

    const { error: saveError } = await supabase.from("user_profiles").upsert({ user_id: user.id, avatar_url: avatarUrl, updated_at: new Date().toISOString() });
    if (saveError) {
      errorEl.textContent = "Échec de l'enregistrement : " + saveError.message;
      return;
    }

    applyAvatarPreview(root, "#settings-avatar", avatarUrl, user.email);
    if (onProfileUpdated) onProfileUpdated();
  });

  root.querySelector("#settings-save").addEventListener("click", async () => {
    const pseudo = pseudoInput.value.trim();
    const errorEl = root.querySelector("#settings-error");
    const feedback = root.querySelector("#settings-feedback");
    errorEl.textContent = "";
    feedback.textContent = "";

    const { error } = await supabase.from("user_profiles").upsert({ user_id: user.id, pseudo, updated_at: new Date().toISOString() });
    if (error) {
      errorEl.textContent = "Erreur : " + error.message;
      return;
    }
    feedback.textContent = "Enregistré ✓";
    if (onProfileUpdated) onProfileUpdated();
  });

  root.querySelector("#settings-dark-mode").addEventListener("change", (e) => {
    setTheme(e.target.checked ? "dark" : "light");
  });

  // Un client n'a pas la zone "Supprimer mon compte" : son compte est géré par Zenoa.
  if (isClient()) root.querySelector("#settings-danger").remove();

  root.querySelector("#settings-password-save").addEventListener("click", async () => {
    const input = root.querySelector("#settings-new-password");
    const msg = root.querySelector("#settings-password-msg");
    const btn = root.querySelector("#settings-password-save");
    msg.style.color = "";
    btn.disabled = true;
    const problem = await passwordError(input.value);
    if (problem) { btn.disabled = false; msg.textContent = problem; return; }
    const { error } = await supabase.auth.updateUser({ password: input.value });
    btn.disabled = false;
    if (error) { msg.textContent = "Impossible de changer le mot de passe : " + error.message; return; }
    input.value = "";
    logEvent("password_changed");
    msg.style.color = "var(--ok)";
    msg.textContent = "Mot de passe changé ✓";
  });

  setupMfaCard(root);
  if (getCurrentRole() === "admin") setupSecurityCard(root);

  root.querySelector("#settings-logout").addEventListener("click", async () => {
    const ok = await window.confirmDialog("Te déconnecter ?", { confirmLabel: "Se déconnecter" });
    if (ok) await signOut();
  });

  const deleteConfirmInput = root.querySelector("#settings-delete-confirm");
  const deleteBtn = root.querySelector("#settings-delete");
  if (!deleteBtn) return;
  deleteConfirmInput.addEventListener("input", () => {
    deleteBtn.disabled = deleteConfirmInput.value.trim() !== "SUPPRIMER";
  });

  deleteBtn.addEventListener("click", async () => {
    const ok = await window.confirmDialog("Supprimer définitivement ton compte et toutes tes données ?", { danger: true, confirmLabel: "Supprimer mon compte" });
    if (!ok) return;

    const errorEl = root.querySelector("#settings-delete-error");
    errorEl.textContent = "";
    deleteBtn.disabled = true;

    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      errorEl.textContent = "Erreur : " + error.message;
      deleteBtn.disabled = false;
      return;
    }
    await signOut();
  });
}

export function applyAvatarPreview(root, selector, avatarUrl, email) {
  const container = root.querySelector(selector);
  const img = container.querySelector("img");
  const initial = container.querySelector("span");
  if (avatarUrl) {
    img.src = avatarUrl;
    img.style.display = "";
    initial.style.display = "none";
  } else {
    img.style.display = "none";
    initial.style.display = "";
    initial.textContent = (email || "?").charAt(0).toUpperCase();
  }
}


// Double authentification : obligatoire pour l'admin (pas de bouton pour la retirer), facultative pour un client.
async function setupMfaCard(root) {
  const text = root.querySelector("#settings-mfa-text");
  const btn = root.querySelector("#settings-mfa-btn");
  const msg = root.querySelector("#settings-mfa-msg");
  const mandatory = getCurrentRole() === "admin";
  let factors = [];
  try { factors = await verifiedFactors(); } catch { text.textContent = "Impossible de lire l'état de la double authentification."; return; }

  const screenAuth = document.getElementById("screen-auth");
  const appEl = document.getElementById("app");
  const back = () => { screenAuth.innerHTML = ""; screenAuth.style.display = "none"; appEl.style.display = ""; setupMfaCard(root); };

  btn.hidden = false;
  btn.onclick = null;
  if (factors.length === 0) {
    text.textContent = "Désactivée. Un code à 6 chiffres, généré par une appli sur ton téléphone, sera demandé à chaque connexion : un mot de passe volé ne suffit alors plus.";
    btn.textContent = "Activer";
    btn.onclick = () => { appEl.style.display = "none"; renderMfaEnroll(screenAuth, { mandatory: false, onDone: back, onCancel: back }); };
  } else if (mandatory) {
    text.textContent = "Activée ✓ — obligatoire pour le compte administrateur.";
    btn.hidden = true;
  } else {
    text.textContent = "Activée ✓";
    btn.textContent = "Désactiver";
    btn.onclick = async () => {
      const ok = await window.confirmDialog("Désactiver la double authentification ?", { danger: true, confirmLabel: "Désactiver" });
      if (!ok) return;
      for (const f of factors) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
        if (error) { msg.textContent = "Impossible de la désactiver : " + error.message; return; }
      }
      logEvent("mfa_removed");
      setupMfaCard(root);
    };
  }
}

// Réservé à l'admin : alertes et derniers événements de sécurité.
async function setupSecurityCard(root) {
  const card = root.querySelector("#settings-security");
  const list = root.querySelector("#settings-security-list");
  const alertsEl = root.querySelector("#settings-security-alerts");
  const [events, alerts] = await Promise.all([loadRecentEvents(), loadSecurityAlerts()]);
  card.hidden = false;
  alertsEl.innerHTML = alerts.map((a) => `<p class="error-msg" style="margin-bottom:10px;">⚠️ ${escapeText(a)}</p>`).join("");
  list.innerHTML = events.length
    ? events.map((e) => `<li style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid var(--border, #2a2a2a);"><span>${escapeText(EVENT_LABELS[e.type] || e.type)}</span><span style="color:var(--light-text-dim);">${new Date(e.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span></li>`).join("")
    : `<li style="color:var(--light-text-dim);">Aucun événement pour l'instant.</li>`;
}

function escapeText(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}
