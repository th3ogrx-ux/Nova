import React from "react";
import { AbsoluteFill, interpolate, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FondTableau } from "./Fonds";
import { SousTitres } from "./SousTitres";
import { SceneComparaison, SceneFin, SceneListe, SceneScore, SceneTitre } from "./scenes";
import { ACCENT_DEFAUT, CARTE, Theme, themeDe } from "./theme";
import type { Scene } from "./types";
import type { MontageProps } from "./types";

const Contenu: React.FC<{ s: Scene; t: Theme }> = ({ s, t }) => {
  switch (s.type) {
    case "titre":
      return <SceneTitre s={s} t={t} />;
    case "comparaison":
      return <SceneComparaison s={s} t={t} />;
    case "liste":
      return <SceneListe s={s} t={t} />;
    case "score":
      return <SceneScore s={s} t={t} />;
    case "fin":
      return <SceneFin s={s} t={t} />;
  }
};

/** Mode « silhouette » : la vidéo est déjà découpée et placée en bas par composer.py. */
const MontageSilhouette: React.FC<MontageProps> = ({ fond, base, textes, mots }) => {
  const { fps } = useVideoConfig();
  const t = themeDe(fond, textes.accent ?? ACCENT_DEFAUT);
  const masquer: Array<[number, number]> = textes.scenes
    .filter((s) => s.type === "fin")
    .map((s) => [Math.round(s.debut * fps), Math.round((s.debut + s.duree) * fps)]);
  return (
    <AbsoluteFill style={{ background: t.clair ? "#FFFFFF" : "#0B0B0D" }}>
      {base && <OffthreadVideo src={staticFile(base)} style={{ width: "100%", height: "100%" }} />}
      {textes.scenes.map((s, i) => (
        <Contenu key={i} s={s} t={t} />
      ))}
      {(textes.sousTitres?.actif ?? true) && <SousTitres mots={mots} t={t} masquer={masquer} y={840} taille={78} />}
    </AbsoluteFill>
  );
};

/**
 * Mode « carte » (par défaut) :
 *  - pendant une scène : écran divisé. Tableau animé en haut (papier clair / noir en alternance),
 *    sous-titres sur la couture, vous dans une carte arrondie en bas ;
 *  - entre les scènes : plan caméra plein écran, avec un zoom qui alterne à chaque coupe ;
 *  - les coupes sont sèches, comme sur TikTok.
 */
const MontageCarte: React.FC<MontageProps> = ({ camera, ratio, cadrage, textes, mots }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  const accent = textes.accent ?? ACCENT_DEFAUT;

  const tableaux = textes.scenes.filter((s) => s.type !== "fin");
  const fin = textes.scenes.find((s) => s.type === "fin" && sec >= s.debut && sec < s.debut + s.duree);
  const idx = tableaux.findIndex((s) => sec >= s.debut && sec < s.debut + s.duree);
  const actif = idx >= 0 ? tableaux[idx] : null;

  // Grand fond blanc par défaut ; une scène peut demander "fond": "sombre" dans textes.json.
  const clair = actif ? actif.fond !== "sombre" : false;
  const t = themeDe(actif ? (clair ? "blanc" : "sombre") : "sombre", accent);

  // Plein écran : quel « plan » sommes-nous ? (sert à alterner le zoom à chaque coupe)
  const coupes = tableaux.flatMap((s) => [s.debut, s.debut + s.duree]).filter((x) => x <= sec).length;
  const debutPlan = Math.max(0, ...tableaux.flatMap((s) => [s.debut, s.debut + s.duree]).filter((x) => x <= sec));
  const duree = Math.max(1, (tableaux.map((s) => s.debut).filter((x) => x > sec)[0] ?? sec + 4) - debutPlan);
  const zoom =
    coupes % 4 === 0
      ? interpolate(sec - debutPlan, [0, duree], [1.0, 1.1], { extrapolateRight: "clamp" })
      : interpolate(sec - debutPlan, [0, duree], [1.14, 1.04], { extrapolateRight: "clamp" });

  const split = actif !== null;
  const L = 1080, H = 1920;
  const cw = split ? CARTE.width : L;
  const ch = split ? CARTE.height : H;
  // la vidéo remplit la carte (comme « cover »), centrée sur le visage via `cadrage`
  const vw = Math.max(cw, ch / ratio);
  const vh = vw * ratio;
  const decalY = split ? Math.max(ch - vh, Math.min(0, ch / 2 - cadrage * vh)) : (H - vh) / 2;
  const decalX = (cw - vw) / 2;

  const contenuSousTitres = (textes.sousTitres?.actif ?? true) && !fin;
  // Plein écran : tout en blanc (un mot rouge se lit mal sur une vidéo) ; sur le tableau : mot dit en accent.
  const couleurSous: Theme = split ? t : { ...themeDe("sombre", "#FFFFFF") };

  return (
    <AbsoluteFill style={{ background: "#0A0A0C" }}>
      {split && <FondTableau clair={clair} />}

      {/* La vidéo : une seule balise, qui change de cadre → pas de saut de lecture à la coupe. */}
      <div
        style={{
          position: "absolute",
          left: split ? CARTE.left : 0,
          top: split ? CARTE.top : 0,
          width: cw,
          height: ch,
          borderRadius: split ? CARTE.radius : 0,
          overflow: "hidden",
          boxShadow: split ? (clair ? "0 24px 60px rgba(0,0,0,0.22)" : "0 24px 60px rgba(0,0,0,0.6)") : "none",
          border: split ? `2px solid ${clair ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.14)"}` : "none",
        }}
      >
        {camera && (
          <OffthreadVideo
            src={staticFile(camera)}
            style={{
              position: "absolute",
              left: decalX,
              top: decalY,
              width: vw,
              height: vh,
              transform: split ? undefined : `scale(${zoom})`,
              transformOrigin: "50% 40%",
            }}
          />
        )}
      </div>

      {actif && <Contenu s={actif} t={t} />}
      {fin && <Contenu s={fin} t={t} />}

      {contenuSousTitres && (
        <SousTitres mots={mots} t={couleurSous} masquer={[]} y={split ? 1190 : 1250} taille={split ? 56 : 62} />
      )}
    </AbsoluteFill>
  );
};

export const Montage: React.FC<MontageProps> = (props) =>
  props.mode === "silhouette" ? <MontageSilhouette {...props} /> : <MontageCarte {...props} />;
