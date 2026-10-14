// Catégories de métiers proposées dans le formulaire de recherche.
// IMPORTANT : la clé ("value") de chaque catégorie doit rester
// identique à la clé utilisée dans CATEGORY_TAGS côté edge function
// (supabase/functions/osm-search/index.ts) — c'est elle qui fait le
// lien avec le tag OpenStreetMap correspondant.
export const CATEGORIES = [
  { value: "coiffeur", label: "Coiffeur" },
  { value: "restaurant", label: "Restaurant" },
  { value: "plombier", label: "Plombier" },
  { value: "electricien", label: "Électricien" },
  { value: "boulangerie", label: "Boulangerie" },
  { value: "garage", label: "Garage / mécanicien auto" },
  { value: "dentiste", label: "Dentiste" },
  { value: "medecin", label: "Médecin généraliste" },
  { value: "avocat", label: "Avocat" },
  { value: "salle_sport", label: "Salle de sport" },
  { value: "institut_beaute", label: "Institut de beauté" },
  { value: "fleuriste", label: "Fleuriste" },
  { value: "boucherie", label: "Boucherie" },
  { value: "cafe", label: "Café / bar" },
  { value: "hotel", label: "Hôtel" },
  { value: "agence_immo", label: "Agence immobilière" },
  { value: "veterinaire", label: "Vétérinaire" },
  { value: "photographe", label: "Photographe" },
  { value: "menuisier", label: "Menuisier" },
  { value: "architecte", label: "Architecte" },
];
