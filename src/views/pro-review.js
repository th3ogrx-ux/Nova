// Prospection > Revue de la semaine : récapitulatif automatique, 3 questions courtes, leçons.
import { sum, rate, inRange, dateKey, addDays, mondayOf, parseKey, weekLabel, strategyStats, escapeHtml, fmtInt, fmtPct, saveReview, canauxIcons, CANAUX } from "./pro-data.js";
import { runCounters } from "./pro-charts.js";
import { toast, friendlyError } from "./pro-ui.js";
import { draftGet, draftSet, draftClear, debounce } from "./pro-draft.js";

const QUESTIONS = [
  { key: "q_bien", label: "Qu'est-ce qui a bien marché ?", hint: "Un message, un canal, une heure d'envoi qui a payé…" },
  { key: "q_mieux", label: "Qu'est-ce qui a coincé ?", hint: "Les objections, les silences, ce qui t'a fait perdre du temps…" },
  { key: "q_suite", label: "Que testes-tu la semaine prochaine ?", hint: "Une seule chose à changer, pour savoir ce qui l'a fait bouger." }
];

export function renderReview(root, data, ctx) {
  const { state } = ctx;
  const monday = addDays(mondayOf(), 7 * (state.reviewOffset || 0)), from = dateKey(monday), to = dateKey(addDays(monday, 6));
  const elapsedDays = (state.reviewOffset || 0) === 0 ? ((new Date().getDay() + 6) % 7) + 1 : 7; // semaine en cours : mêmes jours qu'avant
  const pFrom = dateKey(addDays(monday, -7)), pTo = dateKey(addDays(monday, -8 + elapsedDays));
  const cur = sum(inRange(data.logs, from, to)), prev = sum(inRange(data.logs, pFrom, pTo));
  const saved0 = data.reviews.find((r) => r.semaine === from) || {};
  const draftKey = "review:" + from, draft = draftGet(draftKey);
  const existing = draft ? { ...saved0, ...draft } : saved0; // un brouillon non enregistré passe avant
  const best = strategyStats(data, from, to).filter((s) => s.envoyes >= 5).sort((a, b) => b.taux - a.taux)[0];
  const isCurrent = (state.reviewOffset || 0) === 0;
  const dl = (c, p, pts) => { const d = pts ? Math.round((c - p) * 10) / 10 : c - p; return d === 0 ? "" : `<em class="${d > 0 ? "up" : "down"}">${d > 0 ? "▲ +" : "▼ "}${String(d).replace(".", ",")}${pts ? " pts" : ""}</em>`; };
  const tiles = [
    ["Envoyés", cur.envoyes, 0, "", dl(cur.envoyes, prev.envoyes)], ["Réponses", cur.reponses, 0, "", dl(cur.reponses, prev.reponses)],
    ["Taux de réponse", rate(cur.reponses, cur.envoyes), 1, " %", dl(rate(cur.reponses, cur.envoyes), rate(prev.reponses, prev.envoyes), true)],
    ["Intéressés", cur.interesses, 0, "", dl(cur.interesses, prev.interesses)], ["Audits", cur.audits, 0, "", dl(cur.audits, prev.audits)], ["Clients", cur.clients, 0, "", dl(cur.clients, prev.clients)]
  ];

  root.innerHTML = `
    <div class="pro-weeknav pro-seq" style="--i:0">
      <button type="button" class="icon-btn" data-week="-1" aria-label="Semaine précédente">‹</button>
      <div class="pro-weeknav-label"><b>${isCurrent ? "Cette semaine" : "Semaine du " + weekLabel(from)}</b><span>${weekLabel(from)}</span></div>
      <button type="button" class="icon-btn" data-week="1" aria-label="Semaine suivante"${isCurrent ? " disabled" : ""}>›</button>
    </div>

    <section class="card pro-panel pro-seq" style="--i:1">
      <h2 class="panel-title">Le récap, calculé pour toi</h2>
      <div class="pro-recap">${tiles.map(([l, v, d, suf, delta]) => `<div class="pro-recap-tile"><span>${l}</span><b data-count="${v}" data-dec="${d}" data-suffix="${suf}">0</b>${delta}</div>`).join("")}</div>
      ${cur.envoyes === 0 ? `<p class="pro-muted pro-recap-note">Aucun message noté sur cette semaine. Utilise le bouton « + » pour compléter tes chiffres.</p>`
        : best ? `<p class="pro-recap-best">Meilleure stratégie de la semaine : <button type="button" class="pro-link" data-open="${best.strategy.id}">${escapeHtml(best.strategy.titre)}</button> ${canauxIcons(best.strategy, 13)} avec <b>${fmtPct(best.taux)}</b> de réponses.</p>` : ""}
    </section>

    <section class="card pro-panel pro-review-form pro-seq" style="--i:2">
      <h2 class="panel-title">Ta revue</h2>
      ${QUESTIONS.map((q) => `<div class="field"><label class="field-label" for="rv-${q.key}">${q.label}</label><textarea id="rv-${q.key}" name="${q.key}" rows="3" maxlength="2000" placeholder="${escapeHtml(q.hint)}">${escapeHtml(existing[q.key] || "")}</textarea></div>`).join("")}
      <div class="field"><label class="field-label" for="rv-lecons">Leçons à retenir</label><textarea id="rv-lecons" name="lecons" rows="4" maxlength="4000" placeholder="La phrase que tu veux relire dans 3 mois.">${escapeHtml(existing.lecons || "")}</textarea></div>
      ${draft ? `<p class="pro-draft-note" role="status"><span>Brouillon retrouvé : ton texte non enregistré a été restauré. Pense à enregistrer.</span></p>` : ""}
      <div class="pro-review-actions"><button type="button" class="btn primary" data-save>Enregistrer la revue</button><span class="pro-saved" data-saved aria-live="polite">${existing.updated_at ? "Dernière sauvegarde : " + new Date(existing.updated_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : ""}</span></div>
    </section>

    ${data.reviews.length ? `<section class="card pro-panel pro-seq" style="--i:3"><h2 class="panel-title">Revues précédentes</h2>
      <ul class="pro-reviews">${data.reviews.filter((r) => r.lecons || r.q_bien || r.q_mieux || r.q_suite).slice(0, 8).map((r) => `<li><button type="button" class="pro-review-item" data-goto="${r.semaine}"><b>${weekLabel(r.semaine)}</b><span>${escapeHtml((r.lecons || r.q_bien || r.q_suite || "").slice(0, 110))}</span></button></li>`).join("")}</ul></section>` : ""}`;

  root.querySelectorAll("[data-week]").forEach((b) => b.addEventListener("click", () => { state.reviewOffset = Math.min(0, (state.reviewOffset || 0) + Number(b.dataset.week)); ctx.rerender({ animate: false }); }));
  root.querySelectorAll("[data-goto]").forEach((b) => b.addEventListener("click", () => { state.reviewOffset = Math.round((parseKey(b.dataset.goto) - mondayOf()) / (7 * 86400000)); ctx.rerender({ animate: false }); window.scrollTo(0, 0); }));
  root.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => ctx.openStrategy(b.dataset.open)));
  const saved = root.querySelector("[data-saved]");
  const saveDraft = debounce(() => { const v = {}; root.querySelectorAll(".pro-review-form textarea").forEach((t) => { v[t.name] = t.value; }); draftSet(draftKey, v); }, 500);
  root.querySelectorAll(".pro-review-form textarea").forEach((t) => t.addEventListener("input", saveDraft));
  root.querySelector("[data-save]").addEventListener("click", async (e) => {
    const values = {};
    root.querySelectorAll(".pro-review-form textarea").forEach((t) => { values[t.name] = t.value.trim() || null; });
    e.target.disabled = true;
    try { const row = await saveReview(from, values); const i = data.reviews.findIndex((r) => r.semaine === from); if (i >= 0) data.reviews[i] = row; else data.reviews.unshift(row); saved.textContent = "Enregistré ✓"; draftClear(draftKey); toast("Revue enregistrée ✓"); }
    catch (err) { saved.textContent = friendlyError(err); }
    e.target.disabled = false;
  });
  if (ctx.animate) runCounters(root); else root.querySelectorAll("[data-count]").forEach((el) => { el.textContent = (el.dataset.dec === "1" ? Number(el.dataset.count).toFixed(1).replace(".", ",") : fmtInt(el.dataset.count)) + (el.dataset.suffix || ""); });
}
