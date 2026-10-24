// Audits : les blocs de l'éditeur. Chaque type a un libellé, une valeur de départ et un éditeur (le rendu est dans audit-render.js).
import { escapeHtml } from "./pro-data.js";
import { newId } from "./audits-data.js";
import { sanitizeHtml, PRIORITIES, safeUrl, videoEmbed, gaugeSvg, chartSvg } from "./audit-render.js";

const e = escapeHtml;

export const BLOCK_TYPES = {
  title: { label: "Titre", hint: "Titre de section avec sous-titre", make: () => ({ text: "", sub: "" }), edit: editTitle },
  text: { label: "Texte", hint: "Paragraphes, gras, listes, liens", make: () => ({ html: "" }), edit: editText },
  image: { label: "Image", hint: "Capture ou photo avec légende", make: () => ({ path: null, caption: "" }), edit: editImage },
  table: { label: "Tableau", hint: "Lignes et colonnes", make: () => ({ header: true, rows: [["", ""], ["", ""]] }), edit: editTable },
  recos: { label: "Recommandations", hint: "Liste avec priorité haute, moyenne ou basse", make: () => ({ items: [{ text: "", priority: "high" }] }), edit: editRecos },
  quote: { label: "Citation / encart", hint: "Citation ou encart mis en avant", make: () => ({ style: "callout", text: "", author: "" }), edit: editQuote },
  separator: { label: "Séparateur", hint: "Ligne de séparation", make: () => ({}), edit: (b, el) => { el.innerHTML = `<p class="pro-muted" style="margin:0;">Une ligne de séparation s'affichera ici.</p>`; } },
  gallery: { label: "Galerie", hint: "Plusieurs images côte à côte", make: () => ({ items: [] }), edit: editGallery },
  annotated: { label: "Capture annotée", hint: "Image avec des repères numérotés", make: () => ({ path: null, caption: "", notes: [] }), edit: editAnnotated },
  score: { label: "Score", hint: "Jauge de 0 à 100", make: () => ({ label: "Score global", value: 50, comment: "" }), edit: editScore },
  chart: { label: "Graphique", hint: "Barres ou courbe, données saisies à la main", make: () => ({ kind: "bar", title: "", points: [{ label: "", value: "" }, { label: "", value: "" }] }), edit: editChart },
  video: { label: "Vidéo", hint: "Lien Loom ou YouTube", make: () => ({ url: "", caption: "" }), edit: editVideo },
  cta: { label: "Bouton d'action", hint: "Bouton vers un lien (prise de rendez-vous…)", make: () => ({ label: "Prendre rendez-vous", url: "" }), edit: editCta }
};
export const extendBlockTypes = (more) => Object.assign(BLOCK_TYPES, more);

export const makeBlock = (type) => ({ id: newId(), type, ...BLOCK_TYPES[type].make() });
export function buildBlockEditor(block, el, ctx) {
  const def = BLOCK_TYPES[block.type];
  if (!def) { el.innerHTML = `<p class="pro-muted">Bloc inconnu.</p>`; return; }
  def.edit(block, el, ctx);
}

const lbl = (text, inner) => `<label class="aud-lbl">${text}${inner}</label>`;
// Branche des champs [name] sur les propriétés du bloc.
function bind(block, el, ctx) {
  el.querySelectorAll("[data-k]").forEach((inp) => inp.addEventListener("input", () => { block[inp.dataset.k] = inp.value; ctx.onChange(); }));
}

