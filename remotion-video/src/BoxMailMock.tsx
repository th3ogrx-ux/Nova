import React from "react";
import { interpolate } from "remotion";
import { COLORS } from "./PhoneFrame";

const AvatarDot: React.FC<{ initials: string }> = ({ initials }) => (
  <div
    style={{
      width: 44,
      height: 44,
      borderRadius: "50%",
      flexShrink: 0,
      background: `linear-gradient(135deg, ${COLORS.warm1}, ${COLORS.cool1})`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontWeight: 700,
      fontSize: 14,
      fontFamily: "Poppins, sans-serif",
    }}
  >
    {initials}
  </div>
);

const ExistingRow: React.FC<{ name: string; preview: string; time: string }> = ({
  name,
  preview,
  time,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "12px 4px",
      borderBottom: "1px solid rgba(199,194,219,0.08)",
    }}
  >
    <AvatarDot initials={name.slice(0, 2).toUpperCase()} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: 14.5,
          fontWeight: 600,
          color: COLORS.metal2,
          fontFamily: "Poppins, sans-serif",
        }}
      >
        {name}
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: COLORS.textDim,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontFamily: "Poppins, sans-serif",
        }}
      >
        {preview}
      </div>
    </div>
    <div style={{ fontSize: 11, color: COLORS.textDim, flexShrink: 0 }}>
      {time}
    </div>
  </div>
);

export const BoxMailMock: React.FC<{
  newMsgProgress: number; // 0 -> 1, arrival animation
  pulse: number; // 0 -> 1 highlight pulse after arrival
}> = ({ newMsgProgress, pulse }) => {
  const translateY = interpolate(newMsgProgress, [0, 1], [-60, 0]);
  const opacity = interpolate(newMsgProgress, [0, 0.4, 1], [0, 1, 1]);
  const scale = interpolate(newMsgProgress, [0, 0.7, 1], [0.9, 1.03, 1]);

  return (
    <div style={{ padding: "56px 16px 20px" }}>
      <div
        style={{
          fontSize: 22,
          fontWeight: 300,
          letterSpacing: "0.03em",
          marginBottom: 18,
          background: `linear-gradient(180deg, ${COLORS.metal2} 0%, ${COLORS.warm1} 55%, ${COLORS.cool1} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          fontFamily: "Poppins, sans-serif",
        }}
      >
        BoxMail
      </div>

      {newMsgProgress > 0.02 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 10px",
            borderRadius: 14,
            marginBottom: 12,
            background: `rgba(191,90,242,${0.1 + pulse * 0.12})`,
            border: `1px solid rgba(191,90,242,${0.35 + pulse * 0.4})`,
            boxShadow: `0 0 ${18 + pulse * 20}px rgba(191,90,242,${
              0.35 + pulse * 0.35
            })`,
            transform: `translateY(${translateY}px) scale(${scale})`,
            opacity,
          }}
        >
          <AvatarDot initials="LM" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14.5,
                fontWeight: 700,
                color: COLORS.metal2,
                fontFamily: "Poppins, sans-serif",
              }}
            >
              Lucas Martin
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: COLORS.warm2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontFamily: "Poppins, sans-serif",
              }}
            >
              Nouveau message
            </div>
          </div>
          <div
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: COLORS.warm2,
              boxShadow: `0 0 8px ${COLORS.warm2}`,
              flexShrink: 0,
            }}
          />
        </div>
      )}

      <ExistingRow name="Chef" preview="On fait le point demain ?" time="Hier" />
      <ExistingRow name="Sarah" preview="C'est envoyé au client" time="Hier" />
      <ExistingRow name="Team" preview="Bravo pour les ventes 🎉" time="Lun" />
    </div>
  );
};
