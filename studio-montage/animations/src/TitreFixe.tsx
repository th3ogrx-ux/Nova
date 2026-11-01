import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import "@fontsource/poppins/latin-800.css";
import "@fontsource/playfair-display/latin-700-italic.css";
import { FONT, FONT_SERIF, L, MARGE, Theme } from "./theme";
import type { Config } from "./types";

/** Le titre qui reste en haut pendant toute la vidéo. Il arrive avec une petite animation, puis ne bouge plus. */
export const TitreFixe: React.FC<{ c: Config; t: Theme; ombre?: boolean }> = ({ c, t, ombre }) => {
  const tf = c.titre_fixe;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!tf || !tf.actif) return null;
  const e1 = spring({ frame: frame - 2, fps, config: { damping: 14, stiffness: 170, mass: 0.7 } });
  const e2 = spring({ frame: frame - 9, fps, config: { damping: 14, stiffness: 170, mass: 0.7 } });
  const trait = spring({ frame: frame - 16, fps, config: { damping: 200 } });
  return (
    <div
      style={{
        position: "absolute",
        left: MARGE,
        width: L - 2 * MARGE,
        top: tf.y,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        fontFamily: FONT,
        textShadow: ombre ? "0 3px 18px rgba(0,0,0,0.7)" : "none",
      }}
    >
      <div
        style={{
          fontSize: 76,
          fontWeight: 800,
          letterSpacing: -2,
          lineHeight: 1.04,
          color: t.texte,
          whiteSpace: "nowrap",
          opacity: Math.min(1, e1 * 1.5),
          transform: `translateY(${(1 - Math.min(1, e1)) * -40}px)`,
        }}
      >
        {tf.ligne1}
      </div>
      {tf.ligne2 && (
        <div
          style={{
            fontFamily: FONT_SERIF,
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 92,
            letterSpacing: -1,
            lineHeight: 1.0,
            color: t.accent,
            whiteSpace: "nowrap",
            marginTop: 2,
            opacity: Math.min(1, e2 * 1.5),
            transform: `translateY(${(1 - Math.min(1, e2)) * -40}px)`,
          }}
        >
          {tf.ligne2}
        </div>
      )}
      <div style={{ height: 6, width: 230 * Math.min(1, trait), borderRadius: 3, background: t.accent, marginTop: 14, opacity: 0.9 }} />
    </div>
  );
};
