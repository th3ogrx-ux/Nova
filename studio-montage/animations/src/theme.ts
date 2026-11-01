export const ACCENT_DEFAUT = "#E5303A";
export const FONT = '"Poppins", "Helvetica Neue", Arial, sans-serif';

/** Marges de sécurité : 15 % de chaque côté (1080 px de large). */
export const MARGE = 162;
/** La moitié haute de l'écran : 0 → 960 px. La couture est à 960. */
export const HAUT = { top: 190, bottom: 1150 };

/** Écran divisé « carte » : tableau en haut, sous-titres sur la couture, vous dans une carte en bas. */
export const SOUS_TITRES_Y = 1190;
export const CARTE = { left: 60, top: 1320, width: 960, height: 540, radius: 44 };

export type Theme = {
  clair: boolean;
  texte: string;
  doux: string;
  carte: string;
  bordure: string;
  piste: string;
  accent: string;
};

/** Fond blanc → texte noir. Fond flou / paysage → texte blanc sur voile sombre. */
export const themeDe = (fond: string, accent: string): Theme =>
  fond === "blanc"
    ? {
        clair: true,
        texte: "#111111",
        doux: "#5C5C60",
        carte: "rgba(255,255,255,0.96)",
        bordure: "rgba(0,0,0,0.09)",
        piste: "rgba(0,0,0,0.10)",
        accent,
      }
    : {
        clair: false,
        texte: "#FFFFFF",
        doux: "rgba(255,255,255,0.78)",
        carte: "rgba(12,12,14,0.62)",
        bordure: "rgba(255,255,255,0.16)",
        piste: "rgba(255,255,255,0.18)",
        accent,
      };
