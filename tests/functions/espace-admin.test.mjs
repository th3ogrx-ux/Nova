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
  const tables = { espace_businesses: [], espace_profiles: [], audit_log: [], team_members: [], team_roles: [], team_presence: [], user_profiles: [], espace_partners: [] };
  const users = new Map();   // id -> { id, email, password, user_metadata, last_sign_in_at }
  const tokens = new Map();  // token -> userId
  let seq = 0; const failProfileInsert = { on: false };
  class Q {
    constructor(t) { this.t = t; this.f = []; this.op = "select"; this.row = null; this.lim = null; }
    select() { return this; } insert(r) { this.op = "insert"; this.row = r; return this; }
    delete() { this.op = "delete"; return this; } update(r) { this.op = "update"; this.row = r; return this; }
    eq(k, v) { this.f.push([k, v]); return this; } limit(n) { this.lim = n; return this; }
    _rows() { return tables[this.t].filter(r => this.f.every(([k, v]) => r[k] === v)); }
    _run() {
      if (this.op === "insert") {
        if (this.t === "espace_profiles" && failProfileInsert.on) return { data: null, error: { message: "boom" } };
        const row = { id: this.row.id || `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`, ...this.row }; tables[this.t].push(row); return { data: row, error: null };
      }
      if (this.op === "update") { const rows = this._rows(); rows.forEach((r) => Object.assign(r, this.row)); return { data: rows, error: null }; }
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
          const u = { id: `00000000-0000-4000-9000-${String(++seq).padStart(12, "0")}`, email, password, user_metadata: user_metadata || {}, last_sign_in_at: null }; users.set(u.id, u); return { data: { user: u }, error: null };
        },
        updateUserById: async (id, attrs) => { const u = users.get(id); if (!u) return { data: null, error: { message: "nf" } }; if (attrs.password) u.password = attrs.password; if (attrs.user_metadata) u.user_metadata = { ...u.user_metadata, ...attrs.user_metadata }; return { data: { user: u }, error: null }; },
        getUserById: async (id) => users.has(id) ? { data: { user: users.get(id) }, error: null } : { data: null, error: { message: "nf" } },
        deleteUser: async (id) => { users.delete(id); return { error: null }; }
      }
    }
  };
  const addUser = (email, role, businessId, token) => { const u = { id: `00000000-0000-4000-9000-${String(++seq).padStart(12, "0")}`, email, user_metadata: {}, last_sign_in_at: null }; users.set(u.id, u); tokens.set(token, u.id); if (role) tables.espace_profiles.push({ id: u.id, role, business_id: businessId || null }); return u; };
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

// ---------- 5. équipe ----------
w = makeDb();
w.addUser("admin@zenoa.fr", "admin", null, T.admin);
const biz2 = (await w.db.from("espace_businesses").insert({ nom: "Salon Éclat" }).select("id").single()).data;
const cu = w.addUser("client@eclat.fr", "client", biz2.id, T.client); cu.last_sign_in_at = "2026-10-20T10:00:00Z";
const role = (await w.db.from("team_roles").insert({ nom: "Setter", perms: {} }).select("id").single()).data;
for (const action of ["team_list", "team_create", "team_remove", "team_reset_password"]) { r = await read(await call(w.db, { action, email: "x@y.fr", user_id: cu.id }, { token: T.client })); assert.equal(r.status, 403); }
assert.equal(w.users.size, 2); ok("équipe : toutes les actions refusées à un client");
r = await read(await call(w.db, { action: "team_create", email: "pas-un-email" }, { token: T.admin })); assert.equal(r.status, 400);
r = await read(await call(w.db, { action: "team_create", email: "a@b.fr", role_id: "pas-un-uuid" }, { token: T.admin })); assert.equal(r.status, 400);
r = await read(await call(w.db, { action: "team_create", email: "a@b.fr", role_id: "00000000-0000-4000-8000-0000000000aa" }, { token: T.admin })); assert.equal(r.status, 400);
assert.equal(w.tables.team_members.length, 0); assert.equal(w.users.size, 2); ok("team_create : email / rôle invalides -> 400, rien créé");
r = await read(await call(w.db, { action: "team_create", email: " Lea@Zenoa.fr ", role_id: role.id, pseudo: "Léa" }, { token: T.admin }));
assert.equal(r.status, 200); assert.equal(r.body.email, "lea@zenoa.fr"); assert.match(r.body.temp_password, /^\S{4}-\S{4}-\S{4}$/);
const mu = [...w.users.values()].find(x => x.email === "lea@zenoa.fr"); assert.equal(mu.user_metadata.must_change_password, true);
assert.deepEqual(w.tables.team_members.map(m => [m.user_id, m.role_id]), [[mu.id, role.id]]); assert.equal(w.tables.user_profiles[0].pseudo, "Léa");
assert.ok(!w.tables.espace_profiles.some(p => p.id === mu.id)); ok("team_create : compte + membre lié au rôle + pseudo, sans profil client/admin");
r = await read(await call(w.db, { action: "team_create", email: "lea@zenoa.fr" }, { token: T.admin })); assert.equal(r.status, 409); ok("team_create : email déjà utilisé -> 409");
w.tables.team_presence.push({ user_id: mu.id, last_seen: "2026-10-24T09:00:00Z" });
r = await read(await call(w.db, { action: "team_list" }, { token: T.admin }));
assert.equal(r.body.members.length, 1); assert.equal(r.body.members[0].email, "lea@zenoa.fr"); assert.equal(r.body.members[0].last_seen, "2026-10-24T09:00:00Z"); assert.equal(r.body.members[0].pseudo, "Léa");
assert.equal(r.body.mannequins.length, 1); assert.equal(r.body.mannequins[0].nom, "Salon Éclat"); assert.equal(r.body.mannequins[0].last_sign_in_at, "2026-10-20T10:00:00Z");
assert.deepEqual(r.body.partners, []);
ok("team_list : membres (rôle, activité, pseudo) séparés des mannequins (dernière connexion)");
r = await read(await call(w.db, { action: "team_reset_password", user_id: mu.id }, { token: T.admin })); assert.equal(r.status, 200); assert.equal(mu.password, r.body.temp_password);
r = await read(await call(w.db, { action: "team_reset_password", user_id: cu.id }, { token: T.admin })); assert.equal(r.status, 404); ok("team_reset_password : membre oui, client non");
r = await read(await call(w.db, { action: "team_remove", user_id: adminId2() }, { token: T.admin })); assert.equal(r.status, 404);
function adminId2() { return [...w.users.values()][0].id; }
r = await read(await call(w.db, { action: "team_remove", user_id: cu.id }, { token: T.admin })); assert.equal(r.status, 404);
assert.equal(w.users.size, 3); ok("team_remove : impossible sur l'admin ou sur un client");
r = await read(await call(w.db, { action: "team_remove", user_id: mu.id }, { token: T.admin }));
assert.equal(r.status, 200); assert.ok(!w.users.has(mu.id)); assert.equal(w.tables.team_members.length, 0); assert.equal(w.users.size, 2); ok("team_remove : le membre est exclu (compte supprimé)");
assert.ok(w.tables.audit_log.every(a => !JSON.stringify(a).includes("@"))); ok("journal d'équipe : sans e-mail");

