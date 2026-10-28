// Messagerie client <-> admin.
// - Client : une seule conversation, avec toi.
// - Admin  : boîte de réception (toutes les conversations) + réponse.
// Les droits sont dans la base (espace.sql) : un client ne lit et n'écrit que
// dans SA conversation, et ne peut écrire qu'en son nom.
import { supabase } from "../supabase.js";
import { getCurrentRole, getCurrentBusinessId, getCurrentUser } from "../session.js";
import { loadTeam } from "./equipe-data.js";
import { refreshUnread, onMessagesTick } from "../espace-unread.js";
import { escapeHtml } from "./espace-data.js";

const MAX_LENGTH = 4000;
const MESSAGE_COLUMNS = "id, business_id, auteur, texte, created_at, lu";

// Messages de l'équipe : on les range comme ceux des mannequins (conversation « t:<id du membre> »,
// le membre joue le rôle du « client », l'admin reste « admin »).
const TEAM_COLUMNS = "id, member_id, auteur, texte, created_at, lu";
const normTeam = (r) => ({ id: r.id, business_id: "t:" + r.member_id, auteur: r.auteur === "membre" ? "client" : "admin", texte: r.texte, created_at: r.created_at, lu: r.lu });
const isTeamConv = (id) => typeof id === "string" && id.startsWith("t:");

const initialOf = (name) => (String(name || "?").trim().charAt(0) || "?").toUpperCase();
// Pastille ronde : photo de profil si on l'a, sinon l'initiale. « star » = le logo Zenoa (côté équipe).
const avatarHtml = (person, size = "") => {
  if (person && person.star) return `<span class="msg-av star${size}"><img src="/zenoa-icon.png" alt=""></span>`;
  const url = person && person.avatar_url;
  return `<span class="msg-av${size}">${url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : escapeHtml(initialOf(person && person.nom))}</span>`;
};
const ZENOA_PERSON = { star: true, nom: "Zenoa" };

