// Carte "Ventes" du Tableau de bord : saisie rapide d'une vente, chiffre
// d'affaires du mois, graphique du CA par jour sur 30 jours, et bouton
// "Historique" ouvrant la liste complète (table public.sales, voir sales.sql).
import { supabase } from "../supabase.js";

const CHART_DAYS = 30;
const SVG_NS = "http://www.w3.org/2000/svg";
const eurosWithCents = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const eurosShort = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

// "1 700 €" pour un montant rond, "799,90 €" seulement s'il y a des centimes.
function formatEuros(value) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? eurosShort.format(rounded) : eurosWithCents.format(rounded);
}

function dateKey(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function daysAgoKey(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateKey(d);
}

function shortDate(key) {
  const [, month, day] = key.split("-");
  return `${day}/${month}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// Même hauteur pour les 3 champs et le bouton : un champ date n'a pas la
// même hauteur native qu'un champ texte, et un bouton btn-sm est plus bas,
// ce qui décalait la ligne du formulaire.
const FIELD_HEIGHT = "46px";
const FIELD_STYLE = `height:${FIELD_HEIGHT};box-sizing:border-box;padding-top:0;padding-bottom:0;`;

const HEADER_HTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;">
    <div class="panel-title" style="margin:0;">Ventes</div>
    <button type="button" class="btn ghost btn-sm" id="sales-history-btn">Historique</button>
  </div>
`;

function longDate(key) {
  const [year, month, day] = key.split("-");
  return `${day}/${month}/${year}`;
}

// Fenêtre "Historique des ventes" : toutes les ventes, de la plus récente
// à la plus ancienne, avec suppression. `onChanged` rafraîchit la carte.
// z-index sous celui de la confirmation (60), pour qu'elle passe devant.
async function openSalesHistory(userId, onChanged) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay open";
  overlay.style.zIndex = "59";
  overlay.innerHTML = `
    <div class="card modal-box" style="max-width:520px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;">
        <h2 style="font-size:16px;font-weight:700;letter-spacing:normal;text-transform:none;margin:0;">Historique des ventes</h2>
        <button type="button" class="icon-btn" data-close title="Fermer" style="width:30px;height:30px;">✕</button>
      </div>
      <div data-body style="max-height:60vh;overflow-y:auto;"><p style="color:var(--text-dim);font-size:13px;">Chargement...</p></div>
    </div>
  `;
  document.body.appendChild(overlay);
  const body = overlay.querySelector("[data-body]");

  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  };
  // Échap ferme la fenêtre, sauf si une confirmation est ouverte par-dessus.
  const onKey = (e) => {
    if (e.key === "Escape" && !document.querySelector("#confirm-overlay.open")) close();
  };
  document.addEventListener("keydown", onKey);
  overlay.querySelector("[data-close]").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  async function load() {
    const { data, error } = await supabase
      .from("sales")
      .select("id, client, amount, sold_on")
      .eq("user_id", userId)
      .order("sold_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      body.innerHTML = `<p class="error-msg">Impossible de charger l'historique.</p>`;
      return;
    }
    const sales = data || [];
    if (!sales.length) {
      body.innerHTML = `<p style="color:var(--text-dim);font-size:13px;">Aucune vente enregistrée pour l'instant.</p>`;
      return;
    }
    const total = sales.reduce((sum, s) => sum + Number(s.amount), 0);
    body.innerHTML = `
      <div style="font-size:13px;color:var(--text-dim);margin-bottom:8px;">${sales.length} vente${sales.length > 1 ? "s" : ""} — ${formatEuros(total)} au total</div>
      ${sales.map((s) => `
        <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid rgba(199,194,219,.12);font-size:13px;">
          <span style="color:var(--text-dim);width:78px;flex-shrink:0;">${longDate(s.sold_on)}</span>
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(s.client) || `<span style="color:var(--text-dim);">Sans nom</span>`}</span>
          <span style="font-weight:700;white-space:nowrap;">${formatEuros(Number(s.amount))}</span>
          <button type="button" class="icon-btn" data-delete-sale="${s.id}" title="Supprimer cette vente" style="width:26px;height:26px;flex-shrink:0;">✕</button>
        </div>
      `).join("")}
    `;
    body.querySelectorAll("[data-delete-sale]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const ok = await window.confirmDialog("Supprimer cette vente ?", { danger: true, confirmLabel: "Supprimer" });
        if (!ok) return;
        const { error: deleteError } = await supabase.from("sales").delete().eq("id", btn.dataset.deleteSale);
        if (deleteError) return;
        load();
        onChanged();
      });
    });
  }

  load();
}