function editTitle(b, el, ctx) {
  el.innerHTML = lbl("Titre", `<input type="text" data-k="text" maxlength="160" value="${e(b.text)}" placeholder="Ex : Visibilité sur Google">`) + lbl("Sous-titre (facultatif)", `<input type="text" data-k="sub" maxlength="240" value="${e(b.sub)}">`);
  bind(b, el, ctx);
}
function editQuote(b, el, ctx) {
  el.innerHTML = lbl("Style", `<select data-k="style"><option value="callout">Encart</option><option value="quote">Citation</option></select>`) +
    lbl("Texte", `<textarea data-k="text" rows="3" maxlength="1200">${e(b.text)}</textarea>`) + lbl("Auteur (pour une citation)", `<input type="text" data-k="author" maxlength="120" value="${e(b.author)}">`);
  el.querySelector("select").value = b.style;
  bind(b, el, ctx);
}
function editCta(b, el, ctx) {
  el.innerHTML = lbl("Texte du bouton", `<input type="text" data-k="label" maxlength="60" value="${e(b.label)}">`) + lbl("Lien (https://…)", `<input type="url" data-k="url" maxlength="500" value="${e(b.url)}" placeholder="https://…">`);
  bind(b, el, ctx);
  const url = el.querySelector('[data-k="url"]');
  url.addEventListener("blur", () => { if (url.value && !safeUrl(url.value)) ctx.toast("Le lien doit commencer par https://", "error"); });
}

function editText(b, el, ctx) {
  el.innerHTML = `<div class="aud-rt-bar" role="toolbar" aria-label="Mise en forme">
      <button type="button" class="aud-tool" data-cmd="bold" title="Gras"><b>G</b></button>
      <button type="button" class="aud-tool" data-cmd="italic" title="Italique"><i>I</i></button>
      <button type="button" class="aud-tool" data-cmd="insertUnorderedList" title="Liste à puces">• Liste</button>
      <button type="button" class="aud-tool" data-cmd="insertOrderedList" title="Liste numérotée">1. Liste</button>
      <button type="button" class="aud-tool" data-link title="Lien">Lien</button></div>
    <div class="aud-rt" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Texte" data-ph="Écris ton texte ici…"></div>`;
  const rt = el.querySelector(".aud-rt");
  rt.innerHTML = sanitizeHtml(b.html);
  rt.addEventListener("input", () => { b.html = sanitizeHtml(rt.innerHTML); ctx.onChange(); });
  rt.addEventListener("paste", (ev) => { ev.preventDefault(); const t = (ev.clipboardData || window.clipboardData).getData("text/plain"); document.execCommand("insertText", false, t); });
  el.querySelectorAll("[data-cmd]").forEach((btn) => {
    btn.addEventListener("mousedown", (ev) => ev.preventDefault());
    btn.addEventListener("click", () => { rt.focus(); document.execCommand(btn.dataset.cmd); b.html = sanitizeHtml(rt.innerHTML); ctx.onChange(); });
  });
  el.querySelector("[data-link]").addEventListener("mousedown", (ev) => ev.preventDefault());
  el.querySelector("[data-link]").addEventListener("click", () => {
    const url = safeUrl(window.prompt("Adresse du lien (https://…)", "https://"));
    if (!url) return;
    rt.focus(); document.execCommand("createLink", false, url); b.html = sanitizeHtml(rt.innerHTML); ctx.onChange();
  });
}

// Image : choix du fichier, aperçu, légende.
export function imagePicker(holder, getPath, setPath, ctx, label = "Choisir une image") {
  const draw = () => {
    const p = getPath();
    holder.innerHTML = `${p ? `<img class="aud-thumb big" data-p="${e(p)}" src="${e(ctx.urlOf(p))}" alt="">` : ""}<span class="aud-media-btns"><label class="btn ghost btn-sm aud-file">${p ? "Changer l'image" : label}<input type="file" accept="image/jpeg,image/png,image/webp" hidden></label>${p ? `<button type="button" class="btn ghost btn-sm" data-rm>Retirer</button>` : ""}</span>`;
    holder.querySelector("input").addEventListener("change", async (ev) => {
      const f = ev.target.files[0]; if (!f) return;
      try { setPath(await ctx.upload(f)); ctx.onChange(); draw(); } catch (err) { ctx.toast(err.message, "error"); }
    });
    holder.querySelector("[data-rm]")?.addEventListener("click", () => { setPath(null); ctx.onChange(); draw(); });
  };
  draw();
}
function editImage(b, el, ctx) {
  el.innerHTML = `<div data-pick></div>` + lbl("Légende (facultatif)", `<input type="text" data-k="caption" maxlength="240" value="${e(b.caption)}">`);
  imagePicker(el.querySelector("[data-pick]"), () => b.path, (p) => { b.path = p; }, ctx);
  bind(b, el, ctx);
}

