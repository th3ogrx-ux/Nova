// Teste la fonction Edge "espace-admin" avec une fausse base en mémoire.
// Lancer : node --experimental-strip-types tests/functions/espace-admin.test.mjs
import assert from "node:assert/strict";
// Faux jeton JWT (la signature est vérifiée par Supabase en vrai ; ici seul le niveau "aal" compte).
const mk = (aal, tag) => "h." + Buffer.from(JSON.stringify({ aal, tag })).toString("base64url") + ".s";
const T = { admin: mk("aal2", "admin"), adminNo2fa: mk("aal1", "admin"), client: mk("aal2", "client"), noprofile: mk("aal1", "np") };
globalThis.Deno = { env: { get: (k) => (k === "ALLOWED_ORIGINS" ? "" : "x") }, serve() {} };
// Node ne connaît pas l'import "npm:" de Deno : on teste une copie où il est retiré.
import { readFileSync, writeFileSync, rmSync } from "node:fs";
const here = new URL(".", import.meta.url).pathname;
const code = readFileSync(here + "../../supabase/functions/espace-admin/index.ts", "utf8").replace(/^import .*npm:.*$/m, "const createClient = () => null;");
writeFileSync(here + ".espace-admin.tmp.ts", code);
let handle, generateTempPassword;
try { ({ handle, generateTempPassword } = await import("./.espace-admin.tmp.ts")); } finally { rmSync(here + ".espace-admin.tmp.ts", { force: true }); }

// ---------- fausse base en mémoire ----------
function makeDb() {
  const tables = { espace_businesses: [], espace_profiles: [], audit_log: [] };
  const users = new Map();   // id -> { id, email, password, user_metadata, last_sign_in_at }
  const tokens = new Map();  // token -> userId
  let seq = 0; const failProfileInsert = { on: false };
  class Q {
    constructor(t) { this.t = t; this.f = []; this.op = "select"; this.row = null; this.lim = null; }
    select() { return this; } insert(r) { this.op = "insert"; this.row = r; return this; }
    delete() { this.op = "delete"; return this; }
    eq(k, v) { this.f.push([k, v]); return this; } limit(n) { this.lim = n; return this; }
    _rows() { return tables[this.t].filter(r => this.f.every(([k, v]) => r[k] === v)); }
    _run() {
      if (this.op === "insert") {
        if (this.t === "espace_profiles" && failProfileInsert.on) return { data: null, error: { message: "boom" } };
        const row = { id: this.row.id || `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`, ...this.row }; tables[this.t].push(row); return { data: row, error: null };
      }
      if (this.op === "delete") { const del = this._rows(); tables[this.t] = tables[this.t].filter(r => !del.includes(r));
        if (this.t === "espace_businesses") tables.espace_profiles = tables.espace_profiles.filter(p => !del.some(d => d.id === p.business_id)); return { data: del, error: null }; }
      let rows = this._rows(); if (this.lim) rows = rows.slice(0, this.lim); return { data: rows, error: null };
    }
    single() { const r = this._run(); return Promise.resolve({ data: r.data && (Array.isArray(r.data) ? r.data[0] : r.data), error: r.error }); }
    maybeSingle() { const r = this._run(); return Promise.resolve({ data: (r.data && r.data[0]) || null, error: r.error }); }
    then(res, rej) { return Promise.resolve(this._run()).then(res, rej); }
  }
  const db = {
    from: (t) => new Q(t),
    auth: {
      getUser: async (token) => tokens.has(token) ? { data: { user: users.get(tokens.get(token)) }, error: null } : { data: { user: null }, error: { message: "bad jwt" } },
      admin: {
        createUser: async ({ email, password, user_metadata }) => {
          if ([...users.values()].some(u => u.email === email)) return { data: null, error: { message: "A user with this email address has already been registered" } };
          const u = { id: `u${++seq}`, email, password, user_metadata: user_metadata || {}, last_sign_in_at: null }; users.set(u.id, u); return { data: { user: u }, error: null };
        },
        updateUserById: async (id, attrs) => { const u = users.get(id); if (!u) return { data: null, error: { message: "nf" } }; if (attrs.password) u.password = attrs.password; if (attrs.user_metadata) u.user_metadata = { ...u.user_metadata, ...attrs.user_metadata }; return { data: { user: u }, error: null }; },
        getUserById: async (id) => users.has(id) ? { data: { user: users.get(id) }, error: null } : { data: null, error: { message: "nf" } },
        deleteUser: async (id) => { users.delete(id); return { error: null }; }
      }
    }
  };
  const addUser = (email, role, businessId, token) => { const u = { id: `u${++seq}`, email, user_metadata: {}, last_sign_in_at: null }; users.set(u.id, u); tokens.set(token, u.id); if (role) tables.espace_profiles.push({ id: u.id, role, business_id: businessId || null }); return u; };
  return { db, tables, users, tokens, addUser, failProfileInsert };
}
const call = (db, body, { token, method = "POST" } = {}) => handle(new Request("https://x.test/fn", { method, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) }, body: method === "POST" ? JSON.stringify(body) : undefined }), db);
const read = async (r) => ({ status: r.status, body: await r.json() });
let passed = 0; const ok = (name) => { passed++; console.log("  ✓", name); };

