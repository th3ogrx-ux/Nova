// Listes déroulantes aux couleurs du site : sur ordinateur, chaque <select> est remplacé à l'écran par un bouton
// et un menu stylé (le vrai <select> reste dans la page, caché : valeurs, formulaires et événements ne changent pas).
// Sur téléphone / tablette (écran tactile), on garde la liste native du système, plus pratique au doigt.
const CHEVRON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const valueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");

let openState = null; // { close }
let seq = 0;

const canEnhance = () => !(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);

function isDarkContext(wrapper) {
  if (wrapper.closest(".modal-box, #screen-auth, .sidebar")) return true;
  const app = document.getElementById("app");
  return !app || app.dataset.theme !== "light";
}

function enhance(select) {
  if (select.dataset.zs || select.multiple || select.size > 1 || select.hasAttribute("data-native") || !select.parentNode) return;
  select.dataset.zs = "1";
  const id = "zs" + ++seq;
  const wrapper = document.createElement("span");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "zs-btn";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  button.innerHTML = `<span class="zs-label"></span><span class="zs-chevron">${CHEVRON}</span>`;
  select.parentNode.insertBefore(wrapper, select);
  wrapper.append(button, select);
  select.classList.add("zs-native");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");

  const labelEl = () => (select.id ? document.querySelector(`label[for="${CSS.escape(select.id)}"]`) : null);
  const refresh = () => {
    const opt = select.options[select.selectedIndex];
    button.querySelector(".zs-label").textContent = opt ? opt.textContent.trim() : "";
    button.disabled = select.disabled;
    wrapper.className = "zs " + [...select.classList].filter((c) => c !== "zs-native").join(" ");
    const name = select.getAttribute("aria-label") || (labelEl() && labelEl().textContent.trim()) || "";
    if (name) button.setAttribute("aria-label", name + " : " + (opt ? opt.textContent.trim() : ""));
  };
  // Une valeur changée par le code (select.value = …) met aussi le bouton à jour.
  Object.defineProperty(select, "value", { configurable: true, get() { return valueDesc.get.call(this); }, set(v) { valueDesc.set.call(this, v); refresh(); } });
  new MutationObserver(refresh).observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "class", "label"] });
  select.addEventListener("change", refresh);
  select.addEventListener("focus", () => button.focus());
  refresh();

  let pop = null, active = -1, typed = "", typedTimer = 0;

  function close(focus = true) {
    if (!pop) return;
    pop.remove(); pop = null; openState = null;
    button.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("pointerdown", onOutside, true);
    window.removeEventListener("resize", onViewport);
    window.removeEventListener("scroll", onScroll, true);
    if (focus) button.focus({ preventScroll: true });
  }
  const onOutside = (e) => { if (pop && !pop.contains(e.target) && !wrapper.contains(e.target)) close(false); };
  const onViewport = () => close(false);
  const onScroll = (e) => { if (pop && !pop.contains(e.target)) close(false); };

  function setActive(i, scroll = true) {
    const items = pop.querySelectorAll(".zs-opt");
    if (!items.length) return;
    active = Math.max(0, Math.min(items.length - 1, i));
    items.forEach((el, k) => el.classList.toggle("active", k === active));
    pop.setAttribute("aria-activedescendant", items[active].id);
    if (scroll) items[active].scrollIntoView({ block: "nearest" });
  }
  function choose(i) {
    const opt = select.options[i];
    if (!opt || opt.disabled) return;
    const changed = select.selectedIndex !== i;
    valueDesc.set.call(select, opt.value);
    refresh();
    close();
    if (changed) { select.dispatchEvent(new Event("input", { bubbles: true })); select.dispatchEvent(new Event("change", { bubbles: true })); }
  }
  function onKey(e) {
    if (!pop) return;
    const items = pop.querySelectorAll(".zs-opt");
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === "Tab") { close(false); return; }
    const move = { ArrowDown: () => setActive(active + 1), ArrowUp: () => setActive(active - 1), Home: () => setActive(0), End: () => setActive(items.length - 1) }[e.key];
    if (move) { e.preventDefault(); e.stopPropagation(); move(); return; }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); if (active >= 0) choose(Number(items[active].dataset.i)); return; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { // saisie rapide : taper les premières lettres
      typed += e.key.toLowerCase(); clearTimeout(typedTimer); typedTimer = setTimeout(() => (typed = ""), 700);
      const k = [...items].findIndex((el) => el.textContent.trim().toLowerCase().startsWith(typed));
      if (k >= 0) setActive(k);
    }
  }

  function open() {
    if (pop || select.disabled) return;
    if (openState) openState.close(false);
    pop = document.createElement("div");
    pop.className = "zs-pop " + (isDarkContext(wrapper) ? "dark" : "light");
    pop.id = id;
    pop.setAttribute("role", "listbox");
    pop.tabIndex = -1;
    const name = button.getAttribute("aria-label"); if (name) pop.setAttribute("aria-label", name.split(" : ")[0]);
    [...select.options].forEach((opt, i) => {
      if (opt.hidden) return;
      const item = document.createElement("div");
      item.className = "zs-opt" + (opt.disabled ? " disabled" : "") + (i === select.selectedIndex ? " selected" : "");
      item.id = `${id}-o${i}`; item.dataset.i = String(i);
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(i === select.selectedIndex));
      item.innerHTML = `<span class="zs-opt-text"></span><span class="zs-tick">${i === select.selectedIndex ? CHECK : ""}</span>`;
      item.querySelector(".zs-opt-text").textContent = opt.textContent.trim();
      item.addEventListener("pointerenter", () => { if (!opt.disabled) setActive([...pop.children].indexOf(item), false); });
      item.addEventListener("click", () => choose(i));
      pop.appendChild(item);
    });
    document.body.appendChild(pop);
    const r = button.getBoundingClientRect();
    pop.style.minWidth = Math.max(r.width, 160) + "px";
    const below = window.innerHeight - r.bottom - 12, above = r.top - 12;
    const maxH = Math.min(320, Math.max(160, below >= 200 || below >= above ? below : above));
    pop.style.maxHeight = maxH + "px";
    pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8)) + "px";
    pop.style.top = (below >= Math.min(pop.scrollHeight, maxH) || below >= above) ? r.bottom + 6 + "px" : Math.max(8, r.top - 6 - Math.min(pop.scrollHeight, maxH)) + "px";
    button.setAttribute("aria-expanded", "true");
    openState = { close };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onOutside, true);
    window.addEventListener("resize", onViewport);
    window.addEventListener("scroll", onScroll, true);
    setActive(Math.max(0, [...pop.children].findIndex((el) => Number(el.dataset.i) === select.selectedIndex)));
  }

  button.addEventListener("click", () => (pop ? close() : open()));
  button.addEventListener("keydown", (e) => {
    if (pop) return;
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); open(); }
  });
}

export function initCustomSelects() {
  if (!canEnhance()) return;
  const scan = (root) => root.querySelectorAll && root.querySelectorAll("select").forEach(enhance);
  scan(document);
  new MutationObserver((muts) => {
    for (const m of muts) m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.tagName === "SELECT") enhance(n); else scan(n); } });
  }).observe(document.body, { childList: true, subtree: true });
}
