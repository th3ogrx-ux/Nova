import React from "react";
import { interpolate } from "remotion";
import { COLORS } from "./PhoneFrame";

const Tile: React.FC<{
  label: string;
  sub?: string;
  glow?: number;
  right?: React.ReactNode;
  chevron?: boolean;
}> = ({ label, sub, glow = 0, right, chevron = true }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px 16px",
        borderRadius: 14,
        background: `rgba(255,255,255,${0.05 + glow * 0.07})`,
        border: `1px solid rgba(199,194,219,${0.14 + glow * 0.4})`,
        boxShadow: glow
          ? `0 0 ${18 * glow}px rgba(191,90,242,${0.55 * glow}), 0 0 0 ${
              1 + glow * 1.5
            }px rgba(191,90,242,${0.5 * glow})`
          : "none",
        marginBottom: 10,
        transition: "none",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: COLORS.metal2,
            fontFamily: "Poppins, sans-serif",
          }}
        >
          {label}
        </div>
        {sub && (
          <div
            style={{
              fontSize: 12,
              color: COLORS.textDim,
              marginTop: 3,
              fontFamily: "Poppins, sans-serif",
            }}
          >
            {sub}
          </div>
        )}
      </div>
      {right}
      {chevron && !right && (
        <div style={{ fontSize: 20, opacity: 0.35, color: COLORS.metal2 }}>
          &rsaquo;
        </div>
      )}
    </div>
  );
};

export const Switch: React.FC<{ on: number }> = ({ on }) => {
  return (
    <div
      style={{
        width: 50,
        height: 30,
        borderRadius: 999,
        background: on
          ? `linear-gradient(120deg, ${COLORS.warm1}, ${COLORS.warm2})`
          : "rgba(255,255,255,0.14)",
        border: on ? "none" : "1px solid rgba(199,194,219,0.22)",
        position: "relative",
        flexShrink: 0,
        boxShadow: on ? `0 0 16px rgba(191,90,242,${0.6 * on})` : "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 3,
          left: 3 + on * 20,
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: on ? COLORS.bgDeep : COLORS.metal2,
          boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
        }}
      />
    </div>
  );
};

export const SettingsMock: React.FC<{
  installGlow: number;
  notifGlow: number;
  notifOn: number;
}> = ({ installGlow, notifGlow, notifOn }) => {
  return (
    <div style={{ padding: "56px 20px 20px" }}>
      <div
        style={{
          fontSize: 22,
          fontWeight: 300,
          letterSpacing: "0.03em",
          marginBottom: 22,
          background: `linear-gradient(180deg, ${COLORS.metal2} 0%, ${COLORS.warm1} 55%, ${COLORS.cool1} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          fontFamily: "Poppins, sans-serif",
        }}
      >
        Paramètres
      </div>

      <Tile label="Changer de pseudo" />
      <Tile label="Changer de photo de profil" />
      <Tile label="Signaler un problème" />
      <Tile
        label="Ajouter à l'écran d'accueil"
        glow={installGlow}
        chevron={false}
      />
      <Tile
        label="Activer les notifications"
        sub={notifOn > 0.5 ? "Activées ✓" : "Désactivées"}
        glow={notifGlow}
        chevron={false}
        right={<Switch on={notifOn} />}
      />
    </div>
  );
};

export const TapRipple: React.FC<{ progress: number; x: number; y: number }> = ({
  progress,
  x,
  y,
}) => {
  if (progress <= 0 || progress >= 1) return null;
  const size = interpolate(progress, [0, 1], [10, 70]);
  const opacity = interpolate(progress, [0, 0.6, 1], [0.9, 0.5, 0]);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: "50%",
        border: `2px solid ${COLORS.warm2}`,
        background: `rgba(191,90,242,${opacity * 0.25})`,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

export const FingerTap: React.FC<{ x: number; y: number; pressed: number }> = ({
  x,
  y,
  pressed,
}) => {
  const scale = interpolate(pressed, [0, 1], [1, 0.82]);
  return (
    <div
      style={{
        position: "absolute",
        left: x - 22,
        top: y - 22,
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.9)",
        boxShadow: "0 6px 18px rgba(0,0,0,0.5)",
        transform: `scale(${scale})`,
        border: `3px solid ${COLORS.warm1}`,
      }}
    />
  );
};
