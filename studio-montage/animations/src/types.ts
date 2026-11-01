import type { Caption } from "@remotion/captions";

type Base = { fond?: "clair" | "sombre" };

export type Scene = (
  | { type: "titre"; debut: number; duree: number; texte: string; sousTitre?: string }
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
      type: "score";
      debut: number;
      duree: number;
      titre: string;
      elements: { nom: string; valeur: number; max?: number }[];
    }
  | { type: "fin"; debut: number; duree: number; texte: string; logo?: string }
) &
  Base;

export type Textes = {
  accent?: string;
  sousTitres?: { actif: boolean };
  scenes: Scene[];
};

export type MontageProps = {
  /** "carte" : vous dans une carte en bas + plans plein écran. "silhouette" : vous découpé dans la moitié basse. */
  mode: "carte" | "silhouette";
  /** Mode silhouette : "blanc", "flou" ou "paysage" (choisit les couleurs du texte). */
  fond: string;
  /** Mode silhouette : vidéo déjà découpée et placée (dans public/). */
  base: string | null;
  /** Mode carte : votre vidéo d'origine (dans public/). */
  camera: string | null;
  /** Hauteur / largeur de la vidéo (1.78 pour du 9:16). */
  ratio: number;
  /** Mode carte : quelle partie de l'image reste visible dans la carte (0 = haut, 1 = bas). */
  cadrage: number;
  dureeSecondes: number;
  textes: Textes;
  mots: Caption[];
};
