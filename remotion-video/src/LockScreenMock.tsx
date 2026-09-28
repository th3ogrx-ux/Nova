import React from "react";
import { Img, staticFile } from "remotion";
import { COLORS } from "./PhoneFrame";

export const LockScreenMock: React.FC<{
  screenOpacity: number;
  bannerTranslateY: number;
  bannerOpacity: number;
  bannerScale: number;
  glow: number;
}> = ({ screenOpacity, bannerTranslateY, bannerOpacity, bannerScale, glow }) => {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        opacity: screenOpacity,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 15%, rgba(191,90,242,0.2), transparent 55%), ${COLORS.bgDeep}`,
        }}
      />

      <div style={{ position: "absolute", top: 86, left: 0, right: 0, textAlign: "center" }}>
        <div
          style={{
            fontSize: 62,
            fontWeight: 200,
            color: COLORS.metal2,
            fontFamily: "Poppins, sans-serif",
            letterSpacing: "0.02em",
          }}
        >
          09:41
        </div>
        <div
          style={{
            fontSize: 13,
            color: COLORS.textDim,
            marginTop: 4,
            fontFamily: "Poppins, sans-serif",
          }}
        >
          Lundi 28 septembre
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 220,
          left: 16,
          right: 16,
          transform: `translateY(${bannerTranslateY}px) scale(${bannerScale})`,
          opacity: bannerOpacity,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            padding: "14px 16px",
            borderRadius: 18,
            background: "rgba(18,10,30,0.88)",
            border: `1px solid rgba(191,90,242,${0.32 + glow * 0.45})`,
            boxShadow: `0 14px 40px rgba(0,0,0,0.55), 0 0 ${18 + glow * 22}px rgba(191,90,242,${
              0.22 + glow * 0.4
            })`,
          }}
        >
          <Img
            src={staticFile("zenoa-icon.png")}
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              flexShrink: 0,
              background: "#04010a",
              padding: 4,
              boxSizing: "border-box",
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                color: COLORS.textDim,
                fontFamily: "Poppins, sans-serif",
                marginBottom: 3,
                letterSpacing: "0.04em",
              }}
            >
              <span>ZENOA</span>
              <span>à l'instant</span>
            </div>
            <div
              style={{
                fontSize: 14.5,
                fontWeight: 700,
                color: COLORS.metal2,
                fontFamily: "Poppins, sans-serif",
                marginBottom: 2,
              }}
            >
              Nouveau BoxMail
            </div>
            <div
              style={{
                fontSize: 13,
                color: COLORS.textMid,
                fontFamily: "Poppins, sans-serif",
              }}
            >
              Nouveau message de Lucas Martin
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
