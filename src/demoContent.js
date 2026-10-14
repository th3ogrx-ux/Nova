// Textes pré-écrits pour générer une maquette de site vitrine sans
// IA : plusieurs variantes par catégorie, une est choisie au hasard
// puis remplie avec {nom}/{ville}. Tout reste modifiable ensuite dans
// l'éditeur de maquette.
export const DEMO_CONTENT = {
  coiffeur: [
    { tagline: "Votre coiffeur à {ville}", description: "{nom} vous accueille à {ville} pour sublimer votre style, dans une ambiance chaleureuse et un savoir-faire reconnu.", services: ["Coupe & brushing", "Coloration", "Soins capillaires", "Chignons événementiels"] },
    { tagline: "L'art de la coiffure à {ville}", description: "Chez {nom}, chaque coupe est pensée pour vous. Une équipe passionnée, à votre écoute, en plein cœur de {ville}.", services: ["Coupe homme & femme", "Balayage", "Lissage", "Coiffure de mariage"] }
  ],
  restaurant: [
    { tagline: "{nom}, une table à {ville}", description: "Venez découvrir une cuisine généreuse et faite maison chez {nom}, votre restaurant à {ville}.", services: ["Déjeuner & dîner", "Menu du jour", "Groupes & événements", "Plats à emporter"] },
    { tagline: "Savourez {ville} chez {nom}", description: "{nom} vous propose une cuisine authentique préparée avec des produits frais et de saison.", services: ["Carte de saison", "Terrasse", "Réservation en ligne", "Soirées privatisées"] }
  ],
  plombier: [
    { tagline: "Plombier à {ville}, intervention rapide", description: "{nom} intervient à {ville} et ses environs pour tous vos travaux de plomberie, dépannage et installation.", services: ["Dépannage urgence", "Installation sanitaire", "Recherche de fuite", "Chauffe-eau"] },
    { tagline: "{nom}, votre plombier de confiance", description: "Des interventions rapides et soignées à {ville}, pour les particuliers comme pour les professionnels.", services: ["Débouchage", "Rénovation salle de bain", "Chaudière", "Devis gratuit"] }
  ],
  electricien: [
    { tagline: "Électricien à {ville}", description: "{nom} réalise vos travaux électriques à {ville} : installation, mise aux normes, dépannage.", services: ["Mise aux normes", "Dépannage électrique", "Installation domotique", "Tableau électrique"] },
    { tagline: "{nom}, électricité en toute sécurité", description: "Une équipe qualifiée pour tous vos besoins en électricité à {ville} et alentours.", services: ["Rénovation électrique", "Éclairage", "Bornes de recharge", "Devis gratuit"] }
  ],
  boulangerie: [
    { tagline: "Pain frais chaque matin à {ville}", description: "{nom} prépare chaque jour pains, viennoiseries et pâtisseries artisanales à {ville}.", services: ["Pain traditionnel", "Viennoiseries", "Pâtisserie", "Commande pour événements"] },
    { tagline: "{nom}, le goût de l'artisanal", description: "Une boulangerie-pâtisserie artisanale au cœur de {ville}, pour régaler petits et grands.", services: ["Baguettes & pains spéciaux", "Sandwichs", "Gâteaux sur commande", "Produits locaux"] }
  ],
  garage: [
    { tagline: "Garage auto à {ville}", description: "{nom} entretient et répare votre véhicule à {ville} : mécanique, entretien, diagnostic.", services: ["Entretien courant", "Diagnostic panne", "Pneumatiques", "Contrôle technique"] },
    { tagline: "{nom}, votre garagiste à {ville}", description: "Des mécaniciens expérimentés pour prendre soin de votre véhicule, toutes marques.", services: ["Vidange", "Freinage", "Climatisation", "Devis gratuit"] }
  ],
  dentiste: [
    { tagline: "Cabinet dentaire à {ville}", description: "{nom} vous accueille à {ville} pour vos soins dentaires, dans un cadre moderne et rassurant.", services: ["Soins conservateurs", "Blanchiment", "Orthodontie", "Urgences dentaires"] },
    { tagline: "{nom}, le sourire à {ville}", description: "Une équipe à l'écoute pour prendre soin de votre sourire, à {ville}.", services: ["Détartrage", "Implants", "Esthétique dentaire", "Prise en charge enfants"] }
  ],
  medecin: [
    { tagline: "Cabinet médical à {ville}", description: "{nom} vous reçoit à {ville} pour vos consultations, suivis et prévention.", services: ["Consultations", "Suivi médical", "Vaccinations", "Téléconsultation"] },
    { tagline: "{nom}, votre médecin à {ville}", description: "Un accompagnement médical de proximité, à l'écoute de vos besoins.", services: ["Médecine générale", "Certificats médicaux", "Suivi chronique", "Urgences"] }
  ],
  avocat: [
    { tagline: "Cabinet d'avocat à {ville}", description: "{nom} vous conseille et vous défend à {ville}, avec rigueur et proximité.", services: ["Conseil juridique", "Droit des affaires", "Droit de la famille", "Contentieux"] },
    { tagline: "{nom}, votre avocat à {ville}", description: "Une expertise juridique à votre service, pour particuliers et entreprises.", services: ["Consultation", "Rédaction de contrats", "Représentation en justice", "Médiation"] }
  ],
  salle_sport: [
    { tagline: "Votre salle de sport à {ville}", description: "{nom} vous accueille à {ville} avec des équipements modernes et des coachs motivés.", services: ["Musculation", "Cours collectifs", "Coaching personnalisé", "Espace cardio"] },
    { tagline: "{nom}, bougez à {ville}", description: "Un espace dédié à votre forme, ouvert à tous les niveaux, en plein cœur de {ville}.", services: ["Abonnement libre accès", "Cours fitness", "Coaching", "Suivi nutrition"] }
  ],
  institut_beaute: [
    { tagline: "Institut de beauté à {ville}", description: "{nom} vous propose des soins esthétiques sur-mesure à {ville}, dans un cadre apaisant.", services: ["Soins du visage", "Épilation", "Massages", "Manucure"] },
    { tagline: "{nom}, un moment pour vous à {ville}", description: "Prenez soin de vous chez {nom}, votre institut de beauté de référence.", services: ["Soins corps", "Maquillage", "Onglerie", "Rituels bien-être"] }
  ],
  fleuriste: [
    { tagline: "Fleuriste à {ville}", description: "{nom} compose pour vous de jolis bouquets et compositions florales à {ville}.", services: ["Bouquets sur-mesure", "Livraison", "Décoration événements", "Plantes & fleurs"] },
    { tagline: "{nom}, des fleurs qui parlent", description: "Un fleuriste passionné au cœur de {ville}, pour toutes vos occasions.", services: ["Compositions mariage", "Abonnement fleuri", "Deuil", "Livraison le jour même"] }
  ],
  boucherie: [
    { tagline: "Boucherie artisanale à {ville}", description: "{nom} propose des viandes de qualité, sélectionnées avec soin, à {ville}.", services: ["Viandes locales", "Charcuterie maison", "Plats cuisinés", "Conseils de cuisson"] },
    { tagline: "{nom}, le goût de la qualité", description: "Une boucherie de quartier qui privilégie les circuits courts, à {ville}.", services: ["Découpe sur-mesure", "Volailles", "Traiteur événementiel", "Commande en ligne"] }
  ],
  cafe: [
    { tagline: "Café à {ville}", description: "{nom} vous accueille à {ville} pour une pause gourmande, en toute convivialité.", services: ["Café de spécialité", "Petite restauration", "Brunch", "Terrasse"] },
    { tagline: "{nom}, votre pause à {ville}", description: "Un lieu chaleureux au cœur de {ville}, pour se retrouver autour d'un bon café.", services: ["Boissons chaudes & froides", "Pâtisseries maison", "Wifi", "Événements privés"] }
  ],
  hotel: [
    { tagline: "Hôtel à {ville}", description: "{nom} vous accueille à {ville} pour un séjour confortable, entre affaires et détente.", services: ["Chambres confortables", "Petit-déjeuner", "Wifi gratuit", "Parking"] },
    { tagline: "{nom}, votre étape à {ville}", description: "Un hôtel à taille humaine, idéalement situé à {ville}.", services: ["Réservation en ligne", "Chambres familiales", "Accueil groupes", "Conciergerie"] }
  ],
  agence_immo: [
    { tagline: "Agence immobilière à {ville}", description: "{nom} vous accompagne dans vos projets immobiliers à {ville} : achat, vente, location.", services: ["Vente", "Location", "Estimation gratuite", "Gestion locative"] },
    { tagline: "{nom}, votre projet immobilier à {ville}", description: "Une équipe locale qui connaît {ville} pour vous accompagner à chaque étape.", services: ["Recherche de bien", "Accompagnement juridique", "Estimation", "Investissement locatif"] }
  ],
  veterinaire: [
    { tagline: "Clinique vétérinaire à {ville}", description: "{nom} prend soin de vos animaux à {ville}, avec douceur et professionnalisme.", services: ["Consultations", "Chirurgie", "Vaccination", "Urgences"] },
    { tagline: "{nom}, le bien-être de vos animaux", description: "Une équipe vétérinaire dévouée, au service des animaux de {ville} et alentours.", services: ["Médecine préventive", "Toilettage", "Pension", "Conseils alimentation"] }
  ],
  photographe: [
    { tagline: "Photographe à {ville}", description: "{nom} immortalise vos moments importants à {ville} : mariage, portrait, événement.", services: ["Mariage", "Portrait", "Événementiel", "Shooting professionnel"] },
    { tagline: "{nom}, capturer l'instant à {ville}", description: "Un regard artistique pour sublimer vos souvenirs, basé à {ville}.", services: ["Séance photo studio", "Reportage", "Retouche", "Tirages & albums"] }
  ],
  menuisier: [
    { tagline: "Menuisier à {ville}", description: "{nom} fabrique et pose vos agencements sur-mesure à {ville} : bois, cuisine, dressing.", services: ["Agencement sur-mesure", "Pose de menuiseries", "Cuisine & dressing", "Rénovation"] },
    { tagline: "{nom}, le travail du bois à {ville}", description: "Un artisan menuisier passionné, pour des réalisations durables et soignées.", services: ["Fenêtres & portes", "Escaliers", "Mobilier sur-mesure", "Devis gratuit"] }
  ],
  architecte: [
    { tagline: "Architecte à {ville}", description: "{nom} conçoit vos projets de construction et rénovation à {ville}, sur-mesure.", services: ["Construction neuve", "Rénovation", "Extension", "Permis de construire"] },
    { tagline: "{nom}, concevoir {ville} autrement", description: "Une approche architecturale personnalisée, de l'esquisse à la livraison.", services: ["Études de faisabilité", "Suivi de chantier", "Aménagement intérieur", "Conseil"] }
  ]
};

