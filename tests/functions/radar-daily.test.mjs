// Teste les critères de la fonction Edge "radar-daily" (e-mail, site ancien, ordre, limites).
// Lancer : node --experimental-strip-types tests/functions/radar-daily.test.mjs
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
globalThis.Deno = { env: { get: () => "x" }, serve() {} };
const here = new URL(".", import.meta.url).pathname;
const code = readFileSync(here + "../../supabase/functions/radar-daily/index.ts", "utf8").replace(/^import .*npm:.*$/m, "const createClient = () => null;");
writeFileSync(here + ".radar-daily.tmp.ts", code);
let fn;
try { fn = await import("./.radar-daily.tmp.ts"); } finally { rmSync(here + ".radar-daily.tmp.ts", { force: true }); }
const { cleanEmail, extractEmail, siteLooksOld, qualifyCandidates } = fn;
let passed = 0; const ok = (n) => { passed++; console.log("  ✓", n); };

// ---- e-mails ----
assert.equal(cleanEmail("Contact@Salon-Lea.fr"), "contact@salon-lea.fr");
assert.equal(cleanEmail("logo@2x.png"), null);
assert.equal(cleanEmail("noreply@site.com"), null);
assert.equal(cleanEmail("pas-un-email"), null);
assert.equal(extractEmail('<a href="mailto:salon@exemple.fr?subject=Bonjour">Écrire</a>'), "salon@exemple.fr");
assert.equal(extractEmail("<p>écrivez à  Pierre.Dupont@plomberie-dupont.fr pour un devis</p>"), "pierre.dupont@plomberie-dupont.fr");
assert.equal(extractEmail('<img src="logo@2x.png"><p>rien</p>'), null);
ok("e-mails : trouvés sur la page, images et adresses techniques ignorées");

// ---- site ancien ----
const now = new Date("2026-10-24");
const modern = '<html><head><meta name="viewport" content="width=device-width"></head><body>© 2026 Salon Léa</body></html>';
assert.equal(siteLooksOld(modern, "https://salon-lea.fr", now), false);
assert.equal(siteLooksOld(modern, "http://salon-lea.fr", now), true, "pas sécurisé");
assert.equal(siteLooksOld("<html><body>Bienvenue</body></html>", "https://x.fr", now), true, "pas adapté au téléphone");
assert.equal(siteLooksOld(modern.replace("2026", "2018"), "https://x.fr", now), true, "copyright ancien");
assert.equal(siteLooksOld(modern + "<font color=red>x</font>", "https://x.fr", now), true, "balises d'un autre âge");
assert.equal(siteLooksOld(modern.replace("© 2026", "Copyright 2022-2025"), "https://x.fr", now), false, "copyright récent");
ok("site ancien : http, sans version téléphone, copyright de plus de 3 ans, vieilles balises");

// ---- critères ----
const lead = (id, website, email) => ({ osm_id: "node/" + id, name: "N" + id, category: "coiffeur", website, email, phone: null });
const sites = {
  "https://vieux.fr/": { email: "contact@vieux.fr", old: true },
  "https://vieux-sans-mail.fr/": { email: null, old: true },
  "https://moderne.fr/": { email: "a@moderne.fr", old: false }
};
const inspect = async (w) => sites[w];
const list = [lead(1, "https://vieux.fr/", null), lead(2, "https://vieux-sans-mail.fr/", null), lead(3, "https://moderne.fr/", null),
  lead(4, null, "pro@sans-site.fr"), lead(5, null, null), lead(6, "https://vieux-sans-mail.fr/", "osm@mail.fr"), lead(7, "https://moderne.fr/", "osm@mail.fr")];
let r = await qualifyCandidates(list, 50, Date.now() + 5000, inspect);
assert.deepEqual(r.accepted.map((c) => [c.osm_id, c.site_quality, c.email]), [
  ["node/1", "needs_update", "contact@vieux.fr"], ["node/4", "no_site", "pro@sans-site.fr"], ["node/6", "needs_update", "osm@mail.fr"]]);
assert.deepEqual(r.stats, { examined: 7, modern: 2, noEmail: 2 });
ok("critères : site ancien + e-mail, ou aucun site + e-mail ; site récent et fiche sans e-mail écartés");

r = await qualifyCandidates(list, 2, Date.now() + 5000, inspect);
assert.equal(r.accepted.length, 2); assert.equal(r.accepted[0].osm_id, "node/1");
ok("le quota est respecté et l'ordre de priorité conservé");

r = await qualifyCandidates(list, 50, Date.now() - 1, inspect);
assert.equal(r.accepted.length, 0);
ok("à l'échéance, la fonction s'arrête proprement");

const many = Array.from({ length: 400 }, (_, i) => lead(i, null, `a${i}@x.fr`));
r = await qualifyCandidates(many, 400, Date.now() + 5000, inspect);
assert.equal(r.accepted.length, 200);
ok("jamais plus de 200 fiches examinées par génération");
console.log(`\n${passed} vérifications OK`);
