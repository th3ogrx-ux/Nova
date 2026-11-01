import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FondPage } from "./Fonds";
import { SousTitres } from "./SousTitres";
import { SceneComparaison, SceneCourbe, SceneListe, SceneScore, SceneTitre } from "./scenes";
import { SceneCompteurs, SceneOrbite, SceneProfil } from "./ScenesPlus";
import { TitreFixe } from "./TitreFixe";
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
export const Montage: React.FC<MontageProps> = ({ config: c, scenes, mots, personne, audio, cadrePhoto, mesures, grosPlans = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  const gp = c.gros_plan ?? { hauteurTetePx: 820, hautTeteEcran: 330, y: 0.68, taille: 100, zoom: 1.08 };
  const gros = grosPlans.find((g) => sec >= g.debut && sec < g.debut + g.duree) ?? null;
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

  // Gros plan : la tête en grand, plein écran. Sa silhouette est agrandie, le bas du corps sort de l'écran.
  const gvh = gp.hauteurTetePx / c.tete.fractionHauteurTete;
  const gvw = gvh * (mesures.largeur / mesures.hauteur);
  const gy0 = gp.hautTeteEcran - mesures.hautTete * gvh;
  const gx0 = (L - gvw) / 2;
  const gProg = gros ? (sec - gros.debut) / gros.duree : 0;
  const gZoom = 1 + (gp.zoom - 1) * gProg;

  // Les épaules sont coupées par les bords de la vidéo d'origine : on les estompe au lieu de les trancher net.
  const f = Math.max(0, Math.min(0.4, c.tete.fonduBords ?? 0.12)) * 100;
  const masque = `linear-gradient(to right, transparent 0%, #000 ${f}%, #000 ${100 - f}%, transparent 100%)`;
  const fondu: React.CSSProperties = f > 0 ? { WebkitMaskImage: masque, maskImage: masque } : {};

  // Le titre fixe prend de la place en haut : les animations sont réduites et descendues pour rester en dessous.
  const tf = c.titre_fixe;
  const reserve = tf && tf.actif ? tf.hauteur : 0;
  const centreAvant = (z.top + z.bottom) / 2;
  const k = (z.bottom - (z.top + reserve)) / (z.bottom - z.top);
  const decale = reserve / 2;

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
      case "profil":
        return <SceneProfil key={i} s={s} t={t} z={z} />;
      case "compteurs":
        return <SceneCompteurs key={i} s={s} t={t} z={z} />;
      case "orbite":
        return <SceneOrbite key={i} s={s} t={t} z={z} />;
    }
  };

  const g = gros !== null;
  return (
    <AbsoluteFill style={{ background: c.fond === "blanc" ? c.couleurs.papier : c.couleurs.noir }}>
      {!g && <FondPage c={c} />}
      {!g && (
        <div style={{ position: "absolute", inset: 0, transform: `translateY(${decale}px) scale(${k})`, transformOrigin: `50% ${centreAvant}px` }}>
          {scenes.map(rendre)}
        </div>
      )}

      {/* Gros plan : votre photo de fond en plein écran (pas votre vrai décor) */}
      {g && cadrePhoto && (
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

      {/* Le cadre : coins arrondis, photo en « cover », légèrement floutée */}
      {!g && (
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
      )}

      {/* Vous : une seule balise vidéo, qui change de taille (pas de saut de lecture à la coupe) */}
      {personne && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: g ? `scale(${gZoom})` : undefined,
            transformOrigin: "50% 30%",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: g ? gx0 : x0,
              top: g ? gy0 : y0,
              width: g ? gvw : vw,
              height: g ? gvh : vh,
              ...(g ? {} : fondu),
            }}
          >
            <OffthreadVideo src={staticFile(personne)} transparent muted style={{ width: "100%", height: "100%" }} />
          </div>
        </div>
      )}

      {/* Le titre du haut disparaît pendant les gros plans */}
      {!g && <TitreFixe c={c} t={t} />}
      {audio && <Audio src={staticFile(audio)} />}
      {c.sous_titres.actif && <SousTitres mots={mots} c={c} gros={g ? { taille: gp.taille, y: gp.y } : undefined} />}
    </AbsoluteFill>
  );
};
