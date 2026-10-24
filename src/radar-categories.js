// Cibles du Radar, règles de qualification et ordre d'envoi (aucune dépendance : testable seul).
//
// QUOI, dans l'ordre : 1) coiffeurs et barbiers, 2) restaurants, snacks, pizzerias, 3) artisans
// (électriciens, plombiers, chauffagistes). Ce sont les commerces qui vivent de Google Maps.
export const CATEGORY_INFO = {
  coiffeur:     { label: "Coiffeur", priority: 1, family: "coiffeur" },
  barbier:      { label: "Barbier", priority: 1, family: "coiffeur" },
  restaurant:   { label: "Restaurant", priority: 2, family: "restaurant" },
  snack:        { label: "Snack", priority: 2, family: "restaurant" },
  pizzeria:     { label: "Pizzeria", priority: 2, family: "restaurant" },
  electricien:  { label: "Électricien", priority: 3, family: "artisan" },
  plombier:     { label: "Plombier", priority: 3, family: "artisan" },
  chauffagiste: { label: "Chauffagiste", priority: 3, family: "artisan" },
  // Anciens métiers (prospects déjà enregistrés) : on garde leur nom à l'affichage.
  institut_beaute: { label: "Institut de beauté" }, onglerie: { label: "Onglerie" }, tatoueur: { label: "Tatoueur" }, garage: { label: "Garage" },
  carrossier: { label: "Carrossier" }, salle_sport: { label: "Salle de sport" }, boxe: { label: "Boxe / sports de combat" }, osteopathe: { label: "Ostéopathe" },
  kine: { label: "Kinésithérapeute" }, massage: { label: "Massage" },
  artisan_batiment: { label: "Artisan du bâtiment" }, couvreur: { label: "Couvreur" }, menuisier: { label: "Menuisier" }, chauffage_pac: { label: "Chauffage / PAC" },
  cuisiniste: { label: "Cuisiniste" }, paysagiste: { label: "Paysagiste" }, agence_immo: { label: "Agence immobilière" }, courtier_assurance: { label: "Courtier en assurance" },
  courtier_credit: { label: "Courtier en crédit" }, expert_comptable: { label: "Expert-comptable" }, consultant_formateur: { label: "Consultant / formateur" },
  organisme_formation: { label: "Organisme de formation" }, therapeute: { label: "Thérapeute" }, photographe: { label: "Photographe" }, lieu_reception: { label: "Lieu de réception" },
  traiteur: { label: "Traiteur" }, auto_ecole: { label: "Auto-école" }, gite: { label: "Gîte" }, pme_industrielle: { label: "PME industrielle" }
};

// Tags OpenStreetMap recherchés (clé -> valeurs).
export const OSM_FILTERS = {
  shop: ["hairdresser"],
  amenity: ["restaurant", "fast_food"],
  craft: ["plumber", "electrician", "hvac"]
};

const has = (value, word) => String(value || "").toLowerCase().includes(word);
const nameHas = (tags, re) => re.test(tags.name || "");

// Métier d'un élément OpenStreetMap (ou null s'il ne nous intéresse pas).
// Barbier et pizzeria se repèrent avec les tags précis, puis le nom.
export function categoryOf(tags) {
  if (tags.shop === "hairdresser") return tags.hairdresser === "barber" || nameHas(tags, /barb/i) ? "barbier" : "coiffeur";
  if (tags.amenity === "restaurant" || tags.amenity === "fast_food") {
    if (has(tags.cuisine, "pizza") || nameHas(tags, /pizz/i)) return "pizzeria";
    return tags.amenity === "fast_food" ? "snack" : "restaurant";
  }
  if (tags.craft === "electrician") return "electricien";
  if (tags.craft === "plumber") return "plombier";
  if (tags.craft === "hvac") return "chauffagiste";
  return null;
}

// ---------- Taille : indépendants, 1 à 10 employés, pas de chaînes ----------
const CHAIN_NAMES = [
  // coiffure
  "franck provost", "jean louis david", "dessange", "camille albane", "saint algue", "tchip", "coiff&co", "coiff & co", "vog coiffure", "fantastic sams", "hair spirit",
  // restauration
  "mcdonald", "burger king", "kfc", "quick", "subway", "domino", "pizza hut", "speed rabbit", "pizza del arte", "del arte", "flunch", "buffalo grill", "hippopotamus",
  "courtepaille", "la boucherie", "brioche doree", "starbucks", "o'tacos", "otacos", "five guys", "popeyes", "pitaya", "class'croute", "columbus cafe", "leon de bruxelles",
  "la pataterie", "tablapizza", "planet sushi", "sushi shop", "tacos avenue", "bagelstein", "pomme de pain", "mie caline", "cojean", "big fernand", "bureau vallee",
  "pizza pino", "pizza sprint", "marie blachere", "wok grill", "first burger", "burger & co",
  // artisans / services en réseau
  "engie", "dalkia", "idex", "rexel", "point p", "vinci", "bouygues", "eiffage", "cegelec", "veolia", "leroy merlin", "castorama", "brico depot", "depann'france", "depannfrance", "allo depannage", "plomberie express", "france renov"
];
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// Un nom de chaîne doit apparaître comme mot entier (« Quick » oui, « Quickly » non).
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const CHAIN_REGEXES = CHAIN_NAMES.map((c) => new RegExp("(^|[^a-z0-9])" + escapeRe(norm(c).trim()) + "([^a-z0-9]|$)"));
// Vrai si l'établissement fait partie d'une chaîne (marque OSM, nom connu) ou dépasse 10 employés.
export function isChainOrBig(tags) {
  if (tags.brand || tags["brand:wikidata"] || tags["brand:wikipedia"] || tags.franchise) return true;
  const employees = Number(tags.employees);
  if (Number.isFinite(employees) && employees > 10) return true;
  const name = norm(tags.name);
  if (name.trim() === "paul") return true; // la boulangerie « Paul » : seulement si c'est tout le nom (« Chez Paul » est indépendant)
  return CHAIN_REGEXES.some((re) => re.test(name));
}

