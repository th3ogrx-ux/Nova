import test from "node:test";
import assert from "node:assert/strict";
import { categoryOf, orderByPriority, CATEGORY_INFO, OSM_FILTERS, isChainOrBig, qualifyLead } from "../../src/radar-categories.js";

test("reconnaît les 3 familles ciblées", () => {
  assert.equal(categoryOf({ shop: "hairdresser", name: "Salon Léa" }), "coiffeur");
  assert.equal(categoryOf({ shop: "hairdresser", hairdresser: "barber", name: "Cut" }), "barbier");
  assert.equal(categoryOf({ shop: "hairdresser", name: "Barber Shop 69" }), "barbier");
  assert.equal(categoryOf({ amenity: "restaurant", name: "Chez Mario" }), "restaurant");
  assert.equal(categoryOf({ amenity: "restaurant", cuisine: "pizza;italian", name: "Roma" }), "pizzeria");
  assert.equal(categoryOf({ amenity: "fast_food", name: "O Tacos", cuisine: "tacos" }), "snack");
  assert.equal(categoryOf({ craft: "electrician" }), "electricien");
  assert.equal(categoryOf({ craft: "plumber" }), "plombier");
  assert.equal(categoryOf({ craft: "hvac" }), "chauffagiste");
});

test("les autres métiers ne sont plus recherchés", () => {
  for (const tags of [{ shop: "beauty" }, { shop: "tattoo" }, { shop: "car_repair" }, { leisure: "fitness_centre" }, { healthcare: "osteopath" }, { shop: "massage" }, { shop: "bakery" }])
    assert.equal(categoryOf(tags), null, JSON.stringify(tags));
  const searched = Object.entries(OSM_FILTERS).flatMap(([k, vs]) => vs.map((v) => `${k}=${v}`)).sort();
  assert.deepEqual(searched, ["amenity=fast_food", "amenity=restaurant", "craft=electrician", "craft=hvac", "craft=plumber", "shop=hairdresser"]);
});

test("indépendants seulement : chaînes et grosses structures écartées", () => {
  assert.equal(isChainOrBig({ name: "Salon Léa" }), false);
  assert.equal(isChainOrBig({ name: "Franck Provost" }), true);
  assert.equal(isChainOrBig({ name: "Jean Louis David Lyon" }), true);
  assert.equal(isChainOrBig({ name: "McDonald's" }), true);
  assert.equal(isChainOrBig({ name: "Quick" }), true);
  assert.equal(isChainOrBig({ name: "Quickly Coiffure" }), false, "mot entier seulement");
  assert.equal(isChainOrBig({ name: "Chez Paul" }), false);
  assert.equal(isChainOrBig({ name: "Mon resto", brand: "Autre" }), true);
  assert.equal(isChainOrBig({ name: "Mon resto", "brand:wikidata": "Q1" }), true);
  assert.equal(isChainOrBig({ name: "Plomberie Dupont", employees: "4" }), false);
  assert.equal(isChainOrBig({ name: "Plomberie Dupont", employees: "25" }), true);
  assert.equal(isChainOrBig({ name: "Boulangerie Léon" }), false);
});

test("qualification Google : avis selon le métier, note, photos, description, réponses, avis récents", () => {
  const today = new Date("2026-10-24");
  const good = { category: "coiffeur", site_quality: "needs_update", email: "a@b.fr", g_avis: 60, g_note: 4.3, g_photos: 8, g_description: false, g_sans_reponse: true, g_dernier_avis: "2026-10-01" };
  assert.equal(qualifyLead(good, today).verdict, "ok");
  const bad = (patch, key) => { const r = qualifyLead({ ...good, ...patch }, today); assert.equal(r.verdict, "ko", key); assert.equal(r.checks.find((c) => c.key === key).ok, false, key); };
  bad({ g_avis: 19 }, "avis"); bad({ g_avis: 151 }, "avis");
  bad({ g_note: 3.7 }, "note"); bad({ g_note: 4.7 }, "note");
  bad({ g_photos: 15 }, "photos"); bad({ g_description: true }, "description");
  bad({ g_sans_reponse: false }, "reponse"); bad({ g_dernier_avis: "2026-08-01" }, "recent");
  bad({ site_quality: "good" }, "site");
  // bornes propres à chaque métier
  const range = (category, avis) => qualifyLead({ ...good, category, g_avis: avis }, today).checks.find((c) => c.key === "avis").ok;
  assert.equal(range("coiffeur", 20), true); assert.equal(range("coiffeur", 150), true); assert.equal(range("coiffeur", 151), false);
  assert.equal(range("restaurant", 49), false); assert.equal(range("pizzeria", 50), true); assert.equal(range("snack", 400), true); assert.equal(range("restaurant", 401), false);
  assert.equal(range("plombier", 5), true); assert.equal(range("electricien", 60), true); assert.equal(range("chauffagiste", 61), false); assert.equal(range("barbier", 20), true);
  assert.equal(range("garage", 10), true, "métier hors cibles : bornes par défaut 10-200");
});

test("qualification : partielle, vide", () => {
  const today = new Date("2026-10-24");
  assert.equal(qualifyLead({ category: "coiffeur", site_quality: "no_site", email: "a@b.fr" }, today).verdict, "none");
  const part = qualifyLead({ category: "coiffeur", site_quality: "no_site", email: "a@b.fr", g_avis: 40 }, today);
  assert.equal(part.verdict, "incomplete"); assert.equal(part.filled, 1); assert.equal(part.total, 6);
});

test("l'ordre : 5 coiffeurs, 3 restaurants, 2 artisans par tranche de 10, métiers alternés", () => {
  const mk = (category, n) => Array.from({ length: n }, (_, i) => ({ category, osm_id: category + i }));
  const all = [...mk("restaurant", 400), ...mk("snack", 100), ...mk("coiffeur", 60), ...mk("barbier", 30), ...mk("plombier", 40), ...mk("electricien", 40)];
  const top = orderByPriority(all).slice(0, 50);
  const count = (tier) => top.filter((c) => CATEGORY_INFO[c.category].priority === tier).length;
  assert.deepEqual([count(1), count(2), count(3)], [25, 15, 10]);
  assert.ok(top.filter((c) => c.category === "restaurant").length <= 8, "les restaurants ne monopolisent pas leur groupe");
  assert.ok(new Set(top.map((c) => c.category)).size >= 5);
  assert.equal(orderByPriority(all).length, all.length, "aucune fiche perdue");
  assert.equal(orderByPriority([]).length, 0);
  assert.equal(orderByPriority([{ category: "plombier" }, { category: "plombier" }]).length, 2, "si une famille manque, les autres passent");
});
