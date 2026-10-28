// Espace client : parties « réseaux sociaux » (statistiques par réseau, calendrier de contenu, campagnes et collaborations).
// Lecture seule côté client ; la saisie se fait dans la fiche client (clients.js).
import {
  escapeHtml, RESEAUX, reseauxOf, reseauLabel, formatLabel, statutLabel, natureLabel, engagementRate, formatEuro,
  formatNumber, formatDate, monthLabel, variation, lastMonthKeys, categorieLabel, partnerStatutLabel
} from "./espace-data.js";
import { renderCallsChart } from "./espace-charts.js";

const safeUrl = (v) => { try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u.toString() : null; } catch { return null; } };

function delta(current, previous) {
  const pct = variation(current, previous);
  if (pct === null) return `<span class="espace-delta">—</span>`;
  if (pct === 0) return `<span class="espace-delta">= stable</span>`;
  return `<span class="espace-delta ${pct > 0 ? "up" : "down"}">${pct > 0 ? "▲ +" : "▼ "}${pct} %<span class="espace-delta-note"> vs mois précédent</span></span>`;
}
const tile = (label, value, sub) => `<div class="card stat-tile espace-tile"><div class="stat-tile-value">${value}</div><div class="stat-tile-label">${label}</div><div style="margin-top:8px;">${sub}</div></div>`;
const empty = (text) => `<p style="color:var(--light-text-dim);font-size:13.5px;margin:0;">${text}</p>`;

