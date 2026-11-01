import React, { useMemo } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { createTikTokStyleCaptions } from "@remotion/captions";
import type { Caption, TikTokPage } from "@remotion/captions";
import { FONT, ICE } from "./theme";

type IconName =
  | "play"
  | "flask"
  | "users"
  | "trend"
  | "target"
  | "trophy"
  | "tag"
  | "clipboard"
  | "gift";

/** Mot (en minuscules, sans ponctuation) → icône néon affichée sous le mot-clé. */
const KEYWORDS: Record<string, IconName> = {
  reels: "play",
  reel: "play",
  essai: "flask",
  teste: "flask",
  abonnés: "users",
  abonnées: "users",
  personnes: "users",
  puissants: "trend",
  performe: "trend",
  scaler: "trend",
  accroches: "target",
  hasard: "target",
  mieux: "trophy",
  marque: "tag",
  vêtements: "tag",
  diagnostic: "clipboard",
  gratuitement: "gift",
};

const norm = (t: string) => t.trim().toLowerCase().replace(/[.,!?]/g, "");

const ICONS: Record<IconName, React.ReactNode> = {
  play: <path d="M8 5v14l11-7z" />,
  flask: (
    <>
      <path d="M9 3h6" />
      <path d="M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" />
      <path d="M8 15h8" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M17 14c2.5 0 4.5 2 4.5 4.5" />
    </>
  ),
  trend: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 21h8M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V4h8l10 10-8 8L3 12z" />
      <circle cx="7.5" cy="8.5" r="1.3" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4h6v3H9z" />
      <path d="M9 14l2.2 2.2L15.5 12" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="8" width="18" height="4" />
      <path d="M5 12v9h14v-9M12 8v13" />
      <path d="M12 8H8a2.2 2.2 0 1 1 0-4.4C11 3.6 12 8 12 8zM12 8h4a2.2 2.2 0 1 0 0-4.4C13 3.6 12 8 12 8z" />
    </>
  ),
};

const NeonIcon: React.FC<{ name: IconName; progress: number }> = ({
  name,
  progress,
}) => (
  <div
    style={{
      width: 116,
      height: 116,
      borderRadius: "50%",
      marginTop: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "radial-gradient(circle, rgba(16,90,66,0.85), rgba(4,30,22,0.9))",
      border: `3px solid ${ICE.mint}`,
      boxShadow: `0 0 34px ${ICE.glow}, 0 0 70px ${ICE.glow}, inset 0 0 20px rgba(124,245,192,0.35)`,
      transform: `scale(${progress})`,
      opacity: Math.min(1, progress * 1.5),
    }}
  >
    <svg
      viewBox="0 0 24 24"
      width={62}
      height={62}
      fill="none"
      stroke={ICE.mint}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ filter: `drop-shadow(0 0 6px ${ICE.glow})` }}
    >
      {ICONS[name]}
    </svg>
  </div>
);

export const Captions: React.FC<{
  captions: Caption[];
  /** Plages de frames [début, fin[ pendant lesquelles les sous-titres sont masqués. */
  hidden?: Array<[number, number]>;
}> = ({ captions, hidden = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { pages } = useMemo(
    () =>
      createTikTokStyleCaptions({
        // Une page ne traverse jamais une virgule, un point ou un point d'interrogation.
        captions: captions.map((c) => ({
          ...c,
          pageBreakAfter: /[.,?!]\s*$/.test(c.text),
        })),
        combineTokensWithinMilliseconds: 1300,
      }),
    [captions],
  );

  if (hidden.some(([a, b]) => frame >= a && frame < b)) return null;

  const ms = (frame / fps) * 1000;
  const idx = pages.findIndex(
    (p, i) => ms >= p.startMs && ms < (pages[i + 1]?.startMs ?? Infinity),
  );
  if (idx < 0) return null;
  return <Page page={pages[idx]} ms={ms} frame={frame} fps={fps} />;
};

const small: React.CSSProperties = {
  fontFamily: FONT,
  fontWeight: 700,
  fontSize: 72,
  lineHeight: 1.1,
  letterSpacing: -1,
  color: "#FFFFFF",
  whiteSpace: "pre",
  textAlign: "center",
  filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.75))",
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
    config: { damping: 15, stiffness: 210, mass: 0.6 },
  });

  const kwIndex = page.tokens.findIndex((t) => norm(t.text) in KEYWORDS);
  const kw = kwIndex >= 0 ? page.tokens[kwIndex] : null;
  const pre = kw ? page.tokens.slice(0, kwIndex) : page.tokens;
  const post = kw ? page.tokens.slice(kwIndex + 1) : [];
  const spoken = (t: { fromMs: number }) => ms >= t.fromMs - 40;

  const line = (tokens: typeof pre) =>
    tokens.length > 0 && (
      <div style={small}>
        {tokens.map((t, i) => (
          <span
            key={i}
            style={{ visibility: spoken(t) ? "visible" : "hidden", whiteSpace: "pre" }}
          >
            {i === 0 ? t.text.trimStart() : t.text}
          </span>
        ))}
      </div>
    );

  // Le mot-clé apparaît « flou → net » quand il est prononcé.
  const kwFrame = kw ? (kw.fromMs / 1000) * fps : 0;
  const kwIn = kw
    ? spring({
        frame: frame - kwFrame,
        fps,
        config: { damping: 13, stiffness: 190, mass: 0.7 },
      })
    : 0;
  const kwBlur = interpolate(kwIn, [0, 1], [16, 0], {
    extrapolateRight: "clamp",
  });
  const iconIn = kw
    ? spring({
        frame: frame - kwFrame - 4,
        fps,
        config: { damping: 11, stiffness: 180, mass: 0.7 },
      })
    : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: 50,
        right: 50,
        bottom: 250,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transform: `translateY(${(1 - enter) * 30}px)`,
        opacity: Math.min(1, enter * 1.8),
      }}
    >
      {line(pre)}
      {kw && spoken(kw) && (
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 128,
            lineHeight: 1.02,
            letterSpacing: -3,
            whiteSpace: "pre",
            background: `linear-gradient(180deg, #F2FFF9 0%, ${ICE.mint} 38%, ${ICE.green} 70%, #2FD9A0 100%)`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            filter: `blur(${kwBlur}px) drop-shadow(0 5px 10px rgba(0,0,0,0.65)) drop-shadow(0 0 26px ${ICE.glow})`,
            transform: `scale(${0.82 + kwIn * 0.18})`,
          }}
        >
          {kw.text.trim()}
        </div>
      )}
      {kw && spoken(kw) && (
        <NeonIcon name={KEYWORDS[norm(kw.text)]} progress={iconIn} />
      )}
      {line(post)}
    </div>
  );
};
