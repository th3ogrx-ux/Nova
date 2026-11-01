import React from "react";
import { interpolate } from "remotion";
import { Icone } from "./Icones";
import { racine } from "./scenes";
import { useDecale, useRebond, useScene } from "./anim";
import { FONT, FONT_SERIF, L, MARGE, Theme } from "./theme";
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
  alignItems: "center",
  fontFamily: FONT,
});

const sousTitre = (t: Theme, txt: string): React.ReactNode => (
  <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontWeight: 700, fontSize: 56, color: t.texte, marginBottom: 26, textAlign: "center", lineHeight: 1.1 }}>
    {txt}
  </div>
);

/** 58000 → « 58K », 29000000 → « 29M ». */
const compact = (v: number) => {
  if (v >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(".", ",")}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1).replace(".", ",")}K`;
  return String(Math.round(v));
};
const espaces = (v: number) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** Faux profil Instagram : une tuile décolle, grossit et compte ses vues. */
export const SceneProfil: React.FC<P<"profil">> = ({ s, t, z }) => {
  const a = useScene(s.debut, s.duree);
  if (!a) return null;
  const CW = 700, gap = 14, pad = 26;
  const gridW = CW - 2 * pad;
  const tw = (gridW - 2 * gap) / 3, th = tw * 1.28;
  const decol = interpolate(a.local, [a.fps * 0.45, a.fps * 0.95], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dec = 1 - Math.pow(1 - decol, 3);
  const compte = interpolate(decol, [0, 1], [0, 1]);
  const abo = s.abonnes ? s.abonnes.de + (s.abonnes.a - s.abonnes.de) * dec : 842;
  const ent = useRebond(a.local, a.fps, 2);
  const v = s.vedette;
  const col = v.index % 3, ligne = Math.floor(v.index / 3);
  const dx = -((col - 1) * (tw + gap)) * dec;
  const dy = -((ligne - 0.5) * (th + gap)) * dec;
  const bleu = "#3B82F6";
  return (
    <div style={racine(a)}>
      <div style={{ ...zoneStyle(z), transform: "scale(0.82)" }}>
        {s.titre && sousTitre(t, s.titre)}
        <div
          style={{
            width: CW,
            background: "#fff",
            border: "4px solid #111",
            borderRadius: 44,
            padding: `${pad}px`,
            boxShadow: "0 26px 60px rgba(0,0,0,0.18)",
            transform: `scale(${0.86 + 0.14 * Math.min(1, ent)})`,
            opacity: Math.min(1, ent * 1.5),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontWeight: 700, fontSize: 34, color: "#111", marginBottom: 18 }}>
            {s.compte ?? "ton_compte"}
            <span style={{ width: 34, height: 34, borderRadius: "50%", background: bleu, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Icone nom="check" size={22} color="#fff" epaisseur={3.2} />
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
            <div style={{ width: 118, height: 118, borderRadius: "50%", padding: 6, background: `conic-gradient(${t.accent}, #FF9F1C, ${t.accent})`, flex: "0 0 118px" }}>
              <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icone nom="bolt" size={58} color={t.accent} epaisseur={2} />
              </div>
            </div>
            {[["37", "posts"], [espaces(abo), "abonnés"], ["12", "suivis"]].map(([n, l], i) => (
              <div key={i} style={{ textAlign: "center", flex: 1 }}>
                <div style={{ fontSize: 40, fontWeight: 800, color: i === 1 && s.abonnes ? t.accent : "#111" }}>{n}</div>
                <div style={{ fontSize: 26, color: "#6b6b70", fontWeight: 600 }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 14, margin: "20px 0 18px" }}>
            <div style={{ flex: 2, background: bleu, color: "#fff", fontSize: 28, fontWeight: 700, textAlign: "center", padding: "12px 0", borderRadius: 14 }}>Suivre</div>
            <div style={{ flex: 2, background: "#EFEFF0", color: "#111", fontSize: 28, fontWeight: 700, textAlign: "center", padding: "12px 0", borderRadius: 14 }}>Message</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(3, ${tw}px)`, gap, position: "relative" }}>
            {s.tuiles.slice(0, 6).map((txt, i) => {
              const e = useDecale(a.local, a.fps, i % 3, 4);
              const vedette = i === v.index;
              const scale = vedette ? 1 + 0.82 * dec : 1;
              const tuile: React.CSSProperties = {
                height: th,
                borderRadius: 16,
                position: "relative",
                transform: vedette ? `translate(${dx}px, ${dy}px) scale(${scale})` : `scale(${0.8 + 0.2 * e})`,
                opacity: vedette ? 1 : e * (1 - 0.65 * dec),
                zIndex: vedette ? 5 : 1,
                background: vedette ? `linear-gradient(160deg, #FF5A63, ${t.accent} 55%, #8E0F18)` : "#ECECED",
                boxShadow: vedette ? `0 0 ${20 + 40 * dec}px rgba(229,48,58,${0.35 + 0.35 * dec})` : "none",
                overflow: "hidden",
              };
              const label = vedette ? compact(v.valeur * compte) : txt;
              return (
                <div key={i} style={tuile}>
                  <div style={{ position: "absolute", left: 12, bottom: 10, display: "flex", alignItems: "center", gap: 6, color: vedette ? "#fff" : "#111", fontWeight: 800, fontSize: vedette ? 26 : 25 }}>
                    <Icone nom="eye" size={24} color={vedette ? "#fff" : "#111"} epaisseur={2.4} />
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

/** Cartes de chiffres qui comptent (portée, vues…). */
export const SceneCompteurs: React.FC<P<"compteurs">> = ({ s, t, z }) => {
  const a = useScene(s.debut, s.duree);
  if (!a) return null;
  const W = L - 2 * MARGE;
  return (
    <div style={racine(a)}>
      <div style={zoneStyle(z)}>
        {s.titre && sousTitre(t, s.titre)}
        <div style={{ width: W, display: "flex", flexDirection: "column", gap: 24 }}>
          {s.elements.map((el, i) => {
            const e = useRebond(a.local, a.fps, i * 7);
            const compte = interpolate(a.local, [i * 7 + 4, i * 7 + a.fps * 1.1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const val = el.valeur * (1 - Math.pow(1 - compte, 3));
            const pulse = el.fort ? 1 + Math.sin(a.local / 4) * 0.012 : 1;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 26,
                  background: "#fff",
                  border: `4px solid ${el.fort ? t.accent : "#111"}`,
                  borderRadius: 30,
                  padding: "26px 30px",
                  boxShadow: el.fort ? `0 0 ${30 + Math.sin(a.local / 4) * 10}px rgba(229,48,58,0.45)` : "0 16px 40px rgba(0,0,0,0.12)",
                  transform: `translateX(${(1 - Math.min(1, e)) * 700}px) scale(${pulse})`,
                  opacity: Math.min(1, e * 2),
                }}
              >
                <div style={{ width: 96, height: 96, borderRadius: "50%", background: el.fort ? t.accent : "#111", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 96px" }}>
                  <Icone nom={el.icone} size={50} color="#fff" epaisseur={2} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1, color: el.fort ? t.accent : "#111", letterSpacing: -2 }}>
                    {el.fort ? "+" : ""}
                    {espaces(val)}
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 600, color: "#55555a", marginTop: 6 }}>{el.nom}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/** Un libellé rouge au centre, des icônes qui tournent autour sur une orbite en perspective. */
export const SceneOrbite: React.FC<P<"orbite">> = ({ s, t, z }) => {
  const a = useScene(s.debut, s.duree);
  if (!a) return null;
  const W = L - 2 * MARGE;
  const H = z.bottom - z.top;
  const rx = W / 2 - 62, ry = 225;
  const cx = W / 2, cy = H / 2;
  const n = s.icones.length;
  const centre = useRebond(a.local, a.fps, 2);
  const vitesse = 0.045;
  const elems = s.icones.map((nom, i) => {
    const ang = (i / n) * Math.PI * 2 + a.local * vitesse;
    const profondeur = Math.sin(ang);
    const e = useDecale(a.local, a.fps, i, 4);
    return { nom, i, x: cx + rx * Math.cos(ang), y: cy + ry * profondeur, k: 0.78 + 0.28 * profondeur, derriere: profondeur < 0, e };
  });
  const pastille = (el: (typeof elems)[number]) => (
    <div
      key={el.i}
      style={{
        position: "absolute",
        left: el.x - 62,
        top: el.y - 62,
        width: 124,
        height: 124,
        borderRadius: "50%",
        background: "#fff",
        border: "4px solid #111",
        boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${el.k * Math.min(1, el.e)})`,
        opacity: el.derriere ? 0.6 : 1,
      }}
    >
      <Icone nom={el.nom} size={66} color={t.accent} epaisseur={2.1} />
    </div>
  );
  return (
    <div style={racine(a)}>
      <div style={{ ...zoneStyle(z), alignItems: "stretch" }}>
        <div style={{ position: "relative", width: W, height: H }}>
          <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="#111" strokeOpacity={0.45} strokeWidth={4} strokeDasharray="4 18" strokeLinecap="round" strokeDashoffset={-a.local * 2} />
          </svg>
          {elems.filter((e) => e.derriere).map(pastille)}
          <div style={{ position: "absolute", left: 0, right: 0, top: cy - 62, display: "flex", justifyContent: "center", transform: `scale(${Math.min(1, centre)})` }}>
            <div
              style={{
                background: t.accent,
                color: "#fff",
                fontWeight: 800,
                fontSize: s.centre.length > 14 ? 54 : 72,
                letterSpacing: -1.5,
                padding: "20px 50px 26px",
                borderRadius: 22,
                border: "4px solid #111",
                boxShadow: `0 0 ${34 + Math.sin(a.local / 5) * 12}px rgba(229,48,58,0.5)`,
                whiteSpace: "nowrap",
              }}
            >
              {s.centre}
            </div>
          </div>
          {elems.filter((e) => !e.derriere).map(pastille)}
          {s.sousTitre && (
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 4, textAlign: "center", fontSize: 44, fontWeight: 600, color: t.doux }}>{s.sousTitre}</div>
          )}
        </div>
      </div>
    </div>
  );
};