export const DEMO_TESTIMONIALS = [
  { name: "Camille", text: "Un accueil chaleureux et un vrai professionnalisme. Je recommande !" },
  { name: "Julien", text: "Très satisfait de la prestation, rapide et soigné." },
  { name: "Sophie", text: "Équipe à l'écoute, résultat au top. Je reviendrai sans hésiter." },
  { name: "Nicolas", text: "Service impeccable du début à la fin, merci !" },
  { name: "Marie", text: "Rapport qualité-prix excellent, je recommande vivement." },
  { name: "Thomas", text: "Des professionnels sérieux et disponibles. Parfait." },
  { name: "Laura", text: "Très bonne expérience, je n'hésiterai pas à revenir." },
  { name: "Antoine", text: "Travail soigné et dans les délais. Merci à toute l'équipe !" }
];

function fillText(text, prospect) {
  return (text || "").replaceAll("{nom}", prospect.name || "").replaceAll("{ville}", prospect.city || "");
}

function pickRandom(arr, count) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Génère un jeu de contenu complet pour un prospect donné : pioche une
// variante au hasard dans la catégorie (ou une catégorie générique si
// inconnue), remplit les variables, et choisit 3 avis au hasard.
export function generateDemoContent(prospect) {
  const variants = DEMO_CONTENT[prospect.category] || DEMO_CONTENT.restaurant;
  const variant = variants[Math.floor(Math.random() * variants.length)];

  return {
    tagline: fillText(variant.tagline, prospect),
    description: fillText(variant.description, prospect),
    services: variant.services,
    testimonials: pickRandom(DEMO_TESTIMONIALS, 3),
    contact_text: `Contactez ${prospect.name} à ${prospect.city || "proximité"}${prospect.phone ? " au " + prospect.phone : ""}.`
  };
}
