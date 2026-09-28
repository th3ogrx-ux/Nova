import React from "react";
import { COLORS } from "./PhoneFrame";

const GearIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 16,
  color = COLORS.metal2,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82A1.65 1.65 0 0 0 3 13.09H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const BellIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke={COLORS.metal2}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={16}
    height={16}
  >
    <path d="M6 8a6 6 0 0 1 12 0c0 4.5 1.5 6 2 7H4c.5-1 2-2.5 2-7z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
);

const HamburgerIcon: React.FC<{ glow?: number }> = ({ glow = 0 }) => (
  <div
    style={{
      width: 38,
      height: 38,
      borderRadius: 9,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      border: `1px solid rgba(199,194,219,${0.15 + glow * 0.5})`,
      background: `rgba(255,255,255,${0.02 + glow * 0.08})`,
      boxShadow: glow ? `0 0 ${16 * glow}px rgba(191,90,242,${0.6 * glow})` : "none",
    }}
  >
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        style={{
          width: 16,
          height: 1.5,
          background: COLORS.metal1,
          borderRadius: 2,
        }}
      />
    ))}
  </div>
);

const NavRow: React.FC<{ label: string; active?: boolean }> = ({
  label,
  active,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 12px",
      borderRadius: 9,
      fontSize: 13,
      fontWeight: 500,
      color: active ? COLORS.cool2 : COLORS.textMid,
      background: active ? "rgba(48,10,102,0.4)" : "transparent",
      fontFamily: "Poppins, sans-serif",
    }}
  >
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: active ? COLORS.cool2 : COLORS.metal1,
        opacity: active ? 1 : 0.5,
        flexShrink: 0,
      }}
    />
    {label}
  </div>
);

export const AppShellMock: React.FC<{
  sidebarProgress: number; // 0 closed -> 1 open
  hamburgerGlow: number;
  gearGlow: number;
}> = ({ sidebarProgress, hamburgerGlow, gearGlow }) => {
  const sidebarX = -100 + sidebarProgress * 100; // percent translateX

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* topbar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 64,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 14,
          background: "linear-gradient(180deg, #04010ae6, #04010a80)",
          zIndex: 5,
        }}
      >
        <HamburgerIcon glow={hamburgerGlow} />
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.2em",
            fontFamily: "Orbitron, sans-serif",
            background: `linear-gradient(180deg, ${COLORS.metal2} 0%, ${COLORS.warm1} 55%, ${COLORS.cool1} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          ZENOA
        </div>
        <div style={{ marginLeft: "auto" }}>
          <BellIcon />
        </div>
      </div>

      {/* faded home content behind */}
      <div style={{ padding: "84px 20px", opacity: 0.35 }}>
        <div
          style={{
            height: 90,
            borderRadius: 16,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(199,194,219,0.1)",
            marginBottom: 14,
          }}
        />
        <div
          style={{
            height: 60,
            borderRadius: 16,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(199,194,219,0.08)",
          }}
        />
      </div>

      {/* sidebar overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: "82%",
          background: COLORS.bgPanel,
          borderRight: "1px solid rgba(199,194,219,0.1)",
          transform: `translateX(${sidebarX}%)`,
          display: "flex",
          flexDirection: "column",
          zIndex: 10,
          boxShadow: sidebarProgress > 0.05 ? "20px 0 60px rgba(0,0,0,0.5)" : "none",
        }}
      >
        <div style={{ padding: "24px 20px 14px" }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.18em",
              fontFamily: "Orbitron, sans-serif",
              color: COLORS.metal2,
            }}
          >
            ZENOA
          </div>
        </div>
        <div style={{ flex: 1, padding: "4px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          <NavRow label="Accueil" active />
          <NavRow label="Résultats" />
          <NavRow label="BoxMail" />
          <NavRow label="Calendrier" />
        </div>
        <div
          style={{
            borderTop: "1px solid rgba(199,194,219,0.1)",
            padding: "14px 16px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${COLORS.metal1}, #5b5470)`,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1c1626",
              fontWeight: 700,
              fontSize: 13,
              fontFamily: "Poppins, sans-serif",
            }}
          >
            LM
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: COLORS.metal2,
                fontFamily: "Poppins, sans-serif",
              }}
            >
              Lucas Martin
            </div>
          </div>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid rgba(199,194,219,${0.16 + gearGlow * 0.6})`,
              background: `rgba(255,255,255,${0.02 + gearGlow * 0.1})`,
              boxShadow: gearGlow
                ? `0 0 ${18 * gearGlow}px rgba(191,90,242,${0.65 * gearGlow})`
                : "none",
              flexShrink: 0,
            }}
          >
            <GearIcon />
          </div>
        </div>
      </div>
    </div>
  );
};
