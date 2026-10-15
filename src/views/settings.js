// Paramètres — pseudo et photo de profil.
import { supabase } from "../supabase.js";

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

    <div class="card" style="max-width:480px;">
      <div class="panel-title" style="margin-bottom:16px;">Profil</div>

      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
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

      <div class="field">
        <label class="field-label">Pseudo</label>
        <input type="text" id="settings-pseudo" placeholder="Ton pseudo" maxlength="40">
      </div>
      <div class="error-msg" id="settings-error"></div>
      <button type="button" class="btn primary btn-sm" id="settings-save">Enregistrer</button>
      <span id="settings-feedback" style="font-size:12px;color:var(--ok);margin-left:10px;"></span>
    </div>
  `;

  const { data: { user } } = await supabase.auth.getUser();
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
