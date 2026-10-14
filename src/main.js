import "./style.css";
import { confirmDialog } from "./confirm-dialog.js";

// Rend confirmDialog disponible globalement, comme l'ancien window.zenoaConfirm,
// pour rester simple à réutiliser depuis n'importe quel futur script inline.
window.confirmDialog = confirmDialog;

const app = document.getElementById("app");
const toggle = document.getElementById("sidebar-toggle");

toggle.addEventListener("click", () => {
  app.classList.toggle("sidebar-collapsed");
});