// ---------- 1. mot de passe temporaire ----------
const seen = new Set();
for (let i = 0; i < 2000; i++) { const p = generateTempPassword(); assert.match(p, /^[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}$/); seen.add(p); }
assert.equal(seen.size, 2000); ok("mots de passe temporaires : format correct, sans caractères ambigus, 2000 sur 2000 différents");

// ---------- 2. qui a le droit ? ----------
let w = makeDb();
w.addUser("admin@zenoa.fr", "admin", null, T.admin);
const adminId = [...w.users.values()][0].id;
const biz = (await w.db.from("espace_businesses").insert({ nom: "Barbier" }).select("id").single()).data;
w.addUser("client@barbier.fr", "client", biz.id, T.client);
w.addUser("radar@user.fr", null, null, T.noprofile);
const good = { action: "create_client", nom: "Salon X", email: "contact@salonx.fr" };
let r = await read(await call(w.db, good)); assert.equal(r.status, 401); ok("sans connexion -> 401");
r = await read(await call(w.db, good, { token: "faux" })); assert.equal(r.status, 401); ok("jeton invalide -> 401");
r = await read(await call(w.db, good, { token: T.client })); assert.equal(r.status, 403); ok("un CLIENT ne peut pas créer de compte -> 403");
r = await read(await call(w.db, good, { token: T.noprofile })); assert.equal(r.status, 403); ok("un utilisateur sans profil -> 403");
assert.equal(w.tables.espace_businesses.length, 1); ok("aucun commerce créé par les appels refusés");
for (const action of ["reset_password", "get_account", "delete_client"]) { r = await read(await call(w.db, { action, business_id: biz.id }, { token: T.client })); assert.equal(r.status, 403); }
assert.equal(w.users.size, 3); ok("reset / get / delete refusés au client (et rien supprimé)");
assert.equal((await call(w.db, {}, { method: "GET" })).status, 405); ok("méthode GET refusée -> 405");
assert.equal((await call(w.db, {}, { method: "OPTIONS" })).status, 200); ok("préflight CORS (OPTIONS) accepté");