function editTable(b, el, ctx) {
  const MAXR = 30, MAXC = 8;
  const draw = () => {
    el.innerHTML = `<div class="aud-table-wrap"><table class="aud-table">${b.rows.map((r, i) => `<tr>${r.map((c, j) => `<td><input type="text" maxlength="200" data-r="${i}" data-c="${j}" value="${e(c)}" aria-label="Ligne ${i + 1}, colonne ${j + 1}"${i === 0 && b.header ? ' class="th"' : ""}></td>`).join("")}</tr>`).join("")}</table></div>
      <div class="aud-media-btns"><button type="button" class="btn ghost btn-sm" data-addrow>+ Ligne</button><button type="button" class="btn ghost btn-sm" data-addcol>+ Colonne</button><button type="button" class="btn ghost btn-sm" data-delrow>− Ligne</button><button type="button" class="btn ghost btn-sm" data-delcol>− Colonne</button>
      <label class="aud-check"><input type="checkbox" data-header ${b.header ? "checked" : ""}> 1re ligne = en-tête</label></div>`;
    el.querySelectorAll("input[data-r]").forEach((inp) => inp.addEventListener("input", () => { b.rows[+inp.dataset.r][+inp.dataset.c] = inp.value; ctx.onChange(); }));
    el.querySelector("[data-addrow]").addEventListener("click", () => { if (b.rows.length < MAXR) { b.rows.push(b.rows[0].map(() => "")); ctx.onChange(); draw(); } });
    el.querySelector("[data-addcol]").addEventListener("click", () => { if (b.rows[0].length < MAXC) { b.rows.forEach((r) => r.push("")); ctx.onChange(); draw(); } });
    el.querySelector("[data-delrow]").addEventListener("click", () => { if (b.rows.length > 1) { b.rows.pop(); ctx.onChange(); draw(); } });
    el.querySelector("[data-delcol]").addEventListener("click", () => { if (b.rows[0].length > 1) { b.rows.forEach((r) => r.pop()); ctx.onChange(); draw(); } });
    el.querySelector("[data-header]").addEventListener("change", (ev) => { b.header = ev.target.checked; ctx.onChange(); draw(); });
  };
  draw();
}

function editRecos(b, el, ctx) {
  const draw = () => {
    el.innerHTML = b.items.map((it, i) => `<div class="aud-reco"><select data-p="${i}" aria-label="Priorité">${Object.entries(PRIORITIES).map(([k, v]) => `<option value="${k}"${it.priority === k ? " selected" : ""}>${v}</option>`).join("")}</select>
        <input type="text" maxlength="400" data-t="${i}" value="${e(it.text)}" placeholder="Ex : Ajouter 10 photos sur la fiche Google" aria-label="Recommandation"><button type="button" class="aud-tool danger" data-rm="${i}" aria-label="Retirer">✕</button></div>`).join("") +
      `<button type="button" class="btn ghost btn-sm" data-add>+ Recommandation</button>`;
    el.querySelectorAll("[data-t]").forEach((inp) => inp.addEventListener("input", () => { b.items[+inp.dataset.t].text = inp.value; ctx.onChange(); }));
    el.querySelectorAll("[data-p]").forEach((s) => s.addEventListener("change", () => { b.items[+s.dataset.p].priority = s.value; ctx.onChange(); }));
    el.querySelectorAll("[data-rm]").forEach((x) => x.addEventListener("click", () => { b.items.splice(+x.dataset.rm, 1); if (!b.items.length) b.items.push({ text: "", priority: "medium" }); ctx.onChange(); draw(); }));
    el.querySelector("[data-add]").addEventListener("click", () => { if (b.items.length < 40) { b.items.push({ text: "", priority: "medium" }); ctx.onChange(); draw(); } });
  };
  draw();
}

