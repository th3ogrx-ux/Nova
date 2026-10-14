// Maquettes de sites vitrine — étape 5.
import { supabase } from "../supabase.js";
import { generateDemoContent } from "../demoContent.js";
import { uniqueSlug } from "../slug.js";

export async function renderMaquettes(root) {
  root.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
      <h1 class="page-title" style="margin-bottom:0;">Maquettes</h1>
      <button type="button" class="btn primary btn-sm" id="new-demo">+ Nouvelle maquette</button>
    </div>
    <div style="height:16px;"></div>
    <div id="demo-list"></div>
  `;

  root.querySelector("#new-demo").addEventListener("click", () => openGeneratorModal(root));
  await loadList(root);
}

async function loadList(root) {
  const listEl = root.querySelector("#demo-list");
  const { data, error } = await supabase.from("demo_sites").select("*").order("created_at", { ascending: false });

  if (error) {
    listEl.innerHTML = `<p class="error-msg">Impossible de charger les maquettes : ${error.message}</p>`;
    return;
  }

  if (!data.length) {
    listEl.innerHTML = `<p style="color:var(--light-text-dim);font-size:13.5px;">Aucune maquette pour l'instant — crée-en une à partir d'un prospect.</p>`;
    return;
  }

  listEl.innerHTML = data.map((d) => `
    <div class="card" style="margin-bottom:10px;padding:16px 18px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;">
      <div style="width:14px;height:14px;border-radius:50%;background:${d.primary_color};flex-shrink:0;"></div>
      <div style="flex:1;min-width:200px;">
        <div style="font-weight:700;font-size:14.5px;">${escapeHtml(d.business_name)}</div>
        <div style="font-size:12px;color:var(--light-text-dim);margin-top:2px;">/demo/${d.slug}</div>
      </div>
      <button type="button" class="btn ghost btn-sm demo-view" data-slug="${d.slug}">Voir</button>
      <button type="button" class="btn ghost btn-sm demo-edit" data-id="${d.id}">Modifier</button>
      <button type="button" class="btn blue btn-sm demo-share" data-id="${d.id}">Copier le lien</button>
      <button type="button" class="btn danger btn-sm demo-delete" data-id="${d.id}">Supprimer</button>
    </div>
  `).join("");

  data.forEach((d) => {
    listEl.querySelector(`.demo-view[data-slug="${d.slug}"]`).addEventListener("click", () => {
      window.open("/demo/" + d.slug, "_blank");
    });
    listEl.querySelector(`.demo-edit[data-id="${d.id}"]`).addEventListener("click", () => openEditorModal(root, d));
    listEl.querySelector(`.demo-share[data-id="${d.id}"]`).addEventListener("click", (e) => shareLink(d, e.target));
    listEl.querySelector(`.demo-delete[data-id="${d.id}"]`).addEventListener("click", async () => {
      const ok = await window.confirmDialog("Supprimer cette maquette ?", { danger: true, confirmLabel: "Supprimer" });
      if (!ok) return;
      await supabase.from("demo_sites").delete().eq("id", d.id);
      loadList(root);
    });
  });
}

async function shareLink(demoSite, btn) {
  const url = window.location.origin + "/demo/" + demoSite.slug;
  try {
    await navigator.clipboard.writeText(url);
    btn.textContent = "Copié ✓";
    setTimeout(() => { btn.textContent = "Copier le lien"; }, 1500);
  } catch {
    alert("Lien : " + url);
  }

  // Partager le lien fait passer le prospect lié au statut "maquette envoyée".
  if (demoSite.prospect_id) {
    await supabase.from("radar_prospects").update({ status: "maquette_envoyee", updated_at: new Date().toISOString() }).eq("id", demoSite.prospect_id);
  }
}

async function openGeneratorModal(root) {
  const { data: prospects } = await supabase.from("radar_prospects").select("*").order("created_at", { ascending: false });
  if (!prospects || !prospects.length) {
    alert("Ajoute d'abord un prospect depuis la page Recherche.");
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay open";
  overlay.innerHTML = `
    <div class="card modal-box" style="max-width:420px;">
      <h2 style="letter-spacing:normal;text-transform:none;font-size:17px;margin-bottom:16px;">Nouvelle maquette</h2>
      <div class="field">
        <label class="field-label">Prospect</label>
        <select id="gen-prospect">
          ${prospects.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}${p.city ? " — " + escapeHtml(p.city) : ""}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label class="field-label">Couleur principale</label>
        <input type="color" id="gen-color" value="#bf5af2" style="height:44px;padding:4px;">
      </div>
      <div class="modal-actions">
        <button type="button" class="btn ghost" id="gen-cancel">Annuler</button>
        <button type="button" class="btn primary" id="gen-submit">Générer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector("#gen-cancel").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector("#gen-submit").addEventListener("click", async () => {
    const prospectId = overlay.querySelector("#gen-prospect").value;
    const prospect = prospects.find((p) => p.id === prospectId);
    const color = overlay.querySelector("#gen-color").value;
    const content = generateDemoContent(prospect);

    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("demo_sites").insert({
      user_id: user.id,
      prospect_id: prospect.id,
      slug: uniqueSlug(prospect.name),
      business_name: prospect.name,
      city: prospect.city,
      phone: prospect.phone,
      address: prospect.address,
      lat: prospect.lat,
      lon: prospect.lon,
      primary_color: color,
      tagline: content.tagline,
      description: content.description,
      services: content.services,
      testimonials: content.testimonials,
      contact_text: content.contact_text
    }).select().single();

    if (error) {
      alert("Erreur lors de la génération : " + error.message);
      return;
    }

    overlay.remove();
    openEditorModal(root, data);
  });
}

