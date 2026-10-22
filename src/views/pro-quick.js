// Saisie rapide : bouton flottant « + » qui ouvre un panneau très simple pour noter les messages du jour.
import { addLog, dateKey, escapeHtml } from "./pro-data.js";
import { openModal, modalHeader, toast, friendlyError } from "./pro-ui.js";

const FIELDS = [
  { key: "envoyes", label: "Envoyés" },
  { key: "reponses", label: "Réponses" },
  { key: "interesses", label: "Intéressés" },
  { key: "audits", label: "Audits" },
  { key: "clients", label: "Clients" }
];
const LAST_KEY = "zenoa-pro-last-strategy";

export function openQuickEntry(data, { onSaved, strategyId } = {}) {
  const usable = data.strategies.filter((s) => s.statut !== "abandonnee");
  let remembered = null;
  try { remembered = localStorage.getItem(LAST_KEY); } catch { /* pas grave */ }
  const chosen = strategyId || (usable.some((s) => s.id === remembered) ? remembered : usable[0] && usable[0].id) || "";
  const { overlay, close } = openModal(`
    ${modalHeader("Noter mes messages")}
    <form data-form class="pro-quick">
      <div class="field"><label class="field-label" for="q-strat">Stratégie</label>
        <select id="q-strat" name="strategy">
          <option value="">— Sans stratégie —</option>
          ${data.strategies.map((s) => `<option value="${s.id}"${s.id === chosen ? " selected" : ""}>${escapeHtml(s.titre)}${s.statut === "abandonnee" ? " (abandonnée)" : ""}</option>`).join("")}
        </select></div>
      <div class="field" data-version-wrap hidden><label class="field-label" for="q-ver">Version du script</label><select id="q-ver" name="script"></select></div>
      <div class="field"><label class="field-label" for="q-day">Jour</label><input type="date" id="q-day" name="jour" value="${dateKey()}" max="${dateKey()}"></div>
      <div class="pro-steppers">
        ${FIELDS.map((f) => `<div class="pro-stepper">
          <span class="pro-stepper-label" id="l-${f.key}">${f.label}</span>
          <div class="pro-stepper-ctl" role="group" aria-labelledby="l-${f.key}">
            <button type="button" class="icon-btn" data-step="-1" data-for="${f.key}" aria-label="Moins un ${f.label.toLowerCase()}">−</button>
            <input type="number" inputmode="numeric" min="0" max="100000" name="${f.key}" value="0" aria-label="${f.label}">
            <button type="button" class="icon-btn" data-step="1" data-for="${f.key}" aria-label="Plus un ${f.label.toLowerCase()}">+</button>
            ${f.key === "envoyes" ? `<button type="button" class="icon-btn pro-plus10" data-step="10" data-for="envoyes" aria-label="Plus dix envoyés">+10</button>` : ""}
          </div></div>`).join("")}
      </div>
      <div class="error-msg" data-error></div>
      <div class="modal-actions"><button type="button" class="btn ghost" data-close>Annuler</button><button type="submit" class="btn primary" data-submit>Enregistrer</button></div>
    </form>`, { maxWidth: 460 });

  const form = overlay.querySelector("[data-form]");
  const stratSel = form.querySelector("#q-strat"), verWrap = form.querySelector("[data-version-wrap]"), verSel = form.querySelector("#q-ver");
  const syncVersions = () => {
    const scripts = data.scripts.filter((s) => s.strategy_id === stratSel.value);
    verWrap.hidden = scripts.length === 0;
    verSel.innerHTML = `<option value="">—</option>` + scripts.map((s) => `<option value="${s.id}">Version ${s.version}</option>`).join("");
  };
  stratSel.addEventListener("change", syncVersions);
  syncVersions();

  form.addEventListener("click", (e) => {
    const b = e.target.closest("[data-step]");
    if (!b) return;
    const input = form.querySelector(`input[name="${b.dataset.for}"]`);
    input.value = Math.max(0, (Number(input.value) || 0) + Number(b.dataset.step));
    // Plus de réponses que d'envoyés n'a pas de sens : on remonte les envoyés.
    const sent = form.querySelector('input[name="envoyes"]'), got = form.querySelector('input[name="reponses"]');
    if (Number(got.value) > Number(sent.value)) sent.value = got.value;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = form.querySelector("[data-error]"), btn = form.querySelector("[data-submit]");
    errorEl.textContent = "";
    const v = Object.fromEntries(FIELDS.map((f) => [f.key, Math.max(0, Math.floor(Number(form.elements[f.key].value) || 0))]));
    if (!Object.values(v).some(Boolean)) { errorEl.textContent = "Indique au moins un chiffre."; return; }
    btn.disabled = true;
    try {
      await addLog({ ...v, jour: form.elements.jour.value || dateKey(), strategy_id: stratSel.value || null, script_id: verSel.value || null });
      try { localStorage.setItem(LAST_KEY, stratSel.value); } catch { /* pas grave */ }
      close();
      toast("Enregistré ✓");
      onSaved && onSaved();
    } catch (err) {
      errorEl.textContent = friendlyError(err);
      btn.disabled = false;
    }
  });
  form.querySelector('input[name="envoyes"]').focus();
}
