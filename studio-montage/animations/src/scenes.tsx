import React from "react";
import { interpolate } from "remotion";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";
import "@fontsource/poppins/latin-800.css";
import "@fontsource/playfair-display/latin-700-italic.css";
import { useScene, useDecale } from "./anim";
import { FONT, FONT_SERIF, MARGE, L, Theme } from "./theme";
import type { Scene } from "./types";

type Zone = { top: number; bottom: number };
type P<T extends Scene["type"]> = { s: Extract<Scene, { type: T }>; t: Theme; z: Zone };

const zoneStyle = (z: Zone): React.CSSProperties => ({
  position: "absolute",
  left: MARGE,
  right: MARGE,
  top: z.top,
  height: z.bottom - z.top,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  fontFamily: FONT,
});
const racine = (opacite: number): React.CSSProperties => ({ position: "absolute", inset: 0, opacity: opacite });

/** Titre : texte en Poppins, mot clé en serif italique rouge, petite barre rouge qui s'étire. */
export const SceneTitre: React.FC<P<"titre">> = ({ s, t, z }) => {
  const a = useScene(s.debut, s.duree);
  if (!a) return null;
  return (
    <div style={racine(a.opacite)}>
      <div style={zoneStyle(z)}>
        <div
          style={{
            fontSize: 112,
            fontWeight: 800,
            lineHeight: 1.06,
            color: t.texte,
            letterSpacing: -2,
            transform: `translateY(${(1 - a.entree) * 50}px)`,
          }}
        >
          {s.texte}
        </div>
        {s.italique && (
          <div
            style={{
              fontFamily: FONT_SERIF,
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 104,
              lineHeight: 1.1,
              color: t.accent,
              marginTop: 6,
              opacity: Math.max(0, a.entree * 1.6 - 0.5),
              transform: `translateY(${(1 - a.entree) * 40}px)`,
            }}
          >
            {s.italique}
          </div>
        )}
        <div style={{ height: 10, width: 150 * Math.min(1, a.entree * 1.2), borderRadius: 5, background: t.accent, marginTop: 34 }} />
        {s.sousTitre && (
          <div style={{ fontSize: 46, fontWeight: 400, color: t.doux, marginTop: 26, opacity: Math.max(0, a.entree * 1.5 - 0.5) }}>
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
        padding: "36px 26px",
        transform: `translateY(${(1 - e) * 60}px)`,
        opacity: e,
        boxShadow: t.clair ? "0 14px 40px rgba(0,0,0,0.10)" : "none",
      }}
    >
      <div style={{ fontSize: 56, fontWeight: 800, color: fort ? t.accent : t.texte, lineHeight: 1.1 }}>{nom}</div>
      <div style={{ height: 4, width: 60, background: t.accent, margin: "18px 0 20px" }} />
      {points.map((p, i) => (
        <div key={i} style={{ fontSize: 36, color: t.texte, lineHeight: 1.28, marginBottom: 12, fontWeight: 600 }}>
          {p}
        </div>
      ))}
    </div>
  );
};

/** Comparaison « A contre B ». */
export const SceneComparaison: React.FC<P<"comparaison">> = ({ s, t, z }) => {
  const a = useScene(s.debut, s.duree);
  if (!a) return null;
  const vs = useDecale(a.local, a.fps, 2, 9);
  return (
    <div style={racine(a.opacite)}>
      <div style={zoneStyle(z)}>
        {s.titre && (
          <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontWeight: 700, fontSize: 60, color: t.texte, marginBottom: 32, textAlign: "center", lineHeight: 1.1 }}>
            {s.titre}
          </div>
        )}
        <div style={{ display: "flex", gap: 22, alignItems: "stretch", position: "relative" }}>
          <Carte t={t} nom={s.a.nom} points={s.a.points} local={a.local} fps={a.fps} index={0} />
          <Carte t={t} nom={s.b.nom} points={s.b.points} local={a.local} fps={a.fps} index={1} fort />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 92,
              height: 92,
              marginLeft: -46,
              marginTop: -46,
              borderRadius: "50%",
              background: t.accent,
              color: "#fff",
              fontSize: 34,
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

