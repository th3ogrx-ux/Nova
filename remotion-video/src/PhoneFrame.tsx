import React from "react";

export const COLORS = {
  bgDeep: "#04010a",
  bgPanel: "#0c0518",
  warm1: "#bf5af2",
  warm2: "#e0b3ff",
  cool1: "#300a66",
  cool2: "#7c3aed",
  metal1: "#c7c2db",
  metal2: "#f1eefb",
  textDim: "#8a84a0",
  textMid: "#bdb6d4",
};

export const PhoneFrame: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <div
      style={{
        width: 380,
        height: 780,
        borderRadius: 46,
        background: "#0a0612",
        border: "8px solid #17101f",
        boxShadow:
          "0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(191,90,242,0.15), 0 0 90px rgba(191,90,242,0.12)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* notch */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 150,
          height: 26,
          background: "#0a0612",
          borderBottomLeftRadius: 18,
          borderBottomRightRadius: 18,
          zIndex: 20,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: COLORS.bgDeep,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
};