function editGallery(b, el, ctx) {
  const draw = () => {
    el.innerHTML = `<div class="aud-gal">${b.items.map((it, i) => `<div class="aud-gal-item"><img class="aud-thumb big" data-p="${e(it.path)}" src="${e(ctx.urlOf(it.path))}" alt=""><input type="text" maxlength="200" data-c="${i}" value="${e(it.caption)}" placeholder="Légende" aria-label="Légende"><button type="button" class="btn ghost btn-sm" data-rm="${i}">Retirer</button></div>`).join("")}</div>
      <label class="btn ghost btn-sm aud-file">+ Ajouter des images<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden></label>`;
    el.querySelectorAll("[data-c]").forEach((i) => i.addEventListener("input", () => { b.items[+i.dataset.c].caption = i.value; ctx.onChange(); }));
    el.querySelectorAll("[data-rm]").forEach((x) => x.addEventListener("click", () => { b.items.splice(+x.dataset.rm, 1); ctx.onChange(); draw(); }));
    el.querySelector("input[type=file]").addEventListener("change", async (ev) => {
      for (const f of [...ev.target.files].slice(0, 12 - b.items.length)) {
        try { b.items.push({ path: await ctx.upload(f), caption: "" }); } catch (err) { ctx.toast(err.message, "error"); }
      }
      ctx.onChange(); draw();
    });
  };
  draw();
}

function editAnnotated(b, el, ctx) {
  const draw = () => {
    el.innerHTML = `<div data-pick></div>` + (b.path ? `<p class="pro-muted" style="margin:0 0 6px;">Clique sur l'image pour poser un repère numéroté.</p>
      <div class="aud-annot"><img data-p="${e(b.path)}" src="${e(ctx.urlOf(b.path))}" alt="" draggable="false">${b.notes.map((n, i) => `<span class="pub-pin" style="left:${n.x}%;top:${n.y}%">${i + 1}</span>`).join("")}</div>
      ${b.notes.map((n, i) => `<div class="aud-reco" style="grid-template-columns:34px 1fr auto;"><b>${i + 1}</b><input type="text" maxlength="300" data-n="${i}" value="${e(n.text)}" placeholder="Ce que montre ce repère" aria-label="Repère ${i + 1}"><button type="button" class="aud-tool danger" data-rm="${i}" aria-label="Retirer le repère">✕</button></div>`).join("")}` : "") +
      lbl("Légende (facultatif)", `<input type="text" data-k="caption" maxlength="240" value="${e(b.caption)}">`);
    imagePicker(el.querySelector("[data-pick]"), () => b.path, (p) => { b.path = p; b.notes = []; }, { ...ctx, onChange: () => { ctx.onChange(); draw(); } });
    // imagePicker redessine seul son bloc ; on redessine tout pour afficher la zone de repères
    bind(b, el, ctx);
    const area = el.querySelector(".aud-annot");
    area?.addEventListener("click", (ev) => {
      if (b.notes.length >= 20) return;
      const r = area.querySelector("img").getBoundingClientRect();
      b.notes.push({ x: Math.round(((ev.clientX - r.left) / r.width) * 1000) / 10, y: Math.round(((ev.clientY - r.top) / r.height) * 1000) / 10, text: "" });
      ctx.onChange(); draw(); el.querySelector(`[data-n="${b.notes.length - 1}"]`)?.focus();
    });
    el.querySelectorAll("[data-n]").forEach((i) => i.addEventListener("input", () => { b.notes[+i.dataset.n].text = i.value; ctx.onChange(); }));
    el.querySelectorAll("[data-rm]").forEach((x) => x.addEventListener("click", () => { b.notes.splice(+x.dataset.rm, 1); ctx.onChange(); draw(); }));
  };
  draw();
}

