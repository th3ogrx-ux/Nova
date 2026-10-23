import test from "node:test";
import assert from "node:assert/strict";
import { categoryOf, orderByPriority, CATEGORY_INFO, OSM_FILTERS } from "../../src/radar-categories.js";

test("reconnaît les métiers de priorité 1", () => {
  assert.equal(categoryOf({ shop: "hairdresser", name: "Salon Léa" }), "coiffeur");
  assert.equal(categoryOf({ shop: "hairdresser", hairdresser: "barber", name: "Cut" }), "barbier");
  assert.equal(categoryOf({ shop: "hairdresser", name: "Barber Shop 69" }), "barbier");
  assert.equal(categoryOf({ amenity: "restaurant", name: "Chez Mario" }), "restaurant");
  assert.equal(categoryOf({ amenity: "restaurant", cuisine: "pizza;italian", name: "Roma" }), "pizzeria");
  assert.equal(categoryOf({ amenity: "fast_food", name: "Pizza Express" }), "pizzeria");
  assert.equal(categoryOf({ amenity: "fast_food", name: "O Tacos", cuisine: "tacos" }), "snack");
  assert.equal(categoryOf({ craft: "electrician" }), "electricien");
  assert.equal(categoryOf({ craft: "plumber" }), "plombier");
  assert.equal(categoryOf({ craft: "hvac" }), "chauffagiste");
});

test("reconnaît les métiers de priorité 2", () => {
  assert.equal(categoryOf({ shop: "beauty", name: "Institut Zen" }), "institut_beaute");
  assert.equal(categoryOf({ shop: "beauty", beauty: "nails" }), "onglerie");
  assert.equal(categoryOf({ shop: "beauty", name: "Nail Art" }), "onglerie");
  assert.equal(categoryOf({ shop: "tattoo" }), "tatoueur");
  assert.equal(categoryOf({ shop: "car_repair", name: "Garage Martin" }), "garage");
  assert.equal(categoryOf({ shop: "car_repair", name: "Carrosserie du Parc" }), "carrossier");
  assert.equal(categoryOf({ leisure: "fitness_centre", name: "Fitness Park" }), "salle_sport");
  assert.equal(categoryOf({ leisure: "sports_centre", sport: "boxing" }), "boxe");
  assert.equal(categoryOf({ leisure: "fitness_centre", name: "MMA Club" }), "boxe");
  assert.equal(categoryOf({ leisure: "sports_centre", sport: "tennis" }), null, "un équipement sportif quelconque n'est pas une cible");
  assert.equal(categoryOf({ healthcare: "osteopath" }), "osteopathe");
  assert.equal(categoryOf({ healthcare: "physiotherapist" }), "kine");
  assert.equal(categoryOf({ shop: "massage" }), "massage");
  assert.equal(categoryOf({ shop: "bakery" }), null);
});

test("chaque métier reconnu est recherché dans OpenStreetMap et connu de l'affichage", () => {
  const searched = Object.entries(OSM_FILTERS).flatMap(([k, vs]) => vs.map((v) => `${k}=${v}`));
  for (const tag of ["shop=hairdresser", "amenity=restaurant", "amenity=fast_food", "craft=plumber", "craft=electrician", "craft=hvac", "shop=beauty", "shop=tattoo", "shop=car_repair", "leisure=fitness_centre", "leisure=sports_centre", "healthcare=osteopath", "healthcare=physiotherapist", "shop=massage"]) assert.ok(searched.includes(tag), tag);
  for (const k of ["coiffeur", "pizzeria", "carrossier", "boxe", "massage"]) assert.ok(CATEGORY_INFO[k].label);
});

test("l'ordre favorise la priorité 1 (2 pour 1) et mélange les métiers", () => {
  const mk = (category, n) => Array.from({ length: n }, (_, i) => ({ category, osm_id: category + i }));
  const all = [...mk("restaurant", 300), ...mk("coiffeur", 40), ...mk("plombier", 30), ...mk("tatoueur", 40), ...mk("garage", 40), ...mk("kine", 40)];
  const top = orderByPriority(all).slice(0, 50);
  const p1 = top.filter((c) => CATEGORY_INFO[c.category].priority === 1).length;
  assert.ok(p1 >= 32 && p1 <= 35, "environ 2/3 de priorité 1, obtenu " + p1);
  const resto = top.filter((c) => c.category === "restaurant").length;
  assert.ok(resto <= 14, "les restaurants ne monopolisent pas la liste, obtenu " + resto);
  assert.ok(new Set(top.map((c) => c.category)).size >= 5, "les métiers sont alternés");
  assert.equal(orderByPriority(all).length, all.length, "aucun prospect perdu");
});

test("s'il n'y a qu'une priorité, tous les prospects restent proposés", () => {
  const only2 = [{ category: "garage" }, { category: "kine" }, { category: "massage" }];
  assert.equal(orderByPriority(only2).length, 3);
  assert.equal(orderByPriority([]).length, 0);
});
