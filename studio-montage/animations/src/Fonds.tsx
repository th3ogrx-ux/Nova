import React from "react";
import type { Config } from "./types";
import { H, L } from "./theme";

/** Blanc cassé avec grille fine et points, comme du papier millimétré. Option : noir avec courbes rouges. */
export const FondPage: React.FC<{ c: Config }> = ({ c }) => {
  if (c.fond === "blanc") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: c.couleurs.papier,
          backgroundImage: [
            "radial-gradient(circle, rgba(0,0,0,0.13) 1.6px, transparent 2.2px)",
            "linear-gradient(rgba(0,0,0,0.045) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(0,0,0,0.045) 1px, transparent 1px)",
          ].join(","),
          backgroundSize: "54px 54px, 54px 54px, 54px 54px",
          backgroundPosition: "27px 27px, 0 0, 0 0",
        }}
      />
    );
  }
  const a = c.couleurs.accent;
  return (
    <div style={{ position: "absolute", inset: 0, backgroundColor: c.couleurs.noir }}>
      <svg width={L} height={H} viewBox={`0 0 ${L} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <filter id="flou-courbes">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            d={`M -50 ${260 + i * 170} C 250 ${60 + i * 170}, 520 ${620 + i * 150}, 1130 ${300 + i * 190}`}
            fill="none"
            stroke={a}
            strokeWidth={i % 2 ? 2 : 3}
            opacity={0.18 + i * 0.07}
            filter="url(#flou-courbes)"
          />
        ))}
      </svg>
    </div>
  );
};
