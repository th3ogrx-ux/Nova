import React from "react";
import { staticFile } from "remotion";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";
import "@fontsource/poppins/latin-800.css";
import { useScene, useDecale } from "./anim";
import { FONT, HAUT, MARGE, Theme } from "./theme";
import type { Scene } from "./types";

const zone: React.CSSProperties = {
  position: "absolute",
  left: MARGE,
  right: MARGE,
  top: HAUT.top,
  height: HAUT.bottom - HAUT.top,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  fontFamily: FONT,
};

const voile = (_t: Theme): React.CSSProperties => ({});

/** Titre : grand texte qui monte, petite barre rouge qui s'étire. */
export const SceneTitre: React.FC<{
  s: Extract<Scene, { type: "titre" }>;
  t: Theme;
}> = ({ s, t }) => {
  const a = useScene(s.debut, s.duree);
  if (!a) return null;
  const barre = Math.min(1, a.entree * 1.2);
  return (
    <div style={{ position: "absolute", inset: 0, ...voile(t), opacity: a.opacite }}>
      <div style={zone}>
        <div
          style={{
            fontSize: 124,
            fontWeight: 800,
            lineHeight: 1.08,
            color: t.texte,
            letterSpacing: -2,
            transform: `translateY(${(1 - a.entree) * 50}px)`,
          }}
        >
          {s.texte}
        </div>
        <div
          style={{
            height: 10,
            width: 150 * barre,
            borderRadius: 5,
            background: t.accent,
            marginTop: 34,
          }}
        />
        {s.sousTitre && (
          <div
            style={{
              fontSize: 50,
              fontWeight: 400,
              color: t.doux,
              marginTop: 28,
              opacity: Math.max(0, a.entree * 1.5 - 0.5),
            }}
          >
            {s.sousTitre}
          </div>
        )}
      </div>
    </div>
  );
};

const Carte: React.FC<{
  t: Theme;
  nom: string;
  points: string[];
  local: number;
  fps: number;
  index: number;
  fort?: boolean;
}> = ({ t, nom, points, local, fps, index, fort }) => {
  const e = useDecale(local, fps, index, 9);
  return (
    <div
      style={{
        flex: 1,
        background: t.carte,
        border: `2px solid ${fort ? t.accent : t.bordure}`,
        borderRadius: 34,
        padding: "38px 28px",
        transform: `translateY(${(1 - e) * 60}px)`,
        opacity: e,
        boxShadow: t.clair ? "0 14px 40px rgba(0,0,0,0.10)" : "none",
      }}
    >
      <div style={{ fontSize: 62, fontWeight: 800, color: fort ? t.accent : t.texte, lineHeight: 1.1 }}>
        {nom}
      </div>
      <div style={{ height: 4, width: 60, background: t.accent, margin: "20px 0 22px" }} />
      {points.map((p, i) => (
        <div key={i} style={{ fontSize: 40, color: t.texte, lineHeight: 1.3, marginBottom: 14, fontWeight: 600 }}>
          {p}
        </div>
      ))}
    </div>
  );
};

