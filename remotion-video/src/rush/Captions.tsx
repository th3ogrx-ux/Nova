import React, { useMemo } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { createTikTokStyleCaptions } from "@remotion/captions";
import type { Caption, TikTokPage } from "@remotion/captions";
import { FONT, ICE, glassStyle } from "./theme";

const KEYWORDS = /(reels?|essai|accroches?|marque|gratuit|erreur|scaler|puissants?)/i;

export const Captions: React.FC<{ captions: Caption[] }> = ({ captions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { pages } = useMemo(
    () =>
      createTikTokStyleCaptions({
        captions,
        combineTokensWithinMilliseconds: 650,
      }),
    [captions],
  );

  const ms = (frame / fps) * 1000;
  const idx = pages.findIndex(
    (p, i) => ms >= p.startMs && ms < (pages[i + 1]?.startMs ?? Infinity),
  );
  if (idx < 0) return null;
  return <Page page={pages[idx]} ms={ms} frame={frame} fps={fps} />;
};

const Page: React.FC<{
  page: TikTokPage;
  ms: number;
  frame: number;
  fps: number;
}> = ({ page, ms, frame, fps }) => {
  const startFrame = (page.startMs / 1000) * fps;
  const enter = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 14, stiffness: 220, mass: 0.6 },
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        bottom: 430,
        display: "flex",
        justifyContent: "center",
        transform: `translateY(${(1 - enter) * 40}px) scale(${0.85 + enter * 0.15})`,
        opacity: Math.min(1, enter * 1.6),
      }}
    >
      <div
        style={{
          ...glassStyle,
          background: `linear-gradient(135deg, rgba(10,60,44,0.62), rgba(10,60,44,0.42))`,
          borderRadius: 56,
          padding: "26px 44px",
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 76,
          lineHeight: 1.12,
          textAlign: "center",
          whiteSpace: "pre-wrap",
          color: ICE.text,
          textShadow: "0 3px 14px rgba(0,0,0,0.45)",
        }}
      >
        {page.tokens.map((t, i) => {
          const active = t.fromMs <= ms && t.toMs > ms;
          const key = KEYWORDS.test(t.text);
          const spoken = ms >= t.fromMs;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                margin: "0 3px",
                whiteSpace: "pre",
                color: active || key ? ICE.mint : ICE.text,
                opacity: spoken ? 1 : 0.55,
                transform: `scale(${active ? 1.07 : 1})`,
                textShadow: active
                  ? `0 0 28px ${ICE.glow}, 0 3px 14px rgba(0,0,0,0.45)`
                  : "0 3px 14px rgba(0,0,0,0.45)",
              }}
            >
              {t.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
