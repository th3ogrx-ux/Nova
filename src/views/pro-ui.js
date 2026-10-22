// Module Prospection : petits éléments d'interface partagés (états vides, squelettes, toast, formulaires).
import { openModal as baseOpenModal } from "../modal.js";
import { escapeHtml } from "./pro-data.js";

// Fenêtres de la prospection : un clic ou un tap à côté ne les ferme pas (un « clic fantôme » au moment où le clavier
// s'ouvre sur téléphone les fermait en plein milieu d'une saisie). On les ferme avec ✕ ou « Annuler ».
export const openModal = (html, opts = {}) => baseOpenModal(html, { lockOutside: true, ...opts });

// Illustration de l'état vide : l'étoile de la marque, en trait fin.
const STAR = `<svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M32 4c2 14 6 24 28 28-22 4-26 14-28 28-2-14-6-24-28-28C26 28 30 18 32 4z"/><circle cx="32" cy="32" r="3.5" fill="currentColor" stroke="none"/></svg>`;

export function emptyState({ title, text, cta, action }) {
  return `<div class="pro-empty pro-seq" style="--i:1">${STAR}<h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p>${cta ? `<button type="button" class="btn primary btn-sm" data-action="${action}">${escapeHtml(cta)}</button>` : ""}</div>`;
}

export function skeleton(kind = "dashboard") {
  const block = (cls) => `<div class="pro-skel ${cls}"></div>`;
  if (kind === "cols") return `<div class="pro-skel-cols">${[0, 1, 2, 3].map(() => `<div class="pro-skel-col">${block("h20")}${block("card")}${block("card")}</div>`).join("")}</div>`;
  return `<div class="pro-skel-kpis">${[0, 1, 2, 3].map(() => block("kpi")).join("")}</div><div class="pro-skel-grid">${block("panel")}${block("panel")}</div>${block("wide")}`;
}

export function toast(message, kind = "ok") {
  const t = document.createElement("div");
  t.className = "pro-toast " + kind;
  t.setAttribute("role", "status");
  t.textContent = message;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("in"));
  setTimeout(() => { t.classList.remove("in"); setTimeout(() => t.remove(), 300); }, 2200);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* indisponible */ }
    ta.remove();
    return ok;
  }
}

export const field = (label, inner, { span = false } = {}) => `<div class="field${span ? " pro-span" : ""}"><label class="field-label">${label}</label>${inner}</div>`;
export const options = (list, selected) => list.map((o) => `<option value="${escapeHtml(o.key)}"${o.key === selected ? " selected" : ""}>${escapeHtml(o.label)}</option>`).join("");
export function modalHeader(title) {
  return `<div class="pro-modal-head"><h2>${escapeHtml(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Fermer" style="width:32px;height:32px;">✕</button></div>`;
}
export function readForm(form) {
  const out = {};
  form.querySelectorAll("[name]").forEach((el) => {
    if (el.type === "checkbox") { out[el.name] = el.checked; return; }
    const v = el.value.trim();
    out[el.name] = v === "" ? null : (el.type === "number" ? Number(v) : v);
  });
  return out;
}
// Message d'erreur utile pour l'admin (cette page ne sert qu'à lui) ; le détail technique reste dans la console.
export function friendlyError(err) {
  console.error("[Prospection]", err);
  const m = String((err && err.message) || "");
  if (/pro_offers_phases_ok|violates check constraint|phases|titres_mois|offer_id|schema cache|column/i.test(m)) return "La base de données n'est pas à jour (ou le pack est trop long). Recolle prospection.sql dans Supabase (SQL Editor > Run), puis réessaie. Ton texte est gardé.";
  if (/JWT|expired|not authenticated|401/i.test(m)) return "Ta session a expiré : reconnecte-toi, puis réessaie. Ton texte est gardé.";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Pas de connexion pour le moment. Réessaie dans un instant. Ton texte est gardé.";
  return "Enregistrement impossible" + (m ? " (" + m.slice(0, 110) + ")" : "") + ". Ton texte est gardé : réessaie dans un instant.";
}
