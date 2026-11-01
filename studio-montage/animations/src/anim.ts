import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/** Entrée douce (sans rebond) et sortie rapide d'une scène. Renvoie null hors de la scène. */
export const useScene = (debut: number, duree: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - Math.round(debut * fps);
  const total = Math.round(duree * fps);
  if (local < 0 || local >= total) return null;
  const entree = spring({ frame: local, fps, config: { damping: 200 } });
  const sortie = interpolate(local, [total - 9, total], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { local, fps, entree, sortie, opacite: Math.min(1, entree * 1.4) * sortie };
};

/** Apparition échelonnée d'un élément (index 0, 1, 2…). */
export const useDecale = (local: number, fps: number, index: number, pas = 7) =>
  spring({ frame: local - index * pas - 4, fps, config: { damping: 200 } });
