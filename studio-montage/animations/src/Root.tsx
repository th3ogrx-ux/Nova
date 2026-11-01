import React from "react";
import { Composition } from "remotion";
import { Montage } from "./Montage";
import type { Config, MontageProps, Scene } from "./types";
import config from "../../config.json";
import scenes from "../../scenes.json";

const defaut: MontageProps = {
  config: config as Config,
  scenes: scenes.scenes as Scene[],
  mots: [],
  dureeSecondes: 16,
  personne: null,
  audio: null,
  cadrePhoto: null,
  mesures: { hautTete: 0.25, largeur: 720, hauteur: 1280 },
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Montage"
    component={Montage}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={480}
    defaultProps={defaut}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(1, Math.round(props.dureeSecondes * 30)),
    })}
  />
);
