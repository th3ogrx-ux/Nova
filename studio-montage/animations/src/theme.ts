import type { Config } from "./types";

export const FONT = '"Poppins", "Helvetica Neue", Arial, sans-serif';
export const FONT_SERIF = '"Playfair Display", Georgia, serif';

/** L'écran : 1080 × 1920. Marges de sécurité de 15 % à gauche et à droite. */
export const L = 1080;
export const H = 1920;
export const MARGE = Math.round(L * 0.15);

export type Theme = {
  clair: boolean;
  texte: string;
  doux: string;
  carte: string;
  bordure: string;
  piste: string;
  accent: string;
};

export const themeDe = (c: Config): Theme =>
  c.fond === "blanc"
    ? {
        clair: true,
        texte: c.couleurs.texte,
        doux: "#5C5C60",
        carte: "rgba(255,255,255,0.96)",
        bordure: "rgba(0,0,0,0.09)",
        piste: "rgba(0,0,0,0.10)",
        accent: c.couleurs.accent,
      }
    : {
        clair: false,
        texte: "#FFFFFF",
        doux: "rgba(255,255,255,0.78)",
        carte: "rgba(22,22,24,0.85)",
        bordure: "rgba(255,255,255,0.16)",
        piste: "rgba(255,255,255,0.18)",
        accent: c.couleurs.accent,
      };

/** Zone des animations : du haut de l'écran jusqu'à `animations.zoneBas` (en % de la hauteur). */
export const zoneAnimations = (c: Config) => ({ top: 150, bottom: Math.round(c.animations.zoneBas * H) });
