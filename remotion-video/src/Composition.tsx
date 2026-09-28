import { Composition } from "remotion";
import { PromoVideo } from "./PromoVideo";

export const MyComposition = () => {
  return (
    <Composition
      id="ZenoaSetupPromo"
      component={PromoVideo}
      durationInFrames={454}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
