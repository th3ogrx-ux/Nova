import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT, ICE, glassStyle } from "./theme";

const useAppear = (from: number, to: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inn = spring({
    frame: frame - from,
    fps,
    config: { damping: 13, stiffness: 190, mass: 0.7 },
  });
  const out = interpolate(frame, [to - 8, to], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { inn: frame < from ? 0 : inn, out, visible: frame >= from && frame < to };
};

const chip: React.CSSProperties = {
  ...glassStyle,
  fontFamily: FONT,
  fontWeight: 800,
  color: ICE.text,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  gap: 16,
};

/** Badge d'accroche en haut, pulsation douce. */
export const HookBadge: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const frame = useCurrentFrame();
  const { inn, out, visible } = useAppear(from, to);
  if (!visible) return null;
  const pulse = 1 + Math.sin(frame / 6) * 0.02;
  return (
    <div
      style={{
        position: "absolute",
        top: 250,
        width: "100%",
        display: "flex",
        justifyContent: "center",
        opacity: out * inn,
        transform: `scale(${inn * pulse}) translateY(${(1 - inn) * -60}px)`,
      }}
    >
      <div style={{ ...chip, fontSize: 52, padding: "22px 48px" }}>
        <span style={{ color: ICE.green }}>●</span> REELS D'ESSAI
      </div>
    </div>
  );
};

/** Gros mot qui claque au centre-haut (ex. ERREUR). */
export const PopWord: React.FC<{
  from: number;
  to: number;
  text: string;
  top?: number;
}> = ({ from, to, text, top = 380 }) => {
  const frame = useCurrentFrame();
  const { inn, out, visible } = useAppear(from, to);
  if (!visible) return null;
  const shake = frame - from < 10 ? Math.sin(frame * 3) * 6 : 0;
  return (
    <div
      style={{
        position: "absolute",
        top,
        width: "100%",
        display: "flex",
        justifyContent: "center",
        opacity: out,
        transform: `translateX(${shake}px) scale(${0.4 + inn * 0.6}) rotate(${(1 - inn) * -6}deg)`,
      }}
    >
      <div
        style={{
          ...chip,
          fontSize: 110,
          padding: "20px 64px",
          color: ICE.mint,
          letterSpacing: 4,
        }}
      >
        {text}
      </div>
    </div>
  );
};

/** Trois pastilles 1 / 2 / 3 qui arrivent en cascade (« trois accroches »). */
export const NumberedHooks: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = interpolate(frame, [to - 8, to], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (frame < from || frame >= to) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 330,
        width: "100%",
        display: "flex",
        justifyContent: "center",
        gap: 28,
        opacity: out,
      }}
    >
      {[1, 2, 3].map((n) => {
        const s = spring({
          frame: frame - from - (n - 1) * 7,
          fps,
          config: { damping: 11, stiffness: 200, mass: 0.6 },
        });
        return (
          <div
            key={n}
            style={{
              ...chip,
              width: 190,
              height: 190,
              borderRadius: 56,
              justifyContent: "center",
              flexDirection: "column",
              gap: 4,
              transform: `scale(${s}) translateY(${(1 - s) * 80}px)`,
            }}
          >
            <span style={{ fontSize: 80, color: ICE.mint, lineHeight: 1 }}>{n}</span>
            <span style={{ fontSize: 28, letterSpacing: 2 }}>ACCROCHE</span>
          </div>
        );
      })}
    </div>
  );
};

/** Appel à l'action final : commente MARQUE. */
export const CTA: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const frame = useCurrentFrame();
  const { inn, visible } = useAppear(from, to + 1000);
  if (!visible) return null;
  const pulse = 1 + Math.sin((frame - from) / 5) * 0.035;
  return (
    <div
      style={{
        position: "absolute",
        top: 200,
        width: "100%",
        display: "flex",
        justifyContent: "center",
        transform: `scale(${inn}) translateY(${(1 - inn) * 120}px)`,
        opacity: inn,
      }}
    >
      <div
        style={{
          ...chip,
          flexDirection: "column",
          gap: 6,
          borderRadius: 72,
          padding: "28px 70px",
          background: `linear-gradient(135deg, rgba(10,60,44,0.7), rgba(10,60,44,0.5))`,
          transform: `scale(${pulse})`,
          boxShadow: `0 10px 50px rgba(0,0,0,0.35), 0 0 ${90 * pulse}px ${ICE.glow}, inset 0 2px 0 rgba(255,255,255,0.55)`,
        }}
      >
        <span style={{ fontSize: 44, letterSpacing: 6, opacity: 0.9 }}>COMMENTE</span>
        <span style={{ fontSize: 150, color: ICE.mint, lineHeight: 1, letterSpacing: 4 }}>
          MARQUE
        </span>
        <span style={{ fontSize: 40, opacity: 0.95 }}>→ diagnostic gratuit</span>
      </div>
    </div>
  );
};

/** Barre de progression fine en haut (rétention). */
export const Progress: React.FC<{ total: number }> = ({ total }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        top: 170,
        left: 60,
        right: 60,
        height: 8,
        borderRadius: 8,
        background: "rgba(255,255,255,0.18)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${(frame / total) * 100}%`,
          height: "100%",
          background: `linear-gradient(90deg, ${ICE.green}, ${ICE.mint})`,
          boxShadow: `0 0 18px ${ICE.glow}`,
        }}
      />
    </div>
  );
};
