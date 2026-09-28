import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { PhoneFrame, COLORS } from "./PhoneFrame";
import { SettingsMock, TapRipple, FingerTap } from "./SettingsMock";
import { BoxMailMock } from "./BoxMailMock";
import { AppShellMock } from "./AppShellMock";
import { Sparkles } from "./Sparkles";

const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 45) * 6;
  return (
    <AbsoluteFill
      style={{
        background: COLORS.bgDeep,
        backgroundImage: `radial-gradient(ellipse at ${20 + drift}% 25%, rgba(191,90,242,0.2), transparent 55%), radial-gradient(ellipse at ${82 - drift}% 75%, rgba(48,10,102,0.32), transparent 55%)`,
      }}
    >
      <Sparkles />
    </AbsoluteFill>
  );
};

// Punchy shake for the moment of impact: a few frames of decaying oscillation.
const punch = (frame: number, at: number, amp = 10, dur = 10) => {
  const t = frame - at;
  if (t < 0 || t > dur) return { x: 0, y: 0, scale: 1 };
  const decay = 1 - t / dur;
  const x = Math.sin(t * 2.4) * amp * decay;
  const scale = 1 + (t < dur * 0.35 ? (dur * 0.35 - t) / (dur * 0.35) : 0) * 0.045;
  return { x, y: 0, scale };
};