function editScore(b, el, ctx) {
  el.innerHTML = `<div class="aud-score">${lbl("Intitulé", `<input type="text" data-k="label" maxlength="80" value="${e(b.label)}">`)}
    ${lbl("Score (0 à 100)", `<input type="number" data-k="value" min="0" max="100" step="1" value="${e(b.value)}">`)}</div>
    <div class="aud-gauge-prev">${gaugeSvg(b.value)}</div>` + lbl("Commentaire (facultatif)", `<textarea data-k="comment" rows="2" maxlength="400">${e(b.comment)}</textarea>`);
  bind(b, el, ctx);
  el.querySelector('[data-k="value"]').addEventListener("input", () => { el.querySelector(".aud-gauge-prev").innerHTML = gaugeSvg(b.value); });
}

function editChart(b, el, ctx) {
  const draw = () => {
    el.innerHTML = `<div class="aud-score">${lbl("Type", `<select data-k="kind"><option value="bar">Barres</option><option value="line">Courbe</option></select>`)}${lbl("Titre", `<input type="text" data-k="title" maxlength="120" value="${e(b.title)}">`)}</div>
      ${b.points.map((p, i) => `<div class="aud-reco" style="grid-template-columns:1fr 110px auto;"><input type="text" maxlength="30" data-l="${i}" value="${e(p.label)}" placeholder="Libellé (ex : Jan)" aria-label="Libellé"><input type="number" step="any" data-v="${i}" value="${e(p.value)}" placeholder="Valeur" aria-label="Valeur"><button type="button" class="aud-tool danger" data-rm="${i}" aria-label="Retirer">✕</button></div>`).join("")}
      <button type="button" class="btn ghost btn-sm" data-add>+ Point</button><div class="aud-gauge-prev">${chartSvg(b).replace('class="pub-chart"', 'class="pub-chart" style="max-width:520px"')}</div>`;
    el.querySelector("select").value = b.kind;
    const preview = () => { el.querySelector(".aud-gauge-prev").innerHTML = chartSvg(b); };
    el.querySelectorAll("[data-l]").forEach((i) => i.addEventListener("input", () => { b.points[+i.dataset.l].label = i.value; ctx.onChange(); preview(); }));
    el.querySelectorAll("[data-v]").forEach((i) => i.addEventListener("input", () => { b.points[+i.dataset.v].value = i.value; ctx.onChange(); preview(); }));
    el.querySelectorAll("[data-rm]").forEach((x) => x.addEventListener("click", () => { if (b.points.length > 1) { b.points.splice(+x.dataset.rm, 1); ctx.onChange(); draw(); } }));
    el.querySelector("[data-add]").addEventListener("click", () => { if (b.points.length < 14) { b.points.push({ label: "", value: "" }); ctx.onChange(); draw(); } });
    el.querySelector('[data-k="kind"]').addEventListener("change", (ev) => { b.kind = ev.target.value; ctx.onChange(); preview(); });
    el.querySelector('[data-k="title"]').addEventListener("input", (ev) => { b.title = ev.target.value; ctx.onChange(); });
  };
  draw();
}

function editVideo(b, el, ctx) {
  el.innerHTML = lbl("Lien Loom ou YouTube", `<input type="url" data-k="url" maxlength="300" value="${e(b.url)}" placeholder="https://www.loom.com/share/…">`) + `<p class="aud-hint" data-hint></p>` + lbl("Légende (facultatif)", `<input type="text" data-k="caption" maxlength="240" value="${e(b.caption)}">`);
  bind(b, el, ctx);
  const hint = el.querySelector("[data-hint]");
  const check = () => { hint.textContent = !b.url ? "" : videoEmbed(b.url) ? "✓ Vidéo reconnue" : "Lien non reconnu : seuls Loom et YouTube sont acceptés."; hint.style.color = videoEmbed(b.url) ? "var(--ok)" : "var(--danger)"; };
  el.querySelector('[data-k="url"]').addEventListener("input", check); check();
}
