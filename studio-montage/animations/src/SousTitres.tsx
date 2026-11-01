import React, { useMemo } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { createTikTokStyleCaptions } from "@remotion/captions";
import type { Caption } from "@remotion/captions";
import { FONT, MARGE, SOUS_TITRES_Y, Theme } from "./theme";

type Props = {
  mots: Caption[];
  t: Theme;
  masquer: Array<[number, number]>;
  /** Position verticale (px). Par défaut : sur la couture entre le tableau et la carte. */
  y?: number;
  /** Taille du texte (px). */
  taille?: number;
};

/** Sous-titres mot par mot : 1 à 3 mots à l'écran, le mot dit est en accent. */
export const SousTitres: React.FC<Props> = ({ mots, t, masquer, y = SOUS_TITRES_Y, taille = 56 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { pages } = useMemo(
    () =>
      createTikTokStyleCaptions({
        captions: mots.map((c) => ({ ...c, pageBreakAfter: /[.,?!]\s*$/.test(c.text) })),
        combineTokensWithinMilliseconds: 450,
      }),
    [mots],
  );
  if (masquer.some(([a, b]) => frame >= a && frame < b)) return null;
  const ms = (frame / fps) * 1000;
  const i = pages.findIndex((p, k) => ms >= p.startMs && ms < (pages[k + 1]?.startMs ?? p.startMs + 1500));
  if (i < 0) return null;
  const page = pages[i];
  const e = spring({ frame: frame - (page.startMs / 1000) * fps, fps, config: { damping: 200 } });
  return (
    <div
      style={{
        position: "absolute",
        left: MARGE,
        right: MARGE,
        top: y,
        height: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: taille,
        lineHeight: 1.1,
        letterSpacing: -0.5,
        textAlign: "center",
        whiteSpace: "pre",
        opacity: Math.min(1, e * 2),
        transform: `translateY(${(1 - e) * 12}px)`,
        textShadow: t.clair ? "none" : "0 3px 14px rgba(0,0,0,0.7)",
      }}
    >
      <span>
        {page.tokens.map((tok, k) => {
          const actif = tok.fromMs <= ms && tok.toMs > ms;
          return (
            <span key={k} style={{ color: actif ? t.accent : t.texte, visibility: ms >= tok.fromMs - 30 ? "visible" : "hidden" }}>
              {k === 0 ? tok.text.trimStart() : tok.text}
            </span>
          );
        })}
      </span>
    </div>
  );
};