const timeOf = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayKey = (iso) => { const d = new Date(iso); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return "Aujourd'hui";
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function shortAgo(iso) {
  const d = new Date(iso);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return timeOf(iso);
  if (days === 1) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export async function renderMessages(root) {
  const role = getCurrentRole();
  const isAdmin = role === "admin";
  const isMember = role === "team";
  const other = isAdmin ? "client" : "admin"; // l'auteur dont on reçoit les messages
  const mine = isAdmin ? "admin" : "client";

  root.innerHTML = `<h1 class="page-title">Messages</h1><div id="msg-app"><p style="color:var(--light-text-dim);font-size:14px;">Chargement…</p></div>`;
  const app = root.querySelector("#msg-app");

  let businesses = [];          // admin : tous les commerces
  let members = [];             // admin : membres de l'équipe
  let selectedId = isAdmin ? null : isMember ? null : getCurrentBusinessId();
  if (isMember) { const u = await getCurrentUser(); selectedId = u ? "t:" + u.id : null; }
  let all = [];                 // messages (client : sa conversation ; admin : toutes)
  let dividerBeforeId = null;   // "Nouveaux messages" : premier message non lu à l'ouverture
  let sending = false;

  if (!isAdmin && !selectedId) {
    app.innerHTML = `<div class="card" style="padding:20px;"><p style="color:var(--light-text-dim);font-size:14px;">Ton commerce n'est pas encore rattaché à ce compte. Contacte Zenoa.</p></div>`;
    return;
  }

  // ---------- Données ----------
  async function fetchAll() {
    let list = [];
    if (!isMember) {
      let query = supabase.from("espace_messages").select(MESSAGE_COLUMNS).order("created_at", { ascending: true }).limit(2000);
      if (!isAdmin) query = query.eq("business_id", selectedId);
      const { data, error } = await query;
      if (error) throw error;
      list = data || [];
    }
    if (isAdmin || isMember) {
      // Table facultative (equipe-messages.sql) : si elle manque, on ignore simplement les messages d'équipe.
      const { data, error } = await supabase.from("team_messages").select(TEAM_COLUMNS).order("created_at", { ascending: true }).limit(2000);
      if (isMember && error) throw error;
      if (!error) list = list.concat((data || []).map(normTeam)).sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    return list;
  }

  // La personne à qui on parle : côté admin, la conversation ouverte ; côté mannequin ou membre, Zenoa.
  const personOf = (id) => businesses.concat(members).find((x) => x.id === id) || null;
  const otherPerson = () => (isAdmin ? personOf(selectedId) : ZENOA_PERSON);

  const threadOf = (id) => all.filter((m) => m.business_id === id);

  // ---------- "Lu" : seulement quand la page est réellement sous les yeux ----------
  // (les pages sont préparées en arrière-plan : on ne marque rien comme lu à ce moment-là)
  const isVisible = () => !root.hidden && root.isConnected && document.visibilityState === "visible";

  async function markRead() {
    if (!selectedId || !isVisible()) return;
    const unread = threadOf(selectedId).filter((m) => m.auteur === other && !m.lu);
    if (!unread.length) return;
    const { error } = isTeamConv(selectedId)
      ? await supabase.rpc("team_mark_read", { p_member_id: isAdmin ? selectedId.slice(2) : null })
      : await supabase.rpc("espace_mark_read", { p_business_id: isAdmin ? selectedId : null });
    if (error) return;
    unread.forEach((m) => { m.lu = true; });
    if (isAdmin) renderList();
    refreshUnread();
  }

  new MutationObserver(() => { if (isVisible()) markRead(); }).observe(root, { attributes: true, attributeFilter: ["hidden"] });
  document.addEventListener("visibilitychange", () => { if (root.isConnected) markRead(); });

  // ---------- Affichage d'une conversation ----------
  function bubblesHtml(list) {
    if (!list.length) {
      return `<p class="msg-empty">${isAdmin ? "Aucun message pour l'instant. Écris le premier !" : "Aucun message pour l'instant. Écris-nous, on te répond rapidement."}</p>`;
    }
    let html = "";
    let lastDay = null;
    list.forEach((m) => {
      const key = dayKey(m.created_at);
      if (key !== lastDay) { html += `<div class="msg-day">${escapeHtml(dayLabel(m.created_at))}</div>`; lastDay = key; }
      if (m.id === dividerBeforeId) html += `<div class="msg-new-divider"><span>Nouveaux messages</span></div>`;
      const own = m.auteur === mine;
      html += `
        <div class="msg-row ${own ? "own" : "theirs"}">
          ${own ? "" : avatarHtml(otherPerson(), " sm")}
          <div class="msg-bubble${m.pending ? " pending" : ""}">
            <div class="msg-text">${escapeHtml(m.texte)}</div>
            <div class="msg-meta">${timeOf(m.created_at)}${own && !m.pending ? (m.lu ? " · Lu" : " · Envoyé") : ""}${m.pending ? " · Envoi…" : ""}</div>
          </div>
        </div>`;
    });
    return html;
  }

  function renderThread({ keepScroll = false } = {}) {
    const box = app.querySelector("#msg-thread");
    if (!box) return;
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    const prevTop = box.scrollTop;
    box.innerHTML = bubblesHtml(threadOf(selectedId));
    if (keepScroll && !nearBottom) box.scrollTop = prevTop;
    else {
      const divider = box.querySelector(".msg-new-divider");
      if (divider && !keepScroll) box.scrollTop = Math.max(0, divider.offsetTop - 60);
      else box.scrollTop = box.scrollHeight;
    }
  }

  function composerHtml() {
    return `
      <form id="msg-form" class="msg-form" autocomplete="off">
        <textarea id="msg-input" rows="1" maxlength="${MAX_LENGTH}" placeholder="Écrire un message…" aria-label="Votre message"></textarea>
        <button type="submit" class="btn primary" id="msg-send" aria-label="Envoyer">Envoyer</button>
      </form>
      <div id="msg-error" class="error-msg" style="min-height:0;margin-top:6px;"></div>`;
  }

  function wireComposer() {
    const form = app.querySelector("#msg-form");
    const input = app.querySelector("#msg-input");
    const errorEl = app.querySelector("#msg-error");
    const grow = () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 140) + "px"; };
    input.addEventListener("input", grow);
    // Entrée envoie, Maj+Entrée fait un retour à la ligne.
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const texte = input.value.trim();
      if (!texte || sending) return;
      sending = true;
      errorEl.textContent = "";
      const pending = { id: "pending-" + Date.now(), business_id: selectedId, auteur: mine, texte, created_at: new Date().toISOString(), lu: false, pending: true };
      all.push(pending);
      input.value = ""; grow();
      renderThread();
      let data, error;
      if (isTeamConv(selectedId)) {
        const res = await supabase.from("team_messages").insert({ member_id: selectedId.slice(2), auteur: isAdmin ? "admin" : "membre", texte }).select(TEAM_COLUMNS).single();
        error = res.error; data = res.data ? normTeam(res.data) : null;
      } else {
        const res = await supabase.from("espace_messages").insert({ business_id: selectedId, auteur: mine, texte }).select(MESSAGE_COLUMNS).single();
        error = res.error; data = res.data;
      }
      sending = false;
      all = all.filter((m) => m !== pending);
      if (error || !data) {
        errorEl.textContent = "Message non envoyé. Vérifie ta connexion puis réessaie.";
        input.value = texte; grow();
      } else {
        all.push(data);
      }
      renderThread();
      if (isAdmin) renderList();
      input.focus();
    });
  }

  // ---------- Client : une seule conversation ----------
  function drawClient() {
    app.innerHTML = `
      <div class="card msg-card">
        <div class="msg-head">${avatarHtml(ZENOA_PERSON, " md")}<strong>${isMember ? "Conversation avec l'admin" : "Conversation avec Zenoa"}</strong><span>${isMember ? "Ton message arrive directement chez le fondateur." : "On te répond rapidement."}</span></div>
        <div id="msg-thread" class="msg-thread" role="log" tabindex="0" aria-label="Conversation"></div>
        ${composerHtml()}
      </div>`;
    wireComposer();
    renderThread();
  }

  // ---------- Admin : boîte de réception ----------
  function conversations() {
    return businesses.concat(members).map((b) => {
      const list = threadOf(b.id);
      const last = list[list.length - 1] || null;
      return { b, last, unread: list.filter((m) => m.auteur === "client" && !m.lu).length };
    }).sort((x, y) => (y.last ? y.last.created_at : "").localeCompare(x.last ? x.last.created_at : "") || x.b.nom.localeCompare(y.b.nom));
  }

  function renderList() {
    const box = app.querySelector("#msg-list");
    if (!box) return;
    box.innerHTML = conversations().map(({ b, last, unread }) => `
      <button type="button" class="msg-conv${b.id === selectedId ? " active" : ""}" data-id="${b.id}">
        ${avatarHtml(b)}<div class="msg-conv-main">
        <div class="msg-conv-top"><strong>${escapeHtml(b.nom)}${b.team ? ` <span class="msg-tag">Équipe</span>` : ""}</strong>${last ? `<span>${escapeHtml(shortAgo(last.created_at))}</span>` : ""}</div>
        <div class="msg-conv-bottom">
          <span class="msg-conv-preview">${last ? `${last.auteur === "admin" ? "Vous : " : ""}${escapeHtml(last.texte)}` : "Aucun message"}</span>
          ${unread ? `<span class="msg-unread" aria-label="${unread} non lu${unread > 1 ? "s" : ""}">${unread}</span>` : ""}
        </div></div>
      </button>`).join("") || `<p class="msg-empty">Aucune conversation pour l'instant.</p>`;
    box.querySelectorAll(".msg-conv").forEach((btn) => btn.addEventListener("click", () => select(btn.dataset.id)));
  }

  function select(id) {
    selectedId = id;
    const unread = threadOf(id).filter((m) => m.auteur === "client" && !m.lu);
    dividerBeforeId = unread.length ? unread[0].id : null;
    const b = businesses.concat(members).find((x) => x.id === id);
    app.querySelector(".msg-admin").classList.add("show-thread");
    app.querySelector("#msg-pane").innerHTML = `
      <div class="msg-head">
        <button type="button" class="icon-btn msg-back" id="msg-back" aria-label="Retour aux conversations">‹</button>
        ${avatarHtml(b, " md")}<strong>${escapeHtml(b ? b.nom : "Conversation")}${b && b.team ? ` <span class="msg-tag">Équipe</span>` : ""}</strong>
      </div>
      <div id="msg-thread" class="msg-thread" role="log" tabindex="0" aria-label="Conversation"></div>
      ${composerHtml()}`;
    app.querySelector("#msg-back").addEventListener("click", () => app.querySelector(".msg-admin").classList.remove("show-thread"));
    wireComposer();
    renderThread();
    renderList();
    markRead();
  }

  function drawAdmin() {
    app.innerHTML = `
      <div class="card msg-card msg-admin">
        <div class="msg-list-col"><div id="msg-list" class="msg-list"></div></div>
        <div class="msg-pane-col" id="msg-pane"><p class="msg-empty">Choisis une conversation.</p></div>
      </div>`;
    renderList();
    if (!window.matchMedia("(max-width: 760px)").matches) {
      const first = conversations().find((c) => c.unread) || conversations()[0];
      if (first) select(first.b.id);
    }
  }

  // ---------- Démarrage + actualisation ----------
  try {
    const jobs = [fetchAll()];
    if (isAdmin) { jobs.push(supabase.from("espace_businesses").select("id, nom").order("nom")); jobs.push(loadTeam().catch(() => null)); }
    const [messages, bizRes, teamRes] = await Promise.all(jobs);
    all = messages;
    if (isAdmin) {
      if (bizRes.error) throw bizRes.error;
      businesses = bizRes.data || [];
      // Photos de profil (comptes des mannequins et des membres) : fournies par la fonction espace-admin ; sinon initiales.
      const avatarOf = Object.fromEntries(((teamRes && teamRes.mannequins) || []).map((m) => [m.business_id, m.avatar_url || null]));
      businesses = businesses.map((b) => ({ ...b, avatar_url: avatarOf[b.id] || null }));
      members = ((teamRes && teamRes.members) || []).map((m) => ({ id: "t:" + m.user_id, nom: m.pseudo || m.email || "Membre", avatar_url: m.avatar_url || null, team: true }));
    }
  } catch (err) {
    console.error("[Messages]", err);
    app.innerHTML = `<p class="error-msg">Impossible de charger les messages pour le moment.</p>`;
    return;
  }
  if (!isAdmin) {
    const unread = all.filter((m) => m.auteur === other && !m.lu);
    dividerBeforeId = unread.length ? unread[0].id : null;
    drawClient();
    markRead();
  } else {
    drawAdmin();
  }

  // Nouveaux messages reçus : on recharge sans toucher à ce que la personne est en train d'écrire.
  const stopTicks = onMessagesTick(async () => {
    if (!root.isConnected) { stopTicks(); return; }
    if (sending) return;
    try {
      const fresh = await fetchAll();
      const pendingOnes = all.filter((m) => m.pending);
      const known = new Set(all.map((m) => m.id));
      const hasNew = fresh.some((m) => !known.has(m.id));
      const readChanged = fresh.some((m) => { const old = all.find((o) => o.id === m.id); return old && old.lu !== m.lu; });
      if (!hasNew && !readChanged) return;
      // on garde l'état "lu" local pour ne pas faire clignoter le séparateur
      all = fresh.concat(pendingOnes);
      if (selectedId && app.querySelector("#msg-thread")) renderThread({ keepScroll: true });
      if (isAdmin) renderList();
      markRead();
    } catch { /* réseau coupé : on réessaie au prochain tour */ }
  });
}
