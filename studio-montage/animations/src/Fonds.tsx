import React from "react";

/** Papier clair à grille discrète, ou noir profond : les deux fonds du tableau. */
export const FondTableau: React.FC<{ clair: boolean }> = ({ clair }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundColor: clair ? "#F1F2F2" : "#0A0A0C",
      backgroundImage: clair
        ? "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.9), rgba(255,255,255,0) 60%), linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)"
        : "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.10), rgba(255,255,255,0) 60%), linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
      backgroundSize: "100% 100%, 54px 54px, 54px 54px",
    }}
  />
);