function renderBarChart(container, sales) {
  const days = [];
  for (let i = CHART_DAYS - 1; i >= 0; i--) days.push(daysAgoKey(i));
  const totals = Object.fromEntries(days.map((d) => [d, 0]));
  for (const s of sales) if (s.sold_on in totals) totals[s.sold_on] += Number(s.amount);

  const W = 600, H = 170;
  const padL = 44, padR = 8, padT = 10, padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxVal = Math.max(...Object.values(totals));
  const slot = plotW / days.length;
  const baseline = padT + plotH;

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Chiffre d'affaires par jour sur 30 jours" });
  svg.style.cssText = "width:100%;height:auto;display:block;";

  // Graduations : 0, moitié et maximum.
  const ticks = maxVal > 0 ? [0, maxVal / 2, maxVal] : [0];
  ticks.forEach((v) => {
    const y = baseline - (maxVal > 0 ? (v / maxVal) * plotH : 0);
    svg.appendChild(svgEl("line", { x1: padL, x2: W - padR, y1: y, y2: y, stroke: "var(--light-border)", "stroke-width": v === 0 ? "1.2" : "0.6" }));
    const label = svgEl("text", { x: padL - 6, y: y + 3, "text-anchor": "end", fill: "var(--light-text-dim)", "font-size": "9" });
    label.textContent = eurosShort.format(v);
    svg.appendChild(label);
  });

  days.forEach((d, i) => {
    const v = totals[d];
    const x = padL + i * slot;
    if (v > 0) {
      const h = Math.max(2, (v / maxVal) * plotH);
      const bar = svgEl("rect", { x: x + slot * 0.18, y: baseline - h, width: slot * 0.64, height: h, rx: "2", fill: "var(--warm-1)" });
      const title = svgEl("title", {});
      title.textContent = `${shortDate(d)} : ${formatEuros(v)}`;
      bar.appendChild(title);
      svg.appendChild(bar);
    }
    if (i % 5 === 0 || i === days.length - 1) {
      const label = svgEl("text", { x: x + slot / 2, y: baseline + 14, "text-anchor": i === days.length - 1 ? "end" : "middle", fill: "var(--light-text-dim)", "font-size": "9" });
      label.textContent = shortDate(d);
      svg.appendChild(label);
    }
  });

  container.appendChild(svg);
  if (maxVal === 0) {
    container.insertAdjacentHTML("beforeend", `<p style="color:var(--light-text-dim);font-size:12.5px;margin-top:6px;">Aucune vente sur les 30 derniers jours.</p>`);
  }
}

export async function renderSalesCard(container, userId) {
  container.innerHTML = HEADER_HTML + `<p style="color:var(--light-text-dim);font-size:13.5px;">Chargement des ventes...</p>`;

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthKey = dateKey(monthStart);
  const chartStart = daysAgoKey(CHART_DAYS - 1);
  const since = monthKey < chartStart ? monthKey : chartStart;

  const rangeRes = await supabase.from("sales").select("amount, sold_on").eq("user_id", userId).gte("sold_on", since);

  if (rangeRes.error) {
    const missingTable = /sales/.test(rangeRes.error.message || "");
    container.innerHTML = HEADER_HTML + `<p class="error-msg">${missingTable
      ? "La table des ventes n'existe pas encore : colle le fichier sales.sql dans Supabase (SQL Editor), puis recharge la page."
      : "Impossible de charger les ventes."}</p>`;
    wireHistoryButton(container, userId);
    return;
  }

  const sales = rangeRes.data || [];
  const monthSales = sales.filter((s) => s.sold_on >= monthKey);
  const monthTotal = monthSales.reduce((sum, s) => sum + Number(s.amount), 0);

  container.innerHTML = HEADER_HTML + `
    <div style="display:flex;gap:28px;flex-wrap:wrap;margin-bottom:16px;">
      <div><div class="stat-tile-value">${formatEuros(monthTotal)}</div><div class="stat-tile-label">CA ce mois-ci</div></div>
      <div><div class="stat-tile-value">${monthSales.length}</div><div class="stat-tile-label">Ventes ce mois-ci</div></div>
    </div>

    <form id="sale-form" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:18px;">
      <div class="field" style="flex:2;min-width:160px;margin-bottom:0;">
        <label class="field-label">Client</label>
        <input type="text" id="sale-client" maxlength="200" placeholder="Ex : Garage Dailler" style="${FIELD_STYLE}">
      </div>
      <div class="field" style="flex:1;min-width:110px;margin-bottom:0;">
        <label class="field-label">Montant (€)</label>
        <input type="number" id="sale-amount" min="0.01" step="0.01" required placeholder="500" style="${FIELD_STYLE}">
      </div>
      <div class="field" style="flex:1;min-width:140px;margin-bottom:0;">
        <label class="field-label">Date</label>
        <input type="date" id="sale-date" required value="${dateKey(new Date())}" style="${FIELD_STYLE}">
      </div>
      <button type="submit" class="btn primary btn-sm" style="margin:0;height:${FIELD_HEIGHT};padding:0 18px;">+ Ajouter la vente</button>
    </form>
    <div class="error-msg" id="sale-error"></div>

    <div id="sales-chart"></div>
  `;

  renderBarChart(container.querySelector("#sales-chart"), sales);

  container.querySelector("#sale-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = container.querySelector("#sale-error");
    const submitBtn = e.target.querySelector("button[type=submit]");
    errorEl.textContent = "";
    const amount = Number(container.querySelector("#sale-amount").value);
    const soldOn = container.querySelector("#sale-date").value;
    if (!(amount > 0) || !soldOn) {
      errorEl.textContent = "Indique un montant et une date.";
      return;
    }

    submitBtn.disabled = true;
    const { error } = await supabase.from("sales").insert({
      user_id: userId,
      client: container.querySelector("#sale-client").value.trim() || null,
      amount,
      sold_on: soldOn
    });
    if (error) {
      submitBtn.disabled = false;
      errorEl.textContent = "Erreur : " + error.message;
      return;
    }
    renderSalesCard(container, userId);
  });

  wireHistoryButton(container, userId);
}

function wireHistoryButton(container, userId) {
  container.querySelector("#sales-history-btn").addEventListener("click", () => {
    openSalesHistory(userId, () => renderSalesCard(container, userId));
  });
}