function openEditorModal(root, demoSite) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay open";
  const servicesText = (demoSite.services || []).join("\n");
  const testimonials = demoSite.testimonials && demoSite.testimonials.length ? demoSite.testimonials : [{ name: "", text: "" }, { name: "", text: "" }, { name: "", text: "" }];

  overlay.innerHTML = `
    <div class="card modal-box" style="max-width:560px;max-height:85vh;overflow-y:auto;">
      <h2 style="letter-spacing:normal;text-transform:none;font-size:17px;margin-bottom:16px;">Modifier la maquette</h2>

      <div class="field">
        <label class="field-label">Nom de l'entreprise</label>
        <input type="text" id="edit-name" value="${escapeAttr(demoSite.business_name)}">
      </div>
      <div class="field">
        <label class="field-label">Couleur principale</label>
        <input type="color" id="edit-color" value="${demoSite.primary_color}" style="height:44px;padding:4px;">
      </div>
      <div class="field">
        <label class="field-label">Accroche</label>
        <input type="text" id="edit-tagline" value="${escapeAttr(demoSite.tagline)}">
      </div>
      <div class="field">
        <label class="field-label">Description</label>
        <textarea id="edit-description" rows="3">${escapeHtml(demoSite.description)}</textarea>
      </div>
      <div class="field">
        <label class="field-label">Services (un par ligne)</label>
        <textarea id="edit-services" rows="4">${escapeHtml(servicesText)}</textarea>
      </div>
      <div class="field">
        <label class="field-label">Texte de contact</label>
        <textarea id="edit-contact" rows="2">${escapeHtml(demoSite.contact_text)}</textarea>
      </div>
      <div class="field">
        <label class="field-label">Avis clients</label>
        <div id="edit-testimonials"></div>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn ghost" id="edit-close">Fermer</button>
        <button type="button" class="btn primary" id="edit-save">Enregistrer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const testimonialsEl = overlay.querySelector("#edit-testimonials");
  testimonials.forEach((t, i) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;margin-bottom:8px;";
    row.innerHTML = `
      <input type="text" class="testimonial-name" data-i="${i}" placeholder="Nom" value="${escapeAttr(t.name)}" style="width:100px;flex-shrink:0;">
      <input type="text" class="testimonial-text" data-i="${i}" placeholder="Avis" value="${escapeAttr(t.text)}" style="flex:1;">
    `;
    testimonialsEl.appendChild(row);
  });

  overlay.querySelector("#edit-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector("#edit-save").addEventListener("click", async () => {
    const newTestimonials = Array.from(overlay.querySelectorAll(".testimonial-name")).map((input, i) => ({
      name: input.value,
      text: overlay.querySelector(`.testimonial-text[data-i="${i}"]`).value
    })).filter((t) => t.name || t.text);

    const update = {
      business_name: overlay.querySelector("#edit-name").value.trim(),
      primary_color: overlay.querySelector("#edit-color").value,
      tagline: overlay.querySelector("#edit-tagline").value,
      description: overlay.querySelector("#edit-description").value,
      services: overlay.querySelector("#edit-services").value.split("\n").map((s) => s.trim()).filter(Boolean),
      contact_text: overlay.querySelector("#edit-contact").value,
      testimonials: newTestimonials,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("demo_sites").update(update).eq("id", demoSite.id);
    if (error) {
      alert("Erreur lors de l'enregistrement : " + error.message);
      return;
    }
    overlay.remove();
    loadList(document.getElementById("view-root"));
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
function escapeAttr(str) {
  return escapeHtml(str).replaceAll('"', "&quot;");
}
