import React from "react";
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import type { Caption } from "@remotion/captions";
import timeline from "./timeline.json";
import captionsJson from "./captions.json";
import { Captions } from "./Captions";
import { CTA, ErrorCard, ThreeHooks, WinnerCard } from "./Overlays";
import { ICE } from "./theme";

export const FPS = 30;
const f = (s: number) => Math.round(s * FPS);

const segs = timeline.segments.map((s, i, a) => ({
  ...s,
  from: f(s.outStart),
  dur: (a[i + 1] ? f(a[i + 1].outStart) : f(timeline.duration)) - f(s.outStart),
  srcFrom: f(s.start),
}));
export const RUSH_DURATION = f(timeline.duration);

/** Frame de début d'un mot (n-ième occurrence), d'après les timings des sous-titres. */
const wordFrame = (word: string, occurrence = 0) => {
  const hits = (captionsJson as Caption[]).filter(
    (c) => c.text.trim().toLowerCase().replace(/[.,!?]/g, "") === word,
  );
  return f((hits[occurrence]?.startMs ?? 0) / 1000);
};

/** Zoom par segment : alternance push-in / pull-out + petit « punch » à chaque coupe. */
const Zoom: React.FC<{ i: number; dur: number; children: React.ReactNode }> = ({
  i,
  dur,
  children,
}) => {
  const frame = useCurrentFrame();
  const base =
    i % 2 === 0
      ? interpolate(frame, [0, dur], [1.04, 1.14], { extrapolateRight: "clamp" })
      : interpolate(frame, [0, dur], [1.16, 1.06], { extrapolateRight: "clamp" });
  const punch = interpolate(frame, [0, 5], [0.05, 0], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ transform: `scale(${base + punch})` }}>
      {children}
    </AbsoluteFill>
  );
};

export const RushVideo: React.FC = () => {
  const ctaFrom = wordFrame("commente");
  const errorFrom = wordFrame("grosse");
  const numbersFrom = wordFrame("trois");
  const winnerFrom = wordFrame("passer") - 4;
  return (
    <AbsoluteFill style={{ background: "#031a12" }}>
      {segs.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.dur} premountFor={15}>
          <Zoom i={i} dur={s.dur}>
            <OffthreadVideo
              src={staticFile("rush/rush.mp4")}
              startFrom={s.srcFrom}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Zoom>
        </Sequence>
      ))}

      {/* voile vert glace léger + vignette pour la lisibilité */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 40%, transparent 45%, rgba(2,30,20,0.55) 100%), linear-gradient(180deg, ${ICE.glow.replace("0.55", "0.10")}, transparent 30%)`,
          pointerEvents: "none",
        }}
      />

      <ErrorCard from={errorFrom} to={errorFrom + 24} />
      <ThreeHooks from={numbersFrom} to={numbersFrom + 42} />
      <WinnerCard from={winnerFrom} to={winnerFrom + 50} />
      <CTA from={ctaFrom} to={RUSH_DURATION} />
      <Captions captions={captionsJson as Caption[]} />
    </AbsoluteFill>
  );
};
