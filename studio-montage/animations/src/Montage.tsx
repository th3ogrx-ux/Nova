import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, staticFile } from "remotion";
import { FondPage } from "./Fonds";
import { SousTitres } from "./SousTitres";
import { SceneComparaison, SceneCourbe, SceneListe, SceneScore, SceneTitre } from "./scenes";
import { H, L, themeDe, zoneAnimations } from "./theme";
import type { MontageProps, Scene } from "./types";

/**
 * Mise en page (de l'arrière vers l'avant) :
 *  1. fond quadrillé (ou noir + courbes rouges)
 *  2. animations dans la zone du haut
 *  3. cadre aux coins arrondis, avec votre photo de fond (cover, légèrement floutée)
 *  4. votre silhouette découpée, PAR-DESSUS le cadre : la tête dépasse du bord haut
 *  5. sous-titres, juste au-dessus de la tête
 */
export const Montage: React.FC<MontageProps> = ({ config: c, scenes, mots, personne, audio, cadrePhoto, mesures }) => {
  const t = themeDe(c);
  const z = zoneAnimations(c);

  // Cadre
  const cx = c.cadre.gauche * L;
  const cw = (c.cadre.droite - c.cadre.gauche) * L;
  const ct = c.cadre.haut * H;

  // Silhouette : taille de tête voulue → échelle de la vidéo ; la tête dépasse de `debordement` × sa hauteur.
  const vh = c.tete.hauteurPx / c.tete.fractionHauteurTete;
  const vw = vh * (mesures.largeur / mesures.hauteur);
  const hautTeteEcran = ct - c.tete.debordement * c.tete.hauteurPx;
  const y0 = hautTeteEcran - mesures.hautTete * vh;
  const x0 = (L - vw) / 2;

  const rendre = (s: Scene, i: number) => {
    switch (s.type) {
      case "titre":
        return <SceneTitre key={i} s={s} t={t} z={z} />;
      case "comparaison":
        return <SceneComparaison key={i} s={s} t={t} z={z} />;
      case "liste":
        return <SceneListe key={i} s={s} t={t} z={z} />;
      case "courbe":
        return <SceneCourbe key={i} s={s} t={t} z={z} />;
      case "score":
        return <SceneScore key={i} s={s} t={t} z={z} />;
    }
  };

  return (
    <AbsoluteFill style={{ background: c.fond === "blanc" ? c.couleurs.papier : c.couleurs.noir }}>
      <FondPage c={c} />
      {scenes.map(rendre)}

      {/* Le cadre : coins arrondis, photo en « cover », légèrement floutée */}
      <div
        style={{
          position: "absolute",
          left: cx,
          top: ct,
          width: cw,
          height: H - ct + c.cadre.rayon + 4, // le bas dépasse de l'écran (coins du bas hors cadre)
          borderRadius: c.cadre.rayon,
          overflow: "hidden",
          boxShadow: t.clair ? "0 18px 50px rgba(0,0,0,0.18)" : "0 18px 50px rgba(0,0,0,0.6)",
          background: "#1a1a1a",
        }}
      >
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

      {/* Vous, par-dessus le cadre */}
      {personne && (
        <OffthreadVideo
          src={staticFile(personne)}
          transparent
          muted
          style={{ position: "absolute", left: x0, top: y0, width: vw, height: vh }}
        />
      )}

      {audio && <Audio src={staticFile(audio)} />}
      {c.sous_titres.actif && <SousTitres mots={mots} c={c} />}
    </AbsoluteFill>
  );
};
