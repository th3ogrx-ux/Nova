// Métiers ciblés par le Radar, leur priorité et l'ordre dans lequel on les propose (aucune dépendance : testable seul).
// Métiers ciblés : les commerces qui vivent de Google Maps (avis, photos, « près de moi »).
// Priorité 1 : coiffeurs et barbiers, restaurants / snacks / pizzerias, artisans (électriciens, plombiers, chauffagistes).
// Priorité 2 : instituts de beauté, onglerie, tatoueurs, garages et carrossiers, salles de sport et boxe, médecines douces.
// Chaque métier correspond à un tag OpenStreetMap (même liste de clés que la validation côté radar-daily).
export const CATEGORY_INFO = {
  coiffeur:     { label: "Coiffeur", priority: 1 },
  barbier:      { label: "Barbier", priority: 1 },
  restaurant:   { label: "Restaurant", priority: 1 },
  snack:        { label: "Snack", priority: 1 },
  pizzeria:     { label: "Pizzeria", priority: 1 },
  electricien:  { label: "Électricien", priority: 1 },
  plombier:     { label: "Plombier", priority: 1 },
  chauffagiste: { label: "Chauffagiste", priority: 1 },
  institut_beaute: { label: "Institut de beauté", priority: 2 },
  onglerie:     { label: "Onglerie", priority: 2 },
  tatoueur:     { label: "Tatoueur", priority: 2 },
  garage:       { label: "Garage", priority: 2 },
  carrossier:   { label: "Carrossier", priority: 2 },
  salle_sport:  { label: "Salle de sport", priority: 2 },
  boxe:         { label: "Boxe / sports de combat", priority: 2 },
  osteopathe:   { label: "Ostéopathe", priority: 2 },
  kine:         { label: "Kinésithérapeute", priority: 2 },
  massage:      { label: "Massage", priority: 2 },
  // Anciens métiers (prospects déjà enregistrés) : on garde leur nom à l'affichage.
  artisan_batiment: { label: "Artisan du bâtiment" }, couvreur: { label: "Couvreur" }, menuisier: { label: "Menuisier" }, chauffage_pac: { label: "Chauffage / PAC" },
  cuisiniste: { label: "Cuisiniste" }, paysagiste: { label: "Paysagiste" }, agence_immo: { label: "Agence immobilière" }, courtier_assurance: { label: "Courtier en assurance" },
  courtier_credit: { label: "Courtier en crédit" }, expert_comptable: { label: "Expert-comptable" }, consultant_formateur: { label: "Consultant / formateur" },
  organisme_formation: { label: "Organisme de formation" }, therapeute: { label: "Thérapeute" }, photographe: { label: "Photographe" }, lieu_reception: { label: "Lieu de réception" },
  traiteur: { label: "Traiteur" }, auto_ecole: { label: "Auto-école" }, gite: { label: "Gîte" }, pme_industrielle: { label: "PME industrielle" }
};

// Tags OpenStreetMap recherchés (clé -> valeurs).
export const OSM_FILTERS = {
  shop: ["hairdresser", "beauty", "tattoo", "car_repair", "massage"],
  amenity: ["restaurant", "fast_food"],
  craft: ["plumber", "electrician", "hvac"],
  leisure: ["fitness_centre", "sports_centre"],
  healthcare: ["osteopath", "physiotherapist"]
};

const has = (value, word) => String(value || "").toLowerCase().includes(word);
const nameHas = (tags, re) => re.test(tags.name || "");

// Métier d'un élément OpenStreetMap (ou null s'il ne nous intéresse pas).
// Les cas particuliers (barbier, pizzeria, onglerie, carrossier, boxe) se repèrent avec les tags précis, puis le nom.
export function categoryOf(tags) {
  if (tags.shop === "hairdresser") return tags.hairdresser === "barber" || nameHas(tags, /barb/i) ? "barbier" : "coiffeur";
  if (tags.amenity === "restaurant" || tags.amenity === "fast_food") {
    if (has(tags.cuisine, "pizza") || nameHas(tags, /pizz/i)) return "pizzeria";
    return tags.amenity === "fast_food" ? "snack" : "restaurant";
  }
  if (tags.craft === "electrician") return "electricien";
  if (tags.craft === "plumber") return "plombier";
  if (tags.craft === "hvac") return "chauffagiste";
  if (tags.shop === "beauty") return has(tags.beauty, "nail") || nameHas(tags, /ongl|nail/i) ? "onglerie" : "institut_beaute";
  if (tags.shop === "tattoo") return "tatoueur";
  if (tags.shop === "car_repair") return tags["service:vehicle:body_repair"] === "yes" || nameHas(tags, /carross/i) ? "carrossier" : "garage";
  if (tags.leisure === "fitness_centre" || tags.leisure === "sports_centre") {
    if (/boxing|martial|kickboxing|judo|karate|mma|muay/.test(String(tags.sport || "")) || nameHas(tags, /box|mma|combat|karat|judo/i)) return "boxe";
    return tags.leisure === "fitness_centre" ? "salle_sport" : null; // un simple équipement sportif n'est pas une cible
  }
  if (tags.healthcare === "osteopath") return "osteopathe";
  if (tags.healthcare === "physiotherapist") return "kine";
  if (tags.shop === "massage") return "massage";
  return null;
}

// Ordre des prospects envoyés : l'edge function garde les 50 premiers.
// 2 prospects de priorité 1 pour 1 de priorité 2, et dans chaque groupe on alterne les métiers
// (sinon les restaurants, bien plus nombreux sur OpenStreetMap, prendraient toute la place).
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
export function orderByPriority(candidates) {
  const tiers = { 1: {}, 2: {} };
  for (const c of shuffle([...candidates])) {
    const tier = (CATEGORY_INFO[c.category] || {}).priority === 2 ? 2 : 1;
    (tiers[tier][c.category] = tiers[tier][c.category] || []).push(c);
  }
  const roundRobin = (byCategory) => {
    const lists = shuffle(Object.values(byCategory)), out = [];
    while (lists.some((l) => l.length)) for (const l of lists) if (l.length) out.push(l.shift());
    return out;
  };
  const first = roundRobin(tiers[1]), second = roundRobin(tiers[2]), out = [];
  while (first.length || second.length) {
    for (let k = 0; k < 2 && first.length; k++) out.push(first.shift());
    if (second.length) out.push(second.shift());
    else if (!first.length) break;
  }
  return out;
}

