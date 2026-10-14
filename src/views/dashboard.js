// Tableau de bord — étape 6.
import { supabase } from "../supabase.js";

const CONTACTED_STATUSES = ["contacte", "veut_maquette", "maquette_envoyee", "client"];

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function monthStart() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// Compte prospects/contacts/clients dans une fenêtre de temps.
// "Contacts" et "clients" sont approximés via updated_at (date de
// dernière modification de la fiche) faute d'historique de statut
// dédié — un prospect modifié plusieurs fois dans la période compte
// une fois, au statut où il se trouve maintenant.
function computeStats(prospects, demoSites, sinceIso) {
  const prospectsInPeriod = prospects.filter((p) => p.created_at >= sinceIso).length;
  const contactsInPeriod = prospects.filter((p) => CONTACTED_STATUSES.includes(p.status) && p.updated_at >= sinceIso).length;
  const demoSitesInPeriod = demoSites.filter((d) => d.created_at >= sinceIso).length;
  const clientsInPeriod = prospects.filter((p) => p.status === "client" && p.updated_at >= sinceIso).length;
  const conversionRate = prospectsInPeriod > 0 ? Math.round((clientsInPeriod / prospectsInPeriod) * 100) : 0;

  return { prospectsInPeriod, contactsInPeriod, demoSitesInPeriod, clientsInPeriod, conversionRate };
}

function statsGridHtml(stats) {
  return `
    <div class="stat-grid">
      <div class="card stat-tile"><div class="stat-tile-value">${stats.prospectsInPeriod}</div><div class="stat-tile-label">Prospects</div></div>
      <div class="card stat-tile"><div class="stat-tile-value">${stats.contactsInPeriod}</div><div class="stat-tile-label">Contacts</div></div>
      <div class="card stat-tile"><div class="stat-tile-value">${stats.demoSitesInPeriod}</div><div class="stat-tile-label">Maquettes</div></div>
      <div class="card stat-tile"><div class="stat-tile-value">${stats.clientsInPeriod}</div><div class="stat-tile-label">Clients</div></div>
      <div class="card stat-tile"><div class="stat-tile-value">${stats.conversionRate}%</div><div class="stat-tile-label">Taux de conversion</div></div>
    </div>
  `;
}

export async function renderDashboard(root) {
  root.innerHTML = `
    <h1 class="page-title">Tableau de bord</h1>
    <p style="color:var(--light-text-dim);font-size:14px;margin-bottom:20px;">Chargement des statistiques...</p>
  `;

  const [prospectsRes, demoSitesRes] = await Promise.all([
    supabase.from("radar_prospects").select("id, status, created_at, updated_at"),
    supabase.from("demo_sites").select("id, created_at")
  ]);

  if (prospectsRes.error || demoSitesRes.error) {
    root.innerHTML = `<h1 class="page-title">Tableau de bord</h1><p class="error-msg">Impossible de charger les statistiques.</p>`;
    return;
  }

  const prospects = prospectsRes.data || [];
  const demoSites = demoSitesRes.data || [];

  const weekStats = computeStats(prospects, demoSites, daysAgo(7));
  const monthStats = computeStats(prospects, demoSites, monthStart());

  root.innerHTML = `
    <h1 class="page-title">Tableau de bord</h1>

    <div style="margin-bottom:28px;">
      <h2 style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--light-text-dim);margin-bottom:12px;">Cette semaine</h2>
      ${statsGridHtml(weekStats)}
    </div>

    <div>
      <h2 style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--light-text-dim);margin-bottom:12px;">Ce mois-ci</h2>
      ${statsGridHtml(monthStats)}
    </div>
  `;
}
