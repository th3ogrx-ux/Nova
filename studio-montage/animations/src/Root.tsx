import React from "react";
import { Composition } from "remotion";
import { Montage } from "./Montage";
import type { MontageProps } from "./types";
import textes from "../textes.json";

const defaut: MontageProps = {
  mode: "carte",
  fond: "blanc",
  base: null,
  camera: null,
  ratio: 16 / 9,
  cadrage: 0.5,
  dureeSecondes: 12,
  textes: textes as MontageProps["textes"],
  mots: [],
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Montage"
    component={Montage}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={360}
    defaultProps={defaut}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(1, Math.round(props.dureeSecondes * 30)),
    })}
  />
);
