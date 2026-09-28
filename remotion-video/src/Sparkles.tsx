import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { COLORS } from "./PhoneFrame";

type Dot = { x: number; y: number; size: number; speed: number; phase: number };

export const Sparkles: React.FC<{ count?: number }> = ({ count = 34 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const dots = useMemo<Dot[]>(() => {
    let seed = 42;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return new Array(count).fill(0).map(() => ({
      x: rand() * width,
      y: rand() * height,
      size: 2 + rand() * 4,
      speed: 0.4 + rand() * 0.9,
      phase: rand() * Math.PI * 2,
    }));
  }, [count, width, height]);

  return (
    <>
      {dots.map((d, i) => {
        const y = ((d.y - frame * d.speed) % (height + 40) + height + 40) % (height + 40);
        const twinkle = Math.sin(frame / 10 + d.phase) * 0.5 + 0.5;
        const opacity = interpolate(twinkle, [0, 1], [0.08, 0.55]);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: d.x,
              top: y - 20,
              width: d.size,
              height: d.size,
              borderRadius: "50%",
              background: COLORS.warm2,
              opacity,
              boxShadow: `0 0 ${d.size * 3}px ${COLORS.warm1}`,
            }}
          />
        );
      })}
    </>
  );
};
