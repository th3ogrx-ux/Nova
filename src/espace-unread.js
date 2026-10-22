// Compteur de messages non lus (badge du menu) et mise à jour des conversations.
// - Client : réponses de l'admin pas encore lues.   - Admin : messages clients non lus.
// La base ne renvoie que ce que chacun a le droit de voir (RLS, espace.sql).
// Actualisation : au retour sur l'onglet, toutes les 30 s, et en direct si la
// table est branchée sur Supabase Realtime (facultatif, voir README / espace.sql).
import { supabase } from "./supabase.js";

let role = null;
let count = 0;
let timer = null;
let channel = null;
const countListeners = new Set();
const tickListeners = new Set();

export const getUnread = () => count;
export function onUnread(fn) { countListeners.add(fn); return () => countListeners.delete(fn); }
// Appelé quand de nouveaux messages ont peut-être été reçus (la messagerie se rafraîchit alors).
export function onMessagesTick(fn) { tickListeners.add(fn); return () => tickListeners.delete(fn); }

export async function refreshUnread() {
  if (!role) return;
  const other = role === "admin" ? "client" : "admin";
  const { count: c, error } = await supabase
    .from("espace_messages")
    .select("id", { count: "exact", head: true })
    .eq("lu", false)
    .eq("auteur", other);
  if (error) return;
  count = c || 0;
  countListeners.forEach((fn) => fn(count));
}

function tick() {
  refreshUnread();
  tickListeners.forEach((fn) => fn());
}

function onVisible() {
  if (document.visibilityState === "visible") tick();
}

export function startUnreadWatch(userRole) {
  stopUnreadWatch();
  role = userRole;
  tick();
  timer = setInterval(() => { if (document.visibilityState === "visible") tick(); }, 30000);
  document.addEventListener("visibilitychange", onVisible);
  try {
    channel = supabase
      .channel("espace-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "espace_messages" }, tick)
      .subscribe();
  } catch { /* temps réel indisponible : l'actualisation périodique suffit */ }
}

export function stopUnreadWatch() {
  clearInterval(timer);
  timer = null;
  document.removeEventListener("visibilitychange", onVisible);
  if (channel) { supabase.removeChannel(channel); channel = null; }
  role = null;
  count = 0;
  countListeners.forEach((fn) => fn(0));
}
