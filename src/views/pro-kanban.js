// Colonnes façon Kanban avec glisser-déposer (souris) et boutons ‹ › (téléphone, clavier).
import { escapeHtml } from "./pro-data.js";

// columns : [{ key, label, color }] ; items : lignes ; colOf(item) -> clé de colonne ;
// cardHtml(item, { index }) -> HTML d'une carte (peut contenir des boutons [data-move="-1|1"]).
export function renderBoard(container, { columns, items, colOf, cardHtml, onMove, onOpen, footerHtml, emptyText = "Dépose une carte ici" }) {
  container.innerHTML = `<div class="pro-board" role="list">${columns.map((c, ci) => {
    const list = items.filter((it) => colOf(it) === c.key);
    return `<section class="pro-col pro-seq" style="--i:${ci + 1}" data-col="${c.key}" role="listitem" aria-label="${escapeHtml(c.label)}, ${list.length} élément${list.length > 1 ? "s" : ""}">
      <header class="pro-col-head"><span class="pro-dot" style="background:${c.color}"></span><h3>${escapeHtml(c.label)}</h3><span class="pro-count">${list.length}</span></header>
      ${footerHtml ? `<div class="pro-col-sub">${footerHtml(list, c)}</div>` : ""}
      <div class="pro-col-body" data-drop="${c.key}">
        ${list.length ? list.map((it, i) => `<div class="pro-kcard" draggable="true" tabindex="0" data-id="${it.id}">${cardHtml(it, { index: i })}</div>`).join("") : `<div class="pro-col-empty">${escapeHtml(emptyText)}</div>`}
      </div></section>`;
  }).join("")}</div>`;

  const keys = columns.map((c) => c.key);
  let dragId = null;
  container.querySelectorAll(".pro-kcard").forEach((card) => {
    card.addEventListener("dragstart", (e) => { dragId = card.dataset.id; card.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragId); });
    card.addEventListener("dragend", () => { card.classList.remove("dragging"); container.querySelectorAll(".over").forEach((x) => x.classList.remove("over")); dragId = null; });
    card.addEventListener("click", (e) => {
      const mv = e.target.closest("[data-move]");
      if (mv) {
        e.stopPropagation();
        const item = items.find((it) => it.id === card.dataset.id);
        const next = keys[keys.indexOf(colOf(item)) + Number(mv.dataset.move)];
        if (next) onMove(card.dataset.id, next);
        return;
      }
      if (e.target.closest("button, a, select, input")) return;
      onOpen && onOpen(card.dataset.id);
    });
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target === card) onOpen && onOpen(card.dataset.id); });
  });
  container.querySelectorAll("[data-drop]").forEach((zone) => {
    zone.addEventListener("dragover", (e) => { if (!dragId) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; zone.classList.add("over"); });
    zone.addEventListener("dragleave", (e) => { if (!zone.contains(e.relatedTarget)) zone.classList.remove("over"); });
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("over");
      const id = dragId || e.dataTransfer.getData("text/plain");
      const item = items.find((it) => it.id === id);
      if (item && colOf(item) !== zone.dataset.drop) onMove(id, zone.dataset.drop);
    });
  });
}

export const moveButtons = (colIndex, total) => `<span class="pro-move">
  <button type="button" class="icon-btn" data-move="-1" aria-label="Colonne précédente"${colIndex === 0 ? " disabled" : ""}>‹</button>
  <button type="button" class="icon-btn" data-move="1" aria-label="Colonne suivante"${colIndex === total - 1 ? " disabled" : ""}>›</button></span>`;