// ---------- Fiche Google : critères à vérifier à la main (Google ne les donne pas gratuitement) ----------
export const GOOGLE_RULES = {
  avis: { coiffeur: [20, 150], restaurant: [50, 400], artisan: [5, 60], defaut: [10, 200] },
  note: [3.8, 4.6],
  photosMax: 14, // moins de 15
  dernierAvisJours: 61 // moins de 2 mois
};
const FAMILY_LABEL = { coiffeur: "coiffeurs", restaurant: "restaurants", artisan: "artisans" };

export function avisRange(category) {
  const family = (CATEGORY_INFO[category] || {}).family;
  return { range: GOOGLE_RULES.avis[family] || GOOGLE_RULES.avis.defaut, family };
}

// Résultat de chaque critère : ok = true (rempli), false (non rempli), null (pas encore renseigné).
// Les critères « site » et « e-mail » sont déjà vérifiés par le Radar ; les autres se saisissent depuis la fiche Google.
export function qualifyLead(lead, today = new Date()) {
  const { range, family } = avisRange(lead.category);
  const num = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
  const avis = num(lead.g_avis), note = num(lead.g_note), photos = num(lead.g_photos);
  let recent = null, days = null;
  if (lead.g_dernier_avis) {
    const d = new Date(lead.g_dernier_avis + "T00:00:00");
    if (!Number.isNaN(d.getTime())) { days = Math.round((today - d) / 86400000); recent = days <= GOOGLE_RULES.dernierAvisJours; }
  }
  const bool = (v, want) => (v === null || v === undefined ? null : v === want);
  const checks = [
    { key: "site", label: "Site : aucun ou ancien", ok: lead.site_quality ? lead.site_quality !== "good" : null, auto: true },
    { key: "email", label: "E-mail trouvé", ok: lead.email ? true : null, auto: true },
    { key: "avis", label: `Avis : ${range[0]} à ${range[1]}${family ? " (" + FAMILY_LABEL[family] + ")" : ""}`, ok: avis === null ? null : avis >= range[0] && avis <= range[1] },
    { key: "note", label: `Note : ${String(GOOGLE_RULES.note[0]).replace(".", ",")} à ${String(GOOGLE_RULES.note[1]).replace(".", ",")}`, ok: note === null ? null : note >= GOOGLE_RULES.note[0] && note <= GOOGLE_RULES.note[1] },
    { key: "photos", label: `Photos : moins de ${GOOGLE_RULES.photosMax + 1}`, ok: photos === null ? null : photos <= GOOGLE_RULES.photosMax },
    { key: "description", label: "Pas de description", ok: bool(lead.g_description, false) },
    { key: "reponse", label: "Avis sans réponse", ok: bool(lead.g_sans_reponse, true) },
    { key: "recent", label: "Dernier avis : moins de 2 mois", ok: recent }
  ];
  const google = checks.filter((c) => !c.auto);
  const filled = google.filter((c) => c.ok !== null).length;
  let verdict = "none";
  if (checks.some((c) => c.ok === false)) verdict = "ko";
  else if (filled === google.length) verdict = "ok";
  else if (filled > 0) verdict = "incomplete";
  return { checks, verdict, filled, total: google.length, days };
}

// ---------- Ordre d'envoi des prospects ----------
// L'edge function garde les premiers : 5 coiffeurs/barbiers, 3 restaurants/snacks, 2 artisans par tranche de 10,
// et dans chaque groupe on alterne les métiers (sinon les restaurants, bien plus nombreux, prendraient toute la place).
const TIER_WEIGHTS = { 1: 5, 2: 3, 3: 2 };
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
export function orderByPriority(candidates) {
  const tiers = { 1: {}, 2: {}, 3: {} };
  for (const c of shuffle([...candidates])) {
    const tier = (CATEGORY_INFO[c.category] || {}).priority || 3;
    (tiers[tier][c.category] = tiers[tier][c.category] || []).push(c);
  }
  const roundRobin = (byCategory) => {
    const lists = shuffle(Object.values(byCategory)), out = [];
    while (lists.some((l) => l.length)) for (const l of lists) if (l.length) out.push(l.shift());
    return out;
  };
  const queues = { 1: roundRobin(tiers[1]), 2: roundRobin(tiers[2]), 3: roundRobin(tiers[3]) };
  const out = [];
  while (queues[1].length || queues[2].length || queues[3].length) {
    for (const tier of [1, 2, 3]) for (let k = 0; k < TIER_WEIGHTS[tier] && queues[tier].length; k++) out.push(queues[tier].shift());
  }
  return out;
}
