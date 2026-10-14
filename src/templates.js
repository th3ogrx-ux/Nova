// Modèles de message de premier contact + modale "Contacter un prospect".
// Étape 4.
import { supabase } from "./supabase.js";

function fillVariables(text, prospect) {
  return (text || "")
    .replaceAll("{nom}", prospect.name || "")
    .replaceAll("{ville}", prospect.city || "")
    .replaceAll("{categorie}", prospect.category || "");
}

async function fetchTemplates() {
  const { data } = await supabase.from("message_templates").select("*").order("created_at", { ascending: true });
  return data || [];
}

// Ouvre la modale de contact pour un prospect. `onStatusChange(newStatus)`
// est appelé si le statut doit passer à "contacté" (seulement si le
// prospect était encore "à contacter" — on ne fait jamais régresser un
// statut plus avancé comme "client").
export async function openContactModal(prospect, onStatusChange) {
  const templates = await fetchTemplates();
  if (!templates.length) {
    alert("Aucun modèle de message. Crée-en un depuis \"Modèles de messages\".");
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay open";
  overlay.innerHTML = `
    <div class="card modal-box" style="max-width:520px;">
      <h2 style="letter-spacing:normal;text-transform:none;font-size:17px;margin-bottom:16px;">
        Contacter ${escapeHtml(prospect.name)}
      </h2>
      <div class="field">
        <label class="field-label">Modèle</label>
        <select id="contact-template-select">
          ${templates.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label class="field-label">Objet</label>
        <input type="text" id="contact-subject">
      </div>
      <div class="field">
        <label class="field-label">Message</label>
        <textarea id="contact-body" rows="8"></textarea>
      </div>
      ${prospect.email ? "" : `<p class="error-msg" style="color:var(--warning);">Pas d'email connu pour ce prospect — utilise "Copier le message" pour l'envoyer en DM.</p>`}
      <div class="modal-actions">
        <button type="button" class="btn ghost" id="contact-cancel">Fermer</button>
        <button type="button" class="btn blue" id="contact-copy">Copier le message</button>
        ${prospect.email ? `<button type="button" class="btn primary" id="contact-mailto">Envoyer par email</button>` : ""}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const templateSelect = overlay.querySelector("#contact-template-select");
  const subjectInput = overlay.querySelector("#contact-subject");
  const bodyInput = overlay.querySelector("#contact-body");

  function loadTemplate(id) {
    const t = templates.find((t) => t.id === id) || templates[0];
    subjectInput.value = fillVariables(t.subject, prospect);
    bodyInput.value = fillVariables(t.body, prospect);
  }

  const defaultTemplate = templates.find((t) => t.is_default) || templates[0];
  templateSelect.value = defaultTemplate.id;
  loadTemplate(defaultTemplate.id);
  templateSelect.addEventListener("change", () => loadTemplate(templateSelect.value));

  function close() {
    overlay.remove();
  }

  function markContacted() {
    if (prospect.status === "a_contacter" && onStatusChange) onStatusChange("contacte");
  }

  overlay.querySelector("#contact-cancel").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  overlay.querySelector("#contact-copy").addEventListener("click", async () => {
    const text = subjectInput.value + "\n\n" + bodyInput.value;
    try {
      await navigator.clipboard.writeText(text);
      overlay.querySelector("#contact-copy").textContent = "Copié ✓";
    } catch {
      alert("Impossible de copier automatiquement — sélectionne le texte manuellement.");
    }
    markContacted();
  });

  const mailtoBtn = overlay.querySelector("#contact-mailto");
  if (mailtoBtn) {
    mailtoBtn.addEventListener("click", () => {
      const mailto = "mailto:" + encodeURIComponent(prospect.email) +
        "?subject=" + encodeURIComponent(subjectInput.value) +
        "&body=" + encodeURIComponent(bodyInput.value);
      window.location.href = mailto;
      markContacted();
    });
  }
}

// Modale de gestion des modèles (liste + édition + ajout + suppression).
export async function openTemplatesModal() {
  let templates = await fetchTemplates();

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay open";
  document.body.appendChild(overlay);

  function render() {
    overlay.innerHTML = `
      <div class="card modal-box" style="max-width:560px;max-height:85vh;overflow-y:auto;">
        <h2 style="letter-spacing:normal;text-transform:none;font-size:17px;margin-bottom:16px;">Modèles de messages</h2>
        <p style="font-size:12.5px;color:var(--light-text-dim);margin-bottom:16px;">
          Variables disponibles : <code>{nom}</code>, <code>{ville}</code>, <code>{categorie}</code>
        </p>
        <div id="templates-list"></div>
        <button type="button" class="btn ghost btn-sm" id="template-add">+ Nouveau modèle</button>
        <div class="modal-actions">
          <button type="button" class="btn ghost" id="templates-close">Fermer</button>
        </div>
      </div>
    `;

    const listEl = overlay.querySelector("#templates-list");
    templates.forEach((t) => {
      const row = document.createElement("div");
      row.style.cssText = "border-top:1px solid var(--light-border);padding:14px 0;";
      row.innerHTML = `
        <div class="field">
          <label class="field-label">Nom du modèle</label>
          <input type="text" class="tpl-name" value="${escapeHtml(t.name)}">
        </div>
        <div class="field">
          <label class="field-label">Objet</label>
          <input type="text" class="tpl-subject" value="${escapeHtml(t.subject)}">
        </div>
        <div class="field">
          <label class="field-label">Message</label>
          <textarea class="tpl-body" rows="5">${escapeHtml(t.body)}</textarea>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <button type="button" class="btn primary btn-sm tpl-save">Enregistrer</button>
          ${templates.length > 1 ? `<button type="button" class="btn danger btn-sm tpl-delete">Supprimer</button>` : ""}
          <span class="tpl-feedback" style="font-size:12px;color:var(--ok);"></span>
        </div>
      `;
      listEl.appendChild(row);

      row.querySelector(".tpl-save").addEventListener("click", async () => {
        const name = row.querySelector(".tpl-name").value.trim() || "Sans nom";
        const subject = row.querySelector(".tpl-subject").value;
        const body = row.querySelector(".tpl-body").value;
        await supabase.from("message_templates").update({ name, subject, body }).eq("id", t.id);
        t.name = name; t.subject = subject; t.body = body;
        row.querySelector(".tpl-feedback").textContent = "Enregistré ✓";
      });

      const deleteBtn = row.querySelector(".tpl-delete");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", async () => {
          const ok = await window.confirmDialog("Supprimer ce modèle ?", { danger: true, confirmLabel: "Supprimer" });
          if (!ok) return;
          await supabase.from("message_templates").delete().eq("id", t.id);
          templates = templates.filter((x) => x.id !== t.id);
          render();
        });
      }
    });

    overlay.querySelector("#template-add").addEventListener("click", async () => {
      const { data, error } = await supabase
        .from("message_templates")
        .insert({ name: "Nouveau modèle", subject: "", body: "" })
        .select()
        .single();
      if (!error && data) {
        templates.push(data);
        render();
      }
    });

    overlay.querySelector("#templates-close").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  }

  render();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
