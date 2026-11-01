import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT, ICE, glassStyle } from "./theme";

/** Calque plein écran : voile vert glace + contenu centré, entrée/sortie animées. */
const FullScreen: React.FC<{
  from: number;
  to: number;
  children: React.ReactNode;
  stay?: boolean;
}> = ({ from, to, children, stay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < from || frame >= to) return null;
  const inn = spring({
    frame: frame - from,
    fps,
    config: { damping: 15, stiffness: 170, mass: 0.7 },
  });
  const out = stay
    ? 1
    : interpolate(frame, [to - 7, to], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const t = frame - from;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: out * Math.min(1, inn * 1.4),
        background: `radial-gradient(circle at 50% 45%, rgba(40,150,110,0.88), rgba(4,36,26,0.94) 75%)`,
        backdropFilter: "blur(30px) saturate(160%)",
        WebkitBackdropFilter: "blur(30px) saturate(160%)",
        overflow: "hidden",
        fontFamily: FONT,
      }}
    >
      {/* anneaux qui pulsent */}
      {[0, 1, 2].map((r) => {
        const p = ((t + r * 14) % 42) / 42;
        const size = 500 + p * 1100;
        return (
          <div
            key={r}
            style={{
              position: "absolute",
              left: "50%",
              top: "45%",
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              borderRadius: "50%",
              border: `3px solid rgba(190,255,227,${0.5 * (1 - p)})`,
            }}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          transform: `scale(${0.7 + inn * 0.3})`,
        }}
      >
        {children}
      </div>
    </div>
  );
};

const big: React.CSSProperties = {
  color: ICE.mint,
  fontWeight: 900,
  lineHeight: 1,
  textAlign: "center",
  textShadow: `0 0 60px ${ICE.glow}, 0 6px 30px rgba(0,0,0,0.4)`,
};

/** « ERREUR » en plein écran. */
export const ErrorCard: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const frame = useCurrentFrame();
  const shake = frame - from < 10 ? Math.sin(frame * 3) * 10 : 0;
  return (
    <FullScreen from={from} to={to}>
      <div
        style={{
          ...big,
          fontSize: 210,
          letterSpacing: 6,
          transform: `translateX(${shake}px)`,
        }}
      >
        ERREUR
      </div>
      <div
        style={{
          ...big,
          fontSize: 60,
          color: ICE.text,
          marginTop: 36,
          fontWeight: 700,
        }}
      >
        poster qu'à tes abonnés
      </div>
    </FullScreen>
  );
};

/** Trois accroches en plein écran, en cascade. */
export const ThreeHooks: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <FullScreen from={from} to={to}>
      <div style={{ display: "flex", flexDirection: "column", gap: 34, width: 860 }}>
        {[1, 2, 3].map((n) => {
          const s = spring({
            frame: frame - from - (n - 1) * 8,
            fps,
            config: { damping: 11, stiffness: 200, mass: 0.6 },
          });
          return (
            <div
              key={n}
              style={{
                ...glassStyle,
                borderRadius: 64,
                padding: "34px 54px",
                display: "flex",
                alignItems: "center",
                gap: 40,
                color: ICE.text,
                transform: `translateX(${(1 - s) * 900}px) scale(${0.9 + s * 0.1})`,
              }}
            >
              <span style={{ ...big, fontSize: 130, width: 110 }}>{n}</span>
              <span style={{ fontSize: 64, fontWeight: 800 }}>ACCROCHE {n}</span>
            </div>
          );
        })}
      </div>
    </FullScreen>
  );
};

/** Reel d'essai → Reel normal (le gagnant passe en normal). */
export const WinnerCard: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - from - 6,
    fps,
    config: { damping: 12, stiffness: 160 },
  });
  const pill: React.CSSProperties = {
    ...glassStyle,
    borderRadius: 60,
    padding: "30px 60px",
    fontSize: 62,
    fontWeight: 800,
    color: ICE.text,
  };
  return (
    <FullScreen from={from} to={to}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        <div style={{ ...pill, transform: `scale(${0.9 + s * 0.1})` }}>REEL D'ESSAI</div>
        <div style={{ ...big, fontSize: 150, transform: `translateY(${(1 - s) * -40}px)` }}>
          ↓
        </div>
        <div
          style={{
            ...pill,
            color: ICE.mint,
            transform: `scale(${s})`,
            boxShadow: `0 0 ${60 + Math.sin(frame / 4) * 20}px ${ICE.glow}`,
          }}
        >
          REEL NORMAL
        </div>
      </div>
    </FullScreen>
  );
};

/** Appel à l'action final, plein écran jusqu'à la fin. */
export const CTA: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin((frame - from) / 5) * 0.03;
  return (
    <FullScreen from={from} to={to + 1000} stay>
      <div
        style={{
          transform: `scale(${pulse})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        <div
          style={{
            ...big,
            fontSize: 70,
            letterSpacing: 10,
            color: ICE.text,
            fontWeight: 700,
          }}
        >
          COMMENTE
        </div>
        <div style={{ ...big, fontSize: 200, letterSpacing: 4 }}>MARQUE</div>
        <div
          style={{
            ...glassStyle,
            borderRadius: 999,
            padding: "26px 64px",
            fontSize: 56,
            fontWeight: 800,
            color: ICE.text,
            marginTop: 10,
          }}
        >
          → diagnostic gratuit
        </div>
      </div>
    </FullScreen>
  );
};
