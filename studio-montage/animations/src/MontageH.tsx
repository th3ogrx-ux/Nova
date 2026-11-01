import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import "@fontsource/poppins/latin-800.css";
import "@fontsource/playfair-display/latin-700-italic.css";
import { FondPage } from "./Fonds";
import { SousTitres } from "./SousTitres";
import { FONT, FONT_SERIF, themeDe } from "./theme";
import type { MontageProps } from "./types";

/**
 * Format horizontal 1920×1080 :
 *  - titre en haut ;
 *  - un rectangle au milieu avec votre photo de fond, votre silhouette par-dessus (la tête dépasse du bord haut,
 *    le bas du corps est coupé par le bas du rectangle, épaules allongées sur les côtés) ;
 *  - sous-titres juste en dessous ;
 *  - bandeau « Commente MARQUE… » en bas, quand vous le dites.
 */
export const MontageH: React.FC<MontageProps> = ({ config: c, mots, personne, audio, cadrePhoto, mesures, cta, bloc = "horizontal" }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const h = c[bloc];
  // Écran vertical (TikTok) : titre sur deux lignes, bandeau sur deux lignes.
  const empile = height > width;
  const t = themeDe({ ...c, fond: "blanc" });
  if (!h) return null;
  const sec = frame / fps;

  const { x, largeur, haut, hauteur, rayon } = h.cadre;
  // Silhouette : la taille de la tête donne l'échelle ; la tête dépasse de `debordement` × sa hauteur.
  const vh = h.tete.hauteurPx / c.tete.fractionHauteurTete;
  const vw = vh * (mesures.largeur / mesures.hauteur);
  const teteHaut = haut - h.tete.debordement * h.tete.hauteurPx;
  const top = teteHaut - mesures.hautTete * vh; // position de la vidéo, en pixels d'écran
  const left = x + largeur / 2 - vw / 2; // tête au milieu du rectangle

  // titre : ligne 1 en gras, ligne 2 en serif italique rouge, sur une seule ligne
  const tf = c.titre_fixe;
  const e1 = spring({ frame: frame - 2, fps, config: { damping: 14, stiffness: 170, mass: 0.7 } });
  const e2 = spring({ frame: frame - 9, fps, config: { damping: 14, stiffness: 170, mass: 0.7 } });
  const trait = spring({ frame: frame - 16, fps, config: { damping: 200 } });

  // bandeau d'appel à l'action
  const ctaActif = cta && sec >= cta.debut && sec < cta.debut + cta.duree;
  const ce = cta ? spring({ frame: frame - Math.round(cta.debut * fps), fps, config: { damping: 12, stiffness: 170, mass: 0.7 } }) : 0;

  return (
    <AbsoluteFill style={{ background: c.couleurs.papier }}>
      <FondPage c={{ ...c, fond: "blanc" }} />

      {tf && tf.actif && (
        <div
          style={{
            position: "absolute",
            left: 0,
            width,
            top: h.titre.y,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            fontFamily: FONT,
          }}
        >
          <div style={{ display: "flex", flexDirection: empile ? "column" : "row", alignItems: empile ? "center" : "baseline", gap: empile ? 0 : 22, whiteSpace: "nowrap" }}>
            <span
              style={{
                fontSize: h.titre.taille,
                fontWeight: 800,
                letterSpacing: -2,
                color: t.texte,
                opacity: Math.min(1, e1 * 1.5),
                transform: `translateY(${(1 - Math.min(1, e1)) * -40}px)`,
              }}
            >
              {tf.ligne1}
            </span>
            {tf.ligne2 && (
              <span
                style={{
                  fontFamily: FONT_SERIF,
                  fontStyle: "italic",
                  fontWeight: 700,
                  fontSize: h.titre.taille * 1.14,
                  letterSpacing: -1,
                  color: t.accent,
                  opacity: Math.min(1, e2 * 1.5),
                  transform: `translateY(${(1 - Math.min(1, e2)) * -40}px)`,
                }}
              >
                {tf.ligne2}
              </span>
            )}
          </div>
          <div style={{ height: 6, width: 260 * Math.min(1, trait), borderRadius: 3, background: t.accent, marginTop: 8, opacity: 0.9 }} />
        </div>
      )}

      {/* Le rectangle : coins arrondis, votre photo, vous par-dessus. Seul le haut est libre : la tête dépasse. */}
      <div
        style={{
          position: "absolute",
          left: x,
          top: haut,
          width: largeur,
          height: hauteur,
          borderRadius: rayon,
          boxShadow: "0 22px 60px rgba(0,0,0,0.20)",
          background: "#1a1a1a",
        }}
      >
        <div style={{ position: "absolute", inset: 0, borderRadius: rayon, overflow: "hidden" }}>
          {cadrePhoto && (
            <Img
              src={staticFile(cadrePhoto)}
              style={{
                position: "absolute",
                inset: -c.cadre.flou * 3,
                width: `calc(100% + ${c.cadre.flou * 6}px)`,
                height: `calc(100% + ${c.cadre.flou * 6}px)`,
                objectFit: "cover",
                filter: `blur(${c.cadre.flou}px)`,
              }}
            />
          )}
        </div>
        {personne && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              // on coupe le bas et les côtés, pas le haut (la tête dépasse)
              clipPath: `inset(-700px 0px 0px 0px round 0px 0px ${rayon}px ${rayon}px)`,
            }}
          >
            <div style={{ position: "absolute", left: left - x, top: top - haut, width: vw, height: vh }}>
              <OffthreadVideo src={staticFile(personne)} transparent muted style={{ width: "100%", height: "100%" }} />
            </div>
          </div>
        )}
      </div>

      {c.sous_titres.actif && (
        <SousTitres mots={mots} c={c} libre={{ yPx: h.sous_titres.y, taille: h.sous_titres.taille, marge: h.sous_titres.marge }} />
      )}

      {ctaActif && cta && (
        <div style={{ position: "absolute", left: 0, width, top: h.cta.y, display: "flex", justifyContent: "center", fontFamily: FONT }}>
          <div
            style={{
              background: t.accent,
              color: "#fff",
              fontSize: h.cta.taille,
              fontWeight: 800,
              letterSpacing: -0.5,
              padding: empile ? "20px 52px 26px" : "12px 44px 16px",
              borderRadius: 22,
              whiteSpace: "nowrap",
              textAlign: "center",
              lineHeight: 1.18,
              boxShadow: `0 0 ${26 + Math.sin(frame / 5) * 10}px rgba(229,48,58,0.5)`,
              transform: `translateY(${(1 - Math.min(1, ce)) * 90}px) scale(${1 + Math.sin(frame / 7) * 0.012})`,
              opacity: Math.min(1, ce * 2),
            }}
          >
            {empile ? (
              <>
                <div>
                  {cta.texte} <span style={{ background: "#fff", color: t.accent, padding: "0 16px", borderRadius: 12, margin: "0 6px" }}>{cta.mot}</span>
                </div>
                <div style={{ fontSize: h.cta.taille * 0.62, fontWeight: 700, marginTop: 6 }}>{cta.fin}</div>
              </>
            ) : (
              <>
                {cta.texte} <span style={{ background: "#fff", color: t.accent, padding: "0 14px", borderRadius: 10, margin: "0 6px" }}>{cta.mot}</span> {cta.fin}
              </>
            )}
          </div>
        </div>
      )}

      {audio && <Audio src={staticFile(audio)} />}
    </AbsoluteFill>
  );
};
