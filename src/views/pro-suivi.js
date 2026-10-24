// Suivi prospection > Suivi : une carte par prospect avec ses objectifs, ses notes importantes et 3 boutons.
// « Audit envoyé » / « Non envoyé » : la carte disparaît. « Vendu » : une fiche client est créée avec les notes.
import { supabase } from "../supabase.js";
import { CANAUX, saveProspect, deleteProspect, escapeHtml, canalIcon } from "./pro-data.js";
import { openProspectModal } from "./pro-pipeline.js";
import { emptyState, toast, friendlyError } from "./pro-ui.js";

export function renderSuivi(root, data, ctx) {
  const list = data.prospects;
  root.innerHTML = `
    <div class="pro-toolbar pro-seq" style="--i:0">
      <p class="pro-muted pro-toolbar-text">${list.length} prospect${list.length > 1 ? "s" : ""} à suivre</p>
      <button type="button" class="btn primary btn-sm" data-action="new">+ Ajouter un prospect</button>
    </div>
    <div class="pro-suivi-grid" data-body></div>`;
  const add = () => openProspectModal(null, data, ctx);
  root.querySelector('[data-action="new"]').addEventListener("click", add);
  const body = root.querySelector("[data-body]");
  if (!list.length) {
    body.innerHTML = `<div class="card">${emptyState({ title: "Aucun prospect à suivre", text: "Ajoute un prospect, note ses objectifs et ce qui compte, puis marque-le : audit envoyé, non envoyé ou vendu.", cta: "Ajouter un prospect", action: "new2" })}</div>`;
    body.querySelector('[data-action="new2"]').addEventListener("click", add);
    return;
  }
  body.innerHTML = list.map((p, i) => `
    <article class="card pro-suivi-card pro-seq" style="--i:${Math.min(i + 1, 8)}" data-id="${p.id}">
      <div class="pro-pcard-top"><strong>${escapeHtml(p.nom)}</strong>${p.canal ? `<span class="pro-chip">${canalIcon(p.canal, 13)} ${escapeHtml(CANAUX[p.canal].label)}</span>` : ""}</div>
      ${p.contact ? `<p class="pro-muted">${escapeHtml(p.contact)}</p>` : ""}
      <label class="pro-suivi-label">Objectifs du prospect<textarea rows="2" maxlength="2000" data-f="objectifs" placeholder="Ce qu'il veut obtenir…">${escapeHtml(p.objectifs || "")}</textarea></label>
      <label class="pro-suivi-label">Important à retenir<textarea rows="3" maxlength="4000" data-f="notes" placeholder="Infos clés, budget, ce qu'il a dit…">${escapeHtml(p.notes || "")}</textarea></label>
      <div class="pro-suivi-btns">
        <button type="button" class="btn ghost btn-sm" data-act="sent">Audit envoyé</button>
        <button type="button" class="btn ghost btn-sm" data-act="unsent">Non envoyé</button>
        <button type="button" class="btn primary btn-sm" data-act="sold">Vendu</button>
      </div>
    </article>`).join("");

  body.querySelectorAll(".pro-suivi-card").forEach((card) => {
    const p = list.find((x) => x.id === card.dataset.id);
    // Enregistrement automatique quand on quitte un champ.
    card.querySelectorAll("textarea").forEach((ta) => ta.addEventListener("blur", async () => {
      const v = ta.value.trim();
      if (v === (p[ta.dataset.f] || "")) return;
      try { await saveProspect({ [ta.dataset.f]: v || null }, p.id); p[ta.dataset.f] = v; } catch (err) { toast(friendlyError(err), "error"); }
    }));
    const flush = () => { // enregistre ce qui est en cours de frappe avant une action
      const values = {};
      card.querySelectorAll("textarea").forEach((ta) => { values[ta.dataset.f] = ta.value.trim() || null; });
      return values;
    };
    const remove = async (message) => {
      try { await deleteProspect(p.id); toast(message); ctx.reload(); } catch (err) { toast(friendlyError(err), "error"); }
    };
    card.querySelector('[data-act="sent"]').addEventListener("click", () => remove("Audit envoyé : prospect retiré du suivi ✓"));
    card.querySelector('[data-act="unsent"]').addEventListener("click", () => remove("Retiré du suivi"));
    card.querySelector('[data-act="sold"]').addEventListener("click", async (e) => {
      const btn = e.currentTarget; btn.disabled = true;
      const v = flush();
      const { error } = await supabase.from("espace_businesses").insert({ nom: p.nom, objectifs: v.objectifs, notes_prospection: v.notes });
      if (error) {
        btn.disabled = false;
        toast(/objectifs|notes_prospection/i.test(error.message || "") ? "Colle de nouveau prospection.sql dans Supabase (SQL Editor), puis réessaie." : friendlyError(error), "error");
        return;
      }
      window.dispatchEvent(new CustomEvent("zenoa:client-created"));
      await remove("Vendu 🎉 Fiche client créée (onglet Clients) avec tes notes");
    });
  });
}
