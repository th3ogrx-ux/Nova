// Espace partenaire (photographe, monteur, marque…) : ses mannequins et ses collaborations, en lecture seule.
import { supabase } from "../supabase.js";
import { getPartner } from "../session.js";
import { escapeHtml, reseauxOf, reseauLabel, natureLabel, statutLabel, formatDate, formatEuro } from "./espace-data.js";
import { VISIBLE_STATUTS } from "./espace-social.js";

export async function renderPartnerSpace(root) {
  const me = getPartner() || {};
  root.innerHTML = `<h1 class="page-title">${escapeHtml(me.nom || "Mon espace")}</h1><div id="pt-body"><p style="color:var(--light-text-dim);font-size:14px;">Chargement…</p></div>`;
  const body = root.querySelector("#pt-body");
  try {
    const [bizRes, collabRes] = await Promise.all([
      supabase.from("espace_businesses").select("id, nom, ville, reseaux, comptes").order("nom"),
      supabase.from("espace_collabs").select("id, business_id, marque, nature, statut, montant, date_prevue, notes").order("date_prevue", { ascending: false, nullsFirst: false })
    ]);
    if (bizRes.error) throw bizRes.error;
    const businesses = bizRes.data || [];
    const collabs = (collabRes.data || []).filter((c) => VISIBLE_STATUTS.includes(c.statut));
    const name = (id) => (businesses.find((b) => b.id === id) || {}).nom || "";
    body.innerHTML = `
      <h2 class="espace-h2">Mes mannequins</h2>
      <div class="card espace-card" style="padding:20px;margin-bottom:24px;">
        ${businesses.length ? businesses.map((b) => `
          <article class="espace-partner">
            <div class="espace-partner-main"><strong>${escapeHtml(b.nom)}</strong><span class="pro-muted">${escapeHtml(b.ville || "")}</span></div>
            <div class="espace-partner-links">${reseauxOf(b).map((n) => {
              const h = (b.comptes || {})[n]; if (!h) return "";
              return `<span>${escapeHtml(reseauLabel(n))} : ${escapeHtml(h)}</span>`;
            }).join("")}</div>
          </article>`).join("") : `<p style="color:var(--light-text-dim);font-size:13.5px;margin:0;">Aucun mannequin associé pour l'instant.</p>`}
      </div>
      <h2 class="espace-h2">Mes collaborations</h2>
      <div class="card espace-card" style="padding:20px;">
        ${collabs.length ? collabs.map((c) => `
          <article class="espace-collab">
            <div class="espace-collab-main"><strong>${escapeHtml(c.marque)}</strong><span class="pro-muted">${escapeHtml(name(c.business_id))} · ${escapeHtml(natureLabel(c.nature))}${c.date_prevue ? " · " + formatDate(c.date_prevue) : ""}</span>${c.notes ? `<p>${escapeHtml(c.notes)}</p>` : ""}</div>
            <span class="status-pill neutral">${escapeHtml(statutLabel(c.statut))}</span>
          </article>`).join("") : `<p style="color:var(--light-text-dim);font-size:13.5px;margin:0;">Aucune collaboration en cours pour l'instant.</p>`}
      </div>`;
  } catch (err) {
    console.error("[Espace partenaire]", err);
    body.innerHTML = `<p class="error-msg">Impossible de charger ton espace pour le moment.</p>`;
  }
}
