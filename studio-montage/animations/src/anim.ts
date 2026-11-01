import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/** Entrée douce (sans rebond) et sortie rapide d'une scène. Renvoie null hors de la scène. */
export const useScene = (debut: number, duree: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - Math.round(debut * fps);
  const total = Math.round(duree * fps);
  if (local < 0 || local >= total) return null;
  const entree = spring({ frame: local, fps, config: { damping: 200 } });
  const sortie = interpolate(local, [total - 5, total], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { local, fps, total, progres: local / total, entree, sortie, opacite: Math.min(1, entree * 1.6) * sortie };
};

/** Apparition échelonnée d'un élément (index 0, 1, 2…). */
export const useDecale = (local: number, fps: number, index: number, pas = 7) =>
  spring({ frame: local - index * pas - 4, fps, config: { damping: 200 } });

/** Ressort qui rebondit : pour les arrivées « percutantes ». */
export const useRebond = (local: number, fps: number, retard = 0) =>
  spring({ frame: local - retard, fps, config: { damping: 11, stiffness: 190, mass: 0.7 } });