// ---------- 6. comptes partenaires ----------
const pid = "00000000-0000-4000-8000-0000000000e1";
w.tables.espace_partners.push({ id: pid, nom: "Studio Lumière", categorie: "photographe", statut: "actif", user_id: null });
for (const action of ["partner_account_create", "partner_account_reset", "partner_account_remove"]) { r = await read(await call(w.db, { action, partner_id: pid, email: "p@x.fr" }, { token: T.client })); assert.equal(r.status, 403); }
assert.equal(w.users.size, 2); ok("comptes partenaires : refusés à un client");
r = await read(await call(w.db, { action: "partner_account_create", partner_id: pid, email: "pas-un-email" }, { token: T.admin })); assert.equal(r.status, 400);
r = await read(await call(w.db, { action: "partner_account_create", partner_id: "pas-un-uuid", email: "p@x.fr" }, { token: T.admin })); assert.equal(r.status, 404);
assert.equal(w.users.size, 2); ok("partner_account_create : email / identifiant invalides, rien créé");
r = await read(await call(w.db, { action: "partner_account_create", partner_id: pid, email: " Photo@Studio.fr " }, { token: T.admin }));
assert.equal(r.status, 200); assert.equal(r.body.email, "photo@studio.fr"); assert.match(r.body.temp_password, /^\S{4}-\S{4}-\S{4}$/);
const pu = [...w.users.values()].find((x) => x.email === "photo@studio.fr"); assert.equal(pu.user_metadata.must_change_password, true); assert.equal(w.tables.espace_partners[0].user_id, pu.id);
assert.ok(!w.tables.espace_profiles.some((p) => p.id === pu.id) && !w.tables.team_members.some((m) => m.user_id === pu.id)); ok("partner_account_create : compte lié à la fiche, sans droits admin / équipe / client");
r = await read(await call(w.db, { action: "partner_account_create", partner_id: pid, email: "autre@x.fr" }, { token: T.admin })); assert.equal(r.status, 409); ok("un partenaire n'a qu'un compte");
w.tables.team_presence.push({ user_id: pu.id, last_seen: "2026-10-25T10:00:00Z" });
r = await read(await call(w.db, { action: "team_list" }, { token: T.admin }));
assert.equal(r.body.partners.length, 1); assert.equal(r.body.partners[0].has_account, true); assert.equal(r.body.partners[0].email, "photo@studio.fr"); assert.equal(r.body.partners[0].last_seen, "2026-10-25T10:00:00Z"); ok("team_list : partenaire avec compte et activité");
r = await read(await call(w.db, { action: "partner_account_reset", partner_id: pid }, { token: T.admin })); assert.equal(r.status, 200); assert.equal(pu.password, r.body.temp_password);
r = await read(await call(w.db, { action: "partner_account_remove", partner_id: pid }, { token: T.admin }));
assert.equal(r.status, 200); assert.ok(!w.users.has(pu.id)); assert.equal(w.tables.espace_partners[0].user_id, null); assert.equal(w.tables.espace_partners.length, 1); ok("partner_account_remove : compte supprimé, fiche conservée");
r = await read(await call(w.db, { action: "partner_account_reset", partner_id: pid }, { token: T.admin })); assert.equal(r.status, 404); ok("reset sans compte -> 404");
console.log(`\n${passed} vérifications OK`);
