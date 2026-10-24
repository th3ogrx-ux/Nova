// Teste la fonction Edge "audit-public" : lien, mot de passe, expiration, publication, page publique.
// Lancer : node --experimental-strip-types tests/functions/audit-public.test.mjs
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
let handler;
globalThis.Deno = { env: { get: (k) => (k === "SUPABASE_URL" ? "http://x" : "k") }, serve(h) { handler = h; } };
const here = new URL(".", import.meta.url).pathname;
let db = null; globalThis.__db = () => db;
const code = readFileSync(here + "../../supabase/functions/audit-public/index.ts", "utf8").replace(/^import .*npm:.*$/m, "const createClient = () => globalThis.__db();");
writeFileSync(here + ".audit-public.tmp.ts", code);
let fn;
try { fn = await import("./.audit-public.tmp.ts"); } finally { rmSync(here + ".audit-public.tmp.ts", { force: true }); }
const { makeSlug, hashPassword, verifyPassword, isExpired, tooManyAttempts } = fn;
let passed = 0; const ok = (n) => { passed++; console.log("  ✓", n); };

const slugs = new Set(Array.from({ length: 500 }, () => makeSlug()));
assert.equal(slugs.size, 500); assert.ok([...slugs].every((s) => /^[A-Za-z0-9]{12}$/.test(s)));
ok("liens : 12 caractères, uniques, sans caractère ambigu");

const h = await hashPassword("secret123");
assert.ok(h.startsWith("pbkdf2$")); assert.ok(!h.includes("secret123"));
assert.equal(await verifyPassword("secret123", h), true); assert.equal(await verifyPassword("faux", h), false); assert.equal(await verifyPassword("x", ""), false);
assert.notEqual(h, await hashPassword("secret123"));
ok("mot de passe : haché avec sel, vérifié, faux refusé");

assert.equal(isExpired(null), false); assert.equal(isExpired("2020-01-01T00:00:00Z"), true); assert.equal(isExpired("2999-01-01T00:00:00Z"), false);
ok("expiration");
for (let i = 0; i < 8; i++) assert.equal(tooManyAttempts("k", 1000 + i), false);
assert.equal(tooManyAttempts("k", 1010), true); assert.equal(tooManyAttempts("k", 70_000), false);
ok("anti-devinette : 9e essai en une minute bloqué");

// ---- faux client base de données ----
function fake(rows, views, profile = { role: "admin" }, user = { id: "u1" }) {
  const state = { rows, views, signed: [] };
  const q = (table) => {
    const ctx = { table, filters: {}, patch: null };
    const api = {
      select() { return api; }, eq(k, v) { ctx.filters[k] = v; return api; },
      update(p) { ctx.patch = p; return api; }, insert(p) { if (table === "audit_views") state.views.push(p); return Promise.resolve({ error: null }); },
      maybeSingle() { return Promise.resolve(run()); }, single() { return Promise.resolve(run()); }
    };
    function run() {
      if (table === "espace_profiles") return { data: profile };
      const row = state.rows.find((r) => Object.entries(ctx.filters).every(([k, v]) => r[k] === v));
      if (ctx.patch && row) Object.assign(row, ctx.patch);
      return { data: row || null, error: null };
    }
    return api;
  };
  return { state, from: q, auth: { getUser: async (t) => (t === "tok" ? { data: { user }, error: null } : { data: null, error: { message: "bad" } }) },
    storage: { from: () => ({ createSignedUrls: async (paths) => { state.signed.push(...paths); return { data: paths.map((p) => ({ path: p, signedUrl: "https://s/" + p })) }; } }) } };
}
const call = async (body, token) => (await handler(new Request("http://x", { method: "POST", headers: token ? { Authorization: "Bearer " + token } : {}, body: JSON.stringify(body) }))).json();
const ID = "11111111-1111-4111-8111-111111111111";
const audit = () => ({ id: ID, user_id: "u1", title: "Audit", client_name: "Mario", cover_path: "u1/c.jpg", logo_path: null, content: { pages: [{ blocks: [{ type: "image", path: "u1/a.jpg" }] }] }, status: "draft", slug: null, password_hash: null, has_password: false, expires_at: null });

db = fake([audit()], []);
assert.equal((await call({ action: "publish", audit_id: ID })).error, "Non authentifié.");
ok("publier sans connexion : refusé");
db = fake([audit()], [], { role: "client" });
assert.match((await call({ action: "publish", audit_id: ID }, "tok")).error, /administrateur/);
ok("publier en tant que client : refusé");
db = fake([audit()], [], { role: "admin" }, { id: "autre" });
assert.equal((await call({ action: "publish", audit_id: ID }, "tok")).error, "Audit introuvable.");
ok("publier l'audit d'un autre : introuvable");

db = fake([audit()], []);
let r = await call({ action: "publish", audit_id: ID, password: "abcd1234", expires_at: "2999-01-01" }, "tok");
assert.equal(r.audit.status, "published"); assert.match(r.audit.slug, /^[A-Za-z0-9]{12}$/); assert.equal(r.audit.has_password, true);
assert.ok(db.state.rows[0].password_hash.startsWith("pbkdf2$")); assert.ok(db.state.rows[0].published_content.content.pages.length);
const slug = r.audit.slug;
ok("publication : lien généré, mot de passe haché, version figée");

assert.equal((await call({ action: "view", slug: "nope" })).state, "unavailable");
assert.equal((await call({ action: "view", slug })).state, "password");
assert.equal((await call({ action: "view", slug, password: "mauvais" })).wrong, true);
assert.equal(db.state.views.length, 0);
ok("page publique : mot de passe demandé, faux refusé, aucune vue comptée");
r = await call({ action: "view", slug, password: "abcd1234" });
assert.equal(r.state, "ok"); assert.equal(r.urls["u1/a.jpg"], "https://s/u1/a.jpg"); assert.equal(r.audit.title, "Audit"); assert.ok(!("password_hash" in r.audit));
assert.equal(db.state.views.length, 1);
ok("bon mot de passe : contenu + images signées, 1 vue");
await call({ action: "view", slug, password: "abcd1234" }, "tok");
assert.equal(db.state.views.length, 1);
ok("ta propre visite connectée n'est pas comptée");

// la page publique montre la dernière version PUBLIÉE, pas le brouillon
db.state.rows[0].title = "Brouillon modifié";
assert.equal((await call({ action: "view", slug, password: "abcd1234", count: false })).audit.title, "Audit");
ok("le lien montre la dernière version publiée");
r = await call({ action: "publish", audit_id: ID }, "tok");
assert.equal(r.audit.slug, slug); assert.equal(r.audit.has_password, true);
assert.equal((await call({ action: "view", slug, password: "abcd1234", count: false })).audit.title, "Brouillon modifié");
ok("republier : même lien, mot de passe conservé, nouvelle version");

db.state.rows[0].expires_at = "2020-01-01T00:00:00Z";
assert.equal((await call({ action: "view", slug, password: "abcd1234" })).state, "unavailable");
db.state.rows[0].expires_at = null;
await call({ action: "unpublish", audit_id: ID }, "tok");
assert.equal((await call({ action: "view", slug, password: "abcd1234" })).state, "unavailable");
ok("expiré ou dépublié : « Audit indisponible »");
r = await call({ action: "publish", audit_id: ID, password: "" }, "tok");
assert.equal(r.audit.has_password, false); assert.equal(r.audit.slug, slug);
assert.equal((await call({ action: "view", slug })).state, "ok");
ok("republié sans mot de passe : même lien");
assert.equal((await call({ action: "x" })).error, "Action inconnue.");
console.log(`\n${passed} groupes de tests passés`);