const Caption: React.FC<{ children: React.ReactNode; frame: number; from: number }> = ({
  children,
  frame,
  from,
}) => {
  const { fps } = useVideoConfig();
  const local = frame - from;
  const enter = spring({
    frame: local,
    fps,
    config: { damping: 11, stiffness: 220, mass: 0.6 },
    durationInFrames: 14,
  });
  const opacity = interpolate(local, [-1, 0, 100, 112], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(enter, [0, 1], [50, 0]);
  const scale = interpolate(enter, [0, 1], [0.7, 1]);

  if (opacity <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 90,
        left: 0,
        right: 0,
        textAlign: "center",
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        fontFamily: "Poppins, sans-serif",
      }}
    >
      <div
        style={{
          display: "inline-block",
          padding: "14px 30px",
          borderRadius: 999,
          background: "rgba(12,5,24,0.8)",
          border: `1px solid ${COLORS.warm1}88`,
          color: COLORS.metal2,
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "0.01em",
          boxShadow: `0 10px 40px rgba(0,0,0,0.55), 0 0 30px rgba(191,90,242,0.25)`,
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ---- Scene A: where to tap (hamburger -> settings gear) ----
const AppShellScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 11, stiffness: 200, mass: 0.7 },
    durationInFrames: 16,
  });
  const phoneOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phoneScale = interpolate(enter, [0, 1], [0.75, 1]);
  const phoneY = interpolate(enter, [0, 1], [90, 0]);

  const TAP_HAMBURGER = 20;
  const OPEN_START = TAP_HAMBURGER + 4;
  const OPEN_END = OPEN_START + 14;
  const TAP_GEAR = OPEN_END + 16;

  const hamburgerX = 35;
  const hamburgerY = 32;
  const gearX = 279;
  const gearY = 747;

  const hamburgerGlow = interpolate(
    frame,
    [TAP_HAMBURGER - 4, TAP_HAMBURGER + 4, TAP_HAMBURGER + 14],
    [0, 1, 0.3],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const sidebarProgress = interpolate(frame, [OPEN_START, OPEN_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const gearGlow = interpolate(
    frame,
    [TAP_GEAR - 4, TAP_GEAR + 4, TAP_GEAR + 14],
    [0, 1, 0.4],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const tapHamburgerProgress = interpolate(
    frame,
    [TAP_HAMBURGER, TAP_HAMBURGER + 5, TAP_HAMBURGER + 12],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const tapGearProgress = interpolate(
    frame,
    [TAP_GEAR, TAP_GEAR + 5, TAP_GEAR + 12],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const pressed = Math.max(tapHamburgerProgress, tapGearProgress);

  const fingerVisible = frame >= TAP_HAMBURGER - 8 && frame < TAP_GEAR + 14;
  const fingerX = interpolate(
    frame,
    [TAP_HAMBURGER - 8, TAP_HAMBURGER, OPEN_END, TAP_GEAR],
    [hamburgerX, hamburgerX, gearX, gearX],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const fingerY = interpolate(
    frame,
    [TAP_HAMBURGER - 8, TAP_HAMBURGER, OPEN_END, TAP_GEAR],
    [hamburgerY, hamburgerY, gearY, gearY],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const fingerOpacity = interpolate(
    frame,
    [TAP_HAMBURGER - 8, TAP_HAMBURGER - 3, TAP_GEAR + 10, TAP_GEAR + 16],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const shake1 = punch(frame, TAP_HAMBURGER, 8, 9);
  const shake2 = punch(frame, TAP_GEAR, 10, 10);
  const shakeX = shake1.x + shake2.x;
  const shakeScale = Math.max(shake1.scale, shake2.scale);

  const tapHamburgerRipple = interpolate(
    frame,
    [TAP_HAMBURGER, TAP_HAMBURGER + 22],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const tapGearRipple = interpolate(frame, [TAP_GEAR, TAP_GEAR + 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const sceneOutOpacity = interpolate(frame, [TAP_GEAR + 14, TAP_GEAR + 22], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sceneOutScale = interpolate(frame, [TAP_GEAR + 14, TAP_GEAR + 22], [1, 0.9], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        opacity: Math.min(phoneOpacity, sceneOutOpacity),
      }}
    >
      <div
        style={{
          transform: `translateY(${phoneY}px) scale(${
            phoneScale * shakeScale * sceneOutScale
          }) translateX(${shakeX}px)`,
          position: "relative",
        }}
      >
        <PhoneFrame>
          <AppShellMock
            sidebarProgress={sidebarProgress}
            hamburgerGlow={hamburgerGlow}
            gearGlow={gearGlow}
          />
          <div style={{ position: "absolute", inset: 0, zIndex: 999 }}>
            <TapRipple progress={tapHamburgerRipple} x={hamburgerX} y={hamburgerY} />
            <TapRipple progress={tapGearRipple} x={gearX} y={gearY} />
            {fingerVisible && (
              <div style={{ opacity: fingerOpacity }}>
                <FingerTap x={fingerX} y={fingerY} pressed={pressed} />
              </div>
            )}
          </div>
        </PhoneFrame>
      </div>
      <Caption frame={frame} from={0}>
        Où trouver Paramètres ?
      </Caption>
    </AbsoluteFill>
  );
};

// ---- Scene 1: Intro ----
const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 9, stiffness: 240, mass: 0.7 },
  });
  const logoScale = interpolate(logoSpring, [0, 1], [0.2, 1]);
  const logoRotate = interpolate(logoSpring, [0, 1], [-35, 0]);

  const titleSpring = spring({
    frame: frame - 8,
    fps,
    config: { damping: 10, stiffness: 260, mass: 0.6 },
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [30, 0]);
  const titleScale = interpolate(titleSpring, [0, 1], [0.8, 1]);

  const pulse = 1 + Math.sin(frame / 5) * 0.02;

  const exitScale = interpolate(frame, [30, 40], [1, 1.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitOpacity = interpolate(frame, [30, 40], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        opacity: exitOpacity,
        transform: `scale(${exitScale})`,
      }}
    >
      <Img
        src={staticFile("zenoa-icon.png")}
        style={{
          width: 150,
          height: 150,
          transform: `scale(${logoScale * pulse}) rotate(${logoRotate}deg)`,
          filter: "drop-shadow(0 0 40px rgba(191,90,242,0.65))",
        }}
      />
      <div
        style={{
          marginTop: 30,
          fontSize: 46,
          fontWeight: 800,
          color: COLORS.metal2,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px) scale(${titleScale})`,
          fontFamily: "Poppins, sans-serif",
          textAlign: "center",
        }}
      >
        Active tout en 10 secondes
      </div>
    </AbsoluteFill>
  );
};

// ---- Scene 2: Settings walkthrough ----
const SettingsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 11, stiffness: 200, mass: 0.7 },
    durationInFrames: 16,
  });
  const phoneOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phoneScale = interpolate(enter, [0, 1], [0.75, 1]);
  const phoneY = interpolate(enter, [0, 1], [90, 0]);
  const phoneRotate = interpolate(enter, [0, 1], [6, 0]);

  const TAP1 = 22;
  const TAP2 = 62;

  const tap1X = 190;
  const tap1Y = 331;
  const tap1Progress = interpolate(frame, [TAP1, TAP1 + 5, TAP1 + 12], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tap1Ripple = interpolate(frame, [TAP1, TAP1 + 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const installGlow = interpolate(
    frame,
    [TAP1 - 4, TAP1 + 4, TAP1 + 14, TAP1 + 34],
    [0, 1, 1, 0.35],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const tap2X = 316;
  const tap2Y = 424;
  const tap2Progress = interpolate(frame, [TAP2, TAP2 + 5, TAP2 + 12], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tap2Ripple = interpolate(frame, [TAP2, TAP2 + 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const notifGlow = interpolate(
    frame,
    [TAP2 - 4, TAP2 + 4, TAP2 + 14, TAP2 + 34],
    [0, 1, 1, 0.35],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const notifOn = interpolate(frame, [TAP2 + 2, TAP2 + 9], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2)),
  });

  const fingerVisible = frame >= TAP1 - 8 && frame < TAP2 + 14;
  const fingerX = interpolate(
    frame,
    [TAP1 - 8, TAP1, TAP1 + 16, TAP2],
    [tap1X, tap1X, tap2X, tap2X],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const fingerY = interpolate(
    frame,
    [TAP1 - 8, TAP1, TAP1 + 16, TAP2],
    [tap1Y, tap1Y, tap2Y, tap2Y],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const fingerOpacity = interpolate(
    frame,
    [TAP1 - 8, TAP1 - 3, TAP2 + 10, TAP2 + 16],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const pressed = Math.max(tap1Progress, tap2Progress);

  const shake1 = punch(frame, TAP1, 9, 9);
  const shake2 = punch(frame, TAP2, 11, 10);
  const shakeX = shake1.x + shake2.x;
  const shakeScale = Math.max(shake1.scale, shake2.scale);

  const sceneOutOpacity = interpolate(frame, [95, 104], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sceneOutScale = interpolate(frame, [95, 104], [1, 0.9], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        opacity: Math.min(phoneOpacity, sceneOutOpacity),
      }}
    >
      <div
        style={{
          transform: `translateY(${phoneY}px) rotate(${phoneRotate}deg) scale(${
            phoneScale * shakeScale * sceneOutScale
          }) translateX(${shakeX}px)`,
          position: "relative",
        }}
      >
        <PhoneFrame>
          <SettingsMock
            installGlow={installGlow}
            notifGlow={notifGlow}
            notifOn={notifOn}
          />
          <TapRipple progress={tap1Ripple} x={tap1X} y={tap1Y} />
          <TapRipple progress={tap2Ripple} x={tap2X} y={tap2Y} />
          {fingerVisible && (
            <div style={{ opacity: fingerOpacity }}>
              <FingerTap x={fingerX} y={fingerY} pressed={pressed} />
            </div>
          )}
        </PhoneFrame>
      </div>
      <Caption frame={frame} from={TAP1 - 10}>
        1. Ajoute l'app à l'écran d'accueil
      </Caption>
      <Caption frame={frame} from={TAP2 - 10}>
        2. Active les notifications
      </Caption>
    </AbsoluteFill>
  );
};

// ---- Scene 3: BoxMail payoff ----
const BoxMailScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 11, stiffness: 200, mass: 0.7 },
    durationInFrames: 14,
  });
  const phoneOpacity = interpolate(frame, [0, 7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phoneScale = interpolate(enter, [0, 1], [0.78, 1]);
  const phoneY = interpolate(enter, [0, 1], [80, 0]);

  const ARRIVE = 14;
  const newMsgProgress = interpolate(frame, [ARRIVE, ARRIVE + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2.2)),
  });
  const pulse = interpolate(
    frame,
    [ARRIVE, ARRIVE + 12, ARRIVE + 34, ARRIVE + 46],
    [0, 1, 1, 0.3],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const shake = punch(frame, ARRIVE + 10, 14, 12);

  const captionOpacity = interpolate(frame, [ARRIVE + 2, ARRIVE + 10, 74, 84], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const captionY = interpolate(frame, [ARRIVE + 2, ARRIVE + 10], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const sceneOutOpacity = interpolate(frame, [80, 90], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sceneOutScale = interpolate(frame, [80, 90], [1, 0.9], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        opacity: Math.min(phoneOpacity, sceneOutOpacity),
      }}
    >
      <div
        style={{
          transform: `translateY(${phoneY}px) scale(${
            phoneScale * shake.scale * sceneOutScale
          }) translateX(${shake.x}px)`,
        }}
      >
        <PhoneFrame>
          <BoxMailMock newMsgProgress={newMsgProgress} pulse={pulse} />
        </PhoneFrame>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 90,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: captionOpacity,
          transform: `translateY(${captionY}px)`,
          fontFamily: "Poppins, sans-serif",
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "14px 30px",
            borderRadius: 999,
            background: "rgba(12,5,24,0.8)",
            border: `1px solid ${COLORS.warm1}88`,
            color: COLORS.metal2,
            fontSize: 28,
            fontWeight: 700,
            boxShadow: "0 10px 40px rgba(0,0,0,0.55), 0 0 30px rgba(191,90,242,0.25)",
          }}
        >
          3. Reçois tes BoxMails direct
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---- Scene 4: Outro ----
const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 9, stiffness: 260, mass: 0.65 },
  });
  const scale = interpolate(logoSpring, [0, 1], [0.2, 1]);
  const rotate = interpolate(logoSpring, [0, 1], [180, 0]);
  const pulse = 1 + Math.sin(frame / 5) * 0.03;

  const line1Spring = spring({
    frame: frame - 6,
    fps,
    config: { damping: 10, stiffness: 260, mass: 0.6 },
  });
  const line1Opacity = interpolate(line1Spring, [0, 1], [0, 1]);
  const line1Y = interpolate(line1Spring, [0, 1], [26, 0]);

  const line2Opacity = interpolate(frame, [16, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(frame, [42, 54], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOut,
      }}
    >
      <Img
        src={staticFile("zenoa-icon.png")}
        style={{
          width: 120,
          height: 120,
          transform: `scale(${scale * pulse}) rotate(${rotate}deg)`,
          filter: "drop-shadow(0 0 34px rgba(191,90,242,0.6))",
        }}
      />
      <div
        style={{
          marginTop: 26,
          fontSize: 38,
          fontWeight: 800,
          color: COLORS.metal2,
          fontFamily: "Poppins, sans-serif",
          textAlign: "center",
          opacity: line1Opacity,
          transform: `translateY(${line1Y}px)`,
        }}
      >
        Ne rate rien.
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 21,
          color: COLORS.warm2,
          fontFamily: "Poppins, sans-serif",
          textAlign: "center",
          opacity: line2Opacity,
        }}
      >
        ZENOA — Paramètres → Écran d'accueil → Notifications
      </div>
    </AbsoluteFill>
  );
};

export const PromoVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Backdrop />
      <Sequence from={0} durationInFrames={40}>
        <IntroScene />
      </Sequence>
      <Sequence from={40} durationInFrames={82}>
        <AppShellScene />
      </Sequence>
      <Sequence from={122} durationInFrames={108}>
        <SettingsScene />
      </Sequence>
      <Sequence from={230} durationInFrames={92}>
        <BoxMailScene />
      </Sequence>
      <Sequence from={322} durationInFrames={56}>
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};
