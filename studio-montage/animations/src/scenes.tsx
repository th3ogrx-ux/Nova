import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";
import "@fontsource/poppins/latin-800.css";
import "@fontsource/playfair-display/latin-700-italic.css";
import { useScene, useDecale, useRebond } from "./anim";
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
type Anim = NonNullable<ReturnType<typeof useScene>>;
/** Calque d'une scène : un lent zoom et une petite flottaison pour que rien ne soit jamais figé. */
export const racine = (a: Anim): React.CSSProperties => ({
  position: "absolute",
  inset: 0,
  opacity: a.opacite,
  transform: `translateY(${Math.sin(a.local / 14) * 5}px) scale(${1 + 0.05 * a.progres})`,
});

/** Titre : texte gras, mot sur une barre rouge qui balaie, mot en serif italique rouge. */
export const SceneTitre: React.FC<P<"titre">> = ({ s, t, z }) => {
  const a = useScene(s.debut, s.duree);
  if (!a) return null;
  const balai = useRebond(a.local, a.fps, 5);
  const secousse = s.secousse && a.local < 14 ? Math.sin(a.local * 2.6) * 12 * (1 - a.local / 14) : 0;
  const reveal = Math.max(0, Math.min(1, balai));
  return (
    <div style={racine(a)}>
      <div style={{ ...zoneStyle(z), transform: `translateX(${secousse}px)` }}>
        <div
          style={{
            fontSize: 108,
            fontWeight: 800,
            lineHeight: 1.06,
            color: t.texte,
            letterSpacing: -2,
            transform: `translateY(${(1 - a.entree) * 60}px)`,
          }}
        >
          {s.texte}
        </div>
        {s.surligne && (
          <div style={{ marginTop: 12, alignSelf: "flex-start" }}>
            <div
              style={{
                display: "inline-block",
                background: t.accent,
                color: "#fff",
                fontSize: 108,
                fontWeight: 800,
                lineHeight: 1.08,
                letterSpacing: -2,
                padding: "2px 26px 8px",
                transform: "rotate(-1.4deg)",
                clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0)`,
                boxShadow: "0 14px 34px rgba(229,48,58,0.35)",
              }}
            >
              {s.surligne}
            </div>
          </div>
        )}
        {s.italique && (
          <div
            style={{
              fontFamily: FONT_SERIF,
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 104,
              lineHeight: 1.1,
              color: t.accent,
              marginTop: 8,
              opacity: Math.max(0, a.entree * 1.6 - 0.4),
              transform: `translateY(${(1 - a.entree) * 50}px)`,
            }}
          >
            {s.italique}
          </div>
        )}
        {!s.surligne && (
          <div style={{ height: 10, width: 150 * Math.min(1, a.entree * 1.2), borderRadius: 5, background: t.accent, marginTop: 30 }} />
        )}
        {s.sousTitre && (
          <div style={{ fontSize: 50, fontWeight: 600, color: t.doux, marginTop: 28, opacity: Math.max(0, a.entree * 1.5 - 0.5) }}>
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
    <div style={racine(a)}>
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
    <div style={racine(a)}>
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

/** Courbe lisse qui se dessine, avec des points lumineux qui pulsent. */
export const SceneCourbe: React.FC<P<"courbe">> = ({ s, t, z }) => {
  const a = useScene(s.debut, s.duree);
  if (!a) return null;
  const W = L - 2 * MARGE;
  const Ht = 440;
  const pad = 34;
  const gauche = 40;
  const max = Math.max(...s.points, 1);
  const n = s.points.length;
  const xy = s.points.map(
    (v, i) => [gauche + pad + (i / Math.max(1, n - 1)) * (W - gauche - 2 * pad), Ht - pad - (v / max) * (Ht - 2 * pad)] as const,
  );
  // courbe lisse (Catmull-Rom → Bézier)
  let d = `M ${xy[0][0].toFixed(1)} ${xy[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = xy[i - 1] ?? xy[i], p1 = xy[i], p2 = xy[i + 1], p3 = xy[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  const aire = `${d} L ${xy[n - 1][0]} ${Ht - pad} L ${xy[0][0]} ${Ht - pad} Z`;
  const p = interpolate(a.local, [4, a.fps * 1.3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ease = 1 - Math.pow(1 - p, 3);
  const fin = useRebond(a.local, a.fps, Math.round(a.fps * 1.3));
  return (
    <div style={racine(a)}>
      <div style={zoneStyle(z)}>
        <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontWeight: 700, fontSize: 68, color: t.texte, marginBottom: 26, lineHeight: 1.1 }}>
          {s.titre}
        </div>
        <svg width={W} height={Ht + 70} viewBox={`0 0 ${W} ${Ht + 70}`} style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id="aire-courbe" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={t.accent} stopOpacity="0.30" />
              <stop offset="100%" stopColor={t.accent} stopOpacity="0" />
            </linearGradient>
            <filter id="lueur-courbe" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="7" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* axes */}
          <line x1={gauche} x2={gauche} y1={0} y2={Ht - pad + 8} stroke={t.texte} strokeWidth={4} strokeLinecap="round" />
          <line x1={gauche} x2={W} y1={Ht - pad + 8} y2={Ht - pad + 8} stroke={t.texte} strokeWidth={4} strokeLinecap="round" />
          {[1, 2, 3].map((k) => (
            <line key={k} x1={gauche} x2={W} y1={(k / 4) * (Ht - pad)} y2={(k / 4) * (Ht - pad)} stroke={t.piste} strokeWidth={2} strokeDasharray="6 10" />
          ))}
          <path d={aire} fill="url(#aire-courbe)" opacity={ease} />
          <path d={d} fill="none" stroke={t.accent} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ease} filter="url(#lueur-courbe)" />
          {xy.map(([x, y], i) => {
            const vu = Math.max(0, Math.min(1, ease * (n - 1) - (i - 0.4)));
            const pulse = ((a.local + i * 7) % 36) / 36;
            return (
              <g key={i}>
                {vu > 0.9 && <circle cx={x} cy={y} r={14 + pulse * 22} fill="none" stroke={t.accent} strokeWidth={3} opacity={(1 - pulse) * 0.6} />}
                <circle cx={x} cy={y} r={15 * vu} fill="#fff" stroke={t.accent} strokeWidth={7} />
              </g>
            );
          })}
          {(s.libelles ?? []).map((l, i) => (
            <text key={i} x={xy[i]?.[0] ?? 0} y={Ht + 34} textAnchor="middle" fontFamily={FONT} fontWeight={600} fontSize={30} fill={t.doux}>
              {l}
            </text>
          ))}
          {s.axeX && (
            <text x={W / 2} y={Ht + 68} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={30} fill={t.texte}>{s.axeX}</text>
          )}
          {s.axeY && (
            <text transform={`translate(8, ${(Ht - pad) / 2}) rotate(-90)`} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={30} fill={t.texte}>{s.axeY}</text>
          )}
          {s.etiquetteFinale && (
            <g transform={`translate(${xy[n - 1][0] - 70}, ${xy[n - 1][1] - 74}) scale(${fin})`} style={{ transformOrigin: "70px 30px" }}>
              <rect width={140} height={56} rx={14} fill={t.accent} />
              <text x={70} y={39} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={34} fill="#fff">{s.etiquetteFinale}</text>
            </g>
          )}
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
    <div style={racine(a)}>
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