// ---------- Statistiques par réseau ----------
export function socialHtml(data, rangeHtml = "") {
  const { business, socialStats } = data;
  const nets = reseauxOf(business);
  if (!nets.length) return "";
  const comptes = business.comptes || {};
  const blocks = nets.map((net) => {
    const rows = socialStats.filter((r) => r.reseau === net).sort((a, b) => b.mois.localeCompare(a.mois));
    const cur = rows[0], prev = rows[1];
    const handle = comptes[net] ? ` <span class="espace-handle">${escapeHtml(comptes[net])}</span>` : "";
    const head = `<div class="panel-title">${escapeHtml(reseauLabel(net))}${handle}</div>`;
    if (!cur) return `<div class="card espace-card" style="padding:20px;margin-bottom:16px;">${head}${empty("Les premiers chiffres de ce réseau arrivent bientôt.")}</div>`;
    const gain = prev ? cur.abonnes - prev.abonnes : null;
    const er = engagementRate(cur), erPrev = engagementRate(prev);
    return `<div class="card espace-card" style="padding:20px;margin-bottom:16px;">
      ${head}
      <p class="espace-month-note" style="margin:0 0 12px;">Chiffres de <b>${escapeHtml(monthLabel(cur.mois))}</b></p>
      <div class="stat-grid espace-grid soc-grid">
        ${tile("Abonnés", formatNumber(cur.abonnes), gain === null ? `<span class="espace-delta">—</span>` : `<span class="espace-delta ${gain > 0 ? "up" : gain < 0 ? "down" : ""}">${gain > 0 ? "▲ +" : gain < 0 ? "▼ " : "= "}${formatNumber(gain)} ce mois-ci</span>`)}
        ${tile("Vues", formatNumber(cur.vues), delta(cur.vues, prev && prev.vues))}
        ${tile("Portée", formatNumber(cur.portee), delta(cur.portee, prev && prev.portee))}
        ${tile("Engagement", er === null ? "—" : `${String(er).replace(".", ",")} %`, er === null || erPrev === null ? `<span class="espace-delta">${formatNumber(cur.interactions)} interactions</span>` : `<span class="espace-delta ${er > erPrev ? "up" : er < erPrev ? "down" : ""}">${er > erPrev ? "▲" : er < erPrev ? "▼" : "="} ${String(erPrev).replace(".", ",")} % le mois d'avant</span>`)}
        ${tile("Publications", formatNumber(cur.publications), delta(cur.publications, prev && prev.publications))}
      </div>
    </div>`;
  }).join("");
  const hasStats = socialStats.length > 0;
  return `
    <h2 class="espace-h2">Réseaux sociaux</h2>
    ${blocks}
    ${hasStats ? `${rangeHtml}<div class="espace-charts">
      <div class="card espace-card" style="padding:20px;"><div class="panel-title">Abonnés</div><div id="espace-chart-abonnes" class="espace-chart"></div></div>
      <div class="card espace-card" style="padding:20px;"><div class="panel-title">Vues</div><div id="espace-chart-vues" class="espace-chart"></div></div>
    </div>` : ""}`;
}

export function drawSocialCharts(body, data, range) {
  const nets = reseauxOf(data.business);
  const series = nets.map((k) => ({ key: k, label: reseauLabel(k), color: RESEAUX.find((r) => r.key === k).color }));
  const months = lastMonthKeys(range);
  const rowsFor = (field) => months.map((mois) => ({ mois, ...Object.fromEntries(nets.map((n) => { const r = data.socialStats.find((x) => x.mois === mois && x.reseau === n); return [n, r ? r[field] : 0]; })) }));
  const a = body.querySelector("#espace-chart-abonnes"), v = body.querySelector("#espace-chart-vues");
  if (a) renderCallsChart(a, rowsFor("abonnes"), series);
  if (v) renderCallsChart(v, rowsFor("vues"), series);
}

// ---------- Calendrier de contenu ----------
const dayLabel = (key) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }); };
function postHtml(p) {
  const link = p.visuel_url && safeUrl(p.visuel_url);
  const legende = p.legende ? (p.legende.length > 220 ? p.legende.slice(0, 220) + "…" : p.legende) : "";
  return `<article class="espace-post${p.statut === "publie" ? " done" : ""}">
    <div class="espace-post-date">${escapeHtml(dayLabel(p.date_prevue))}</div>
    <div class="espace-post-main">
      <div class="espace-post-tags"><span class="status-pill neutral">${escapeHtml(reseauLabel(p.reseau))}</span><span class="status-pill neutral">${escapeHtml(formatLabel(p.format))}</span>${p.statut === "publie" ? `<span class="status-pill ok">Publié</span>` : `<span class="status-pill blue">Prévu</span>`}</div>
      <strong>${escapeHtml(p.titre)}</strong>
      ${legende ? `<p>${escapeHtml(legende)}</p>` : ""}
      ${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" class="espace-post-link">Voir le visuel ↗</a>` : ""}
    </div></article>`;
}
export function calendarHtml(data) {
  const today = new Date(); const key = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  const upcoming = data.posts.filter((p) => p.statut !== "publie" && p.date_prevue >= key).sort((a, b) => a.date_prevue.localeCompare(b.date_prevue)).slice(0, 30);
  const done = data.posts.filter((p) => p.statut === "publie").sort((a, b) => b.date_prevue.localeCompare(a.date_prevue)).slice(0, 6);
  return `
    <h2 class="espace-h2">Calendrier de contenu</h2>
    <div class="card espace-card" style="padding:20px;margin-bottom:16px;">
      <div class="panel-title">À venir</div>
      ${upcoming.length ? upcoming.map(postHtml).join("") : empty("Aucun contenu planifié pour l'instant.")}
    </div>
    ${done.length ? `<div class="card espace-card" style="padding:20px;margin-bottom:24px;"><div class="panel-title">Dernières publications</div>${done.map(postHtml).join("")}</div>` : ""}`;
}

// ---------- Campagnes et collaborations ----------
// Les étapes de recherche (à contacter, contactée, réponse, refusée) restent internes à l'agence.
export const VISIBLE_STATUTS = ["negociation", "signe", "en_cours", "publie", "paye"];
const STATUT_PILL = { negociation: "neutral", signe: "blue", en_cours: "warning", publie: "blue", paye: "ok" };
export function collabsHtml(data, { title = "Campagnes et collaborations" } = {}) {
  const list = data.collabs.filter((c) => VISIBLE_STATUTS.includes(c.statut));
  const paid = list.filter((c) => c.statut === "paye").reduce((s, c) => s + Number(c.montant || 0), 0);
  const pending = list.filter((c) => ["signe", "en_cours", "publie"].includes(c.statut)).reduce((s, c) => s + Number(c.montant || 0), 0);
  const active = list.filter((c) => c.statut !== "negociation").length;
  const nPaid = list.filter((c) => c.statut === "paye").length;
  return `
    <h2 class="espace-h2">${escapeHtml(title)}</h2>
    <div class="stat-grid espace-grid" style="margin-bottom:16px;">
      ${tile("Revenus encaissés", formatEuro(paid), `<span class="espace-delta">${nPaid} payée${nPaid > 1 ? "s" : ""}</span>`)}
      ${tile("À encaisser", formatEuro(pending), `<span class="espace-delta">signées ou en cours</span>`)}
      ${tile("Collaborations", formatNumber(active), `<span class="espace-delta">${list.length - active ? `${list.length - active} en négociation` : "signées ou plus"}</span>`)}
    </div>
    <div class="card espace-card" style="padding:20px;margin-bottom:24px;">
      <div class="panel-title">Liste</div>
      ${list.length ? list.map((c) => `
        <article class="espace-collab">
          <div class="espace-collab-main"><strong>${escapeHtml(c.marque)}</strong><span class="pro-muted">${escapeHtml(natureLabel(c.nature))}${c.date_prevue ? " · " + formatDate(c.date_prevue) : ""}</span>
            ${c.notes ? `<p>${escapeHtml(c.notes)}</p>` : ""}</div>
          <span class="status-pill ${STATUT_PILL[c.statut] || "neutral"}">${escapeHtml(statutLabel(c.statut))}</span>
          <b class="espace-collab-amount">${c.montant != null ? escapeHtml(formatEuro(c.montant)) : "—"}</b>
        </article>`).join("") : empty("Aucune collaboration pour l'instant.")}
    </div>`;
}

// ---------- Mes partenaires (photographes, monteurs, marques… associés au mannequin) ----------
const PSTATUT_PILL = { actif: "ok", en_discussion: "blue", contacte: "neutral", a_contacter: "neutral", inactif: "neutral" };
export function partnersHtml(data) {
  const list = data.partners || [];
  return `
    <h2 class="espace-h2">Mes partenaires</h2>
    <div class="card espace-card" style="padding:20px;margin-bottom:24px;">
      ${list.length ? list.map((p) => {
        const ig = p.instagram ? p.instagram.replace(/^@/, "") : "";
        const site = p.site && safeUrl(/^https?:/i.test(p.site) ? p.site : "https://" + p.site);
        return `<article class="espace-partner">
          <div class="espace-partner-main"><strong>${escapeHtml(p.nom)}</strong><span class="pro-muted">${escapeHtml(categorieLabel(p.categorie))}${p.contact_nom ? " · " + escapeHtml(p.contact_nom) : ""}</span></div>
          <span class="status-pill ${PSTATUT_PILL[p.statut] || "neutral"}">${escapeHtml(partnerStatutLabel(p.statut))}</span>
          <div class="espace-partner-links">
            ${p.email ? `<a href="mailto:${escapeHtml(p.email)}">${escapeHtml(p.email)}</a>` : ""}
            ${p.telephone ? `<a href="tel:${escapeHtml(p.telephone.replace(/\s+/g, ""))}">${escapeHtml(p.telephone)}</a>` : ""}
            ${ig ? `<a href="https://instagram.com/${encodeURIComponent(ig)}" target="_blank" rel="noopener noreferrer">@${escapeHtml(ig)}</a>` : ""}
            ${site ? `<a href="${escapeHtml(site)}" target="_blank" rel="noopener noreferrer">Site ↗</a>` : ""}
          </div>
        </article>`;
      }).join("") : empty("Tes partenaires (photographes, monteurs, marques…) apparaîtront ici.")}
    </div>`;
}
