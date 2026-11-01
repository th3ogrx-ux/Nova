import type { Caption } from "@remotion/captions";

/** Réglages de config.json. */
export type Config = {
  fond: "blanc" | "noir";
  couleurs: { papier: string; noir: string; accent: string; texte: string };
  cadre: { gauche: number; droite: number; haut: number; rayon: number; flou: number };
  tete: { hauteurPx: number; debordement: number; fractionHauteurTete: number };
  sous_titres: { actif: boolean; police: string; taille: number; y: number; couleur: string; motsMax: number };
  animations: { zoneBas: number };
};

export type Scene =
  | { type: "titre"; debut: number; duree: number; texte: string; italique?: string; sousTitre?: string }
  | {
      type: "comparaison";
      debut: number;
      duree: number;
      titre?: string;
      a: { nom: string; points: string[] };
      b: { nom: string; points: string[] };
    }
  | { type: "liste"; debut: number; duree: number; titre: string; elements: string[] }
  | { type: "courbe"; debut: number; duree: number; titre: string; points: number[]; libelles?: string[] }
  | {
      type: "score";
      debut: number;
      duree: number;
      titre: string;
      elements: { nom: string; valeur: number; max?: number }[];
    };

export type MontageProps = {
  config: Config;
  scenes: Scene[];
  mots: Caption[];
  dureeSecondes: number;
  /** Silhouette transparente (WebM) dans public/. */
  personne: string | null;
  /** Son d'origine (dans public/). */
  audio: string | null;
  /** Photo du cadre (dans public/). */
  cadrePhoto: string | null;
  /** Mesures de la silhouette : haut de la tête (0 à 1) et proportions de la vidéo. */
  mesures: { hautTete: number; largeur: number; hauteur: number };
};
