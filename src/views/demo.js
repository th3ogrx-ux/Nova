// Page publique d'une maquette (/demo/:slug) — aucune authentification
// requise, accessible à n'importe qui ayant le lien.
import { supabase } from "../supabase.js";

// Assombrit une couleur hex d'un certain facteur, pour le dégradé du
// bandeau d'accueil (évite de dépendre de color-mix(), pas supporté
// partout).
function darken(hex, factor) {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.substring(0, 2), 16) * factor);
  const g = Math.round(parseInt(h.substring(2, 4), 16) * factor);
  const b = Math.round(parseInt(h.substring(4, 6), 16) * factor);
  return `rgb(${r}, ${g}, ${b})`;
}

export async function renderDemoPage(container, slug) {
  container.innerHTML = `<div class="demo-page"><p style="text-align:center;padding:60px;">Chargement...</p></div>`;

  const { data: site, error } = await supabase.from("demo_sites").select("*").eq("slug", slug).maybeSingle();

  if (error || !site) {
    container.innerHTML = `
      <div class="demo-page">
        <div class="demo-error">
          <div>
            <h1 style="font-family:var(--font-heading);font-size:24px;margin-bottom:10px;">Page introuvable</h1>
            <p style="color:var(--light-text-dim);">Cette maquette n'existe pas ou plus.</p>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const color = site.primary_color || "#bf5af2";
  const services = site.services || [];
  const testimonials = site.testimonials || [];
  const hasMap = site.lat != null && site.lon != null;

  container.innerHTML = `
    <div class="demo-page" style="--demo-color:${color};--demo-color-dark:${darken(color, 0.55)};">
      <section class="demo-hero">
        <div class="demo-hero-name">${escapeHtml(site.business_name)}</div>
        <div class="demo-hero-tagline">${escapeHtml(site.tagline)}</div>
      </section>

      ${site.description ? `
      <section class="demo-section">
        <div class="demo-section-title">À propos</div>
        <p class="demo-description">${escapeHtml(site.description)}</p>
      </section>` : ""}

      ${services.length ? `
      <section class="demo-section">
        <div class="demo-section-title">Nos services</div>
        <div class="demo-services">
          ${services.map((s) => `<div class="demo-service-card">${escapeHtml(s)}</div>`).join("")}
        </div>
      </section>` : ""}

      ${testimonials.length ? `
      <section class="demo-section">
        <div class="demo-section-title">Avis clients</div>
        <div class="demo-testimonials">
          ${testimonials.map((t) => `
            <div class="demo-testimonial">
              <div class="demo-testimonial-text">« ${escapeHtml(t.text)} »</div>
              <div class="demo-testimonial-name">${escapeHtml(t.name)}</div>
            </div>
          `).join("")}
        </div>
      </section>` : ""}

      <section class="demo-section demo-contact">
        <div class="demo-section-title">Contact</div>
        ${site.contact_text ? `<p class="demo-contact-text">${escapeHtml(site.contact_text)}</p>` : ""}
        <div class="demo-contact-details">
          ${site.address ? `<div>${escapeHtml(site.address)}</div>` : ""}
          ${site.phone ? `<div>${escapeHtml(site.phone)}</div>` : ""}
        </div>
      </section>

      <section class="demo-section">
        <div class="demo-section-title">Nous trouver</div>
        ${hasMap
          ? `<iframe class="demo-map-frame" loading="lazy"
               src="https://www.openstreetmap.org/export/embed.html?bbox=${site.lon - 0.01}%2C${site.lat - 0.008}%2C${site.lon + 0.01}%2C${site.lat + 0.008}&layer=mapnik&marker=${site.lat}%2C${site.lon}"></iframe>`
          : `<div class="demo-map-fallback">
               ${site.address ? escapeHtml(site.address) : "Adresse non renseignée"}<br>
               <a href="https://www.openstreetmap.org/search?query=${encodeURIComponent((site.address || "") + " " + (site.city || ""))}" target="_blank" rel="noopener">Voir sur la carte</a>
             </div>`}
      </section>

      <div class="demo-footer">Site créé par Zenoa Agency</div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
