import type { Caption } from "@remotion/captions";
import type { IconeNom } from "./Icones";

/** Réglages de config.json. */
export type Config = {
  fond: "blanc" | "noir";
  couleurs: { papier: string; noir: string; accent: string; texte: string };
  cadre: { gauche: number; droite: number; haut: number; rayon: number; flou: number };
  tete: { hauteurPx: number; debordement: number; fractionHauteurTete: number; fonduBords?: number; epaulesPx?: number };
  sous_titres: { actif: boolean; police: string; taille: number; y: number; couleur: string; motsMax: number };
  animations: { zoneBas: number };
  /** Titre qui reste en haut de la vidéo, du début à la fin. */
  /** Gros plan : votre tête en grand, plein écran, sur la photo du cadre. */
  gros_plan?: { hauteurTetePx: number; hautTeteEcran: number; y: number; taille: number; zoom: number };
  titre_fixe?: { actif: boolean; ligne1: string; ligne2?: string; y: number; hauteur: number };
};

export type Scene =
  | {
      type: "titre";
      debut: number;
      duree: number;
      texte: string;
      /** Mot(s) sur une barre rouge qui balaie l'écran. */
      surligne?: string;
      /** Mot(s) en serif italique rouge. */
      italique?: string;
      sousTitre?: string;
      /** Petit tremblement à l'arrivée. */
      secousse?: boolean;
    }
  | {
      type: "comparaison";
      debut: number;
      duree: number;
      titre?: string;
      a: { nom: string; points: string[] };
      b: { nom: string; points: string[] };
    }
  | { type: "liste"; debut: number; duree: number; titre: string; elements: string[] }
  | {
      type: "courbe";
      debut: number;
      duree: number;
      titre: string;
      points: number[];
      libelles?: string[];
      axeX?: string;
      axeY?: string;
      /** Bulle affichée sur le dernier point (par ex. "x10"). */
      etiquetteFinale?: string;
    }
  | {
      type: "profil";
      debut: number;
      duree: number;
      titre?: string;
      compte?: string;
      abonnes?: { de: number; a: number };
      /** Vues affichées sur chaque tuile (6 tuiles). */
      tuiles: string[];
      /** La tuile qui grossit et compte jusqu'à `valeur`. */
      vedette: { index: number; valeur: number };
    }
  | {
      type: "compteurs";
      debut: number;
      duree: number;
      titre?: string;
      elements: { icone: IconeNom; nom: string; valeur: number; fort?: boolean }[];
    }
  | { type: "orbite"; debut: number; duree: number; centre: string; icones: IconeNom[]; sousTitre?: string }
  | {
      type: "score";
      debut: number;
      duree: number;
      titre: string;
      elements: { nom: string; valeur: number; max?: number }[];
    };

export type GrosPlan = { debut: number; duree: number };

export type MontageProps = {
  /** Moments où la tête passe en gros plan plein écran (en secondes). */
  grosPlans?: GrosPlan[];
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
