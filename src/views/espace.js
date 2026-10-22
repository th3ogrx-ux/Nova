// Espace client — page provisoire (étape 1) : prouve que la connexion par
// rôle et la sécurité fonctionnent. Le client ne voit que SON commerce : c'est
// la base de données (RLS, espace.sql) qui filtre, pas ce code.
// Le vrai tableau de bord arrive à l'étape 2.
import { supabase } from "../supabase.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

export async function renderEspace(root) {
  root.innerHTML = `
    <h1 class="page-title">Mon espace</h1>
    <p style="color:var(--light-text-dim);font-size:14px;">Chargement…</p>
  `;
  const { data, error } = await supabase.from("espace_businesses").select("nom, secteur, ville").limit(1);
  const business = data && data[0];
  const subtitle = business ? [business.secteur, business.ville].filter(Boolean).join(" · ") : "";

  root.innerHTML = `
    <h1 class="page-title">${escapeHtml(business ? business.nom : "Mon espace")}</h1>
    ${subtitle ? `<p style="color:var(--light-text-dim);font-size:14px;margin-bottom:20px;">${escapeHtml(subtitle)}</p>` : ""}
    <div class="card" style="padding:20px;">
      ${error
        ? `<p class="error-msg">Impossible de charger ton espace pour le moment.</p>`
        : business
          ? `<p style="color:var(--light-text-dim);font-size:14px;">Ton tableau de bord (note, avis, chiffres Google, tâches) arrive très bientôt.</p>`
          : `<p style="color:var(--light-text-dim);font-size:14px;">Ton commerce n'est pas encore rattaché à ce compte. Contacte Zenoa.</p>`}
    </div>
  `;
}
