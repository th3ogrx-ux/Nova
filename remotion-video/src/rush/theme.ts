export const ICE = {
  mint: "#BFFFE3",
  green: "#7CF5C0",
  glow: "rgba(92, 240, 180, 0.55)",
  glass: "rgba(205, 255, 232, 0.16)",
  glassStrong: "rgba(205, 255, 232, 0.26)",
  border: "rgba(225, 255, 242, 0.5)",
  text: "#F4FFF9",
  dark: "rgba(4, 28, 20, 0.55)",
};

export const FONT =
  '"SF Pro Display", "Inter", "Helvetica Neue", Arial, sans-serif';

export const glassStyle: React.CSSProperties = {
  background: `linear-gradient(135deg, ${ICE.glassStrong}, ${ICE.glass})`,
  backdropFilter: "blur(26px) saturate(190%)",
  WebkitBackdropFilter: "blur(26px) saturate(190%)",
  border: `2px solid ${ICE.border}`,
  boxShadow: `0 10px 50px rgba(0,0,0,0.35), 0 0 60px ${ICE.glow}, inset 0 2px 0 rgba(255,255,255,0.55), inset 0 -2px 0 rgba(120,255,200,0.25)`,
};
