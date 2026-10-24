// Page publique d'un audit (/a/xxxx) : aucune connexion demandée. Le contenu vient de la fonction « audit-public ».
import { supabase } from "../supabase.js";
import { renderAuditHtml } from "./audit-render.js";
import { escapeHtml } from "./pro-data.js";

const SEEN = (slug) => "zenoa-audit-seen-" + slug;
const PW = (slug) => "zenoa-audit-pw-" + slug;
const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* pas grave */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* pas grave */ } }
};

function setRobots() {
  let m = document.querySelector('meta[name="robots"]');
  if (!m) { m = document.createElement("meta"); m.name = "robots"; document.head.appendChild(m); }
  m.content = "noindex, nofollow, noarchive";
}

export async function renderPublicAudit(el, slug) {
  setRobots();
  document.documentElement.classList.add("pub-root");
  el.className = "pub pub-auto pub-page";
  el.innerHTML = `<div class="pub-center"><p class="pub-dim">Chargement…</p></div>`;

  const shell = (inner) => { el.innerHTML = `<div class="pub-center">${inner}</div>`; };
  const unavailable = () => { document.title = "Audit indisponible"; shell(`<span class="pub-brand-name">Zenoa Agency</span><h1 class="pub-title" style="font-size:28px;margin-top:14px;">Audit indisponible</h1><p class="pub-dim">Ce lien n'est plus actif ou n'existe pas. Contacte la personne qui te l'a envoyé.</p>`); };

  async function load(password) {
    let res;
    try {
      const count = !store.get(SEEN(slug));
      const { data, error } = await supabase.functions.invoke("audit-public", { body: { action: "view", slug, password: password || undefined, count } });
      if (error) {
        let body = null; try { body = await error.context.json(); } catch { /* corps non JSON */ }
        if (body && body.state === "password") res = body; else throw error;
      } else res = data;
    } catch (err) {
      console.error("[Audit public]", err);
      shell(`<span class="pub-brand-name">Zenoa Agency</span><h1 class="pub-title" style="font-size:28px;margin-top:14px;">Chargement impossible</h1><p class="pub-dim">Réessaie dans un instant.</p><p><button type="button" class="pub-btn" data-retry>Réessayer</button></p>`);
      el.querySelector("[data-retry]").addEventListener("click", () => load(password));
      return;
    }
    if (!res || res.state === "unavailable") return unavailable();
    if (res.state === "password") return askPassword(res);
    if (password) store.set(PW(slug), password);
    store.set(SEEN(slug), "1");
    document.title = res.audit.title || "Audit";
    el.innerHTML = renderAuditHtml(res.audit, (p) => (res.urls || {})[p] || "");
    el.querySelectorAll(".pub-toc a").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); el.querySelector(a.getAttribute("href"))?.scrollIntoView({ behavior: "smooth" }); }));
  }

  function askPassword(res) {
    document.title = "Audit protégé";
    shell(`<span class="pub-brand-name">Zenoa Agency</span><h1 class="pub-title" style="font-size:28px;margin:14px 0 6px;">Audit protégé</h1><p class="pub-dim">Saisis le mot de passe que tu as reçu.</p>
      <form data-form class="pub-pw"><input type="password" name="password" autocomplete="current-password" required aria-label="Mot de passe" autofocus><button type="submit" class="pub-btn">Ouvrir</button></form>
      <p class="pub-err" role="alert">${res.wrong ? "Mot de passe incorrect." : escapeHtml(res.error || "")}</p>`);
    el.querySelector("[data-form]").addEventListener("submit", (e) => { e.preventDefault(); load(e.target.password.value); });
  }

  const remembered = store.get(PW(slug));
  await load(remembered || null);
}
