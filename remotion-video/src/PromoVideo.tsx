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

const Backdrop: React.FC = () => (
  <AbsoluteFill
    style={{
      background: COLORS.bgDeep,
      backgroundImage: `radial-gradient(ellipse at 20% 25%, rgba(191,90,242,0.16), transparent 55%), radial-gradient(ellipse at 82% 75%, rgba(48,10,102,0.28), transparent 55%)`,
    }}
  />
);

const Caption: React.FC<{ children: React.ReactNode; opacity: number }> = ({
  children,
  opacity,
}) => (
  <div
    style={{
      position: "absolute",
      bottom: 90,
      left: 0,
      right: 0,
      textAlign: "center",
      opacity,
      fontFamily: "Poppins, sans-serif",
    }}
  >
    <div
      style={{
        display: "inline-block",
        padding: "14px 30px",
        borderRadius: 999,
        background: "rgba(12,5,24,0.75)",
        border: "1px solid rgba(191,90,242,0.35)",
        color: COLORS.metal2,
        fontSize: 26,
        fontWeight: 600,
        letterSpacing: "0.01em",
        boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
      }}
    >
      {children}
    </div>
  </div>
);

// ---- Scene 1: Intro ----
const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoScale = spring({ frame, fps, config: { damping: 14 } });
  const titleOpacity = interpolate(frame, [12, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [12, 28], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitOpacity = interpolate(frame, [45, 58], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        opacity: exitOpacity,
      }}
    >
      <Img
        src={staticFile("zenoa-icon.png")}
        style={{
          width: 140,
          height: 140,
          transform: `scale(${logoScale})`,
          filter: "drop-shadow(0 0 30px rgba(191,90,242,0.55))",
        }}
      />
      <div
        style={{
          marginTop: 34,
          fontSize: 40,
          fontWeight: 700,
          color: COLORS.metal2,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
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

  const enter = spring({ frame, fps, config: { damping: 16 }, durationInFrames: 20 });
  const phoneOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phoneScale = interpolate(enter, [0, 1], [0.92, 1]);

  // Tap 1: install tile, around frame 35-55
  const tap1X = 190;
  const tap1Y = 331;
  const tap1Progress = interpolate(frame, [35, 42, 50], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tap1Ripple = interpolate(frame, [35, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const installGlow = interpolate(
    frame,
    [30, 40, 50, 70],
    [0, 1, 1, 0.35],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Tap 2: notif switch, around frame 95-115
  const tap2X = 316;
  const tap2Y = 424;
  const tap2Progress = interpolate(frame, [95, 102, 110], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tap2Ripple = interpolate(frame, [95, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const notifGlow = interpolate(
    frame,
    [90, 100, 110, 130],
    [0, 1, 1, 0.35],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const notifOn = interpolate(frame, [98, 108], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const fingerVisible = frame >= 30 && frame < 118;
  const fingerX = interpolate(frame, [30, 40, 85, 100], [tap1X, tap1X, tap2X, tap2X], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fingerY = interpolate(frame, [30, 40, 85, 100], [tap1Y, tap1Y, tap2Y, tap2Y], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fingerOpacity = interpolate(
    frame,
    [26, 32, 116, 124],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const pressed = Math.max(tap1Progress, tap2Progress);

  const caption1Opacity = interpolate(frame, [22, 30, 68, 78], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const caption2Opacity = interpolate(frame, [82, 90, 128, 140], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const sceneOutOpacity = interpolate(frame, [140, 150], [1, 0], {
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
      <div style={{ transform: `scale(${phoneScale})`, position: "relative" }}>
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
      <Caption opacity={caption1Opacity}>
        1. Ajoute l'app à l'écran d'accueil
      </Caption>
      <Caption opacity={caption2Opacity}>2. Active les notifications</Caption>
    </AbsoluteFill>
  );
};

// ---- Scene 3: BoxMail payoff ----
const BoxMailScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 16 }, durationInFrames: 18 });
  const phoneOpacity = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phoneScale = interpolate(enter, [0, 1], [0.92, 1]);

  const newMsgProgress = interpolate(frame, [20, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.6)),
  });
  const pulse = interpolate(
    frame,
    [20, 34, 50, 65],
    [0, 1, 1, 0.3],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const captionOpacity = interpolate(frame, [30, 40, 78, 90], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const sceneOutOpacity = interpolate(frame, [88, 98], [1, 0], {
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
      <div style={{ transform: `scale(${phoneScale})` }}>
        <PhoneFrame>
          <BoxMailMock newMsgProgress={newMsgProgress} pulse={pulse} />
        </PhoneFrame>
      </div>
      <Caption opacity={captionOpacity}>
        3. Reçois tes BoxMails direct
      </Caption>
    </AbsoluteFill>
  );
};

// ---- Scene 4: Outro ----
const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 14 } });
  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [58, 70], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        opacity: Math.min(opacity, fadeOut),
      }}
    >
      <Img
        src={staticFile("zenoa-icon.png")}
        style={{
          width: 110,
          height: 110,
          transform: `scale(${scale})`,
          filter: "drop-shadow(0 0 26px rgba(191,90,242,0.55))",
        }}
      />
      <div
        style={{
          marginTop: 28,
          fontSize: 34,
          fontWeight: 700,
          color: COLORS.metal2,
          fontFamily: "Poppins, sans-serif",
          textAlign: "center",
        }}
      >
        Ne rate plus rien.
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 20,
          color: COLORS.warm2,
          fontFamily: "Poppins, sans-serif",
          textAlign: "center",
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
      <Sequence from={0} durationInFrames={62}>
        <IntroScene />
      </Sequence>
      <Sequence from={62} durationInFrames={152}>
        <SettingsScene />
      </Sequence>
      <Sequence from={214} durationInFrames={100}>
        <BoxMailScene />
      </Sequence>
      <Sequence from={312} durationInFrames={70}>
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};