/** Comparaison « A contre B ». */
export const SceneComparaison: React.FC<{
  s: Extract<Scene, { type: "comparaison" }>;
  t: Theme;
}> = ({ s, t }) => {
  const a = useScene(s.debut, s.duree);
  if (!a) return null;
  const vs = useDecale(a.local, a.fps, 2, 9);
  return (
    <div style={{ position: "absolute", inset: 0, ...voile(t), opacity: a.opacite }}>
      <div style={zone}>
        {s.titre && (
          <div style={{ fontSize: 54, fontWeight: 700, color: t.doux, marginBottom: 34, textAlign: "center" }}>
            {s.titre}
          </div>
        )}
        <div style={{ display: "flex", gap: 24, alignItems: "stretch", position: "relative" }}>
          <Carte t={t} nom={s.a.nom} points={s.a.points} local={a.local} fps={a.fps} index={0} />
          <Carte t={t} nom={s.b.nom} points={s.b.points} local={a.local} fps={a.fps} index={1} fort />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 96,
              height: 96,
              marginLeft: -48,
              marginTop: -48,
              borderRadius: "50%",
              background: t.accent,
              color: "#fff",
              fontSize: 36,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${vs})`,
              boxShadow: "0 8px 24px rgba(229,48,58,0.45)",
            }}
          >
            VS
          </div>
        </div>
      </div>
    </div>
  );
};

/** Liste : les lignes arrivent l'une après l'autre. */
export const SceneListe: React.FC<{
  s: Extract<Scene, { type: "liste" }>;
  t: Theme;
}> = ({ s, t }) => {
  const a = useScene(s.debut, s.duree);
  if (!a) return null;
  return (
    <div style={{ position: "absolute", inset: 0, ...voile(t), opacity: a.opacite }}>
      <div style={zone}>
        <div style={{ fontSize: 80, fontWeight: 800, color: t.texte, marginBottom: 44, lineHeight: 1.1 }}>
          {s.titre}
        </div>
        {s.elements.map((el, i) => {
          const e = useDecale(a.local, a.fps, i + 1, 8);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                marginBottom: 22,
                opacity: e,
                transform: `translateX(${(1 - e) * -60}px)`,
              }}
            >
              <div
                style={{
                  flex: "0 0 70px",
                  height: 70,
                  borderRadius: "50%",
                  background: t.accent,
                  color: "#fff",
                  fontSize: 36,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {i + 1}
              </div>
              <div style={{ fontSize: 54, fontWeight: 600, color: t.texte, lineHeight: 1.15 }}>{el}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Barres de score qui se remplissent. */
export const SceneScore: React.FC<{
  s: Extract<Scene, { type: "score" }>;
  t: Theme;
}> = ({ s, t }) => {
  const a = useScene(s.debut, s.duree);
  if (!a) return null;
  return (
    <div style={{ position: "absolute", inset: 0, ...voile(t), opacity: a.opacite }}>
      <div style={zone}>
        <div style={{ fontSize: 74, fontWeight: 800, color: t.texte, marginBottom: 50, lineHeight: 1.1 }}>
          {s.titre}
        </div>
        {s.elements.map((el, i) => {
          const e = useDecale(a.local, a.fps, i + 1, 10);
          const max = el.max ?? 10;
          const part = Math.max(0, Math.min(1, el.valeur / max));
          return (
            <div key={i} style={{ marginBottom: 34, opacity: Math.min(1, e * 2) }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 46, fontWeight: 600, color: t.texte, marginBottom: 14 }}>
                <span>{el.nom}</span>
                <span style={{ color: t.accent, fontWeight: 800 }}>
                  {(el.valeur * e).toFixed(Number.isInteger(el.valeur) ? 0 : 1)}/{max}
                </span>
              </div>
              <div style={{ height: 28, borderRadius: 14, background: t.piste, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${part * e * 100}%`, borderRadius: 14, background: t.accent }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Écran de fin plein écran avec le logo. */
export const SceneFin: React.FC<{
  s: Extract<Scene, { type: "fin" }>;
  t: Theme;
}> = ({ s, t }) => {
  const a = useScene(s.debut, s.duree);
  if (!a) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: t.clair ? "#FFFFFF" : "#0B0B0D",
        opacity: Math.min(1, a.entree * 2) * (a.local > 0 ? 1 : 0),
        fontFamily: FONT,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: `0 ${MARGE}px`,
        textAlign: "center",
      }}
    >
      <div style={{ transform: `scale(${0.8 + a.entree * 0.2})`, opacity: a.entree }}>
        {s.logo ? (
          <img src={staticFile(s.logo)} style={{ maxWidth: 520, maxHeight: 360, objectFit: "contain" }} />
        ) : (
          <div style={{ width: 180, height: 180, borderRadius: "50%", background: t.accent }} />
        )}
      </div>
      <div style={{ fontSize: 70, fontWeight: 800, color: t.texte, marginTop: 60, lineHeight: 1.12, opacity: a.entree }}>
        {s.texte}
      </div>
      <div style={{ height: 10, width: 150 * a.entree, borderRadius: 5, background: t.accent, marginTop: 36 }} />
    </div>
  );
};
