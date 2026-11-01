import React, { useMemo } from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { createTikTokStyleCaptions } from "@remotion/captions";
import type { Caption, TikTokPage } from "@remotion/captions";
import type { Config } from "./types";
import { FONT, H, MARGE } from "./theme";

/** Coupe une page en morceaux de `max` mots au plus (les temps de chaque mot sont gardés). */
const decoupe = (pages: TikTokPage[], max: number): TikTokPage[] =>
  pages.flatMap((p) => {
    if (p.tokens.length <= max) return [p];
    const nb = Math.ceil(p.tokens.length / max);
    const taille = Math.ceil(p.tokens.length / nb);
    const out: TikTokPage[] = [];
    for (let i = 0; i < p.tokens.length; i += taille) {
      const tokens = p.tokens.slice(i, i + taille);
      out.push({ ...p, tokens, text: tokens.map((t) => t.text).join(""), startMs: tokens[0].fromMs });
    }
    return out;
  });

/** Sous-titres mot par mot : 2 à 4 mots, apparition en léger zoom + fondu de 150 ms. */
export const SousTitres: React.FC<{ mots: Caption[]; c: Config }> = ({ mots, c }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const st = c.sous_titres;
  const pages = useMemo(() => {
    const { pages: brutes } = createTikTokStyleCaptions({
      captions: mots.map((m) => ({ ...m, pageBreakAfter: /[.,?!]\s*$/.test(m.text) })),
      combineTokensWithinMilliseconds: 700,
    });
    return decoupe(brutes, st.motsMax);
  }, [mots, st.motsMax]);

  const ms = (frame / fps) * 1000;
  const i = pages.findIndex((p, k) => ms >= p.startMs && ms < (pages[k + 1]?.startMs ?? p.startMs + 1600));
  if (i < 0) return null;
  const page = pages[i];
  const t = Math.max(0, ms - page.startMs) / 150; // 150 ms
  const e = interpolate(t, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: MARGE,
        right: MARGE,
        top: Math.round(st.y * H) - 60,
        height: 120,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: st.taille,
        lineHeight: 1.1,
        letterSpacing: -0.5,
        textAlign: "center",
        whiteSpace: "pre",
        color: st.couleur,
        opacity: e,
        transform: `scale(${0.92 + 0.08 * e})`,
      }}
    >
      {page.tokens.map((tok, k) => (k === 0 ? tok.text.trimStart() : tok.text)).join("")}
    </div>
  );
};