// ---------- 3. création ----------
r = await read(await call(w.db, { action: "create_client", nom: "  Salon X  ", secteur: "Coiffeur", ville: "Lille", email: "  Contact@SalonX.fr " }, { token: T.admin }));
assert.equal(r.status, 200); assert.match(r.body.temp_password, /^\S{4}-\S{4}-\S{4}$/); assert.equal(r.body.email, "contact@salonx.fr");
const created = w.tables.espace_businesses.find(b => b.id === r.body.business_id);
assert.equal(created.nom, "Salon X"); const prof = w.tables.espace_profiles.find(p => p.business_id === created.id);
assert.equal(prof.role, "client"); const u = [...w.users.values()].find(x => x.email === "contact@salonx.fr");
assert.equal(prof.id, u.id); assert.equal(u.password, r.body.temp_password); assert.equal(u.user_metadata.must_change_password, true);
ok("création : commerce nettoyé, compte en minuscules, profil CLIENT lié, mot de passe temporaire à changer");
const before = JSON.stringify([w.tables.espace_businesses.length, w.users.size]);
r = await read(await call(w.db, { action: "create_client", nom: "", email: "a@b.fr" }, { token: T.admin })); assert.equal(r.status, 400);
r = await read(await call(w.db, { action: "create_client", nom: "Y", email: "pas-un-email" }, { token: T.admin })); assert.equal(r.status, 400);
assert.equal(JSON.stringify([w.tables.espace_businesses.length, w.users.size]), before); ok("nom vide / email invalide -> 400, rien créé");
r = await read(await call(w.db, { action: "create_client", nom: "Doublon", email: "contact@salonx.fr" }, { token: T.admin }));
assert.equal(r.status, 409); assert.equal(JSON.stringify([w.tables.espace_businesses.length, w.users.size]), before); ok("email déjà utilisé -> 409, et le commerce créé en route est annulé (pas d'orphelin)");
w.failProfileInsert.on = true;
r = await read(await call(w.db, { action: "create_client", nom: "Panne", email: "panne@x.fr" }, { token: T.admin }));
assert.equal(r.status, 500); assert.equal(JSON.stringify([w.tables.espace_businesses.length, w.users.size]), before); w.failProfileInsert.on = false; ok("panne pendant la création -> tout est annulé (compte ET commerce)");

// ---------- 4. mot de passe, compte, suppression ----------
const oldPw = u.password; u.user_metadata.must_change_password = false;
r = await read(await call(w.db, { action: "reset_password", business_id: created.id }, { token: T.admin }));
assert.equal(r.status, 200); assert.notEqual(r.body.temp_password, oldPw); assert.equal(u.password, r.body.temp_password); assert.equal(u.user_metadata.must_change_password, true); ok("reset_password : nouveau mot de passe temporaire + changement obligatoire");
r = await read(await call(w.db, { action: "reset_password", business_id: "pas-un-uuid" }, { token: T.admin })); assert.equal(r.status, 400); ok("identifiant invalide -> 400");
r = await read(await call(w.db, { action: "reset_password", business_id: "00000000-0000-4000-8000-000000000000" }, { token: T.admin })); assert.equal(r.status, 404); ok("commerce sans compte -> 404");
r = await read(await call(w.db, { action: "get_account", business_id: created.id }, { token: T.admin })); assert.equal(r.body.email, "contact@salonx.fr"); assert.equal(r.body.must_change_password, true); ok("get_account : email + état du mot de passe");
r = await read(await call(w.db, { action: "delete_client", business_id: created.id }, { token: T.admin }));
assert.equal(r.status, 200); assert.ok(!w.tables.espace_businesses.some(b => b.id === created.id)); assert.ok(![...w.users.values()].some(x => x.email === "contact@salonx.fr"));
assert.ok([...w.users.values()].some(x => x.email === "admin@zenoa.fr")); assert.ok([...w.users.values()].some(x => x.email === "client@barbier.fr")); ok("delete_client : supprime ce client (commerce + compte) sans toucher à l'admin ni aux autres clients");
r = await read(await call(w.db, { action: "nimporte", }, { token: T.admin })); assert.equal(r.status, 400); ok("action inconnue -> 400");
assert.deepEqual(w.tables.audit_log.map(a => a.type), ["client_created", "client_password_reset", "client_deleted"]); assert.ok(w.tables.audit_log.every(a => a.actor === adminId && !JSON.stringify(a).includes("@")));
ok("journal : création / réinitialisation / suppression enregistrées, sans e-mail ni mot de passe");
console.log(`\n${passed} vérifications OK`);