/** Liste : les lignes se construisent l'une après l'autre. */
export const SceneListe: React.FC<P<"liste">> = ({ s, t, z }) => {
  const a = useScene(s.debut, s.duree);
  if (!a) return null;
  return (
    <div style={racine(a.opacite)}>
      <div style={zoneStyle(z)}>
        <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontWeight: 700, fontSize: 84, color: t.texte, marginBottom: 40, lineHeight: 1.1 }}>
          {s.titre}
        </div>
        {s.elements.map((el, i) => {
          const e = useDecale(a.local, a.fps, i + 1, 9);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 24, opacity: e, transform: `translateX(${(1 - e) * -60}px)` }}>
              <div style={{ flex: "0 0 66px", height: 66, borderRadius: "50%", background: t.accent, color: "#fff", fontSize: 34, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {i + 1}
              </div>
              <div style={{ fontSize: 50, fontWeight: 600, color: t.texte, lineHeight: 1.15 }}>{el}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Courbe qui se dessine, avec des points qui apparaissent au passage du tracé. */
export const SceneCourbe: React.FC<P<"courbe">> = ({ s, t, z }) => {
  const a = useScene(s.debut, s.duree);
  if (!a) return null;
  const W = L - 2 * MARGE;
  const Ht = 420;
  const pad = 26;
  const max = Math.max(...s.points, 1);
  const n = s.points.length;
  const xy = s.points.map((v, i) => [pad + (i / Math.max(1, n - 1)) * (W - 2 * pad), Ht - pad - (v / max) * (Ht - 2 * pad)] as const);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const aire = `${d} L ${xy[n - 1][0]} ${Ht - pad} L ${xy[0][0]} ${Ht - pad} Z`;
  const p = interpolate(a.local, [6, a.fps * 1.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ease = 1 - Math.pow(1 - p, 3);
  return (
    <div style={racine(a.opacite)}>
      <div style={zoneStyle(z)}>
        <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontWeight: 700, fontSize: 70, color: t.texte, marginBottom: 30, lineHeight: 1.1 }}>
          {s.titre}
        </div>
        <svg width={W} height={Ht + 50} viewBox={`0 0 ${W} ${Ht + 50}`} style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id="aire-courbe" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={t.accent} stopOpacity="0.28" />
              <stop offset="100%" stopColor={t.accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((k) => (
            <line key={k} x1={pad} x2={W - pad} y1={pad + (k / 3) * (Ht - 2 * pad)} y2={pad + (k / 3) * (Ht - 2 * pad)} stroke={t.piste} strokeWidth={2} />
          ))}
          <path d={aire} fill="url(#aire-courbe)" opacity={ease} />
          <path d={d} fill="none" stroke={t.accent} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ease} />
          {xy.map(([x, y], i) => {
            const vu = Math.max(0, Math.min(1, ease * (n - 1) - (i - 0.4)));
            return <circle key={i} cx={x} cy={y} r={14 * vu} fill={t.clair ? "#fff" : "#111"} stroke={t.accent} strokeWidth={6} />;
          })}
          {(s.libelles ?? []).map((l, i) => (
            <text key={i} x={xy[i]?.[0] ?? 0} y={Ht + 40} textAnchor="middle" fontFamily={FONT} fontWeight={600} fontSize={32} fill={t.doux}>
              {l}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
};

/** Barres de score qui se remplissent. */
export const SceneScore: React.FC<P<"score">> = ({ s, t, z }) => {
  const a = useScene(s.debut, s.duree);
  if (!a) return null;
  return (
    <div style={racine(a.opacite)}>
      <div style={zoneStyle(z)}>
        <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontWeight: 700, fontSize: 78, color: t.texte, marginBottom: 46, lineHeight: 1.1 }}>
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
