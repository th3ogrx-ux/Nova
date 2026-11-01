import "./index.css";
import { MyComposition } from "./Composition";
import { Composition } from "remotion";
import { FPS, RUSH_DURATION, RushVideo } from "./rush/RushVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <Composition
        id="Rush"
        component={RushVideo}
        durationInFrames={RUSH_DURATION}
        fps={FPS}
        width={1080}
        height={1920}
      />
    </>
  );
};
