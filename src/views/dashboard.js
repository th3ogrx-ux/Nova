// Tableau de bord — les ventes (voir sales-card.js).
import { getCurrentUser, getDataOwnerId } from "../session.js";
import { renderSalesCard } from "./sales-card.js";

export async function renderDashboard(root) {
  root.innerHTML = `
    <h1 class="page-title">Tableau de bord</h1>
    <div class="card" id="dashboard-sales" style="padding:20px;margin-bottom:24px;"></div>
  `;
  const user = await getCurrentUser();
  await renderSalesCard(root.querySelector("#dashboard-sales"), getDataOwnerId() || user.id);
}
